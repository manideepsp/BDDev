import json, logging
from datetime import datetime
from utils import extract_json

logger = logging.getLogger(__name__)


def _profile_block(profile: dict | None) -> str:
    if not profile:
        return "USER COMPANY PROFILE: (not provided — infer a generic IT services/vendor offering)"
    services = ", ".join(profile.get("services", []) or [])
    industries = ", ".join(profile.get("industries", []) or [])
    models = ", ".join(profile.get("engagement_models", []) or [])
    return (
        "USER COMPANY PROFILE (use this to ground every opportunity in what the user actually offers):\n"
        f"  Name: {profile.get('company_name','')} ({profile.get('company_type','')})\n"
        f"  Services: {services}\n"
        f"  Industries served: {industries}\n"
        f"  Technologies: {profile.get('technologies','')}\n"
        f"  Case studies: {profile.get('case_studies','')}\n"
        f"  USPs: {profile.get('usps','')}\n"
        f"  Engagement models: {models}"
    )


_ICP_FACTORS = (
    "industry_fit", "tech_alignment", "company_size",
    "pain_service_fit", "budget_probability", "decision_readiness",
)


def _coerce_score(value, default: int = 0) -> int:
    """Coerce an LLM-returned score into an int clamped to 0-100."""
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, n))


def _as_str_list(value) -> list:
    """Coerce a value into a list of non-empty strings."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value if v not in (None, "")]
    return [str(value)]


def _normalize_intelligence(intelligence: dict) -> dict:
    """Sanitize off-schema LLM output so the frontend and embeddings never break."""
    if not isinstance(intelligence, dict):
        intelligence = {}

    # pain_points must always be a list of well-formed objects
    raw_pains = intelligence.get("pain_points")
    pains = []
    for p in raw_pains if isinstance(raw_pains, list) else []:
        if isinstance(p, dict):
            pains.append({
                "title": str(p.get("title") or p.get("opportunity") or "Pain point"),
                "severity": str(p.get("severity") or "medium"),
                "evidence": _as_str_list(p.get("evidence")),
                "inference": str(p.get("inference") or ""),
                "opportunity": str(p.get("opportunity") or ""),
                "pitch_angle": str(p.get("pitch_angle") or ""),
                "confidence": str(p.get("confidence") or "medium"),
            })
        elif p:
            pains.append({
                "title": str(p), "severity": "medium", "evidence": [],
                "inference": "", "opportunity": "", "pitch_angle": "", "confidence": "low",
            })
    intelligence["pain_points"] = pains

    # tech_stack must always have the three array buckets
    raw_tech = intelligence.get("tech_stack")
    raw_tech = raw_tech if isinstance(raw_tech, dict) else {}
    intelligence["tech_stack"] = {
        "current": _as_str_list(raw_tech.get("current")),
        "hiring": _as_str_list(raw_tech.get("hiring")),
        "gaps": _as_str_list(raw_tech.get("gaps")),
    }

    # icp_score: overall + every breakdown factor coerced to a number
    raw_icp = intelligence.get("icp_score")
    raw_icp = raw_icp if isinstance(raw_icp, dict) else {}
    raw_breakdown = raw_icp.get("breakdown")
    raw_breakdown = raw_breakdown if isinstance(raw_breakdown, dict) else {}
    breakdown = {f: _coerce_score(raw_breakdown.get(f)) for f in _ICP_FACTORS}
    overall = raw_icp.get("overall")
    overall = _coerce_score(
        overall,
        default=round(sum(breakdown.values()) / len(breakdown)) if breakdown else 0,
    )
    intelligence["icp_score"] = {
        "overall": overall,
        "breakdown": breakdown,
        "recommended_action": str(raw_icp.get("recommended_action") or ""),
        "suggested_deal_size": str(raw_icp.get("suggested_deal_size") or ""),
        "best_entry_point": str(raw_icp.get("best_entry_point") or ""),
    }

    return intelligence


class InsightsAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, company_name: str, website_data: dict, linkedin_data: dict,
            keywords: dict, research_results: dict, user_description: str,
            company_profile: dict | None = None, target_context: dict | None = None,
            rag_context: str | None = None) -> dict:
        if rag_context:
            # RAG-grounded: retrieved chunks are the primary evidence, but always
            # include the people list explicitly so prospect identification works.
            context_parts = [f"RETRIEVED EVIDENCE (most relevant chunks across all sources):\n{rag_context}"]
            for p in linkedin_data.get("people", []) + research_results.get("people", []):
                context_parts.append(f"PERSON FOUND: {p.get('name','')} - {p.get('title','')}")
        else:
            context_parts = []
            for page in website_data.get("pages", [])[:2]:
                context_parts.append(f"WEBSITE: {page.get('text','')[:600]}")
            if linkedin_data.get("company_info"):
                context_parts.append(f"LINKEDIN PROFILE:\n{linkedin_data['company_info'][:1400]}")
            for p in linkedin_data.get("people", []):
                context_parts.append(f"PERSON FOUND: {p.get('name','')} - {p.get('title','')}")
            for r in research_results.get("results", [])[:8]:
                context_parts.append(f"[{r['angle'].upper()}] {r['title']}: {r['snippet']}")
            context_parts.append(f"KEYWORDS: {json.dumps(keywords)}")
        context = "\n\n".join(context_parts)[:6000]

        # Warn downstream when context is very thin — prevents hallucination
        data_quality = "rich" if len(context) > 1500 else ("sparse" if len(context) > 400 else "very sparse")
        if data_quality != "rich":
            context += f"\n\nDATA QUALITY WARNING: Context is {data_quality} ({len(context)} chars). " \
                       "Score ICP conservatively. Use low confidence on all pain points. " \
                       "State 'Unknown' for any field not supported by evidence."

        target_context = target_context or {}
        target_block = ""
        if target_context.get("notes"):
            target_block += f"\nUSER NOTES ON TARGET: {target_context['notes']}"
        if target_context.get("human_input"):
            target_block += f"\nHUMAN REVIEWER INPUT (high priority — incorporate this): {target_context['human_input']}"
        if target_context.get("deal_size"):
            target_block += f"\nTARGET DEAL SIZE BAND: {target_context['deal_size']}"

        today = datetime.now().strftime("%Y-%m-%d")

        system = (
            "You are a world-class B2B intelligence analyst and BD strategist. "
            "You synthesize raw, imperfect scraped data into an evidence-first intelligence report. "
            "Your cardinal rule: every pain point, every claim, every score must be traceable to "
            "something in the provided data. If the data is thin, you say so explicitly through "
            "lower confidence scores and hedged language — you never hallucinate specifics. "
            "ICP scores must reflect the actual fit between the target company and the seller's "
            "profile, not aspirational numbers. A score of 50 is honest; 95 is a red flag."
        )

        user = f"""Synthesize the gathered data below into a structured BD intelligence report.

