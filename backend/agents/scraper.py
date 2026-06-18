import requests
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

class WebsiteScraperAgent:
    HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    def run(self, company_name: str, company_url: str | None) -> dict:
        try:
            if not company_url:
                company_url = self._find_url(company_name)
            if not company_url:
                return {"pages": [], "error": "Could not find company URL"}
            pages = []
            homepage = self._fetch_page(company_url)
            if homepage:
                pages.append(homepage)
                # Find relevant subpages
                sub_links = self._find_subpages(homepage.get("url", company_url), homepage.get("raw_html",""))
                for link in sub_links[:3]:
                    p = self._fetch_page(link)
                    if p:
                        pages.append(p)
            return {"pages": pages, "error": None}
        except Exception as e:
            logger.warning(f"Scraper error: {e}")
            return {"pages": [], "error": str(e)}

    def _find_url(self, company_name: str) -> str | None:
        """Search for the company's official website, with basic domain-name validation."""
        try:
            from duckduckgo_search import DDGS
            from urllib.parse import urlparse
            # Normalize company name to a slug for domain matching
            slug = company_name.lower().replace(" ", "").replace("-", "").replace(".", "")[:20]
            results = list(DDGS().text(f'"{company_name}" official website OR homepage', max_results=5))
            for r in results:
                url = r.get("href") or r.get("url", "")
                if not url:
                    continue
                skip = {"linkedin", "wikipedia", "crunchbase", "glassdoor", "twitter",
                        "facebook", "instagram", "youtube", "indeed", "g2.com", "capterra"}
                if any(s in url for s in skip):
                    continue
                # Prefer URLs whose domain contains the company name slug
                try:
                    domain = urlparse(url).netloc.lower().replace("www.", "").replace("-", "").replace(".", "")
                    if slug[:8] in domain or domain[:8] in slug:
                        return url
                except Exception:
                    pass
                # Fall back to first non-social result
                return url
        except Exception:
            pass
        return None

    def _fetch_page(self, url: str) -> dict | None:
        try:
            if not url.startswith("http"):
                url = "https://" + url
            r = requests.get(url, headers=self.HEADERS, timeout=10, allow_redirects=True)
            if r.status_code != 200:
                return None
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script","style","nav","footer","header"]):
                tag.decompose()
            title = soup.title.string.strip() if soup.title else ""
            meta = soup.find("meta", attrs={"name": "description"})
            meta_desc = meta.get("content","") if meta else ""
            text = " ".join(soup.get_text(" ", strip=True).split())[:2000]
            return {"url": url, "title": title, "meta": meta_desc, "text": text, "raw_html": r.text[:5000]}
        except Exception as e:
            logger.debug(f"Failed to fetch {url}: {e}")
            return None

    def _find_subpages(self, base_url: str, html: str) -> list[str]:
        try:
            from urllib.parse import urljoin, urlparse
            base_domain = urlparse(base_url).netloc
            soup = BeautifulSoup(html, "html.parser")
            priority_keywords = ["about","product","service","solution","team","company","platform"]
            links = []
            seen = set()
            for a in soup.find_all("a", href=True):
                href = urljoin(base_url, a["href"])
                parsed = urlparse(href)
                if parsed.netloc != base_domain or href in seen:
                    continue
                path = parsed.path.lower()
                if any(kw in path for kw in priority_keywords):
                    seen.add(href)
                    links.append(href)
            return links[:3]
        except Exception:
            return []
