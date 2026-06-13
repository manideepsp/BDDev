import requests
from bs4 import BeautifulSoup
import re
import logging

logger = logging.getLogger(__name__)

class LinkedInAgent:
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    def run(self, company_name: str) -> dict:
        company_info = ""
        people = []
        try:
            company_info = self._scrape_company_page(company_name)
        except Exception as e:
            logger.debug(f"LinkedIn company page failed: {e}")

        try:
            people = self._search_people(company_name)
        except Exception as e:
            logger.debug(f"LinkedIn people search failed: {e}")

        if not company_info and not people:
            return {"company_info": "", "people": [], "error": "LinkedIn data unavailable"}
        return {"company_info": company_info, "people": people, "error": None}

    def _scrape_company_page(self, company_name: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", company_name.lower()).strip("-")
        url = f"https://www.linkedin.com/company/{slug}/"
        try:
            r = requests.get(url, headers=self.HEADERS, timeout=8)
            if r.status_code != 200:
                return ""
            soup = BeautifulSoup(r.text, "html.parser")
            # LinkedIn embeds data in <code> tags
            code_texts = [c.get_text() for c in soup.find_all("code")]
            # Also grab visible text
            for tag in soup(["script","style"]):
                tag.decompose()
            visible = " ".join(soup.get_text(" ", strip=True).split())[:1500]
            combined = " ".join(code_texts)[:500] + " " + visible
            return combined[:2000]
        except Exception:
            return ""

    def _search_people(self, company_name: str) -> list[dict]:
        from duckduckgo_search import DDGS
        people = []
        seen_names = set()
        queries = [
            f"{company_name} CEO OR CTO OR founder LinkedIn",
            f"site:linkedin.com/in {company_name} VP OR Director OR Head",
        ]
        for q in queries:
            try:
                results = list(DDGS().text(q, max_results=4))
                for r in results:
                    snippet = r.get("body","") or r.get("snippet","")
                    title_text = r.get("title","")
                    person = self._parse_person(title_text, snippet, company_name)
                    if person and person["name"] not in seen_names:
                        seen_names.add(person["name"])
                        people.append(person)
            except Exception:
                continue
        return people[:6]

    def _parse_person(self, title: str, snippet: str, company_name: str) -> dict | None:
        # Try to extract "Name - Title at Company" patterns
        patterns = [
            r"^([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s*[-–|]\s*(.+?)(?:\s*[-–|]|\s+at\s+|\s*$)",
            r"^([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s*[,·]\s*(.+?)(?:\s+at\s+|\s*[-–|])",
        ]
        text = title + " " + snippet
        for pat in patterns:
            m = re.match(pat, text.strip())
            if m:
                name, job_title = m.group(1).strip(), m.group(2).strip()
                if len(name.split()) >= 2:
                    return {"name": name, "title": job_title[:80], "snippet": snippet[:200]}
        return None
