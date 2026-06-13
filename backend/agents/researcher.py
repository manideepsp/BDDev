import os, logging

logger = logging.getLogger(__name__)

class WebResearchAgent:
    def run(self, company_name: str, keywords: dict, company_url: str | None) -> dict:
        results = []
        queries = [
            (f"{company_name} news 2025 OR 2026", "news"),
            (f"{company_name} competitors alternative", "competitive"),
            (f"{company_name} funding OR revenue OR growth", "financial"),
            (f"{' '.join(keywords.get('keywords', [])[:4])} market trends", "market"),
        ]
        tavily_key = os.getenv("TAVILY_API_KEY")
        seen_urls = set()
        for query, angle in queries:
            try:
                batch = self._search(query, angle, tavily_key, seen_urls)
                results.extend(batch)
            except Exception as e:
                logger.debug(f"Search failed for '{query}': {e}")
        return {"results": results, "error": None if results else "No search results"}

    def _search(self, query: str, angle: str, tavily_key: str | None, seen_urls: set) -> list[dict]:
        items = []
        if tavily_key:
            try:
                from tavily import TavilyClient
                client = TavilyClient(api_key=tavily_key)
                resp = client.search(query, max_results=4)
                for r in resp.get("results", []):
                    url = r.get("url","")
                    if url not in seen_urls:
                        seen_urls.add(url)
                        items.append({"title": r.get("title",""), "url": url,
                                      "snippet": r.get("content","")[:300], "angle": angle})
                return items
            except Exception as e:
                logger.debug(f"Tavily failed: {e}")
        # Fall back to DuckDuckGo
        from duckduckgo_search import DDGS
        for r in DDGS().text(query, max_results=4):
            url = r.get("href") or r.get("url","")
            if url and url not in seen_urls:
                seen_urls.add(url)
                items.append({"title": r.get("title",""), "url": url,
                              "snippet": r.get("body","")[:300], "angle": angle})
        return items
