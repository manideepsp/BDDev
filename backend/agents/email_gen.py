import json, logging, uuid
from datetime import datetime
from utils import extract_json, pain_point_titles

logger = logging.getLogger(__name__)

TONE_MAP = {
    "professional": "formal, polished, and executive-level — confident but respectful",
    "conversational": "warm, friendly, and human — professional but approachable",
    "bold": "direct and challenge-oriented — lead with a provocative insight or stat, be bold",
}

class EmailGeneratorAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, prospect: dict, poc_plan: dict, intelligence: dict, company_name: str,
            sender_name: str, sender_company: str, sender_offering: str, tone: str) -> dict:
        keywords = intelligence.get("key_keywords", [])
        _pains = pain_point_titles(intelligence, limit=1)
        top_pain = _pains[0] if _pains else ""
        tone_desc = TONE_MAP.get(tone, TONE_MAP["professional"])

        prompt = f"""You are a top-tier BD strategist who writes emails that get responses.

SENDER: {sender_name} at {sender_company}
OFFERING: {sender_offering}

TARGET: {prospect.get('name','Unknown')} ({prospect.get('title','')}) at {company_name}
CONTACT ANGLE: {prospect.get('contact_angle','')}
TOP PAIN POINT: {top_pain}
POC VALUE PROP: {poc_plan.get('value_proposition','')}
KEY KEYWORDS (weave 2-3 naturally): {', '.join(keywords[:6])}
TONE: {tone_desc}

Write a highly personalized outreach email:
1. Open with a specific observation about their company (not generic)
2. Connect their pain point to your offering
3. Body under 150 words
4. End with a single low-friction CTA
5. Sign off with sender name

Return ONLY this JSON:
{{
  "subject": "Subject under 50 chars — specific",
  "to_name": "{prospect.get('name','Contact')}",
  "to_title": "{prospect.get('title','')}",
  "body": "Full email body. Include sender name in sign-off.",
  "follow_up_subject": "Follow-up subject for 7 days later",
  "follow_up_body": "Brief follow-up under 70 words referencing first email.",
  "poc_summary": "One sentence POC hook from the plan",
  "keywords_used": ["keyword1", "keyword2", "keyword3"]
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
            email_data = extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"EmailGeneratorAgent failed: {e}")
            raise

        return {
            "id": str(uuid.uuid4()),
            "sender_name": sender_name,
            "sender_company": sender_company,
            "tone": tone,
            "created_at": datetime.now().isoformat(),
            **email_data,
        }
