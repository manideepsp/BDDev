"""
LinkedInPostAgent

Generates a strategic batch of LinkedIn posts by synthesising:
  - All completed pipeline intelligence (pain points, industries, keywords)
  - All gathered company posts from those pipelines
  - Market trends summary from Qdrant (if available)
  - The user's company profile
  - Previously generated LinkedIn posts (to decide in-tune vs. contrarian strategy)
"""
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

STRATEGY_TYPES = [
    "trend_spotlight",
    "pain_narrative",
    "contrarian",
    "how_we_help",
    "industry_take",
    "case_signal",
]

# Strategy rotation logic: if last post was one of these, suggest alternatives
_STRATEGY_FOLLOWUPS = {
    "how_we_help": ["trend_spotlight", "pain_narrative", "contrarian"],
    "case_signal": ["trend_spotlight", "pain_narrative", "contrarian"],
    "contrarian": ["how_we_help", "industry_take", "trend_spotlight"],
    "trend_spotlight": ["pain_narrative", "contrarian", "industry_take"],
    "pain_narrative": ["how_we_help", "case_signal", "trend_spotlight"],
    "industry_take": ["pain_narrative", "contrarian", "how_we_help"],
}


def _build_company_profile_summary(company_profile: dict | None) -> str:
    if not company_profile:
        return "No company profile available."
    parts = []
    if company_profile.get("company_name"):
        parts.append(f"Company: {company_profile['company_name']}")
    if company_profile.get("company_type"):
        parts.append(f"Type: {company_profile['company_type']}")
    if company_profile.get("services"):
        parts.append(f"Services: {', '.join(company_profile['services'])}")
    if company_profile.get("industries"):
        parts.append(f"Industries served: {', '.join(company_profile['industries'])}")
    if company_profile.get("usps"):
        parts.append(f"Unique strengths: {company_profile['usps']}")
    if company_profile.get("case_studies"):
        parts.append(f"Case studies / proof: {company_profile['case_studies']}")
    return "\n".join(parts) if parts else "No company profile details available."


def _build_pipeline_context(pipeline_summaries: list[dict]) -> str:
    if not pipeline_summaries:
        return "No pipeline intelligence available."
    lines = []
    for i, ps in enumerate(pipeline_summaries, 1):
        lines.append(f"\n--- Company {i}: {ps.get('company_name', 'Unknown')} ({ps.get('industry', 'Unknown industry')}) ---")
        pain_points = ps.get("pain_points", [])
        if pain_points:
            lines.append(f"Pain points: {'; '.join(pain_points[:3])}")
        keywords = ps.get("key_keywords", [])
        if keywords:
            lines.append(f"Key keywords: {', '.join(keywords[:5])}")
        recent = ps.get("recent_developments", [])
        if recent:
            lines.append(f"Recent signals: {'; '.join(recent[:2])}")
        posts = ps.get("gathered_posts", [])
        if posts:
            post_titles = [p.get("title", "") for p in posts[:3] if p.get("title")]
            if post_titles:
                lines.append(f"Company content topics: {'; '.join(post_titles)}")
    return "\n".join(lines)


def _build_past_strategy_summary(past_posts: list[dict]) -> str:
    if not past_posts:
        return "No previous posts. Generate a balanced mix of all strategy types."
    recent = past_posts[:3]
    lines = ["Recent post strategies (most recent first):"]
    for p in recent:
        strategy = p.get("strategy", "unknown")
        cluster = p.get("trend_cluster", "")
        note = p.get("strategy_note", "")
        lines.append(f"  - {strategy} (cluster: {cluster}): {note}")

    last_strategy = recent[0].get("strategy", "") if recent else ""
    suggested = _STRATEGY_FOLLOWUPS.get(last_strategy, STRATEGY_TYPES)
    lines.append(f"\nSuggested next strategies for variety: {', '.join(suggested[:3])}")
    lines.append(
        "Use this to ensure the new batch varies from recent posts — "
        "mix in-tune and contrarian angles."
    )
    return "\n".join(lines)


class LinkedInPostAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(
        self,
        company_profile: dict | None,
        past_posts: list[dict],
        pipeline_summaries: list[dict],
        trends_summary: str,
    ) -> list[dict]:
        """Generate a batch of 5 LinkedIn posts using all available intelligence."""
        n = 5
        company_profile_summary = _build_company_profile_summary(company_profile)
        pipeline_context = _build_pipeline_context(pipeline_summaries)
        past_strategy_summary = _build_past_strategy_summary(past_posts)
        trends_block = trends_summary.strip() if trends_summary else "No market trends data available."

        n_companies = len(pipeline_summaries)

        prompt = f"""You are a LinkedIn content strategist for a B2B company. Generate {n} distinct LinkedIn posts.

COMPANY PROFILE:
{company_profile_summary}

MARKET INTELLIGENCE (distilled from {n_companies} researched companies):
{pipeline_context}

MARKET TRENDS:
{trends_block}

PREVIOUS POSTS STRATEGY (use this to decide variety):
{past_strategy_summary}

POST REQUIREMENTS:
- Each post must be under 1300 characters (LinkedIn sweet spot for reach)
- Write in first person, as a B2B practitioner voice — not corporate
- Mix of short punchy takes and slightly longer insight posts
- No hashtag spam (max 3 relevant hashtags per post, at the end)
- No exclamation marks
- Each post must feel distinct — different angle, different format

Available strategy types:
- trend_spotlight: Big-picture market observation based on clustered intelligence
- pain_narrative: Problem story using real signals from researched companies (anonymised or named)
- contrarian: Challenges conventional wisdom in the space
- how_we_help: Subtle positioning — what we do, shown through outcomes, not features
- industry_take: Topical observation about a specific vertical
- case_signal: A hint of a success story (not a full case study — a teaser)

Return ONLY this JSON (no other text):
{{"posts": [
  {{
    "content": "full post text including hashtags",
    "strategy": "trend_spotlight|pain_narrative|contrarian|how_we_help|industry_take|case_signal",
    "trend_cluster": "the theme or industry this targets",
    "strategy_note": "one sentence explaining why this strategy and whether it is in-tune or contrarian to recent posts"
  }}
]}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=3500,
                temperature=0.75,
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.choices[0].message.content
            import json
            data = json.loads(raw)
            posts_raw = data.get("posts", [])
            if not isinstance(posts_raw, list):
                logger.error("LinkedInPostAgent: LLM returned non-list posts")
                return []

            now = datetime.now().isoformat()
            result = []
            for p in posts_raw:
                if not isinstance(p, dict):
                    continue
                content = p.get("content", "")
                result.append({
                    "id": str(uuid.uuid4()),
                    "content": content,
                    "strategy": p.get("strategy", "trend_spotlight"),
                    "trend_cluster": p.get("trend_cluster", ""),
                    "strategy_note": p.get("strategy_note", ""),
                    "status": "draft",
                    "char_count": len(content),
                    "created_at": now,
                    "pipeline_ids": [],
                })
            return result

        except Exception as e:
            logger.error(f"LinkedInPostAgent failed: {e}")
            return []
