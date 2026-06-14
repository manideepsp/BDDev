import requests
from bs4 import BeautifulSoup
import re
import json
import logging

logger = logging.getLogger(__name__)

class LinkedInAgent:
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    def run(self, company_name: str) -> dict:
        company_info = ""
        fields: dict = {}
        people = []
        try:
            company_info, fields = self._scrape_company_page(company_name)
        except Exception as e:
            logger.debug(f"LinkedIn company page failed: {e}")

        try:
            people = self._search_people(company_name)
        except Exception as e:
            logger.debug(f"LinkedIn people search failed: {e}")

        # Merge any people surfaced from the company page's JSON-LD
        for p in fields.get("people", []):
            if p["name"] not in {x["name"] for x in people}:
                people.append(p)

        if not company_info and not people:
            return {"company_info": "", "company_fields": {}, "people": [], "error": "LinkedIn data unavailable"}
        return {"company_info": company_info, "company_fields": fields, "people": people[:6], "error": None}

    # ---- Company page -------------------------------------------------------

    def _scrape_company_page(self, company_name: str) -> tuple[str, dict]:
        slug = re.sub(r"[^a-z0-9]+", "-", company_name.lower()).strip("-")
        # /about/ carries the richest overview; fall back to the base page.
        for url in (f"https://www.linkedin.com/company/{slug}/about/",
                    f"https://www.linkedin.com/company/{slug}/"):
            try:
                r = requests.get(url, headers=self.HEADERS, timeout=10)
            except Exception:
                continue
            if r.status_code != 200 or not r.text:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            fields = self._extract_fields(soup)
            if fields:
                return self._compose_info(company_name, fields), fields
        return "", {}

    def _extract_fields(self, soup: BeautifulSoup) -> dict:
        """Pull structured company data from JSON-LD, og: meta tags, and visible labels."""
        fields: dict = {}
        org = self._extract_org_jsonld(soup)
        if org:
            fields["name"] = self._clean(org.get("name"))
            fields["description"] = self._clean(org.get("description"))
            fields["url"] = self._clean(org.get("url"))
            emp = org.get("numberOfEmployees")
            if isinstance(emp, dict):
                lo, hi = emp.get("minValue"), emp.get("maxValue")
                fields["company_size"] = f"{lo}-{hi} employees" if lo and hi else self._clean(emp.get("value"))
            elif emp:
                fields["company_size"] = self._clean(emp)
            fields["founded"] = self._clean(org.get("foundingDate"))
            addr = org.get("address")
            if isinstance(addr, dict):
                loc = ", ".join(x for x in [self._clean(addr.get("addressLocality")),
                                            self._clean(addr.get("addressRegion")),
                                            self._clean(addr.get("addressCountry"))] if x)
                if loc:
                    fields["headquarters"] = loc
            stat = org.get("interactionStatistic")
            if isinstance(stat, dict) and stat.get("userInteractionCount"):
                fields["followers"] = self._clean(stat.get("userInteractionCount"))
            # founders / key people embedded in the schema
            ppl = []
            for key in ("founder", "founders", "employee", "employees", "member"):
                val = org.get(key)
                for person in (val if isinstance(val, list) else [val] if val else []):
                    if isinstance(person, dict) and person.get("name"):
                        ppl.append({"name": self._clean(person.get("name")),
                                    "title": self._clean(person.get("jobTitle")) or "Listed on company page",
                                    "snippet": ""})
            if ppl:
                fields["people"] = ppl

        # og: meta fallbacks
        if not fields.get("description"):
            md = soup.find("meta", attrs={"property": "og:description"}) or \
                 soup.find("meta", attrs={"name": "description"})
            if md and md.get("content"):
                fields["description"] = self._clean(md["content"])
        if not fields.get("name"):
            mt = soup.find("meta", attrs={"property": "og:title"})
            if mt and mt.get("content"):
                fields["name"] = self._clean(mt["content"])

        # Visible label scraping for fields JSON-LD often omits (Industry, follower count)
        self._extract_labeled_fields(soup, fields)
        return {k: v for k, v in fields.items() if v}

    def _extract_org_jsonld(self, soup: BeautifulSoup) -> dict:
        raws = [t.string or t.get_text() for t in soup.find_all("script", attrs={"type": "application/ld+json"})]
        raws += [c.get_text() for c in soup.find_all("code") if "@type" in c.get_text()]
        for raw in raws:
            if not raw:
                continue
            try:
                data = json.loads(raw)
            except Exception:
                continue
            graph = data.get("@graph") if isinstance(data, dict) else None
            candidates = graph if isinstance(graph, list) else (data if isinstance(data, list) else [data])
            for obj in candidates:
                if isinstance(obj, dict) and "Organization" in str(obj.get("@type", "")):
                    return obj
        return {}

    def _extract_labeled_fields(self, soup: BeautifulSoup, fields: dict) -> None:
        """Best-effort scrape of dt/dd-style label pairs (Industry, Founded, Company size)."""
        text = " ".join(soup.get_text(" ", strip=True).split())
        if not fields.get("industry"):
            m = re.search(r"Industry\s+([A-Z][A-Za-z &/]+?)(?:\s+Company size|\s+\d|\s+Headquarters|\s+Founded)", text)
            if m:
                fields["industry"] = self._clean(m.group(1))
        if not fields.get("followers"):
            m = re.search(r"([\d,]+)\s+followers", text)
            if m:
                fields["followers"] = m.group(1)
        if not fields.get("company_size"):
            m = re.search(r"([\d,]+-[\d,]+|[\d,]+\+?)\s+employees", text)
            if m:
                fields["company_size"] = f"{m.group(1)} employees"
        if not fields.get("founded"):
            m = re.search(r"Founded\s+(\d{4})", text)
            if m:
                fields["founded"] = m.group(1)

    def _compose_info(self, company_name: str, fields: dict) -> str:
        """Build a clean, LLM-friendly summary string from structured fields."""
        lines = [f"Company: {fields.get('name') or company_name}"]
        meta = []
        for label, key in (("Industry", "industry"), ("Size", "company_size"),
                           ("Founded", "founded"), ("HQ", "headquarters"),
                           ("Followers", "followers")):
            if fields.get(key):
                meta.append(f"{label}: {fields[key]}")
        if meta:
            lines.append(" | ".join(meta))
        if fields.get("description"):
            lines.append(f"Overview: {fields['description']}")
        if fields.get("people"):
            names = ", ".join(f"{p['name']} ({p['title']})" for p in fields["people"][:4])
            lines.append(f"Key people: {names}")
        return "\n".join(lines)[:2500]

    @staticmethod
    def _clean(val) -> str:
        if val is None:
            return ""
        return " ".join(str(val).split()).strip()

    # ---- People search ------------------------------------------------------

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
