import asyncio, logging
from utils import extract_json

logger = logging.getLogger(__name__)


async def _to_thread(fn):
    return await asyncio.get_running_loop().run_in_executor(None, fn)


async def run_gathering_phase(pipeline_id: str, company_name: str, company_url: str | None,
                              user_description: str, groq_client,
                              company_profile: dict | None = None,
                              target_context: dict | None = None,
                              post_lookback_months: int = 3, post_limit: int = 10) -> None:
    """Phase 1: run all gathering agents, index into RAG, then pause for human review."""
    from db import update_pipeline_status, save_gathered
    from agents.scraper import WebsiteScraperAgent
    from agents.linkedin import LinkedInAgent
    from agents.posts import LinkedInPostsAgent
    from agents.jobs import JobsAgent
    from agents.people import PeopleSwarmAgent
    from agents.keywords import KeywordExtractionAgent
    from agents.researcher import WebResearchAgent
    from agents.crawler import WebCrawlerAgent
    from agents.rag import RAGIndexAgent

    try:
        # --- Concurrent gather: website, linkedin, posts, jobs run in parallel ---
        update_pipeline_status(pipeline_id, "gathering")
        linkedin_url = (target_context or {}).get("linkedin_url")
        scraper_result, linkedin_result, posts_result, jobs_result = await asyncio.gather(
            _to_thread(lambda: WebsiteScraperAgent().run(company_name, company_url)),
            _to_thread(lambda: LinkedInAgent().run(company_name, linkedin_url)),
            _to_thread(lambda: LinkedInPostsAgent().run(company_name, post_lookback_months, post_limit)),
            _to_thread(lambda: JobsAgent().run(company_name, company_url)),
        )
        logger.info(f"[{pipeline_id}] gathered: {len(scraper_result.get('pages',[]))} pages, "
                    f"{len(posts_result.get('posts',[]))} posts, {len(jobs_result.get('jobs',[]))} jobs")

        # --- People swarm: one enrichment agent per person, in parallel ---
        update_pipeline_status(pipeline_id, "people")
        people_result = await PeopleSwarmAgent(groq_client).run(
            company_name, linkedin_result.get("people", []), user_description, max_people=6)
        logger.info(f"[{pipeline_id}] swarm enriched {people_result.get('swarm_size',0)} people")

        # --- Keyword distillation, then targeted web research ---
        update_pipeline_status(pipeline_id, "keywords")
        keywords = await _to_thread(lambda: KeywordExtractionAgent(groq_client).run(
            scraper_result, linkedin_result, user_description, company_name))

        # Targeted research + broad open-web crawl run concurrently.
        update_pipeline_status(pipeline_id, "researching")
        research, crawl = await asyncio.gather(
            _to_thread(lambda: WebResearchAgent().run(company_name, keywords, company_url)),
            _to_thread(lambda: WebCrawlerAgent().run(company_name, company_url, keywords)),
        )
        logger.info(f"[{pipeline_id}] crawl: {crawl.get('pages_crawled',0)} pages across "
                    f"{len(crawl.get('by_type',{}))} source types")

        gathered = {
            "website": scraper_result,
            "linkedin": linkedin_result,
            "posts": posts_result,
            "jobs": jobs_result,
            "people": people_result,
            "keywords": keywords,
            "research": research,
            "crawl": crawl,
        }

        # --- Index everything into the per-pipeline RAG namespace ---
        update_pipeline_status(pipeline_id, "indexing")
        n = await _to_thread(lambda: RAGIndexAgent(groq_client).index(pipeline_id, company_name, gathered))
        gathered["rag_chunks"] = n

        save_gathered(pipeline_id, gathered)
        update_pipeline_status(pipeline_id, "awaiting_input")
        logger.info(f"[{pipeline_id}] gathering complete — awaiting human input ({n} chunks indexed)")

    except Exception as e:
        logger.error(f"[{pipeline_id}] gathering failed: {e}")
        update_pipeline_status(pipeline_id, "failed", error=str(e))


async def run_synthesis_phase(pipeline_id: str, groq_client, human_input: str | None = None,
                              company_profile: dict | None = None,
                              target_context: dict | None = None) -> None:
    """Phase 2 (resumes after human review): RAG-grounded insights, then embed + complete."""
    from db import update_pipeline_status, save_prospects, get_gathered, get_pipeline
    from agents.insights import InsightsAgent
    from agents.rag import RAGIndexAgent
    from agents.vector_store import VectorStoreAgent

    try:
        gathered = get_gathered(pipeline_id) or {}
        meta = get_pipeline(pipeline_id) or {}
        company_name = meta.get("company_name", "")
        user_description = meta.get("user_description", "")

        target_context = dict(target_context or {})
        if human_input:
            target_context["human_input"] = human_input

        # Retrieve grounded context via LLM-built queries against the RAG index
        update_pipeline_status(pipeline_id, "insights")
        rag = RAGIndexAgent(groq_client)
        rag_context = await _to_thread(
            lambda: rag.retrieve_context(pipeline_id, company_name, user_description))

        intelligence = await _to_thread(lambda: InsightsAgent(groq_client).run(
            company_name, gathered.get("website", {}), gathered.get("linkedin", {}),
            gathered.get("keywords", {}), gathered.get("research", {}), user_description,
            company_profile=company_profile, target_context=target_context,
            rag_context=rag_context))
        logger.info(f"[{pipeline_id}] insights complete, {len(intelligence.get('prospects',[]))} prospects")

        # Carry the enriched people through so the UI keeps them
        intelligence["people"] = gathered.get("people", {}).get("people", [])
        intelligence["posts"] = gathered.get("posts", {}).get("posts", [])
        intelligence["jobs"] = gathered.get("jobs", {}).get("jobs", [])

        update_pipeline_status(pipeline_id, "embedding")
        prospects = intelligence.pop("prospects", [])
        for i, p in enumerate(prospects):
            if not p.get("id") or len(p["id"]) < 3:
                p["id"] = f"{pipeline_id[:8]}-p{i+1}"
        save_prospects(pipeline_id, prospects)
        intelligence["prospects"] = prospects

        await _to_thread(lambda: VectorStoreAgent().embed_and_store(pipeline_id, company_name, intelligence))

        update_pipeline_status(pipeline_id, "complete", intelligence_json=intelligence)
        logger.info(f"[{pipeline_id}] pipeline complete")

    except Exception as e:
        logger.error(f"[{pipeline_id}] synthesis failed: {e}")
        update_pipeline_status(pipeline_id, "failed", error=str(e))


def generate_market_trends(groq_client, vector_agent) -> dict:
    payloads = vector_agent.get_all_for_clustering()
    total = len(payloads)
    if total < 3:
        return {
            "clusters": [],
            "overall_summary": "Not enough data yet. Analyze at least 3 companies to unlock market trends.",
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