ANALYSIS DATE: {today} — judge recency of events against this date.
TARGET COMPANY: {company_name}
SELLER OFFERING: {user_description}{target_block}

{_profile_block(company_profile)}

GATHERED DATA:
{context}

Return ONLY this JSON — no markdown, no commentary:
{{
  "company_overview": {{
    "description": "2–3 sentences grounded in what the data actually shows",
    "industry": "Primary industry vertical",
    "size": "Headcount or ARR estimate — say 'Unknown' if not in data",
    "founded": "Year or decade — say 'Unknown' if not in data",
    "headquarters": "City, Country — say 'Unknown' if not in data"
  }},
  "business_model": "How they make money — be specific, avoid 'they provide solutions'",
  "tech_stack": {{
    "current": ["technologies/platforms they demonstrably use now"],
    "hiring": ["technologies implied by job postings or hiring signals — empty if none found"],
    "gaps": ["capabilities the data suggests they lack that the seller could address"]
  }},
  "pain_points": [
    {{
      "title": "Short, specific pain point name",
      "severity": "high | medium | low",
      "evidence": ["Direct quote or paraphrase from the gathered data that supports this pain"],
      "inference": "What the evidence implies about underlying business pressure",
      "opportunity": "How the seller's specific services address this — not generic",
      "pitch_angle": "One line: how to lead with this pain in a cold email or call opener",
      "confidence": "high | medium | low — based on evidence quality, not wishful thinking"
    }}
  ],
  "bd_opportunities": [
    "Specific, time-anchored opportunity (e.g. 'Expanding into APAC — needs localisation tooling')"
  ],
  "recent_developments": [
    "Recent event with timeframe — only include if supported by gathered data"
  ],
  "competitive_landscape": {{
    "main_competitors": ["name1", "name2"],
    "market_position": "leader | challenger | niche | unknown",
    "differentiators": "What sets them apart — or 'unclear from available data'"
  }},
  "engagement_score": {{
    "score": "<integer 1-100 — weight: pain fit 40%, timing 30%, access 30%>",
    "reasoning": "2–3 sentences explaining the score with reference to specific signals"
  }},
  "icp_score": {{
    "overall": "<integer 1-100 — average of breakdown, not inflated>",
    "breakdown": {{
      "industry_fit": "<1-100>",
      "tech_alignment": "<1-100>",
      "company_size": "<1-100>",
      "pain_service_fit": "<1-100>",
      "budget_probability": "<1-100>",
      "decision_readiness": "<1-100>"
    }},
    "recommended_action": "PRIORITIZE | NURTURE | DEPRIORITIZE — one clause of specific reasoning",
    "suggested_deal_size": "e.g. '$100K–$300K / year' or 'Unknown'",
    "best_entry_point": "The fastest-yes service angle or entry point for this specific company"
  }},
  "recommended_approach": "2–3 sentences of specific BD strategy — not generic advice",
  "key_keywords": ["6 keywords that best represent this company's context for RAG retrieval"],
  "prospects": [
    {{
      "id": "p1",
      "name": "Full Name if found — otherwise describe the role ('Head of Engineering (name unknown)')",
      "title": "Job title",
      "relevance": "Why specifically this person for the seller's offering",
      "contact_angle": "Specific, personalised angle to lead with — reference a real signal",
      "confidence": "high | medium | low"
    }}
  ]
}}

Provide exactly 3 pain points and 2–4 prospects. Score ICP factors against the seller's actual profile, not against an ideal customer in the abstract. If data is sparse on any dimension, score conservatively."""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=4000,
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            intelligence = extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"InsightsAgent LLM failed: {e}")
            raise

        intelligence = _normalize_intelligence(intelligence)

        # Attach real sources
        sources = [{"title": r["title"], "url": r["url"]}
                   for r in research_results.get("results", []) if r.get("url")]
        intelligence["sources"] = sources[:8]
        intelligence["grounded"] = len(sources) > 0

        # Ensure prospects have unique IDs
        for i, p in enumerate(intelligence.get("prospects", [])):
            if not p.get("id") or p["id"] == f"p{i+1}":
                p["id"] = f"p{i+1}"

        return intelligence
