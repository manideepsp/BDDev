import os, logging, json
from datetime import datetime
from utils import pain_point_titles

logger = logging.getLogger(__name__)

COLLECTION_NAME = "nexus_bd_intelligence"
VECTOR_SIZE = 384  # BAAI/bge-small-en-v1.5

class VectorStoreAgent:
    def __init__(self):
        self._ef = None
        self._client = None
        self._available = False
        try:
            from fastembed import TextEmbedding
            from qdrant_client import QdrantClient
            from qdrant_client.models import Distance, VectorParams
            qdrant_url = os.getenv("QDRANT_URL")
            qdrant_key = os.getenv("QDRANT_API_KEY")
            if not qdrant_url:
                logger.warning("QDRANT_URL not set; vector store disabled")
                return
            self._ef = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            self._client = QdrantClient(url=qdrant_url, api_key=qdrant_key)
            self._available = True
            self.ensure_collection()
        except Exception as e:
            logger.warning(f"VectorStoreAgent unavailable: {e}")

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
            embeddings = list(self._ef.embed([text]))
            vector = embeddings[0].tolist()
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
