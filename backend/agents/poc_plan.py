import json, logging
from utils import extract_json

logger = logging.getLogger(__name__)

# Deal type detection: keywords in user_description or pain point titles → type
_DEAL_TYPE_SIGNALS = {
    "integration": ["integrat", "api", "connector", "middleware", "webhook", "sync", "pipeline"],
    "staffing": ["staffing", "talent", "recruit", "resource", "augment", "hire", "headcount"],
    "audit": ["audit", "assessment", "review", "compliance", "security", "gap analysis", "maturity"],
    "data": ["data", "analytics", "warehouse", "bi ", "dashboard", "reporting", "ml", "ai model", "etl"],
    "migration": ["migrat", "cloud", "lift and shift", "moderniz", "legacy", "replatform"],
    "implementation": ["implement", "deploy", "roll out", "rollout", "go-live", "setup", "configure"],
    "consulting": ["strategy", "roadmap", "advisory", "consult", "workshop", "design sprint"],
}

_DEAL_TYPE_CONFIG = {
    "integration": {
        "label": "Integration / API",
        "timeline_hint": "4–6 week integration POC with a specific API endpoint or data flow",
        "metric_hints": ["Integration latency (target: <200ms)", "Data sync accuracy (%)", "Error rate reduction vs current manual process"],
        "risk_hints": ["Sandbox API access may require IT approval", "Data ownership/security review", "Existing vendor contract lock-in"],
    },
    "staffing": {
        "label": "Resource Augmentation",
        "timeline_hint": "2–4 week trial placement with clear performance metrics",
        "metric_hints": ["Time-to-productivity for placed resource", "Sprint velocity delta", "Reduction in open req backlog"],
        "risk_hints": ["Internal team culture fit", "IP/NDA onboarding requirements", "Manager bandwidth for onboarding"],
    },
    "audit": {
        "label": "Assessment / Audit",
        "timeline_hint": "2–3 week assessment producing a prioritised findings report",
        "metric_hints": ["Number of critical findings identified", "Risk score reduction (before/after)", "Remediation roadmap accepted by leadership"],
        "risk_hints": ["Access to production systems/logs may require security approval", "Findings may surface uncomfortable truths", "Budget for remediation needs to be pre-approved"],
    },
    "data": {
        "label": "Data & Analytics",
        "timeline_hint": "3–4 week data POC: ingest one source, produce one working dashboard",
        "metric_hints": ["Time to first insight (from raw data)", "Dashboard adoption rate at 30 days", "Manual reporting hours eliminated per week"],
        "risk_hints": ["Data quality/cleanliness issues in source systems", "PII/GDPR compliance for data movement", "Stakeholder alignment on KPI definitions"],
    },
    "migration": {
        "label": "Migration / Modernisation",
        "timeline_hint": "4–8 week migration POC: migrate one non-critical workload to prove approach",
        "metric_hints": ["Downtime during migration (target: zero)", "Performance improvement post-migration (%)", "Cost delta (cloud vs on-prem) at steady state"],
        "risk_hints": ["Dependency mapping may reveal unknown couplings", "Rollback plan must be approved before go-live", "Licensing costs on new platform"],
    },
    "implementation": {
        "label": "Implementation",
        "timeline_hint": "3–5 week scoped implementation of one module or workflow",
        "metric_hints": ["User adoption at 30 days post go-live (%)", "Process cycle time reduction (%)", "Number of manual steps eliminated"],
        "risk_hints": ["Change management / user resistance", "Data migration from legacy system", "Executive sponsor availability for sign-offs"],
    },
    "consulting": {
        "label": "Advisory / Consulting",
        "timeline_hint": "2-week discovery sprint producing a prioritised roadmap",
        "metric_hints": ["Roadmap approved by leadership within 30 days", "Top 3 initiatives sized and prioritised", "Stakeholder alignment score (survey)"],
        "risk_hints": ["Stakeholder availability for interviews", "Scope creep beyond initial charter", "Recommendations require capital approval"],
    },
}


