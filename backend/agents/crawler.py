"""WebCrawlerAgent — broad open-web discovery + content extraction.

Where WebResearchAgent runs a few targeted queries and keeps only the result
snippets, this agent casts a wide net across the public internet and then
actually FETCHES the most promising pages to pull their real text — news,
funding/investor coverage, review sites, directories, social, code, press.

Every finding is classified by source type so the downstream RAG index and the
human reviewer can see, at a glance, everything the web says about a company.
Network-bound and fully sync (the pipeline wraps it in a worker thread); the
page fetches themselves fan out via a small thread pool so the crawl stays fast.
"""
import os, logging, re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Domain → source-type classification. First substring match wins.
SOURCE_TYPES: list[tuple[str, tuple[str, ...]]] = [
    ("news", ("techcrunch", "reuters", "bloomberg", "forbes", "businessinsider",
              "cnbc", "venturebeat", "theverge", "wired", "wsj", "nytimes",
              "guardian", "yourstory", "economictimes", "livemint", "inc42")),
    ("press", ("prnewswire", "businesswire", "globenewswire", "prweb")),
    ("funding", ("crunchbase", "pitchbook", "tracxn", "dealroom", "cbinsights")),
    ("directory", ("owler", "zoominfo", "apollo.io", "rocketreach", "dnb.com",
                   "bloomberg.com/profile", "zaubacorp")),
    ("review", ("g2.com", "capterra", "trustpilot", "gartner", "trustradius",
                "getapp", "softwareadvice")),
    ("social", ("twitter.com", "x.com", "facebook.com", "instagram.com",
                "youtube.com", "reddit.com", "medium.com", "substack")),
    ("professional", ("linkedin.com", "glassdoor", "ambitionbox", "indeed.com")),
    ("code", ("github.com", "gitlab.com", "stackshare", "npmjs", "pypi.org")),
    ("reference", ("wikipedia.org", "wikidata", "bing.com/search")),
]


