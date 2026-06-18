"""PeopleSwarmAgent — discover people at the target, then enrich each in parallel.

Discovery uses public web search (site:linkedin.com/in snippets). Each
discovered person is handed to its own lightweight enrichment agent that runs
concurrently (asyncio.gather, capped) to map the person to a role category,
infer seniority/location FROM THE SNIPPET ONLY (never invented), and score
relevance to the user's offering. This is the visible "agent swarm".
"""
import asyncio, logging, re
from utils import extract_json

logger = logging.getLogger(__name__)

_ROLE_CATEGORIES = [
    "Executive", "Engineering", "Product", "Sales/BD", "Marketing",
    "Operations", "Finance", "HR/People", "Data/AI", "Other",
]

_ENRICH_SYSTEM = (
    "You are a precision people-intelligence agent. "
    "Classify and assess a single professional using ONLY the evidence in their snippet. "
    "Never invent a location, title, or detail absent from the snippet. "
    "If a detail is not present, return \"Unknown\". "
    "Confidence must reflect snippet clarity — not how plausible your guess is."
)


class PeopleSwarmAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    async def run(self, company_name: str, seed_people: list[dict], user_description: str,
                  max_people: int = 6, concurrency: int = 4) -> dict:
        people = self._discover(company_name, seed_people, max_people)
        if not people:
            return {"people": [], "swarm_size": 0, "error": "No people found"}

        sem = asyncio.Semaphore(concurrency)

        async def _guarded(p):
            async with sem:
                return await self._enrich(p, company_name, user_description)

        tasks = [_guarded(p) for p in people]
        enriched = await asyncio.gather(*tasks, return_exceptions=True)
        out = []
        for original, result in zip(people, enriched):
            if isinstance(result, dict):
                out.append({**original, **result})
            else:
                out.append({
                    **original,
                    "role_category": "Other", "location": "Unknown",
                    "seniority": "Unknown", "relevance": "", "confidence": "low",
                })
        return {"people": out, "swarm_size": len(out), "error": None}

    # ── Discovery ──────────────────────────────────────────────────────────────

    def _discover(self, company_name: str, seed_people: list[dict], max_people: int) -> list[dict]:
        people = list(seed_people or [])
        seen = {p.get("name", "").lower() for p in people}
        if len(people) >= max_people:
            return people[:max_people]
        try:
            from duckduckgo_search import DDGS
            queries = [
                f'site:linkedin.com/in "{company_name}" (CEO OR CTO OR founder OR VP OR Director OR Head)',
                f'"{company_name}" team leadership site:linkedin.com/in',
            ]
            for q in queries:
                try:
                    results = list(DDGS().text(q, max_results=6))
                except Exception:
                    continue
                for r in results:
                    person = self._parse(r.get("title", ""), r.get("body", "") or r.get("snippet", ""))
                    if person and person["name"].lower() not in seen:
                        seen.add(person["name"].lower())
                        people.append(person)
                        if len(people) >= max_people:
                            return people[:max_people]
        except Exception as e:
            logger.debug(f"People discovery failed: {e}")
        return people[:max_people]

    @staticmethod
    def _parse(title: str, snippet: str) -> dict | None:
        text = (title + " " + snippet).strip()
        m = re.match(
            r"^([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s*[-–|,·]\s*(.+?)(?:\s*[-–|]|\s+at\s+|\s*$)",
            text,
        )
        if m and len(m.group(1).split()) >= 2:
            return {
                "name": m.group(1).strip(),
                "title": m.group(2).strip()[:90],
                "snippet": snippet[:240],
            }
        return None

    # ── Per-person enrichment agent ────────────────────────────────────────────

    async def _enrich(self, person: dict, company_name: str, user_description: str) -> dict:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, lambda: self._enrich_sync(person, company_name, user_description)
        )

    def _enrich_sync(self, person: dict, company_name: str, user_description: str) -> dict:
        role_list = ", ".join(_ROLE_CATEGORIES)
        user = f"""Profile this professional for B2B outreach using ONLY the snippet below.

PERSON: {person.get('name', '')}
STATED TITLE: {person.get('title', '')}
SNIPPET (sole source of truth — do not use outside knowledge): {person.get('snippet', '')}
EMPLOYER: {company_name}
WHAT THE SELLER OFFERS: {user_description}

Return ONLY this JSON:
{{
  "role_category": "one of: {role_list}",
  "seniority": "C-Level | VP | Director | Manager | IC | Unknown",
  "location": "city or region if stated in snippet, else Unknown",
  "relevance": "one sentence: is this person a good BD entry point for the offering, and why",
  "confidence": "high (clear evidence in snippet) | medium (implied) | low (snippet is thin)"
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=320,
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _ENRICH_SYSTEM},
                    {"role": "user", "content": user},
                ],
            )
            data = extract_json(msg.choices[0].message.content)
            cat = data.get("role_category", "Other")
            return {
                "role_category": cat if cat in _ROLE_CATEGORIES else "Other",
                "seniority": str(data.get("seniority", "Unknown"))[:20],
                "location": str(data.get("location", "Unknown"))[:60],
                "relevance": str(data.get("relevance", ""))[:240],
                "confidence": str(data.get("confidence", "low")),
            }
        except Exception as e:
            logger.debug(f"Enrich failed for {person.get('name')}: {e}")
            return {
                "role_category": "Other", "seniority": "Unknown",
                "location": "Unknown", "relevance": "", "confidence": "low",
            }
