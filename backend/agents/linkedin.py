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
    # Regional subdomains serve the PUBLIC company page; www.linkedin.com walls it
    # behind auth. Try regional first, fall back to www only as a last resort.
    SUBDOMAINS = ("in", "uk", "sg", "ca", "au", "www")

    def run(self, company_name: str, linkedin_url: str | None = None) -> dict:
        company_info = ""
        fields: dict = {}
        people = []
        try:
            company_info, fields = self._scrape_company_page(company_name, linkedin_url)
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

    def _slug_from_url(self, url: str) -> str | None:
        m = re.search(r"linkedin\.com/company/([^/?#]+)", url, re.I)
        return m.group(1).strip().lower() if m else None

    def _candidate_urls(self, company_name: str, linkedin_url: str | None) -> list[str]:
        """Build an ordered list of public company-page URLs to try.

        The base company page on a regional subdomain (in., uk., …) is public and
        embeds the full JSON-LD org schema. The /about/ path and the www. host both
        bounce to the auth wall, so we hit the regional base pages only. If the user
        pasted a LinkedIn URL we reuse its slug but still route through a public
        regional subdomain rather than www.
        """
        slug = None
        if linkedin_url:
            slug = self._slug_from_url(linkedin_url)
        if not slug:
            slug = re.sub(r"[^a-z0-9]+", "-", company_name.lower()).strip("-")

        # Base page only — no trailing /about/, which forces login.
        return [f"https://{sub}.linkedin.com/company/{slug}" for sub in self.SUBDOMAINS]

    def _scrape_company_page(self, company_name: str, linkedin_url: str | None = None) -> tuple[str, dict]:
        for url in self._candidate_urls(company_name, linkedin_url):
            try:
                r = requests.get(url, headers=self.HEADERS, timeout=10)
            except Exception:
                continue
            if r.status_code != 200 or not r.text:
                continue
            # A 200 can still be the soft auth wall (LinkedIn redirects to /login).
            if "login" in r.url.lower() or "authwall" in r.url.lower():
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            fields = self._extract_fields(soup)
            # Guard against parsing the login page itself as company data.
            if fields and "linkedin login" not in (fields.get("name", "").lower()):
                logger.info(f"LinkedIn company page scraped from {url}")
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
                if lo and hi:
                    fields["company_size"] = f"{lo}-{hi} employees"
                elif emp.get("value"):
                    fields["company_size"] = f"{self._clean(emp.get('value'))} employees"
            elif emp:
                fields["company_size"] = f"{self._clean(emp)} employees"
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
