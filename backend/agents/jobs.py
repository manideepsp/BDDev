"""JobsAgent — open roles via web search.

Open job listings are a strong BD signal: they reveal what a company is
investing in, which tech they're adopting, and where capability gaps are. We
gather them from public job boards via web search (LinkedIn Jobs, Greenhouse,
Lever, careers pages).
"""
import logging

logger = logging.getLogger(__name__)


class JobsAgent:
    def run(self, company_name: str, company_url: str | None = None) -> dict:
        jobs = []
        try:
            jobs = self._search_jobs(company_name)
        except Exception as e:
            logger.debug(f"Jobs search failed: {e}")
        return {
            "jobs": jobs[:12],
            "error": None if jobs else "No open roles found",
        }

    def _search_jobs(self, company_name: str) -> list[dict]:
        from duckduckgo_search import DDGS
        queries = [
            f'"{company_name}" jobs site:linkedin.com/jobs',
            f'"{company_name}" careers (engineer OR manager OR sales OR director) hiring',
            f'"{company_name}" (site:boards.greenhouse.io OR site:jobs.lever.co)',
        ]
        seen = set()
        jobs = []
        for q in queries:
            try:
                results = list(DDGS().text(q, max_results=6))
            except Exception:
                continue
            for r in results:
                url = r.get("href") or r.get("url") or ""
                title = (r.get("title") or "").strip()
                snippet = (r.get("body") or r.get("snippet") or "").strip()
                key = url or title
                if not title or key in seen:
                    continue
                seen.add(key)
                jobs.append({
                    "title": self._clean_title(title),
                    "location": self._guess_location(snippet),
                    "url": url,
                    "snippet": snippet[:300],
                })
        return jobs

    @staticmethod
    def _clean_title(title: str) -> str:
        for sep in (" | ", " - ", " – ", " at "):
            if sep in title:
                title = title.split(sep)[0]
                break
        return title.strip()[:120]

    @staticmethod
    def _guess_location(snippet: str) -> str:
        import re
        m = re.search(r"(Remote|Hybrid|[A-Z][a-z]+(?:,\s*[A-Z]{2,})?(?:,\s*[A-Z][a-z]+)?)", snippet)
        return m.group(1)[:60] if m else ""
