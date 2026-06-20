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
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, n))


def _as_str_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value if v not in (None, "")]
    return [str(value)]


def _normalize_intelligence(intelligence: dict) -> dict:
    if not isinstance(intelligence, dict):
        intelligence = {}

    # pain_points — always a list of well-formed objects
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

    # tech_stack — three array buckets
    raw_tech = intelligence.get("tech_stack")
    raw_tech = raw_tech if isinstance(raw_tech, dict) else {}
    intelligence["tech_stack"] = {
        "current": _as_str_list(raw_tech.get("current")),
        "hiring": _as_str_list(raw_tech.get("hiring")),
        "gaps": _as_str_list(raw_tech.get("gaps")),
    }

    # icp_score — coerce all factors
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

    # urgency_trigger — normalize to a well-formed object
    raw_urgency = intelligence.get("urgency_trigger")
    if isinstance(raw_urgency, dict):
        intelligence["urgency_trigger"] = {
            "signal": str(raw_urgency.get("signal") or ""),
            "window": str(raw_urgency.get("window") or ""),
            "angle": str(raw_urgency.get("angle") or ""),
        }
    else:
        intelligence["urgency_trigger"] = {"signal": "", "window": "", "angle": ""}

    return intelligence


class InsightsAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, company_name: str, website_data: dict, linkedin_data: dict,
            keywords: dict, research_results: dict, user_description: str,
            company_profile: dict | None = None, target_context: dict | None = None,
            rag_context: str | None = None,
            crawl_data: dict | None = None) -> dict:

        if rag_context:
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

        # Always inject crawl findings for competitive/news context even in RAG mode
        if crawl_data:
            for finding in (crawl_data.get("findings") or [])[:12]:
                stype = finding.get("source_type", "web")
                context_parts.append(
                    f"[CRAWL/{stype.upper()}] {finding.get('title','')}: {finding.get('snippet','')[:300]}"
                )

        context = "\n\n".join(context_parts)[:6500]

        target_context = target_context or {}
        target_block = ""
        if target_context.get("notes"):
            target_block += f"\nUSER NOTES ON TARGET: {target_context['notes']}"
        if target_context.get("human_input"):
            target_block += f"\nHUMAN REVIEWER INPUT (high priority — incorporate this): {target_context['human_input']}"
        if target_context.get("deal_size"):
            target_block += f"\nTARGET DEAL SIZE BAND: {target_context['deal_size']}"

        today = datetime.now().strftime("%Y-%m-%d")
        prompt = f"""You are a world-class BD strategist for an IT services / software vendor. Synthesize the data below into a structured, EVIDENCE-FIRST intelligence report. Every pain point MUST be anchored to concrete evidence from the gathered data — never invent facts. If evidence is weak, lower the confidence. Identify specific prospects (people to pitch to).

TODAY'S DATE: {today} — use this to judge recency of information and events.

COMPANY: {company_name}
USER'S OFFERING (free text): {user_description}{target_block}

{_profile_block(company_profile)}

GATHERED DATA:
{context}

SPECIFICITY RULES — outputs that break these rules are useless to a BD rep and will be rejected:
1. BANNED PHRASES — never output any of these: "end-to-end solutions", "streamline operations", "business growth and resilience", "digital transformation", "proven track record", "extensive experience", "leverage our expertise", "best-in-class", "seamlessly", "holistic", "synergy", "empower", "state-of-the-art", "cutting-edge", "comprehensive solutions", "tailored solutions", "drive growth"
2. `pain_points[].title` — must name the SPECIFIC problem, not a category. BAD: "Technology Challenges". GOOD: "12 React roles unfilled 78+ days — delivery backlog building before Q3 deadline"
3. `pain_points[].evidence[]` — quote the ACTUAL signal verbatim (headline text, job count, post text, stat). BAD: "Company announced layoffs". GOOD: "LinkedIn headline: 'Acrisure to Cut 2,250 Employees, Citing Advances in Technology and AI'"
4. `pain_points[].opportunity` — MUST follow this format: "[specific service from user profile] + [concrete outcome tied to this company's evidence]". BAD: "Our digital solutions can help them improve efficiency". GOOD: "Staff augmentation with 3 React engineers fills the 12-role backlog before the Q3 deadline, based on their 78-day open req pattern"
5. `pain_points[].pitch_angle` — must use {company_name}'s name AND a specific evidence signal. Must be copy-paste ready for an email opener.
6. `urgency_trigger.angle` — must be a complete, ready-to-send one-line opener for an email or call. e.g. "Saw {company_name} cut 2,250 roles last quarter — suggests you're accelerating automation faster than your remaining team can absorb"
7. `icp_score.recommended_action` — must state the action (PRIORITIZE/NURTURE/DEPRIORITIZE) AND explain which scores drove it. e.g. "PRIORITIZE — pain_service_fit 88 and urgency signal is high, but budget_probability 54 means lead with a scoped audit rather than full engagement"
8. `icp_score.best_entry_point` — name the specific engagement type + service. BAD: "data analytics". GOOD: "2-week data quality audit scoped to their claims processing pipeline"

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
      "title": "Specific problem name using concrete evidence — NOT a category label",
      "severity": "high|medium|low",
      "evidence": ["VERBATIM signal from gathered data — quote the exact headline, job count, or post text"],
      "inference": "what this evidence specifically implies about {company_name}'s current situation",
      "opportunity": "[specific service from user profile] addresses [specific evidence signal] — include a concrete number or outcome",
      "pitch_angle": "{company_name} + evidence signal as a copy-paste ready email opener",
      "confidence": "high|medium|low"
    }}
  ],
  "bd_opportunities": ["specific opportunity with evidence basis", "second opportunity"],
  "recent_developments": ["recent event with timeframe and source"],
  "competitive_landscape": {{
    "main_competitors": ["only competitors found in gathered data — do NOT invent"],
    "market_position": "leader/challenger/niche — based on gathered evidence only",
    "differentiators": "what sets them apart based on gathered evidence"
  }},
  "urgency_trigger": {{
    "signal": "The single most time-sensitive signal from the data. Quote the source. Leave blank if nothing concrete found.",
    "window": "Why this quarter or next 90 days matters — based on the signal. e.g. 'New CTO hired 6 weeks ago — still evaluating vendors'.",
    "angle": "Complete one-line opener ready to paste into an email — uses company name + specific signal"
  }},
  "engagement_score": {{
    "score": <integer 1-100>,
    "reasoning": "specific reasons referencing the evidence signals"
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
    "recommended_action": "PRIORITIZE/NURTURE/DEPRIORITIZE — explain which scores drove the decision and what BD action follows",
    "suggested_deal_size": "e.g. $300K-$600K / year",
    "best_entry_point": "specific engagement type + named service based on their situation"
  }},
  "recommended_approach": "2-3 sentence BD strategy specific to {company_name}'s situation",
  "key_keywords": ["top 6 keywords representing this company's specific context"],
  "prospects": [
    {{
      "id": "p1",
      "name": "Full Name or role description if name unknown",
      "title": "Job Title",
      "relevance": "why this specific person for BD at {company_name}",
      "contact_angle": "specific angle tied to their role AND the evidence — not generic",
      "confidence": "high"
    }}
  ]
}}
Provide 3 pain points (each grounded in evidence) and 2-4 prospects. Score ICP factors honestly based on fit between the target and the user's profile. For competitive_landscape, ONLY name competitors mentioned in the gathered data — if none found, return an empty list."""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=3800,
                messages=[{"role": "user", "content": prompt}],
            )
            intelligence = extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"InsightsAgent LLM failed: {e}")
            raise

        intelligence = _normalize_intelligence(intelligence)

        sources = [{"title": r["title"], "url": r["url"]}
                   for r in research_results.get("results", []) if r.get("url")]
        intelligence["sources"] = sources[:8]
        intelligence["grounded"] = len(sources) > 0

        for i, p in enumerate(intelligence.get("prospects", [])):
            if not p.get("id") or p["id"] == f"p{i+1}":
                p["id"] = f"p{i+1}"

        return intelligence
