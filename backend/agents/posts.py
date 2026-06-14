"""LinkedInPostsAgent — best-effort recent activity/posts via web search.

LinkedIn's own post feed is walled for unauthenticated requests, so this agent
gathers the company's recent public activity (announcements, launches, updates,
indexed post snippets) through web search. Range is configurable by lookback
months and a hard post limit.
"""
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class LinkedInPostsAgent:
    def run(self, company_name: str, lookback_months: int = 3, limit: int = 10) -> dict:
        posts = []
        try:
            posts = self._search_posts(company_name, lookback_months, limit)
        except Exception as e:
            logger.debug(f"Posts search failed: {e}")
        return {
            "posts": posts[:limit],
            "lookback_months": lookback_months,
            "limit": limit,
            "error": None if posts else "No recent posts found",
        }

    def _search_posts(self, company_name: str, lookback_months: int, limit: int) -> list[dict]:
        from duckduckgo_search import DDGS
        year = datetime.now().year
        years = f"{year} OR {year - 1}" if lookback_months > 6 else str(year)
        queries = [
            f'site:linkedin.com/posts {company_name}',
            f'"{company_name}" announcement OR launch OR partnership OR funding {years}',
            f'"{company_name}" news update {years}',
        ]
        seen = set()
        posts = []
        for q in queries:
            try:
                results = list(DDGS().text(q, max_results=6))
            except Exception:
                continue
            for r in results:
                url = r.get("href") or r.get("url") or ""
                text = (r.get("body") or r.get("snippet") or "").strip()
                title = (r.get("title") or "").strip()
                key = url or title
                if not text or key in seen:
                    continue
                seen.add(key)
                is_li = "linkedin.com" in url
                posts.append({
                    "title": title[:140],
                    "text": text[:500],
                    "url": url,
                    "source": "LinkedIn" if is_li else "Web",
                })
            if len(posts) >= limit:
                break
        # Prefer LinkedIn-native results first, then web mentions
        posts.sort(key=lambda p: 0 if p["source"] == "LinkedIn" else 1)
        return posts