class WebCrawlerAgent:
    def __init__(self, max_pages: int = 12, per_query: int = 5):
        self.max_pages = max_pages
        self.per_query = per_query

    def run(self, company_name: str, company_url: str | None = None,
            keywords: dict | None = None) -> dict:
        """Discover and crawl everything the open web has on a company.

        Returns: {"findings": [...], "by_type": {type: count}, "pages_crawled": int,
                  "discovered": int, "error": str|None}
        Each finding: {title, url, snippet, content, source_type, query_angle}
        """
        domain = self._domain(company_url)
        try:
            discovered = self._discover(company_name, domain, keywords or {})
        except Exception as e:
            logger.warning(f"crawler discovery failed: {e}")
            return {"findings": [], "by_type": {}, "pages_crawled": 0,
                    "discovered": 0, "error": str(e)}

        if not discovered:
            return {"findings": [], "by_type": {}, "pages_crawled": 0,
                    "discovered": 0, "error": "No web results found"}

        # Fetch the top discoveries' real page content in parallel.
        to_fetch = discovered[: self.max_pages]
        findings: list[dict] = []
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(self._fetch_content, d["url"]): d for d in to_fetch}
            for fut in as_completed(futures):
                d = futures[fut]
                content = ""
                try:
                    content = fut.result() or ""
                except Exception:
                    content = ""
                findings.append({**d, "content": content})

        # Keep discovery order stable (as_completed scrambles it).
        order = {d["url"]: i for i, d in enumerate(to_fetch)}
        findings.sort(key=lambda f: order.get(f["url"], 1e9))

        by_type: dict[str, int] = {}
        for f in findings:
            by_type[f["source_type"]] = by_type.get(f["source_type"], 0) + 1

        pages_crawled = sum(1 for f in findings if f.get("content"))
        logger.info(f"crawler: discovered {len(discovered)}, crawled {pages_crawled} pages "
                    f"for '{company_name}' across {len(by_type)} source types")
        return {"findings": findings, "by_type": by_type, "pages_crawled": pages_crawled,
                "discovered": len(discovered), "error": None}

    # ---- discovery ----------------------------------------------------------

    def _discover(self, company_name: str, domain: str | None, keywords: dict) -> list[dict]:
        kw = " ".join((keywords.get("keywords") or [])[:3])
        year = datetime.now().year
        queries: list[tuple[str, str]] = [
            (f'"{company_name}" company overview', "profile"),
            (f"{company_name} news {year} OR {year - 1}", "news"),
            (f"{company_name} funding OR investors OR raised", "funding"),
            (f"{company_name} founders OR leadership OR executives", "leadership"),
            (f"{company_name} customers OR case study OR clients", "customers"),
            (f"{company_name} reviews OR ratings", "reviews"),
            (f"{company_name} competitors OR alternatives", "competitive"),
            (f"{company_name} partnership OR acquisition OR launch", "milestones"),
        ]
        # Targeted site: queries that surface high-signal directory/review pages.
        queries += [
            (f"{company_name} site:crunchbase.com", "directory"),
            (f"{company_name} site:github.com", "code"),
        ]
        if kw:
            queries.append((f"{company_name} {kw}", "context"))

        tavily_key = os.getenv("TAVILY_API_KEY")
        seen: set[str] = set()
        out: list[dict] = []
        for query, angle in queries:
            try:
                for r in self._search(query, tavily_key):
                    url = r.get("url", "")
                    if not url or url in seen:
                        continue
                    # Skip the company's own site — WebsiteScraperAgent owns that.
                    if domain and domain in urlparse(url).netloc:
                        continue
                    seen.add(url)
                    out.append({
                        "title": r.get("title", ""),
                        "url": url,
                        "snippet": (r.get("snippet", "") or "")[:300],
                        "source_type": self._classify(url),
                        "query_angle": angle,
                    })
            except Exception as e:
                logger.debug(f"crawler search '{query}' failed: {e}")
        return out

    def _search(self, query: str, tavily_key: str | None) -> list[dict]:
        if tavily_key:
            try:
                from tavily import TavilyClient
                resp = TavilyClient(api_key=tavily_key).search(query, max_results=self.per_query)
                return [{"title": r.get("title", ""), "url": r.get("url", ""),
                         "snippet": r.get("content", "")} for r in resp.get("results", [])]
            except Exception as e:
                logger.debug(f"Tavily failed, falling back to DDG: {e}")
        from duckduckgo_search import DDGS
        items = []
        for r in DDGS().text(query, max_results=self.per_query):
            items.append({"title": r.get("title", ""),
                          "url": r.get("href") or r.get("url", ""),
                          "snippet": r.get("body", "")})
        return items

    # ---- fetching -----------------------------------------------------------

    def _fetch_content(self, url: str) -> str:
        try:
            r = requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
            if r.status_code != 200 or not r.text:
                return ""
            ctype = r.headers.get("Content-Type", "")
            if "html" not in ctype and "text" not in ctype:
                return ""
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "form", "aside"]):
                tag.decompose()
            # Prefer the main article body when present.
            main = soup.find("article") or soup.find("main") or soup
            text = " ".join(main.get_text(" ", strip=True).split())
            return text[:2500]
        except Exception as e:
            logger.debug(f"crawler fetch {url} failed: {e}")
            return ""

    # ---- helpers ------------------------------------------------------------

    @staticmethod
    def _domain(company_url: str | None) -> str | None:
        if not company_url:
            return None
        try:
            net = urlparse(company_url if company_url.startswith("http")
                           else "https://" + company_url).netloc
            return net.replace("www.", "") or None
        except Exception:
            return None

    @staticmethod
    def _classify(url: str) -> str:
        host = url.lower()
        for label, needles in SOURCE_TYPES:
            if any(n in host for n in needles):
                return label
        return "web"
