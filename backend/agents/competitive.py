"""
CompetitiveIntelligenceAgent

Given a target company and its existing intelligence, identify its top 3 competitors
and produce a structured competitive comparison: positioning, pricing signals,
tech approach, and BD gap analysis (where the seller can undercut or differentiate).
"""
import os, logging
from utils import extract_json

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a B2B competitive intelligence analyst. You compare companies through the lens of "
    "a specific seller's offering — not general market analysis. Your output must identify "
    "concrete gaps and vulnerabilities in the target's competitive position that the seller "
    "can exploit. Be specific, evidence-based, and avoid generic analysis."
)


def _search_competitors(company_name: str, industry: str) -> list[dict]:
    queries = [
        f'"{company_name}" competitors alternatives comparison {industry}',
        f'{company_name} vs alternative SaaS {industry} 2025',
        f'"{company_name}" competitor pricing OR alternative',
    ]
    results = []
    seen = set()
    tavily_key = os.getenv("TAVILY_API_KEY")
    for q in queries:
        try:
            if tavily_key:
                from tavily import TavilyClient
                r = TavilyClient(api_key=tavily_key).search(q, max_results=4)
                for item in r.get("results", []):
                    url = item.get("url", "")
                    if url not in seen:
                        seen.add(url)
                        results.append({"title": item.get("title", ""), "snippet": item.get("content", "")[:400]})
            else:
                from duckduckgo_search import DDGS
                for item in list(DDGS().text(q, max_results=4)):
                    url = item.get("href", "")
                    if url not in seen:
                        seen.add(url)
                        results.append({"title": item.get("title", ""), "snippet": item.get("body", "")[:400]})
        except Exception as e:
            logger.debug(f"Competitive search failed: {e}")
    return results[:10]


class CompetitiveIntelligenceAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, company_name: str, intelligence: dict, user_description: str) -> dict:
        industry = (intelligence.get("company_overview") or {}).get("industry", "")
        known_competitors = (intelligence.get("competitive_landscape") or {}).get("main_competitors", [])
        differentiators = (intelligence.get("competitive_landscape") or {}).get("differentiators", "")
        pain_titles = [
            (p.get("title") if isinstance(p, dict) else str(p))
            for p in (intelligence.get("pain_points") or [])[:3]
        ]

        search_results = _search_competitors(company_name, industry)
        signals_block = "\n".join(
            f"[{i+1}] {r['title']}: {r['snippet']}" for i, r in enumerate(search_results)
        ) if search_results else "No competitive signals found via search."

        user = f"""Analyse the competitive landscape for {company_name} and identify BD opportunities for the seller.

TARGET COMPANY: {company_name}
INDUSTRY: {industry}
KNOWN COMPETITORS (from previous analysis): {', '.join(known_competitors) if known_competitors else 'unknown'}
TARGET'S DIFFERENTIATORS: {differentiators}
TARGET'S PAIN POINTS: {'; '.join(pain_titles)}

SELLER OFFERING: {user_description}

COMPETITIVE SIGNALS FROM WEB:
{signals_block}

Produce a structured competitive analysis. For each competitor, assess:
1. How they position against the target
2. Pricing/model signals
3. Technical approach
4. Where the seller's offering creates a wedge (either the target uses competitor X and is unhappy, or the target IS a competitor to someone who needs the seller)

Return ONLY this JSON:
{{
  "competitors": [
    {{
      "name": "Competitor name",
      "positioning": "How they compete vs. {company_name}",
      "pricing_signal": "What we can infer about their pricing model",
      "tech_approach": "Their technical architecture or delivery model",
      "weakness": "Their key weakness that the seller can exploit",
      "bd_angle": "Specific pitch angle to use at {company_name} that references this competitive context"
    }}
  ],
  "market_position": "How {company_name} sits in the competitive landscape overall",
  "seller_wedge": "The single best competitive angle for the seller to use — references specific competitor pressure or gap",
  "displacement_risk": "high | medium | low — is {company_name} likely already being pitched by a competitor of the seller?",
  "recommended_talking_points": [
    "Competitive talking point 1",
    "Competitive talking point 2"
  ]
}}

Identify exactly 3 competitors. If fewer are known, infer likely competitors from the industry and signals."""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=2000,
                temperature=0.15,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": user},
                ],
            )
            result = extract_json(msg.choices[0].message.content)
            result["company_name"] = company_name
            result["search_signals"] = search_results
            return result
        except Exception as e:
            logger.error(f"CompetitiveIntelligenceAgent failed for {company_name}: {e}")
            raise
