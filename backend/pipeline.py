import asyncio, logging, uuid
from datetime import datetime
from utils import extract_json

logger = logging.getLogger(__name__)

async def run_pipeline(pipeline_id: str, company_name: str, company_url: str | None,
                       user_description: str, groq_client) -> None:
    from db import update_pipeline_status, save_prospects
    from agents.scraper import WebsiteScraperAgent
    from agents.linkedin import LinkedInAgent
    from agents.keywords import KeywordExtractionAgent
    from agents.researcher import WebResearchAgent
    from agents.insights import InsightsAgent
    from agents.vector_store import VectorStoreAgent

    try:
        update_pipeline_status(pipeline_id, "scraping")
        scraper_result = await asyncio.get_running_loop().run_in_executor(
            None, lambda: WebsiteScraperAgent().run(company_name, company_url))
        logger.info(f"[{pipeline_id}] Scraped {len(scraper_result.get('pages',[]))} pages")

        update_pipeline_status(pipeline_id, "linkedin")
        linkedin_result = await asyncio.get_running_loop().run_in_executor(
            None, lambda: LinkedInAgent().run(company_name))
        logger.info(f"[{pipeline_id}] LinkedIn: {len(linkedin_result.get('people',[]))} people")

        update_pipeline_status(pipeline_id, "keywords")
        keywords = await asyncio.get_running_loop().run_in_executor(
            None, lambda: KeywordExtractionAgent(groq_client).run(
                scraper_result, linkedin_result, user_description, company_name))
        logger.info(f"[{pipeline_id}] Keywords: {keywords.get('keywords',[])}")

        update_pipeline_status(pipeline_id, "researching")
        research = await asyncio.get_event_loop().run_in_executor(
            None, lambda: WebResearchAgent().run(company_name, keywords, company_url))
        logger.info(f"[{pipeline_id}] Research: {len(research.get('results',[]))} results")

        update_pipeline_status(pipeline_id, "insights")
        intelligence = await asyncio.get_event_loop().run_in_executor(
            None, lambda: InsightsAgent(groq_client).run(
                company_name, scraper_result, linkedin_result, keywords, research, user_description))
        logger.info(f"[{pipeline_id}] Insights complete, {len(intelligence.get('prospects',[]))} prospects")

        update_pipeline_status(pipeline_id, "embedding")
        prospects = intelligence.pop("prospects", [])
        # Assign stable IDs
        for i, p in enumerate(prospects):
            if not p.get("id") or len(p["id"]) < 3:
                p["id"] = f"{pipeline_id[:8]}-p{i+1}"
        save_prospects(pipeline_id, prospects)
        intelligence["prospects"] = prospects  # put back for storage

        await asyncio.get_event_loop().run_in_executor(
            None, lambda: VectorStoreAgent().embed_and_store(pipeline_id, company_name, intelligence))

        update_pipeline_status(pipeline_id, "complete", intelligence_json=intelligence)
        logger.info(f"[{pipeline_id}] Pipeline complete")

    except Exception as e:
        logger.error(f"[{pipeline_id}] Pipeline failed: {e}")
        update_pipeline_status(pipeline_id, "failed", error=str(e))


def generate_market_trends(groq_client, vector_agent) -> dict:
    payloads = vector_agent.get_all_for_clustering()
    total = len(payloads)
    if total < 3:
        return {
            "clusters": [],
            "overall_summary": "Not enough data yet. Research at least 3 companies to unlock market trends.",
            "total_companies_analyzed": total,
        }
    try:
        # Simple keyword-based clustering (no scipy needed)
        # Group by industry tag similarity
        from collections import defaultdict
        industry_groups = defaultdict(list)
        for p in payloads:
            industry = p.get("industry") or "Unknown"
            industry_groups[industry].append(p)

        clusters = []
        for industry, group in list(industry_groups.items())[:5]:
            all_keywords = []
            all_pain_points = []
            company_names = []
            for p in group:
                all_keywords.extend(p.get("key_keywords", []))
                all_pain_points.extend(p.get("pain_points", []))
                company_names.append(p.get("company_name",""))

            # Use LLM to synthesize cluster insight
            prompt = f"""You are a market analyst. Summarize the common themes and trends from these companies.

INDUSTRY GROUP: {industry}
COMPANIES: {', '.join(company_names)}
COMMON KEYWORDS: {', '.join(list(set(all_keywords))[:15])}
COMMON PAIN POINTS: {', '.join(list(set(all_pain_points))[:8])}

Return ONLY this JSON:
{{
  "theme": "Short theme name (3-5 words)",
  "insight": "2-3 sentence insight about this market segment",
  "opportunity": "Specific BD opportunity in this segment"
}}"""
            try:
                msg = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    max_tokens=400,
                    messages=[{"role": "user", "content": prompt}],
                )
                cluster_data = extract_json(msg.choices[0].message.content)
                clusters.append({
                    "theme": cluster_data.get("theme", industry),
                    "companies": company_names,
                    "insight": cluster_data.get("insight", ""),
                    "opportunity": cluster_data.get("opportunity", ""),
                })
            except Exception:
                clusters.append({
                    "theme": industry,
                    "companies": company_names,
                    "insight": f"{len(company_names)} companies in this segment share common challenges around {', '.join(list(set(all_keywords))[:3])}.",
                    "opportunity": "Explore common BD opportunities across this segment.",
                })

        # Overall summary
        overall = f"Analysis across {total} companies spanning {len(clusters)} industry segments. Key themes: {', '.join(c['theme'] for c in clusters[:3])}."
        return {"clusters": clusters, "overall_summary": overall, "total_companies_analyzed": total}
    except Exception as e:
        logger.error(f"generate_market_trends failed: {e}")
        return {"clusters": [], "overall_summary": f"Trend analysis unavailable: {e}", "total_companies_analyzed": total}
