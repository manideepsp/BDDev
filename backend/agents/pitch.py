import json, logging, uuid
from datetime import datetime
from utils import extract_json, pain_point_titles

logger = logging.getLogger(__name__)


def _profile_summary(profile: dict | None) -> str:
    if not profile:
        return "(no structured profile — rely on the offering text)"
    parts = []
    if profile.get("company_name"):
        parts.append(f"{profile['company_name']} ({profile.get('company_type','')})")
    if profile.get("services"):
        parts.append("Services: " + ", ".join(profile["services"]))
    if profile.get("case_studies"):
        parts.append("Case studies: " + profile["case_studies"])
    if profile.get("usps"):
        parts.append("USPs: " + profile["usps"])
    if profile.get("engagement_models"):
        parts.append("Engagement models: " + ", ".join(profile["engagement_models"]))
    return "\n".join(parts)


class PitchAssetAgent:
    """Generates the full BD pitch asset bundle for a single prospect."""

    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, prospect: dict, intelligence: dict, company_name: str,
            sender_name: str, sender_company: str, sender_offering: str,
            company_profile: dict | None = None) -> dict:
        pains = pain_point_titles(intelligence, limit=3)
        icp = intelligence.get("icp_score", {})

        prompt = f"""You are a top-tier BD strategist. Using the evidence below, produce a complete, ready-to-send pitch bundle for ONE prospect. Be specific and reference real signals — no generic filler.

SENDER: {sender_name} at {sender_company or company_profile and company_profile.get('company_name') or ''}
OFFERING: {sender_offering}
SENDER PROFILE:
{_profile_summary(company_profile)}

TARGET COMPANY: {company_name}
PROSPECT: {prospect.get('name','')} ({prospect.get('title','')})
CONTACT ANGLE: {prospect.get('contact_angle','')}
TOP PAIN POINTS: {json.dumps(pains)}
BEST ENTRY POINT: {icp.get('best_entry_point','')}
RECOMMENDED APPROACH: {intelligence.get('recommended_approach','')}

Return ONLY this JSON:
{{
  "executive_summary": "A one-page exec summary addressed to the target's leadership. 3 numbered opportunities, each with Impact / Timeline / Effort lines. Plain text with newlines.",
  "cold_email_short": "A tight cold email under 90 words. Specific opener referencing a real signal, one CTA. Include sign-off.",
  "cold_email_detailed": "A fuller cold email under 160 words connecting a pain point to the offering with a proof point. Include sign-off.",
  "linkedin_message": "A LinkedIn connection note under 300 characters, personalized, low-friction ask.",
  "talking_points": ["5 discovery-call talking points: openers, key questions, and differentiation lines"]
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            assets = extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"PitchAssetAgent failed: {e}")
            raise

        assets["id"] = str(uuid.uuid4())
        assets["created_at"] = datetime.now().isoformat()
        return assets
