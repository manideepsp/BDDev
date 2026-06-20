"""Contact enrichment agent — finds verified email addresses and LinkedIn URLs for prospects.

Tries in order:
  1. Apollo.io People Search API (if APOLLO_API_KEY set)
  2. Hunter.io Domain Search API (if HUNTER_API_KEY set)
  3. Email pattern inference from company domain (heuristic, unverified)

All failures are silent — enrichment is optional; missing data does not block the pipeline.
"""
import os, re, logging, requests
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_APOLLO_KEY = os.getenv("APOLLO_API_KEY", "")
_HUNTER_KEY = os.getenv("HUNTER_API_KEY", "")

# Common corporate email patterns for heuristic fallback
_EMAIL_PATTERNS = [
    "{first}.{last}@{domain}",
    "{first}{last}@{domain}",
    "{f}{last}@{domain}",
    "{first}@{domain}",
    "{first}_{last}@{domain}",
]


def _extract_domain(company_url: str | None) -> str:
    if not company_url:
        return ""
    try:
        parsed = urlparse(company_url if "://" in company_url else f"https://{company_url}")
        host = parsed.hostname or ""
        return host.removeprefix("www.")
    except Exception:
        return ""


def _apollo_enrich(name: str, company_name: str, domain: str) -> dict:
    if not _APOLLO_KEY:
        return {}
    parts = name.strip().split()
    first = parts[0] if parts else ""
    last = parts[-1] if len(parts) > 1 else ""
    try:
        resp = requests.post(
            "https://api.apollo.io/v1/people/match",
            json={
                "api_key": _APOLLO_KEY,
                "first_name": first,
                "last_name": last,
                "organization_name": company_name,
                "domain": domain,
                "reveal_personal_emails": False,
            },
            timeout=8,
        )
        if resp.status_code == 200:
            person = resp.json().get("person") or {}
            return {
                "email": person.get("email") or "",
                "linkedin_url": person.get("linkedin_url") or "",
                "phone": (person.get("phone_numbers") or [{}])[0].get("sanitized_number") or "",
                "enrichment_source": "apollo",
            }
    except Exception as e:
        logger.debug(f"Apollo enrichment failed for {name}: {e}")
    return {}


def _hunter_enrich(name: str, domain: str) -> dict:
    if not _HUNTER_KEY or not domain:
        return {}
    parts = name.strip().split()
    first = parts[0] if parts else ""
    last = parts[-1] if len(parts) > 1 else ""
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/email-finder",
            params={
                "domain": domain,
                "first_name": first,
                "last_name": last,
                "api_key": _HUNTER_KEY,
            },
            timeout=8,
        )
        if resp.status_code == 200:
            data = resp.json().get("data") or {}
            email = data.get("email") or ""
            if email:
                return {
                    "email": email,
                    "email_confidence": data.get("score", 0),
                    "enrichment_source": "hunter",
                }
    except Exception as e:
        logger.debug(f"Hunter enrichment failed for {name}: {e}")
    return {}


def _pattern_infer(name: str, domain: str) -> dict:
    """Generate candidate email addresses using common corporate patterns.
    Marked as unverified — for reference only, not for sending."""
    if not domain:
        return {}
    parts = name.strip().lower().split()
    first = re.sub(r"[^a-z]", "", parts[0]) if parts else ""
    last = re.sub(r"[^a-z]", "", parts[-1]) if len(parts) > 1 else ""
    f = first[:1]
    if not first or not last:
        return {}
    candidates = []
    for pattern in _EMAIL_PATTERNS:
        try:
            candidate = pattern.format(first=first, last=last, f=f, domain=domain)
            candidates.append(candidate)
        except KeyError:
            continue
    return {
        "email_candidates": candidates[:3],
        "email_verified": False,
        "enrichment_source": "pattern_inferred",
    }


class EnrichmentAgent:
    def enrich_person(self, person: dict, company_name: str, company_url: str | None = None) -> dict:
        name = person.get("name", "")
        if not name or name.lower().startswith("unknown"):
            return person

        domain = _extract_domain(company_url)

        # Apollo first
        result = _apollo_enrich(name, company_name, domain)
        if result.get("email"):
            return {**person, **result}

        # Hunter second
        result = _hunter_enrich(name, domain)
        if result.get("email"):
            return {**person, **result}

        # Pattern inference as last resort (unverified)
        result = _pattern_infer(name, domain)
        if result.get("email_candidates"):
            return {**person, **result}

        return person

    def enrich_batch(self, people: list[dict], company_name: str,
                     company_url: str | None = None) -> list[dict]:
        enriched = []
        for person in people:
            try:
                enriched.append(self.enrich_person(person, company_name, company_url))
            except Exception as e:
                logger.warning(f"Enrichment failed for {person.get('name','?')}: {e}")
                enriched.append(person)
        return enriched
