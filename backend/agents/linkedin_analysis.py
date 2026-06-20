"""LinkedInAnalysisAgent — timeline intelligence + post ideas from fetched company posts."""
import json
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

_HOOK_PATTERNS = ["question", "stat", "story", "contrarian", "bold_claim"]


class LinkedInAnalysisAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, own_company: str, fetched_posts: list[dict]) -> dict:
        if not fetched_posts:
            return {
                "timeline_summary": "No posts fetched yet. Add target companies and click Fetch & Analyse.",
                "own_cadence": "Unknown",
                "content_themes": [],
                "competitor_angles": [],
                "content_gaps": [],
                "best_day_guess": "Unknown",
                "hook_swipe_file": [],
                "post_ideas": [],
                "error": None,
            }

        # Build context block grouped by company
        by_company: dict[str, list[dict]] = {}
        for p in fetched_posts:
            cn = p.get("company_name", "Unknown")
            by_company.setdefault(cn, []).append(p)

        context_lines = [f"TODAY: {datetime.now().strftime('%B %Y')}", ""]
        for company, posts in by_company.items():
            source_tag = "(YOUR COMPANY)" if posts[0].get("source_type") == "own" else "(COMPETITOR)"
            context_lines.append(f"=== {company} {source_tag} ===")
            for p in posts[:10]:
                date = p.get("published_date", "") or ""
                title = p.get("title", "") or ""
                content = (p.get("content", "") or "")[:250]
                snippet = title if title else content[:120]
                context_lines.append(f"  [{date or 'recent'}] {snippet}")
            context_lines.append("")

        context = "\n".join(context_lines)

        prompt = f"""You are a LinkedIn content strategist analysing a B2B company's content landscape.

OWN COMPANY: {own_company}

FETCHED POSTS (last 3 months):
{context}

Analyse the posting patterns across all companies. Then return ONLY this JSON:
{{
  "timeline_summary": "2-3 sentence overview of the content landscape — what's being said, what's missing, what patterns stand out",
  "own_cadence": "how often the own company posts (e.g. 'weekly', '2x/month', 'infrequent')",
  "content_themes": ["recurring theme 1", "recurring theme 2", "theme 3", "theme 4", "theme 5"],
  "competitor_angles": ["angle competitors use that own company hasn't covered", "angle 2", "angle 3"],
  "content_gaps": ["topic gap 1 — specific missing content type", "gap 2", "gap 3"],
  "best_day_guess": "best day to post based on patterns (e.g. 'Tuesday or Wednesday')",
  "hook_swipe_file": [
    {{
      "pattern": "stat|question|story|contrarian|bold_claim",
      "hook": "exact opening line from the fetched posts",
      "company": "which company used it",
      "why": "one sentence — why this hook works"
    }}
  ],
  "post_ideas": [
    {{
      "topic": "specific post topic",
      "angle": "contrarian|trend|story|how-to|data|opinion",
      "suggested_format": "short punchy take|story post|data observation|industry take|listicle",
      "rationale": "why this idea makes sense NOW based on timeline gaps",
      "hook": "suggested opening line for this post"
    }}
  ]
}}

Rules:
- hook_swipe_file: extract the 6 best real opening lines from the data, classify each pattern
- post_ideas: generate exactly 6 ideas that fill the identified gaps
- Be specific — no generic advice, reference actual signals from the data"""

        try:
            resp = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=2500,
                temperature=0.6,
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": prompt}],
            )
            data = json.loads(resp.choices[0].message.content)
            # Add ids to ideas
            for idea in data.get("post_ideas", []):
                if "id" not in idea:
                    idea["id"] = str(uuid.uuid4())
            data["error"] = None
            return data
        except Exception as e:
            logger.error(f"LinkedInAnalysisAgent failed: {e}")
            return {
                "timeline_summary": "Analysis failed — try again.",
                "own_cadence": "",
                "content_themes": [],
                "competitor_angles": [],
                "content_gaps": [],
                "best_day_guess": "",
                "hook_swipe_file": [],
                "post_ideas": [],
                "error": str(e),
            }
