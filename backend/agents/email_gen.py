import logging, uuid
from datetime import datetime
from utils import extract_json, pain_point_titles

logger = logging.getLogger(__name__)

# Tone steers VOICE only — never the structure or the rules below.
TONE_MAP = {
    "professional": (
        "Polished and executive-to-executive. Calm confidence, zero fluff. "
        "Reads like a respected peer who values the reader's time."
    ),
    "conversational": (
        "Warm and human, like a thoughtful note from one operator to another. "
        "Contractions, plain words, a touch of personality — never chummy or cute."
    ),
    "bold": (
        "Direct and provocative. Open with a sharp, specific insight or a number "
        "that reframes their situation. Confident, never arrogant; earns the reply."
    ),
}

# Distilled from cold-outreach reply-rate research (Boomerang word-count study,
# personalization-lift data, deliverability/spam-trigger guidance). These are the
# rules that actually move reply rates — they are non-negotiable in the output.
EMAIL_PLAYBOOK = """\
COLD EMAIL PLAYBOOK — follow every rule. These are reply-rate drivers, not style suggestions.

SUBJECT LINE
- 3–5 words. Looks like an internal note, not a campaign. Sentence case, no Title Case.
- Spark relevance or curiosity tied to THEIR world. No clickbait, no "Quick question",
  no the recipient's-company-name-as-bait, no emojis, no ALL CAPS, no exclamation marks.
- Never use spam-trigger words: free, guarantee, offer, deal, act now, limited time, $$$.

OPENING LINE (the single biggest reply driver)
- Lead with something specific and true about THEM — a recent hire, launch, post, funding
  round, job opening, or the concrete pain point below. Show you did the work.
- BANNED openers: "I hope this email finds you well", "My name is...", "I'm reaching out
  because...", "I came across your company", "Hope you're doing well", "Let me introduce".

BODY (this is where most emails lose the reader)
- 50–110 words total. Shorter wins. Every sentence earns its place.
- Their world first, your product second. Roughly 70% about them, 30% about you.
- Connect their pain point to the outcome you create — speak in results, not features.
- Exactly ONE proof point: a concrete number, a comparable customer, or a specific result.
  If you have no real proof, make a credible, specific claim — never vague superlatives.
- 5th–7th grade reading level. Short sentences. Active voice. No jargon, no buzzwords
  ("synergy", "leverage", "cutting-edge", "revolutionary", "best-in-class", "solutions").
- 2–3 short paragraphs, scannable on a phone. No links. No attachments. No images.

CALL TO ACTION
- Exactly one, and make it low-friction and interest-based, e.g.
  "Worth a quick look?" / "Open to me sending a 2-line breakdown?" / "Want the short version?"
- Do NOT ask for a 30-minute meeting, a demo, or a calendar booking in a first cold email.
  Ask for a small yes, not their time.

SIGN-OFF
- Simple: "Best," or "Thanks," then the sender's first name (+ company on the next line).
- No corporate signature block, no titles, no phone numbers.

FOLLOW-UP (sent ~5–7 days later)
- Under 60 words. Add a NEW angle, proof point, or idea — never just "bumping this" or
  "circling back". Reference the first email in one short clause, then give a fresh reason.

OVERALL FEEL
- One human wrote this to one person. If it could be sent to 1,000 companies unchanged,
  it has failed. Specific beats clever. Brief beats thorough.\
"""


class EmailGeneratorAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, prospect: dict, poc_plan: dict, intelligence: dict, company_name: str,
            sender_name: str, sender_company: str, sender_offering: str, tone: str) -> dict:
        keywords = intelligence.get("key_keywords", [])
        _pains = pain_point_titles(intelligence, limit=2)
        top_pain = _pains[0] if _pains else ""
        secondary_pain = _pains[1] if len(_pains) > 1 else ""
        tone_desc = TONE_MAP.get(tone, TONE_MAP["professional"])

        # Real signals the model can anchor a specific opener on.
        overview = (intelligence.get("company_overview") or {})
        recent = intelligence.get("recent_developments") or []
        recent_signal = recent[0] if recent else ""
        contact_angle = prospect.get("contact_angle", "")
        value_prop = poc_plan.get("value_proposition", "")

        prompt = f"""You are an elite cold-outreach copywriter. Senders pay you because your \
emails get replies from busy executives who ignore everyone else. You write for ONE person, \
never a list.

{EMAIL_PLAYBOOK}

────────────────────────────────────────
THE ASSIGNMENT

WHO IS WRITING
- Sender: {sender_name} from {sender_company}
- What they offer: {sender_offering}

WHO RECEIVES IT
- {prospect.get('name','the contact')} — {prospect.get('title','')} at {company_name}
- About {company_name}: {overview.get('description','')}
- Why this person, why now: {contact_angle}

THE SIGNALS YOU MUST USE (anchor the opener on at least one real, specific item)
- Their top pain point: {top_pain}
- A secondary pain point: {secondary_pain}
- A recent development at their company: {recent_signal}
- The outcome we can create for them: {value_prop}
- Relevant context words to weave in naturally (2–3 max, only if they fit): {', '.join(keywords[:6])}

VOICE FOR THIS EMAIL: {tone_desc}

Write the primary email AND a follow-up, obeying every rule in the playbook. The opener must
reference a real, specific signal above — not a generic compliment. Keep the body 50–110 words.

Return ONLY this JSON (no commentary):
{{
  "subject": "3–5 words, internal-note style",
  "to_name": "{prospect.get('name','Contact')}",
  "to_title": "{prospect.get('title','')}",
  "body": "The full primary email, including the sign-off with the sender's first name.",
  "follow_up_subject": "Short follow-up subject (can be 'Re: <original>' style)",
  "follow_up_body": "Under 60 words, adds a NEW angle, references the first email briefly.",
  "poc_summary": "One plain sentence capturing the core hook offered.",
  "keywords_used": ["only the context words you actually wove in"],
  "personalization_hook": "The specific signal you anchored the opener on (for the user's reference)."
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1500,
                temperature=0.7,
                response_format={"type": "json_object"},
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
