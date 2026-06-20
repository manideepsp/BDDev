import logging, uuid
from datetime import datetime
from utils import extract_json

logger = logging.getLogger(__name__)

_PERSONA_ANGLES = {
    "cto": ("technical", "Lead with architecture, engineering velocity, and reducing technical debt. Speak the language of their stack. Avoid business-case language — they hate it."),
    "cio": ("technical", "Lead with architecture, engineering velocity, and reducing technical debt. Speak the language of their stack. Avoid business-case language — they hate it."),
    "engineering": ("technical", "Lead with architecture, engineering velocity, and reducing technical debt. Speak the language of their stack. Avoid business-case language — they hate it."),
    "vp eng": ("technical", "Lead with architecture, engineering velocity, and reducing technical debt. Speak the language of their stack. Avoid business-case language — they hate it."),
    "cfo": ("financial", "Lead with cost of inaction, ROI, and payback period. Quantify everything. Risk reduction > revenue growth for this persona. Be precise with numbers."),
    "finance": ("financial", "Lead with cost of inaction, ROI, and payback period. Quantify everything. Risk reduction > revenue growth for this persona. Be precise with numbers."),
    "ceo": ("strategic", "Lead with market position, competitive advantage, and 12-month strategic impact. Connect to their growth narrative. Skip operational detail — go straight to outcomes."),
    "founder": ("strategic", "Lead with market position, competitive advantage, and 12-month strategic impact. Connect to their growth narrative. Skip operational detail — go straight to outcomes."),
    "president": ("strategic", "Lead with market position, competitive advantage, and 12-month strategic impact. Connect to their growth narrative. Skip operational detail — go straight to outcomes."),
    "cro": ("revenue", "Lead with pipeline impact, win rate, and revenue acceleration. They care about deals closed, not tech. Frame everything in revenue terms."),
    "sales": ("revenue", "Lead with pipeline impact, win rate, and revenue acceleration. They care about deals closed, not tech. Frame everything in revenue terms."),
    "revenue": ("revenue", "Lead with pipeline impact, win rate, and revenue acceleration. They care about deals closed, not tech. Frame everything in revenue terms."),
    "coo": ("operational", "Lead with process efficiency, cost reduction, and team capacity. They care about execution — specific workflows, headcount, and turnaround time."),
    "operations": ("operational", "Lead with process efficiency, cost reduction, and team capacity. They care about execution — specific workflows, headcount, and turnaround time."),
    "chro": ("people", "Lead with talent retention, hiring velocity, and culture signals. Frame your offering around their people challenges, not their technology."),
    "hr": ("people", "Lead with talent retention, hiring velocity, and culture signals. Frame your offering around their people challenges, not their technology."),
    "people": ("people", "Lead with talent retention, hiring velocity, and culture signals. Frame your offering around their people challenges, not their technology."),
    "cmo": ("marketing", "Lead with market share, brand positioning, and pipeline generation. Connect your offering to their go-to-market motion and growth targets."),
    "marketing": ("marketing", "Lead with market share, brand positioning, and pipeline generation. Connect your offering to their go-to-market motion and growth targets."),
    "product": ("product", "Lead with product velocity, user outcomes, and reducing time-to-market. Speak about roadmap risk, technical coupling, and customer impact."),
    "cpo": ("product", "Lead with product velocity, user outcomes, and reducing time-to-market. Speak about roadmap risk, technical coupling, and customer impact."),
}

TONE_MAP = {
    "professional": "formal, polished, executive-to-executive. Calm confidence, zero fluff. Reads like a respected peer who values the reader's time.",
    "conversational": "warm and human, like a thoughtful note from one operator to another. Contractions, plain words, a touch of personality — never chummy or cute.",
    "bold": "direct and provocative. Open with a sharp, specific insight or a number that reframes their situation. Confident, never arrogant; earns the reply.",
}

EMAIL_PLAYBOOK = """\
COLD EMAIL PLAYBOOK — follow every rule:
SUBJECT: 3–5 words. Looks like an internal note. Sentence case. No Title Case, no emojis, no ALL CAPS.
  Spark relevance tied to THEIR world. No "Quick question", no spam words (free, guarantee, offer, deal).
OPENING LINE: Lead with something specific and true about THEM — a recent hire, launch, post, job opening, or the pain.
  BANNED openers: "I hope this email finds you well", "My name is...", "I'm reaching out because...",
  "I came across your company", "Hope you're doing well", "Let me introduce", "Just following up", "Circling back"
BODY: 50–110 words total. Their world first (70%), your offering second (30%).
  ONE proof point: a concrete number, a comparable customer, or a specific result.
  5th–7th grade reading level. Short sentences. Active voice. No jargon. 2–3 short paragraphs.
CTA: Exactly one, low-friction. e.g. "Worth a quick look?" / "Open to a 2-line breakdown?"
  Do NOT ask for a 30-minute meeting in a cold email.
SIGN-OFF: "Best," or "Thanks," then sender name + company.\
"""

