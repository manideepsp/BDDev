import logging, json
from datetime import datetime
from utils import pain_point_titles
from agents.embedder import get_embedder, get_qdrant_client, embed_one, VECTOR_SIZE

logger = logging.getLogger(__name__)

COLLECTION_NAME = "nexus_bd_intelligence"

class VectorStoreAgent:
    def __init__(self):
        self._ef = get_embedder()
        self._client = get_qdrant_client()
        self._available = bool(self._ef and self._client)
        if self._available:
            self.ensure_collection()

    def ensure_collection(self):
        if not self._available:
            return
        try:
            from qdrant_client.models import Distance, VectorParams
            existing = [c.name for c in self._client.get_collections().collections]
            if COLLECTION_NAME not in existing:
                self._client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
                )
        except Exception as e:
            logger.warning(f"ensure_collection failed: {e}")

    def embed_and_store(self, pipeline_id: str, company_name: str, intelligence: dict):
        if not self._available:
            return
        try:
            from qdrant_client.models import PointStruct
            overview = intelligence.get("company_overview", {})
            pains = pain_point_titles(intelligence, limit=3)
            text = (
                f"{company_name}. "
                f"{overview.get('description','')}. "
                f"{' '.join(intelligence.get('key_keywords', []))}. "
                f"{intelligence.get('business_model','')}. "
                f"{' '.join(pains)}"
            )
            vector = embed_one(text)
            if vector is None:
                return
            point = PointStruct(
                id=pipeline_id,
                vector=vector,
                payload={
                    "pipeline_id": pipeline_id,
                    "company_name": company_name,
                    "industry": overview.get("industry", ""),
                    "engagement_score": intelligence.get("engagement_score", {}).get("score", 0),
                    "pain_points": pains,
                    "bd_opportunities": intelligence.get("bd_opportunities", [])[:3],
                    "key_keywords": intelligence.get("key_keywords", []),
                    "created_at": datetime.now().isoformat(),
                }
            )
            self._client.upsert(collection_name=COLLECTION_NAME, points=[point])
            logger.info(f"Stored vector for {company_name}")
        except Exception as e:
            logger.warning(f"embed_and_store failed: {e}")

    def get_all_for_clustering(self) -> list[dict]:
        if not self._available:
            return []
        try:
            points, _ = self._client.scroll(
                collection_name=COLLECTION_NAME,
                limit=100,
                with_payload=True,
                with_vectors=False,
            )
            return [p.payload for p in points]
        except Exception as e:
            logger.warning(f"get_all_for_clustering failed: {e}")
            return []
