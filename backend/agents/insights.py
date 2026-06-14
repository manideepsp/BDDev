import json, logging
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
            company_profile: dict | None = None, target_context: dict | None = None) -> dict:
        context_parts = []
        for page in website_data.get("pages", [])[:2]:
            context_parts.append(f"WEBSITE: {page.get('text','')[:600]}")
        if linkedin_data.get("company_info"):
            context_parts.append(f"LINKEDIN: {linkedin_data['company_info'][:400]}")
        for p in linkedin_data.get("people", []):
            context_parts.append(f"PERSON FOUND: {p.get('name','')} - {p.get('title','')}")
        for r in research_results.get("results", [])[:8]:
            context_parts.append(f"[{r['angle'].upper()}] {r['title']}: {r['snippet']}")
        context_parts.append(f"KEYWORDS: {json.dumps(keywords)}")
        context = "\n\n".join(context_parts)[:4000]

        target_context = target_context or {}
        target_block = ""
        if target_context.get("notes"):
            target_block += f"\nUSER NOTES ON TARGET: {target_context['notes']}"
        if target_context.get("deal_size"):
            target_block += f"\nTARGET DEAL SIZE BAND: {target_context['deal_size']}"

        prompt = f"""You are a world-class BD strategist for an IT services / software vendor. Synthesize the data below into a structured, EVIDENCE-FIRST intelligence report. Every pain point MUST be anchored to concrete evidence from the gathered data — never invent facts. If evidence is weak, lower the confidence. Identify specific prospects (people to pitch to).

COMPANY: {company_name}
USER'S OFFERING (free text): {user_description}{target_block}

{_profile_block(company_profile)}

GATHERED DATA:
{context}

Return ONLY this JSON:
{{
  "company_overview": {{
    "description": "2-3 sentence summary",
    "industry": "Primary industry",
    "size": "Estimated headcount/ARR",
    "founded": "Year or decade",
    "headquarters": "City, Country"
  }},
  "business_model": "How they make money",
  "tech_stack": {{
    "current": ["technologies/platforms they appear to use now"],
    "hiring": ["technologies implied by hiring / job signals, or empty"],
    "gaps": ["capabilities they appear to lack that the user could provide"]
  }},
  "pain_points": [
    {{
      "title": "Short pain point name",
      "severity": "high|medium|low",
      "evidence": ["concrete observation taken from the gathered data (quote a signal)"],
      "inference": "what this evidence implies about the company",
      "opportunity": "how the user's services specifically address this",
      "pitch_angle": "one-line angle to lead with",
      "confidence": "high|medium|low"
    }}
  ],
  "bd_opportunities": ["specific opportunity 1", "specific opportunity 2"],
  "recent_developments": ["recent event with timeframe"],
  "competitive_landscape": {{
    "main_competitors": ["name1", "name2", "name3"],
    "market_position": "leader/challenger/niche",
    "differentiators": "what sets them apart"
  }},
  "engagement_score": {{
    "score": <integer 1-100>,
    "reasoning": "why this score"
  }},
  "icp_score": {{
    "overall": <integer 1-100>,
    "breakdown": {{
      "industry_fit": <1-100>,
      "tech_alignment": <1-100>,
      "company_size": <1-100>,
      "pain_service_fit": <1-100>,
      "budget_probability": <1-100>,
      "decision_readiness": <1-100>
    }},
    "recommended_action": "PRIORITIZE / NURTURE / DEPRIORITIZE — one short clause why",
    "suggested_deal_size": "e.g. $300K-$600K / year",
    "best_entry_point": "the fastest-yes service or angle"
  }},
  "recommended_approach": "2-3 sentence BD strategy",
  "key_keywords": ["top 6 keywords representing this company context"],
  "prospects": [
    {{
      "id": "p1",
      "name": "Full Name or role description if name unknown",
      "title": "Job Title",
      "relevance": "why this person for BD",
      "contact_angle": "specific angle to use when pitching",
      "confidence": "high"
    }}
  ]
}}
Provide 3 pain points (each grounded in evidence) and 2-4 prospects. Score ICP factors honestly based on fit between the target and the user's profile. If no specific prospect names are found, infer likely personas based on the company type."""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=3500,
                messages=[{"role": "user", "content": prompt}],
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
