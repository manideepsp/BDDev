import logging
from utils import extract_json, pain_point_titles

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a senior B2B engagement consultant with a track record of closing enterprise deals. "
    "You write POC plans that are credible, specific, and immediately actionable — "
    "not consulting boilerplate. Every field must be grounded in the provided context. "
    "If you cannot make a specific claim, make a testable hypothesis instead. "
    "Never use corporate filler like 'leverage synergies' or 'drive value'."
)


class POCPlanAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, prospect: dict, intelligence: dict, user_description: str, company_name: str) -> dict:
        pains = pain_point_titles(intelligence, limit=3)
        opportunities = (intelligence.get("bd_opportunities") or [])[:3]
        approach = intelligence.get("recommended_approach", "")
        icp = intelligence.get("icp_score") or {}

        user = f"""Design a proof-of-concept engagement plan for a specific prospect.

TARGET
  Person: {prospect.get('name', 'Unknown')} ({prospect.get('title', '')})
  Company: {company_name}
  Contact angle: {prospect.get('contact_angle', '')}

SELLER OFFERING
  {user_description}

INTELLIGENCE
  Top pain points: {'; '.join(pains) if pains else 'not specified'}
  BD opportunities: {'; '.join(opportunities) if opportunities else 'not specified'}
  Recommended approach: {approach}
  ICP recommended action: {icp.get('recommended_action', '')}
  Best entry point: {icp.get('best_entry_point', '')}
  Suggested deal size: {icp.get('suggested_deal_size', '')}

CONSTRAINTS
- The POC must be completable in 2–6 weeks
- Value proposition must be specific to this prospect's role and pain
- Success metrics must be measurable (numbers, percentages, or binary outcomes)
- Talking points should be openers or questions, not feature lists
- Risks must be real objections this prospect is likely to raise

Return ONLY this JSON:
{{
  "objective": "One sentence: what we prove in this POC and for whom",
  "approach": "3–4 sentences: how we run the engagement — who's involved, what we show, how we measure",
  "timeline": "e.g. '2-week pilot with a defined scope and a go/no-go checkpoint at day 10'",
  "value_proposition": "Specific outcome this prospect personally cares about, framed in their terms",
  "success_metrics": [
    "Metric 1 (measurable)",
    "Metric 2 (measurable)",
    "Metric 3 (measurable)"
  ],
  "talking_points": [
    "Opening question or observation that earns attention",
    "Key insight that reframes their current approach",
    "Differentiation point vs. how they're likely solving this today"
  ],
  "risks": [
    "Most likely objection and how to pre-empt it",
    "Second most likely concern"
  ]
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1400,
                temperature=0.25,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": user},
                ],
            )
            return extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"POCPlanAgent failed: {e}")
            raise
