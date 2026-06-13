import json, logging, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

logger = logging.getLogger(__name__)

class POCPlanAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, prospect: dict, intelligence: dict, user_description: str, company_name: str) -> dict:
        from main import extract_json
        prompt = f"""You are a senior BD consultant. Create a concise, actionable POC engagement plan.

TARGET: {prospect.get('name','Unknown')} ({prospect.get('title','')}) at {company_name}
CONTACT ANGLE: {prospect.get('contact_angle','')}
USER OFFERING: {user_description}
COMPANY PAIN POINTS: {json.dumps(intelligence.get('pain_points', []))}
BD OPPORTUNITIES: {json.dumps(intelligence.get('bd_opportunities', []))}
RECOMMENDED APPROACH: {intelligence.get('recommended_approach','')}

Return ONLY this JSON:
{{
  "objective": "one sentence goal of the POC",
  "approach": "3-4 sentence engagement approach",
  "timeline": "realistic POC timeline (e.g. 2-week pilot)",
  "value_proposition": "specific value for this prospect",
  "success_metrics": ["measurable metric 1", "measurable metric 2", "measurable metric 3"],
  "talking_points": ["compelling point 1", "compelling point 2", "compelling point 3"],
  "risks": ["potential objection or risk 1", "potential objection or risk 2"]
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
            )
            return extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"POCPlanAgent failed: {e}")
            raise
