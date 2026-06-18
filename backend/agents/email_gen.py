import logging, uuid
from datetime import datetime
from utils import extract_json, pain_point_titles

logger = logging.getLogger(__name__)

TONE_MAP = {
    "professional": (
        "formal, polished, executive-to-executive. Calm confidence, zero fluff. "
        "Reads like a respected peer who values the reader's time."
    ),
    "conversational": (
        "warm and human, like a thoughtful note from one operator to another. "
        "Contractions, plain words, a touch of personality — never chummy or cute."
    ),
    "bold": (
        "direct and provocative. Open with a sharp, specific insight or a number "
        "that reframes their situation. Confident, never arrogant; earns the reply."
    ),
}


class EmailGeneratorAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(
        self,
        prospect: dict,
        poc_plan: dict,
        intelligence: dict,
        company_name: str,
        sender_name: str,
        sender_company: str,
        sender_offering: str,
        tone: str,
        trigger_event: str = "",
        linkedin_quote: str = "",
        word_limit: int = 150,
        feedback_prefs: dict | None = None,
        brand_voice: dict | None = None,
    ) -> dict:
        tone_desc = TONE_MAP.get(tone, TONE_MAP["professional"])
        pains = pain_point_titles(intelligence, limit=2)
        pain_primary = pains[0] if pains else ""
        pain_secondary = pains[1] if len(pains) > 1 else ""

        overview = (intelligence.get("company_overview") or {})
        recents = intelligence.get("recent_developments") or []
        # Use caller-supplied trigger event first; fall back to first recent development
        resolved_trigger = trigger_event.strip() or (recents[0] if recents else "")
        contact_angle = prospect.get("contact_angle", "")
        value_prop = poc_plan.get("value_proposition", "")
        industry = overview.get("industry", "")

        # Build the structured context the prompt template slots into
        my_company_context = (
            f"Name: {sender_name}\n"
            f"Company: {sender_company}\n"
            f"What we do (value proposition): {sender_offering}"
        )

        prospect_context = (
            f"Name: {prospect.get('name', 'the contact')}\n"
            f"Title: {prospect.get('title', '')}\n"
            f"Company: {company_name}\n"
            f"Industry: {industry}\n"
            f"Primary pain point: {pain_primary}\n"
            f"Secondary pain point: {pain_secondary}\n"
            f"Why this person, specifically: {contact_angle}"
        )

        # Best trigger to anchor the opener on
        trigger_block = ""
        if linkedin_quote.strip():
            trigger_block = f"Use this specific quote from the prospect's LinkedIn/interview as the opening line:\n\"{linkedin_quote.strip()}\""
        elif resolved_trigger:
            trigger_block = f"Anchor the opening on this recent trigger event at {company_name}:\n{resolved_trigger}"
        else:
            trigger_block = f"Anchor the opening on the primary pain point: {pain_primary}"

        poc_hook = value_prop or poc_plan.get("objective", "")

        # --- Brand Voice: inject from company profile settings ---
        brand_voice_block = ""
        if brand_voice:
            bv_lines = []
            bv_tone = brand_voice.get("brand_voice_tone")
            bv_rules = (brand_voice.get("brand_voice_rules") or "").strip()
            bv_forbidden = (brand_voice.get("brand_voice_forbidden") or "").strip()
            bv_example = (brand_voice.get("brand_voice_example") or "").strip()
            if bv_tone or bv_rules or bv_forbidden or bv_example:
                bv_lines.append("BRAND VOICE (override the tone setting if they conflict):")
                if bv_tone:
                    bv_lines.append(f"  Tone style: {bv_tone}")
                if bv_rules:
                    bv_lines.append(f"  Rules: {bv_rules}")
                if bv_forbidden:
                    bv_lines.append(f"  NEVER use: {bv_forbidden}")
                if bv_example:
                    bv_lines.append(f"  Match this style (do NOT copy):\n  ---\n  {bv_example[:400]}\n  ---")
                brand_voice_block = "\n".join(bv_lines) + "\n\n"

        # --- Memory: inject feedback preferences from past high/low-rated emails ---
        memory_block = ""
        if feedback_prefs and feedback_prefs.get("total_rated", 0) > 0:
            lines = [f"MEMORY — LEARNED PREFERENCES (from {feedback_prefs['total_rated']} rated emails):"]
            if feedback_prefs.get("preferred_tones"):
                lines.append(f"  The user rates '{', '.join(feedback_prefs['preferred_tones'])}' emails highest — lean into that style.")
            if feedback_prefs.get("avoided_tones"):
                lines.append(f"  The user rates '{', '.join(feedback_prefs['avoided_tones'])}' emails poorly — avoid that style regardless of the selected tone.")
            if feedback_prefs.get("high_rated_bodies"):
                lines.append("  EXAMPLE — study the structure, length, and voice of this top-rated email and match it (do NOT copy):")
                lines.append(f"  ---\n  {feedback_prefs['high_rated_bodies'][0]}\n  ---")
            memory_block = "\n".join(lines) + "\n\n"

        prompt = f"""Act as an expert B2B sales copywriter. Write a concise, value-driven cold email to a prospect.
{brand_voice_block}{memory_block}
MY COMPANY CONTEXT:
{my_company_context}

TARGET PROSPECT:
{prospect_context}

PERSONALISATION SIGNAL (use this to open — do NOT ignore it):
{trigger_block}

POC HOOK (weave into the body naturally):
{poc_hook}

EMAIL GUIDELINES & CONSTRAINTS:
Goal: Book a 15-minute introductory call.
Framework: Start with a sharp business observation or the trigger event above. Then, briefly share how we help companies like theirs, and end with a low-pressure, curiosity-driven call-to-action.
Tone: {tone_desc}
Length: Strictly under {word_limit} words (body only). Aim for {max(50, word_limit - 50)}–{word_limit} words — concise wins.
Rules:
- Do NOT use exclamation points anywhere in the email.
- Do NOT use generic flattery or clichés: "I hope this finds you well", "I came across your profile", "I wanted to reach out", "touching base", "circling back", "synergy", "solutions", "best-in-class".
- Do NOT open with your company name or your own name.
- DO open with an observation, a data point, or the trigger event — something about THEM.
- ONE clear, low-pressure CTA at the end. Ask to talk, not for a meeting slot.
- Sign off with the sender's first name and company on separate lines.
- Write as one human to one person. If this email could be sent to 100 people unchanged, rewrite it.

FOLLOW-UP (sent 5-7 days later):
- Under 80 words.
- Add a NEW angle, proof point, or insight — not "just bumping this".
- Reference the first email in one short clause.

OUTPUT REQUIRED:
Provide exactly 3 distinct, compelling subject lines — each under 7 words. Vary the approach:
  1. Provocative or insight-led
  2. Relevance/trigger-based (reference their company, role, or recent event)
  3. Curiosity or question-driven

Return ONLY this JSON:
{{
  "subject_lines": [
    "subject line 1 — provocative or insight-led",
    "subject line 2 — relevance or trigger-based",
    "subject line 3 — curiosity or question-driven"
  ],
  "subject": "the best of the three (copy it here)",
  "to_name": "{prospect.get('name', 'Contact')}",
  "to_title": "{prospect.get('title', '')}",
  "body": "The complete email body, plain text. Opening observation → value bridge → CTA → sign-off.",
  "follow_up_subject": "Short follow-up subject — can be Re: <original>",
  "follow_up_body": "Under 80 words. New angle. References first email briefly.",
  "poc_summary": "One plain sentence capturing the core hook offered to this prospect.",
  "personalization_hook": "The specific signal you anchored the opener on (for user reference).",
  "keywords_used": ["words or phrases from the research you wove in naturally"]
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1800,
                temperature=0.72,
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": prompt}],
            )
            email_data = extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"EmailGeneratorAgent failed: {e}")
            raise

        # Ensure subject_lines is always a list of 3
        if not isinstance(email_data.get("subject_lines"), list):
            email_data["subject_lines"] = [email_data.get("subject", "")]
        email_data["subject_lines"] = (email_data["subject_lines"] + ["", "", ""])[:3]

        # Keep the primary subject populated
        if not email_data.get("subject") and email_data["subject_lines"][0]:
            email_data["subject"] = email_data["subject_lines"][0]

        return {
            "id": str(uuid.uuid4()),
            "sender_name": sender_name,
            "sender_company": sender_company,
            "tone": tone,
            "created_at": datetime.now().isoformat(),
            **email_data,
        }
