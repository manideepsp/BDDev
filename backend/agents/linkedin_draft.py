"""LinkedInDraftAgent — start and refine a LinkedIn post draft via AI chat."""
import logging

logger = logging.getLogger(__name__)

_BRAND_VOICE_DESCS = {
    "professional": "Polished, authoritative without being cold.",
    "conversational": "Warm, direct, peer-to-peer. Contractions fine.",
    "bold": "Provocative, insight-led. Sharp opener.",
    "thought-leader": "Opinionated, educational. Shares a POV.",
}


def _voice_block(company_profile: dict | None) -> str:
    if not company_profile:
        return ""
    tone = company_profile.get("brand_voice_tone", "")
    rules = (company_profile.get("brand_voice_rules") or "").strip()
    forbidden = (company_profile.get("brand_voice_forbidden") or "").strip()
    if not (tone or rules or forbidden):
        return ""
    lines = ["BRAND VOICE (follow strictly):"]
    if tone:
        lines.append(f"  Tone: {tone} — {_BRAND_VOICE_DESCS.get(tone, '')}")
    if rules:
        lines.append(f"  Rules: {rules}")
    if forbidden:
        lines.append(f"  Never use: {forbidden}")
    return "\n".join(lines) + "\n\n"


class LinkedInDraftAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def start_draft(self, idea: dict, company_profile: dict | None) -> str:
        voice = _voice_block(company_profile)
        company = (company_profile or {}).get("company_name", "our company")
        services = ", ".join((company_profile or {}).get("services", [])[:3]) if company_profile else ""

        prompt = f"""{voice}You are a LinkedIn content writer for {company}{f" ({services})" if services else ""}.

Write a complete LinkedIn post based on this idea:
Topic: {idea.get("topic", "")}
Angle: {idea.get("angle", "")}
Format: {idea.get("suggested_format", "")}
Suggested opening hook: {idea.get("hook", "")}
Rationale: {idea.get("rationale", "")}

Requirements:
- Under 1300 characters
- First-person B2B practitioner voice — not corporate
- Max 3 relevant hashtags at the end
- No exclamation marks
- Return ONLY the post text, nothing else"""

        try:
            resp = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=500,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"LinkedInDraftAgent.start_draft failed: {e}")
            return f"Draft generation failed: {e}"

    def refine_draft(
        self,
        current_content: str,
        message: str,
        history: list[dict],
        company_profile: dict | None,
    ) -> str:
        voice = _voice_block(company_profile)
        system = (
            f"{voice}"
            "You are a LinkedIn content editor. Refine the post based on user feedback. "
            "Return ONLY the revised post text — no commentary, no JSON, no markdown. "
            "Keep it under 1300 characters. Preserve the author's voice."
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Current post:\n\n{current_content}"},
        ]
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": message})

        try:
            resp = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=500,
                temperature=0.65,
                messages=messages,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"LinkedInDraftAgent.refine_draft failed: {e}")
            raise