# Per message type: config for prompting and return structure
MESSAGE_TYPE_CONFIG = {
    "cold_email": {
        "channel": "email",
        "label": "Cold Intro Email",
        "has_subject": True,
        "has_voicemail": False,
        "instructions": (
            "Generate ONE cold intro email. Follow the EMAIL PLAYBOOK exactly.\n"
            "Subject: 3-5 words, sentence case, internal-note style.\n"
            "Body: 60-100 words. Open with the ANCHOR SIGNAL — show you did the research. One proof point. One CTA."
        ),
        "json_schema": '{"subject": "3-5 word subject line", "body": "full email body with sign-off", "rationale": "why this specific opener works"}',
    },
    "follow_up_email": {
        "channel": "email",
        "label": "Follow-up Email",
        "has_subject": True,
        "has_voicemail": False,
        "instructions": (
            "Generate ONE follow-up email with a COMPLETELY DIFFERENT angle from the cold intro. Not a bump — new signal, new value.\n"
            "Subject: 3-5 words or Re: style.\n"
            "Body: 40-60 words MAXIMUM. New angle: different pain point, a proof point, or a customer result.\n"
            "BANNED: 'Following up', 'Checking in', 'Circling back', 'Just bumping this'."
        ),
        "json_schema": '{"subject": "short subject", "body": "follow-up body with sign-off", "rationale": "what new angle this introduces"}',
    },
    "linkedin_message": {
        "channel": "linkedin",
        "label": "LinkedIn Direct Message",
        "has_subject": False,
        "has_voicemail": False,
        "instructions": (
            "Generate ONE LinkedIn direct message (300-500 characters).\n"
            "Specific opener tied to their role, a recent post, or the pain signal. Soft CTA: a question or resource offer.\n"
            "No subject. Peer-to-peer tone. No pitch dump. Feels human, not automated."
        ),
        "json_schema": '{"body": "the LinkedIn message (300-500 chars)", "rationale": "why this approach on LinkedIn"}',
    },
    "linkedin_connection": {
        "channel": "linkedin",
        "label": "Connection Request",
        "has_subject": False,
        "has_voicemail": False,
        "instructions": (
            "Generate ONE LinkedIn connection request note (HARD LIMIT: 280 characters).\n"
            "Give a specific reason to connect: their recent post, a shared professional context, or the pain signal.\n"
            "BANNED: 'I'd love to connect', 'I came across your profile', 'I'm reaching out'.\n"
            "No pitch. Something only this person could receive — hyper-specific."
        ),
        "json_schema": '{"body": "connection note ≤280 chars", "rationale": "specific reason used to connect"}',
    },
    "call_script": {
        "channel": "phone",
        "label": "Call Script",
        "has_subject": False,
        "has_voicemail": True,
        "instructions": (
            "Generate a 30-second cold call opening script AND a 20-second voicemail.\n"
            "Opening: name + company + one specific reason they'd care (their pain or signal) + low-pressure ask.\n"
            "Voicemail: name, company, one compelling hook, [YOUR NUMBER] placeholder.\n"
            "Respectful, specific, not salesy."
        ),
        "json_schema": '{"body": "30-second opening script (what to say when they pick up)", "voicemail": "20-second voicemail script", "rationale": "angle and approach used"}',
    },
}


