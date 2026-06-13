from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from groq import Groq
import os
from dotenv import load_dotenv
import json
import uuid
from datetime import datetime
import re

load_dotenv()

app = FastAPI(title="Nexus BD API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise RuntimeError("Missing GROQ_API_KEY; set it in backend/.env")
client = Groq(api_key=api_key)

# In-memory store for demo
prospects_db: dict = {}


class ResearchRequest(BaseModel):
    company_name: str
    company_url: Optional[str] = None
    additional_context: Optional[str] = None


class OutreachRequest(BaseModel):
    prospect_id: str
    sender_name: str
    sender_company: str
    sender_offering: str
    tone: str = "professional"


class StatusUpdate(BaseModel):
    status: str


def _sanitize(text: str) -> str:
    # Replace literal control characters (0x00-0x1f except \t \n \r) that
    # the LLM sometimes emits inside string values, breaking json.loads.
    # Also collapse bare \r\n / \r to \n so the parser sees clean whitespace.
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)


def _try_parse(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(_sanitize(text))


def extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return _try_parse(part)
            except Exception:
                continue
    try:
        return _try_parse(text)
    except Exception:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return _try_parse(match.group())
        raise ValueError("No valid JSON found in response")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/research")
async def research_company(request: ResearchRequest):
    prompt = f"""You are a world-class business intelligence analyst specializing in BD strategy.
Produce a comprehensive, insightful research report on the following company.

Company: {request.company_name}
{f"Website: {request.company_url}" if request.company_url else ""}
{f"Context: {request.additional_context}" if request.additional_context else ""}

Return a JSON object with this exact structure. Be specific, realistic, and actionable:
{{
  "company_overview": {{
    "description": "2-3 sentence description of what the company does and their mission",
    "industry": "Primary industry/sector",
    "size": "Estimated size (e.g. '500-1000 employees, ~$50M ARR')",
    "founded": "Year founded or estimated decade",
    "headquarters": "City, Country"
  }},
  "key_people": [
    {{"name": "Full name", "title": "Job title", "relevance": "Why ideal to reach out to for BD"}}
  ],
  "business_model": "How they generate revenue — be specific about monetization model",
  "recent_developments": [
    "Specific recent development with approximate timeframe"
  ],
  "pain_points": [
    "Specific, concrete business challenge this company faces"
  ],
  "bd_opportunities": [
    "Specific, actionable opportunity for a vendor/partner to deliver value"
  ],
  "competitive_landscape": {{
    "main_competitors": ["Competitor 1", "Competitor 2", "Competitor 3"],
    "market_position": "Where they stand in the market — leader/challenger/niche",
    "differentiators": "What genuinely sets them apart"
  }},
  "engagement_score": {{
    "score": 78,
    "reasoning": "Concise reasoning for this score (budget signals, growth stage, strategic fit)"
  }},
  "recommended_approach": "Specific 2-3 sentence BD strategy with concrete first-step tactics"
}}

Be insightful and specific. Return ONLY the JSON object, no other text."""

    try:
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2500,
            messages=[{"role": "user", "content": prompt}],
        )
        research_data = extract_json(message.choices[0].message.content)

        prospect_id = str(uuid.uuid4())
        prospect = {
            "id": prospect_id,
            "company_name": request.company_name,
            "company_url": request.company_url,
            "status": "researched",
            "research": research_data,
            "outreach_emails": [],
            "created_at": datetime.now().isoformat(),
        }
        prospects_db[prospect_id] = prospect
        return {"prospect_id": prospect_id, "research": research_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/outreach/generate")
async def generate_outreach(request: OutreachRequest):
    prospect = prospects_db.get(request.prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    research = prospect.get("research", {})
    company_name = prospect["company_name"]

    tone_map = {
        "professional": "formal, polished, and executive-level — confident but respectful",
        "conversational": "warm, friendly, and human — professional but approachable",
        "bold": "direct and challenge-oriented — lead with a provocative insight or stat, be bold",
    }

    prompt = f"""You are a top-tier BD and sales strategist who writes emails that actually get responses.

SENDER:
- Name: {request.sender_name}
- Company: {request.sender_company}
- What they offer: {request.sender_offering}

TARGET:
- Company: {company_name}
- Industry: {research.get('company_overview', {}).get('industry', 'N/A')}
- Size: {research.get('company_overview', {}).get('size', 'N/A')}
- Pain Points: {json.dumps(research.get('pain_points', []))}
- Recent Developments: {json.dumps(research.get('recent_developments', []))}
- BD Opportunities: {json.dumps(research.get('bd_opportunities', []))}
- Key People: {json.dumps(research.get('key_people', []))}
- Recommended Approach: {research.get('recommended_approach', '')}

TONE: {tone_map.get(request.tone, tone_map['professional'])}

Write a highly personalized outreach email that:
1. References 1-2 SPECIFIC details about their company to prove genuine research
2. Directly connects their pain points to what the sender offers
3. Body under 150 words — every sentence earns its place
4. No generic openers ("I hope this email finds you well", "I came across your company")
5. Ends with a single, low-friction CTA (e.g. "Worth a 15-min call this week?")
6. Signed off with sender name

Return ONLY this JSON:
{{
  "subject": "Subject line under 50 chars — specific, not clickbait",
  "to_name": "Best person to contact from key_people list",
  "to_title": "Their title",
  "body": "Full email body with natural paragraph breaks. Include sender name in sign-off.",
  "follow_up_subject": "Follow-up subject line for 7 days later",
  "follow_up_body": "Brief follow-up under 70 words. Reference the first email naturally. End with same CTA."
}}"""

    try:
        message = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        email_data = extract_json(message.choices[0].message.content)

        entry = {
            "id": str(uuid.uuid4()),
            "sender_name": request.sender_name,
            "sender_company": request.sender_company,
            "tone": request.tone,
            "created_at": datetime.now().isoformat(),
            **email_data,
        }
        prospects_db[request.prospect_id]["outreach_emails"].append(entry)
        prospects_db[request.prospect_id]["status"] = "outreach_ready"

        return entry

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/prospects")
async def list_prospects():
    return sorted(
        list(prospects_db.values()),
        key=lambda x: x["created_at"],
        reverse=True,
    )


@app.get("/api/prospects/{prospect_id}")
async def get_prospect(prospect_id: str):
    prospect = prospects_db.get(prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return prospect


@app.patch("/api/prospects/{prospect_id}/status")
async def update_status(prospect_id: str, body: StatusUpdate):
    if prospect_id not in prospects_db:
        raise HTTPException(status_code=404, detail="Prospect not found")
    prospects_db[prospect_id]["status"] = body.status
    return prospects_db[prospect_id]


@app.delete("/api/prospects/{prospect_id}")
async def delete_prospect(prospect_id: str):
    if prospect_id not in prospects_db:
        raise HTTPException(status_code=404, detail="Prospect not found")
    del prospects_db[prospect_id]
    return {"deleted": True}
