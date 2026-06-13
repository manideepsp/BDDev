import json, logging, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

logger = logging.getLogger(__name__)

class InsightsAgent:
    def __init__(self, groq_client):
        self.client = groq_client

    def run(self, company_name: str, website_data: dict, linkedin_data: dict,
            keywords: dict, research_results: dict, user_description: str) -> dict:
        from main import extract_json
        context_parts = []
        for page in website_data.get("pages", [])[:2]:
            context_parts.append(f"WEBSITE: {page.get('text','')[:600]}")
        if linkedin_data.get("company_info"):
            context_parts.append(f"LINKEDIN: {linkedin_data['company_info'][:400]}")
        for p in linkedin_data.get("people", []):
            context_parts.append(f"PERSON FOUND: {p.get('name','')} - {p.get('title','')}")
        for r in research_results.get("results", [])[:8]:
            context_parts.append(f"[{r['angle'].upper()}] {r['title']}: {r['snippet']}")
        context_parts.append(f"KEYWORDS: {json.dumps(keywords)}")
        context = "\n\n".join(context_parts)[:4000]

        prompt = f"""You are a world-class BD strategist. Synthesize the data below into a structured intelligence report. Identify specific prospects (people at this company to pitch to). Base your report strictly on the gathered data; be realistic and specific.

COMPANY: {company_name}
USER'S OFFERING: {user_description}

GATHERED DATA:
{context}

Return ONLY this JSON:
{{
  "company_overview": {{
    "description": "2-3 sentence summary",
    "industry": "Primary industry",
    "size": "Estimated headcount/ARR",
    "founded": "Year or decade",
    "headquarters": "City, Country"
  }},
  "business_model": "How they make money",
  "pain_points": ["concrete challenge 1", "concrete challenge 2", "concrete challenge 3"],
  "bd_opportunities": ["specific opportunity 1", "specific opportunity 2"],
  "recent_developments": ["recent event with timeframe"],
  "competitive_landscape": {{
    "main_competitors": ["name1", "name2", "name3"],
    "market_position": "leader/challenger/niche",
    "differentiators": "what sets them apart"
  }},
  "engagement_score": {{
    "score": <integer 1-100>,
    "reasoning": "why this score"
  }},
  "recommended_approach": "2-3 sentence BD strategy",
  "key_keywords": ["top 6 keywords representing this company context"],
  "prospects": [
    {{
      "id": "p1",
      "name": "Full Name or role description if name unknown",
      "title": "Job Title",
      "relevance": "why this person for BD",
      "contact_angle": "specific angle to use when pitching",
      "confidence": "high"
    }}
  ]
}}
Include 2-4 prospects. Use people found in the data; if no specific names found, infer likely personas based on the company type."""

        try:
            msg = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=3000,
                messages=[{"role": "user", "content": prompt}],
            )
            intelligence = extract_json(msg.choices[0].message.content)
        except Exception as e:
            logger.error(f"InsightsAgent LLM failed: {e}")
            raise

        # Attach real sources
        sources = [{"title": r["title"], "url": r["url"]}
                   for r in research_results.get("results", []) if r.get("url")]
        intelligence["sources"] = sources[:8]
        intelligence["grounded"] = len(sources) > 0

        # Ensure prospects have unique IDs
        for i, p in enumerate(intelligence.get("prospects", [])):
            if not p.get("id") or p["id"] == f"p{i+1}":
                p["id"] = f"p{i+1}"

        return intelligence
