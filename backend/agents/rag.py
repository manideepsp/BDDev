"""RAGIndexAgent — index ALL gathered raw data, retrieve via LLM-built queries.

Instead of stuffing truncated raw blobs into the synthesis prompt, every piece
of gathered intelligence (website, LinkedIn profile, posts, jobs, people,
research) is chunked, embedded, and upserted into a per-pipeline Qdrant
namespace. At synthesis time the agent asks the LLM what to look for, embeds
those queries, retrieves the most relevant chunks, and assembles a clean,
grounded context block (classic retrieve-then-synthesize RAG).
"""
import logging, uuid, json
from datetime import datetime
from agents.embedder import get_embedder, get_qdrant_client, embed_one, embed_many, VECTOR_SIZE
from utils import extract_json

logger = logging.getLogger(__name__)

COLLECTION = "nexus_bd_rag"


class RAGIndexAgent:
    def __init__(self, groq_client=None):
        self.groq = groq_client
        self._ef = get_embedder()
        self._client = get_qdrant_client()
        self.available = bool(self._ef and self._client)
        if self.available:
            self._ensure()

    def _ensure(self):
        try:
            from qdrant_client.models import Distance, VectorParams, PayloadSchemaType
            existing = [c.name for c in self._client.get_collections().collections]
            if COLLECTION not in existing:
                self._client.create_collection(
                    collection_name=COLLECTION,
                    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
                )
            try:
                self._client.create_payload_index(
                    collection_name=COLLECTION, field_name="pipeline_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception:
                pass  # index may already exist
        except Exception as e:
            logger.warning(f"RAG ensure_collection failed: {e}")
            self.available = False

    # ---- indexing -----------------------------------------------------------

    def index(self, pipeline_id: str, company_name: str, gathered: dict) -> int:
        if not self.available:
            return 0
        chunks = self._chunk(company_name, gathered)
        if not chunks:
            return 0
        try:
            from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
            # Clear any prior chunks for this pipeline (idempotent re-index)
            try:
                self._client.delete(
                    collection_name=COLLECTION,
                    points_selector=Filter(must=[FieldCondition(
                        key="pipeline_id", match=MatchValue(value=pipeline_id))]),
                )
            except Exception:
                pass
            vectors = embed_many([c["text"] for c in chunks])
            if not vectors:
                return 0
            points = [
                PointStruct(id=str(uuid.uuid4()), vector=vec, payload={
                    "pipeline_id": pipeline_id, "source": c["source"], "text": c["text"],
                    "created_at": datetime.now().isoformat(),
                })
                for c, vec in zip(chunks, vectors)
            ]
            self._client.upsert(collection_name=COLLECTION, points=points)
            logger.info(f"[{pipeline_id}] RAG indexed {len(points)} chunks")
            return len(points)
        except Exception as e:
            logger.warning(f"RAG index failed: {e}")
            return 0

    def _chunk(self, company_name: str, gathered: dict) -> list[dict]:
        chunks: list[dict] = []

        def add(source: str, text: str):
            text = " ".join((text or "").split()).strip()
            if len(text) < 25:
                return
            # split long text into ~600-char windows
            for i in range(0, len(text), 600):
                piece = text[i:i + 600]
                if len(piece) >= 25:
                    chunks.append({"source": source, "text": f"[{source}] {piece}"})

        web = gathered.get("website", {})
        for page in web.get("pages", []):
            add("website", f"{page.get('title','')}. {page.get('text','')}")

        li = gathered.get("linkedin", {})
        if li.get("company_info"):
            add("linkedin", li["company_info"])

        for post in gathered.get("posts", {}).get("posts", []):
            add("post", f"{post.get('title','')}. {post.get('text','')}")

        for job in gathered.get("jobs", {}).get("jobs", []):
            add("job", f"{job.get('title','')} ({job.get('location','')}). {job.get('snippet','')}")

        for person in gathered.get("people", {}).get("people", []):
            add("person", f"{person.get('name','')} — {person.get('title','')} "
                          f"[{person.get('role_category','')}, {person.get('seniority','')}, "
                          f"{person.get('location','')}]. {person.get('relevance','') or person.get('snippet','')}")

        for r in gathered.get("research", {}).get("results", []):
            add(f"research:{r.get('angle','web')}", f"{r.get('title','')}. {r.get('snippet','')}")

        for f in gathered.get("crawl", {}).get("findings", []):
            body = f.get("content") or f.get("snippet", "")
            add(f"web:{f.get('source_type','web')}", f"{f.get('title','')}. {body}")

        kw = gathered.get("keywords", {})
        if kw:
            add("keywords", json.dumps(kw))
        return chunks

    # ---- retrieval ----------------------------------------------------------

    def build_queries(self, company_name: str, user_description: str) -> list[str]:
        fallback = [
            f"{company_name} business model and what they do",
            f"{company_name} pain points challenges and gaps",
            f"{company_name} technology stack and tools",
            f"{company_name} recent news developments and announcements",
            f"{company_name} hiring growth and open roles",
            f"{company_name} decision makers and leadership",
        ]
        if not self.groq:
            return fallback
        try:
            prompt = f"""You are planning RAG retrieval. Given a target company and what a vendor sells,
write 6 short search queries (3-7 words each) that would retrieve the most useful chunks
to build a BD intelligence report and find pain points the vendor can solve.

TARGET COMPANY: {company_name}
VENDOR OFFERING: {user_description}

Return ONLY JSON: {{"queries": ["...", "..."]}}"""
            msg = self.groq.chat.completions.create(
                model="llama-3.3-70b-versatile", max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )
            data = extract_json(msg.choices[0].message.content)
            queries = [q for q in data.get("queries", []) if isinstance(q, str) and q.strip()]
            return queries[:8] or fallback
        except Exception as e:
            logger.debug(f"build_queries failed: {e}")
            return fallback

    def retrieve(self, pipeline_id: str, queries: list[str], k: int = 4) -> list[str]:
        if not self.available:
            return []
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            flt = Filter(must=[FieldCondition(key="pipeline_id", match=MatchValue(value=pipeline_id))])
            seen, out = set(), []
            for q in queries:
                vec = embed_one(q)
                if vec is None:
                    continue
                hits = self._client.search(
                    collection_name=COLLECTION, query_vector=vec,
                    query_filter=flt, limit=k, with_payload=True,
                )
                for h in hits:
                    text = (h.payload or {}).get("text", "")
                    if not text:
                        continue
                    # Normalize: lowercase, collapse whitespace, first 120 chars
                    norm = " ".join(text.lower().split())[:120]
                    if norm not in seen:
                        seen.add(norm)
                        out.append(text)
            return out
        except Exception as e:
            logger.warning(f"RAG retrieve failed: {e}")
            return []

    def retrieve_context(self, pipeline_id: str, company_name: str,
                         user_description: str, max_chars: int = 5500) -> str:
        if not self.available:
            return ""
        queries = self.build_queries(company_name, user_description)
        chunks = self.retrieve(pipeline_id, queries, k=4)
        if not chunks:
            return ""
        return "\n\n".join(chunks)[:max_chars]