def _detect_persona(title: str) -> tuple[str, str]:
    title_lower = title.lower()
    for keyword, (ptype, instruction) in _PERSONA_ANGLES.items():
        if keyword in title_lower:
            return ptype, instruction
    return "executive", "Lead with business outcomes and strategic value. Keep it concise, specific, and relevant to their role."


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
        message_type: str = "cold_email",
        trigger_event: str = "",
        linkedin_quote: str = "",
        pain_focus: str = "",
        word_limit: int = 150,
        feedback_prefs: dict | None = None,
        brand_voice: dict | None = None,
    ) -> dict:
        cfg = MESSAGE_TYPE_CONFIG.get(message_type, MESSAGE_TYPE_CONFIG["cold_email"])
        tone_desc = TONE_MAP.get(tone, TONE_MAP["professional"])
        persona_type, persona_instruction = _detect_persona(prospect.get("title", ""))

        # Pain point context — optionally focused on a specific pain
        all_pains = intelligence.get("pain_points") or []
        focused_pain = None
        if pain_focus:
            focused_pain = next(
                (p for p in all_pains if pain_focus.lower() in p.get("title", "").lower()), None
            )
        top_pain_obj = focused_pain or (all_pains[0] if all_pains else {})
        secondary_pain_obj = (all_pains[1] if len(all_pains) > 1 else {}) if not focused_pain else (all_pains[1] if len(all_pains) > 1 else {})

        top_pain = top_pain_obj.get("title", "")
        pain_evidence = top_pain_obj.get("evidence") or []
        pain_opportunity = top_pain_obj.get("opportunity", "")
        secondary_pain = secondary_pain_obj.get("title", "")

        overview = intelligence.get("company_overview") or {}
        urgency = intelligence.get("urgency_trigger") or {}
        urgency_angle = urgency.get("angle", "")
        urgency_signal = urgency.get("signal", "")

        # Anchor signal priority: linkedin_quote > trigger_event > urgency_angle > top pain evidence
        anchor = (
            linkedin_quote.strip()
            or trigger_event.strip()
            or urgency_angle
            or (pain_evidence[0] if pain_evidence else top_pain)
        )

        value_prop = poc_plan.get("value_proposition", "") or sender_offering
        keywords = intelligence.get("key_keywords") or []
        contact_angle = prospect.get("contact_angle", "")

        playbook_block = f"\n{EMAIL_PLAYBOOK}\n" if cfg["channel"] == "email" else ""
        word_limit_block = f"\nWORD COUNT: Write the message in exactly {word_limit} words (±10%). Do not exceed {word_limit} words.\n"

        # Brand voice injection
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

        # Memory / feedback preferences injection
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

        prompt = f"""You are an elite B2B outreach specialist. Generate ONE piece of outreach — make it the best version of its type.
{brand_voice_block}{memory_block}
TYPE: {cfg['label']}
TASK: {cfg['instructions']}

WHO THIS IS FOR:
- Recipient: {prospect.get('name', 'the contact')} — {prospect.get('title', '')} at {company_name}
- About {company_name}: {overview.get('description', '')}
- Why this person specifically: {contact_angle}
- Persona: {persona_type.upper()} — {persona_instruction}

ANCHOR SIGNAL (this is the reason you're reaching out RIGHT NOW — use it as the opener):
{anchor}

PAIN CONTEXT (primary pain to focus on; weave in secondary if natural):
- Primary pain: {top_pain}
- Supporting evidence: {'; '.join(pain_evidence[:3])}
- How we address it: {pain_opportunity}
- Secondary pain: {secondary_pain}
- Urgency signal: {urgency_signal}

FROM:
- {sender_name} at {sender_company}
- What they offer: {sender_offering}
- Value created: {value_prop}
- Keywords to weave in naturally: {', '.join(keywords[:5])}
{playbook_block}
VOICE: {tone_desc}
{word_limit_block}
BANNED PHRASES (never use any of these): "Hope you're doing well", "I'm reaching out because", "My name is", "Let me introduce", "I came across", "Quick question", "Just following up", "Circling back", "end-to-end solutions", "streamline", "leverage", "synergy", "best-in-class", "proven track record"

Return ONLY this JSON (no markdown, no extra text):
{cfg['json_schema']}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1200,
                temperature=0.7,
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": prompt}],
            )
            data = extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"EmailGeneratorAgent failed: {e}")
            raise

        subject = data.get("subject", "")
        body = data.get("body", "")
        voicemail = data.get("voicemail", "")
        rationale = data.get("rationale", "")

        return {
            "id": str(uuid.uuid4()),
            "message_type": message_type,
            "channel": cfg["channel"],
            "sender_name": sender_name,
            "sender_company": sender_company,
            "tone": tone,
            "created_at": datetime.now().isoformat(),
            # Main content
            "subject": subject,
            "body": body,
            "voicemail": voicemail,
            "rationale": rationale,
            "persona_angle": f"{persona_type}: {persona_instruction}",
            "personalization_hook": anchor,
            "poc_summary": value_prop,
            "keywords_used": keywords[:4],
            # Backward-compat flat fields
            "to_name": prospect.get("name", ""),
            "to_title": prospect.get("title", ""),
            "follow_up_subject": "",
            "follow_up_body": "",
            # Sequence wrapper (single item) for backward compat with DB/display
            "sequence": [{
                "day": 1,
                "channel": cfg["channel"],
                "type": message_type,
                "subject": subject,
                "body": body,
                "voicemail": voicemail,
                "rationale": rationale,
            }],
        }
