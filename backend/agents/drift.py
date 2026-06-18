"""
DriftDetectorAgent

Re-checks a previously analyzed company for meaningful changes since the last
analysis: funding rounds, leadership changes, product launches, headcount shifts,
news events. Returns a structured diff that can be shown to the user as an alert.
"""
import os, logging
from datetime import datetime

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a B2B intelligence analyst specializing in monitoring company changes. "
    "You compare new signals against previous intelligence to surface ONLY meaningful "
    "changes — not noise. Be specific and evidence-based. If a claim cannot be supported "
    "by the new signals, do not include it. Output must be grounded in what changed, not "
    "a restatement of stable facts."
)


def _search_new_signals(company_name: str, last_analyzed: str, company_url: str | None) -> list[dict]:
    """Run targeted searches for recent company signals."""
    now = datetime.now()
    year = now.year
    queries = [
        f'"{company_name}" funding OR "Series" OR acquisition {year}',
        f'"{company_name}" leadership OR "new CEO" OR "new CTO" OR hired OR "joins as" {year}',
        f'"{company_name}" product launch OR partnership OR expansion {year}',
        f'"{company_name}" layoffs OR growth OR "headcount" {year}',
    ]
    results = []
    seen = set()
    tavily_key = os.getenv("TAVILY_API_KEY")
    for q in queries:
        try:
            if tavily_key:
                from tavily import TavilyClient
                r = TavilyClient(api_key=tavily_key).search(q, max_results=3, include_raw_content=False)
                for item in r.get("results", []):
                    url = item.get("url", "")
                    if url not in seen:
                        seen.add(url)
                        results.append({"title": item.get("title", ""), "url": url, "snippet": item.get("content", "")[:300]})
            else:
                from duckduckgo_search import DDGS
                for item in list(DDGS().text(q, max_results=3)):
                    url = item.get("href", "")
                    if url not in seen:
                        seen.add(url)
                        results.append({"title": item.get("title", ""), "url": url, "snippet": item.get("body", "")[:300]})
        except Exception as e:
            logger.debug(f"Drift search failed for '{q}': {e}")
    return results[:12]


class DriftDetectorAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, company_name: str, previous_intelligence: dict, last_analyzed: str,
            company_url: str | None = None) -> dict:
        """
        Compare new search signals against previous intelligence.
        Returns drift report: {"changes": [...], "alert_level": "high|medium|low|none",
                               "summary": str, "new_signals": [...]}
        """
        signals = _search_new_signals(company_name, last_analyzed, company_url)
        if not signals:
            return {
                "changes": [], "alert_level": "none",
                "summary": "No new signals found since last analysis.",
                "new_signals": [], "checked_at": datetime.now().isoformat(),
            }

        signals_block = "\n".join(
            f"[{i+1}] {s['title']}: {s['snippet']}" for i, s in enumerate(signals)
        )

        prev_overview = previous_intelligence.get("company_overview", {}).get("description", "")
        prev_pain_titles = [
            (p.get("title") if isinstance(p, dict) else str(p))
            for p in (previous_intelligence.get("pain_points") or [])[:3]
        ]
        prev_score = (previous_intelligence.get("engagement_score") or {}).get("score", "unknown")

        user = f"""Detect meaningful changes at {company_name} since their last analysis on {last_analyzed}.

PREVIOUS INTELLIGENCE SNAPSHOT:
  Description: {prev_overview}
  Top pain points: {'; '.join(prev_pain_titles)}
  Engagement score: {prev_score}/100

TODAY'S NEW SIGNALS ({len(signals)} results):
{signals_block}

TASK: Compare the new signals against the previous snapshot. Identify ONLY concrete changes:
- Funding, acquisition, or exit events
- C-suite or VP leadership changes
- Product launches or major pivots
- Significant headcount changes (hiring spree or layoffs)
- Partnerships or new market entries
- Any signal that meaningfully changes the BD opportunity

If nothing material changed, say so. Do not repeat stable facts from the previous analysis.

Return ONLY this JSON:
{{
  "changes": [
    {{
      "type": "funding | leadership | product | headcount | partnership | other",
      "title": "Short change description",
      "detail": "One sentence with specific evidence from the signals",
      "impact_on_bd": "How this changes the BD opportunity or urgency",
      "source_index": <1-based index into signals list>
    }}
  ],
  "alert_level": "high (act now) | medium (monitor) | low (FYI) | none (nothing changed)",
  "summary": "1-2 sentences: overall verdict on whether to reach out now vs. wait"
}}"""

        try:
            from utils import extract_json
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1200,
                temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": user},
                ],
            )
            result = extract_json(msg.choices[0].message.content)
            result["new_signals"] = signals
            result["checked_at"] = datetime.now().isoformat()
            return result
        except Exception as e:
            logger.error(f"DriftDetectorAgent failed for {company_name}: {e}")
            return {
                "changes": [], "alert_level": "none",
                "summary": f"Drift check failed: {e}",
                "new_signals": signals, "checked_at": datetime.now().isoformat(),
            }
