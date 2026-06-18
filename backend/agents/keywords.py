import logging
from utils import extract_json

logger = logging.getLogger(__name__)

_ROLE_CATEGORIES = [
    "Executive", "Engineering", "Product", "Sales/BD", "Marketing",
    "Operations", "Finance", "HR/People", "Data/AI", "Other",
]

_SYSTEM = """\
You are a precision people-intelligence agent. Your sole job is to classify and assess \
a single professional based ONLY on the evidence provided in their LinkedIn snippet. \
You never invent facts. If a detail (location, seniority) is not present in the snippet, \
return "Unknown" — do not guess. Confidence should reflect how clearly the snippet supports \
your assessment, not how plausible the guess is.\
"""


class KeywordExtractionAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, website_data: dict, linkedin_data: dict, user_description: str, company_name: str) -> dict:
        parts = []
        for page in website_data.get("pages", [])[:2]:
            parts.append(f"WEBSITE ({page.get('url', '')}):\n{page.get('text', '')[:800]}")
        if linkedin_data.get("company_info"):
            parts.append(f"LINKEDIN:\n{linkedin_data['company_info'][:600]}")
        for p in linkedin_data.get("people", [])[:3]:
            parts.append(f"PERSON: {p.get('name', '')} — {p.get('title', '')}")
        context = "\n\n".join(parts)[:3000]

        system = (
            "You are a B2B market intelligence analyst specialising in keyword distillation. "
            "Extract structured, precise keywords from raw company data. "
            "Prefer specific, actionable terms over generic buzzwords. "
            "Output must be grounded in the provided data — do not add keywords you invented."
        )
        user = f"""Extract structured keywords for BD research targeting.

COMPANY: {company_name}
USER OFFERING (what we sell — use this to weight persona and tech relevance): {user_description}

RAW COMPANY DATA:
{context}

Return ONLY this JSON — no commentary:
{{
  "keywords": [
    "8–12 core terms that define this company's domain, business model, and market position"
  ],
  "product_areas": [
    "3–6 specific product or service categories this company operates in"
  ],
  "target_personas": [
    "3–5 exact job titles most likely to buy or champion the user's offering at this company"
  ],
  "industry_tags": [
    "2–4 industry or vertical labels (e.g. 'B2B SaaS', 'Digital Health', 'Enterprise Fintech')"
  ],
  "tech_signals": [
    "up to 6 technologies, platforms, or tools explicitly mentioned or strongly implied — omit if none found"
  ]
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=900,
                temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            return extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.warning(f"KeywordExtractionAgent failed: {e}")
            return {
                "keywords": [], "product_areas": [], "target_personas": [],
                "industry_tags": [], "tech_signals": [],
            }
