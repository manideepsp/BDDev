import logging
from utils import extract_json

logger = logging.getLogger(__name__)

class KeywordExtractionAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, website_data: dict, linkedin_data: dict, user_description: str, company_name: str) -> dict:
        # Build context
        parts = []
        for page in website_data.get("pages", [])[:2]:
            parts.append(f"WEBSITE ({page.get('url','')}):\n{page.get('text','')[:800]}")
        if linkedin_data.get("company_info"):
            parts.append(f"LINKEDIN:\n{linkedin_data['company_info'][:600]}")
        for p in linkedin_data.get("people", [])[:3]:
            parts.append(f"PERSON: {p.get('name','')} - {p.get('title','')}")
        context = "\n\n".join(parts)[:3000]

        prompt = f"""You are a BD analyst. Extract structured keywords from raw company data.

COMPANY: {company_name}
USER'S OFFERING: {user_description}
RAW DATA:
{context}

Return ONLY this JSON:
{{
  "keywords": ["core terms describing this company's business, 8-12 items"],
  "product_areas": ["specific product/service domains, 3-6 items"],
  "target_personas": ["ideal job titles to contact, 3-5 items"],
  "industry_tags": ["industry/vertical tags, 2-4 items"],
  "tech_signals": ["technologies, platforms, tools mentioned, up to 6 items"]
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=800,
                messages=[{"role": "user", "content": prompt}],
            )
            return extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.warning(f"Keyword extraction failed: {e}")
            return {"keywords": [], "product_areas": [], "target_personas": [], "industry_tags": [], "tech_signals": []}