def _detect_deal_type(user_description: str, pain_points: list) -> str:
    text = user_description.lower()
    for pain in pain_points:
        if isinstance(pain, dict):
            text += " " + (pain.get("title", "") + " " + pain.get("opportunity", "")).lower()
        elif isinstance(pain, str):
            text += " " + pain.lower()

    scores = {deal_type: 0 for deal_type in _DEAL_TYPE_SIGNALS}
    for deal_type, signals in _DEAL_TYPE_SIGNALS.items():
        for signal in signals:
            if signal in text:
                scores[deal_type] += 1

    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "consulting"


class POCPlanAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, prospect: dict, intelligence: dict, user_description: str, company_name: str) -> dict:
        pain_points = intelligence.get("pain_points", [])
        deal_type = _detect_deal_type(user_description, pain_points)
        cfg = _DEAL_TYPE_CONFIG[deal_type]

        prompt = f"""You are a senior BD consultant specialising in {cfg['label']} engagements. Create a concise, actionable POC plan that is specific to this deal type — not a generic template.

DEAL TYPE: {cfg['label']}
SUGGESTED TIMELINE: {cfg['timeline_hint']}
SUGGESTED METRICS (adapt to the specific context): {json.dumps(cfg['metric_hints'])}
COMMON RISKS FOR THIS TYPE: {json.dumps(cfg['risk_hints'])}

TARGET: {prospect.get('name','Unknown')} ({prospect.get('title','')}) at {company_name}
CONTACT ANGLE: {prospect.get('contact_angle','')}
USER OFFERING: {user_description}
COMPANY PAIN POINTS: {json.dumps(pain_points)}
BD OPPORTUNITIES: {json.dumps(intelligence.get('bd_opportunities', []))}
RECOMMENDED APPROACH: {intelligence.get('recommended_approach','')}
BEST ENTRY POINT: {intelligence.get('icp_score',{}).get('best_entry_point','')}

BANNED PHRASES — never use: "Our team has extensive experience", "proven track record", "working closely with your team", "aligning with goals and objectives", "holistic approach", "leverage our expertise", "streamline operations", "business growth and resilience", "tailor our solutions", "best-in-class"

SPECIFICITY RULES:
- `objective` MUST name the exact pain point from above WITH its evidence signal: e.g. "Prove that 2 augmented React engineers can close 4 of {company_name}'s 12 unfilled roles and ship the stalled dashboard backlog within 3 weeks"
- `approach` must describe SPECIFIC deliverables at each stage — NOT "we will work with the team to understand requirements". Each sentence names a concrete output.
- `success_metrics` targets must derive from the actual evidence (if 12 roles are open, metric is role backlog; if response time is the issue, metric is specific ms target)
- `talking_points` EACH must reference a specific evidence signal from the pain points above — no generic openers. Format: evidence signal → implication → how we address it
- `value_proposition` must name {prospect.get('name','this prospect')}'s actual situation from the evidence and the specific change we create

Return ONLY this JSON:
{{
  "deal_type": "{deal_type}",
  "objective": "One specific sentence: what we will prove, for whom, by when",
  "approach": "3-4 sentences: how we run this engagement step by step",
  "timeline": "Specific timeline based on deal type (e.g. 'Week 1: discovery + access; Week 2-3: build + iterate; Week 4: readout')",
  "value_proposition": "Specific value for {prospect.get('name','this prospect')} — connect to their pain",
  "success_metrics": ["Specific measurable metric with target number", "second metric", "third metric"],
  "talking_points": ["Persona-specific opener for {prospect.get('title','')}", "Key differentiator relevant to their pain", "The one objection they will raise and how to handle it"],
  "risks": ["Specific risk for this deal type at this company", "Second risk with mitigation"]
}}"""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=1400,
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": prompt}],
            )
            result = extract_json(msg.choices[0].message.content)
            result["deal_type"] = deal_type
            return result
        except Exception as e:
            logger.error(f"POCPlanAgent failed: {e}")
            raise
