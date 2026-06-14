"""LinkedInPostsAgent — company-specific recent announcements and posts.

Source priority:
  1. Company's own website — /news, /blog, /press, /announcements, /updates pages
     (most reliable: directly from the source, no noise)
  2. LinkedIn company page — extracts any visible post/update snippets from the
     public in.linkedin.com/company/{slug} page (best-effort; JS-rendered content
     is limited but the page often embeds recent update text in structured data)
  3. DDG web search — timelimited, strict: the company name MUST appear in the
     result title, and results from the company's own domain are preferred

All agents receive the current date as context so temporal relevance is anchored.
"""
import logging, re, json
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Subpages to try on the company's own website for announcements.
NEWS_PATH_KEYWORDS = [
    "news", "blog", "press", "announcements", "updates", "insights",
    "resources", "media", "newsroom", "latest",
]


class LinkedInPostsAgent:
    def run(self, company_name: str, lookback_months: int = 3,
            limit: int = 10, company_url: str | None = None) -> dict:
        now = datetime.now()
        cutoff = now - timedelta(days=30 * lookback_months)

        posts: list[dict] = []

        # 1. Company's own website news/blog/press pages
        if company_url:
            try:
                posts += self._scrape_company_news(company_name, company_url, cutoff)
            except Exception as e:
                logger.debug(f"Company news scrape failed: {e}")

        # 2. LinkedIn company page visible updates
        try:
            posts += self._scrape_linkedin_updates(company_name)
        except Exception as e:
            logger.debug(f"LinkedIn updates scrape failed: {e}")

        # 3. Web search — strict: company name must appear in title
        if len(posts) < limit:
            try:
                posts += self._search_web(company_name, lookback_months, limit, now)
            except Exception as e:
                logger.debug(f"Web search failed: {e}")

        # Deduplicate by URL, then by title prefix
        seen_urls: set[str] = set()
        seen_titles: set[str] = set()
        deduped: list[dict] = []
        for p in posts:
            url_key = p.get("url", "")
            title_key = p.get("title", "")[:60].lower().strip()
            if url_key and url_key in seen_urls:
                continue
            if title_key and title_key in seen_titles:
                continue
            seen_urls.add(url_key)
            if title_key:
                seen_titles.add(title_key)
            deduped.append(p)

        # Sort: company-owned content first, then LinkedIn, then web; within each group newest first
        def sort_key(p: dict) -> tuple:
            source_rank = {"company": 0, "LinkedIn": 1}.get(p.get("source", ""), 2)
            date_str = p.get("date", "")
            # Descending date — negate the timestamp
            try:
                ts = -datetime.fromisoformat(date_str).timestamp()
            except Exception:
                ts = 0.0
            return (source_rank, ts)

        deduped.sort(key=sort_key)

        result = deduped[:limit]
        return {
            "posts": result,
            "lookback_months": lookback_months,
            "limit": limit,
            "as_of": now.strftime("%Y-%m-%d"),
            "error": None if result else "No company-specific posts/announcements found",
        }

    # ---- Source 1: Company website news/blog/press --------------------------

    def _scrape_company_news(self, company_name: str, company_url: str,
                             cutoff: datetime) -> list[dict]:
        """Fetch /news, /blog, /press etc. from the company's own website."""
        if not company_url.startswith("http"):
            company_url = "https://" + company_url
        base = company_url.rstrip("/")
        posts: list[dict] = []

        for path in NEWS_PATH_KEYWORDS:
            url = f"{base}/{path}"
            try:
                r = requests.get(url, headers=HEADERS, timeout=8, allow_redirects=True)
                if r.status_code != 200 or "html" not in r.headers.get("Content-Type", ""):
                    continue
                items = self._extract_articles(r.text, url, company_name)
                posts.extend(items)
                if posts:
                    logger.info(f"Scraped {len(items)} items from {url}")
                    break  # one successful news page is enough
            except Exception:
                continue
        return posts

    def _extract_articles(self, html: str, base_url: str, company_name: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        results: list[dict] = []
        name_lower = company_name.lower()
        for article in soup.find_all(["article", "li", "div"],
                                     class_=re.compile(r"post|article|news|blog|card", re.I)):
            # Find a link + title
            a = article.find("a", href=True)
            if not a:
                continue
            href = urljoin(base_url, a["href"])
            title_el = article.find(["h1", "h2", "h3", "h4"])
            title = (title_el.get_text(strip=True) if title_el else a.get_text(strip=True))[:140]
            if not title or len(title) < 10:
                continue
            # Date
            date_str = ""
            for dt in article.find_all(["time", "span"],
                                        attrs={"datetime": True}):
                date_str = dt.get("datetime", "")[:10]
                break
            # Snippet
            snippet = ""
            for p in article.find_all("p"):
                text = p.get_text(strip=True)
                if len(text) > 40:
                    snippet = text[:300]
                    break
            results.append({
                "title": title,
                "text": snippet,
                "url": href,
                "source": "company",
                "date": date_str,
            })
        return results[:8]

    # ---- Source 2: LinkedIn company page visible updates --------------------

    def _scrape_linkedin_updates(self, company_name: str) -> list[dict]:
        """Extract any visible recent-activity snippets from the public LinkedIn page."""
        slug = re.sub(r"[^a-z0-9]+", "-", company_name.lower()).strip("-")
        for subdomain in ("in", "uk", "sg"):
            url = f"https://{subdomain}.linkedin.com/company/{slug}"
            try:
                r = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
                if r.status_code != 200 or "login" in r.url.lower():
                    continue
            except Exception:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            # Look for structured JSON-LD data that might contain recent activity
            posts: list[dict] = []
            for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
                raw = script.string or script.get_text()
                if not raw or "SocialMediaPosting" not in raw and "Article" not in raw:
                    continue
                try:
                    data = json.loads(raw)
                    graph = data.get("@graph") if isinstance(data, dict) else None
                    items = graph if isinstance(graph, list) else ([data] if isinstance(data, dict) else [])
                    for item in items:
                        t = str(item.get("@type", ""))
                        if "Posting" in t or "Article" in t or "Event" in t:
                            headline = item.get("headline") or item.get("name", "")
                            if not headline:
                                continue
                            posts.append({
                                "title": headline[:140],
                                "text": (item.get("description") or item.get("text") or "")[:300],
                                "url": item.get("url") or url,
                                "source": "LinkedIn",
                                "date": (item.get("datePublished") or item.get("dateCreated") or "")[:10],
                            })
                except Exception:
                    continue
            if posts:
                return posts[:6]
        return []

    # ---- Source 3: Web search with strict company-name filter ---------------

    def _search_web(self, company_name: str, lookback_months: int,
                    limit: int, now: datetime) -> list[dict]:
        """DDG search with a hard requirement: company name in title or URL."""
        from duckduckgo_search import DDGS

        # Map lookback to DDG timelimit
        if lookback_months <= 1:
            timelimit = "w"   # 1 week (closest to 1 month DDG supports)
        elif lookback_months <= 3:
            timelimit = "m"   # 1 month
        else:
            timelimit = "y"   # 1 year

        year = now.year
        queries = [
            f'"{company_name}" announcement OR launch OR update {year}',
            f'"{company_name}" press release OR partnership OR funding {year}',
        ]
        name_lower = company_name.lower()
        name_words = set(name_lower.split())
        posts: list[dict] = []
        seen: set[str] = set()

        for q in queries:
            if len(posts) >= limit:
                break
            try:
                results = list(DDGS().text(q, max_results=8, timelimit=timelimit))
            except Exception:
                try:
                    results = list(DDGS().text(q, max_results=8))
                except Exception:
                    continue

            for r in results:
                url = r.get("href") or r.get("url") or ""
                title = (r.get("title") or "").strip()
                snippet = (r.get("body") or r.get("snippet") or "").strip()

                # STRICT FILTER: company name must appear in title (not just somewhere)
                if name_lower not in title.lower():
                    # Allow if ALL words of company name are in title
                    title_words = set(title.lower().split())
                    if not name_words.issubset(title_words):
                        continue

                key = url or title[:60]
                if key in seen:
                    continue
                seen.add(key)
                posts.append({
                    "title": title[:140],
                    "text": snippet[:400],
                    "url": url,
                    "source": "Web",
                    "date": "",
                })

        return posts
