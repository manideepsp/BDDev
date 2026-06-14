"""Shared, lazily-initialized embedding model + Qdrant client.

Loading fastembed is expensive, so every agent that needs vectors shares one
TextEmbedding instance and one QdrantClient via these getters. All failures are
swallowed (return None) so the pipeline degrades gracefully when vectors are
unavailable.
"""
import os, logging

logger = logging.getLogger(__name__)

VECTOR_SIZE = 384  # BAAI/bge-small-en-v1.5

_embedder = None
_embedder_tried = False
_client = None
_client_tried = False


def get_embedder():
    global _embedder, _embedder_tried
    if _embedder_tried:
        return _embedder
    _embedder_tried = True
    try:
        from fastembed import TextEmbedding
        _embedder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    except Exception as e:
        logger.warning(f"Embedder unavailable: {e}")
        _embedder = None
    return _embedder


def get_qdrant_client():
    global _client, _client_tried
    if _client_tried:
        return _client
    _client_tried = True
    try:
        from qdrant_client import QdrantClient
        url = os.getenv("QDRANT_URL")
        if not url:
            logger.warning("QDRANT_URL not set; vector store disabled")
            _client = None
            return None
        _client = QdrantClient(url=url, api_key=os.getenv("QDRANT_API_KEY"))
    except Exception as e:
        logger.warning(f"Qdrant client unavailable: {e}")
        _client = None
    return _client


def embed_one(text: str):
    ef = get_embedder()
    if not ef:
        return None
    try:
        return list(ef.embed([text]))[0].tolist()
    except Exception as e:
        logger.warning(f"embed_one failed: {e}")
        return None


def embed_many(texts: list[str]):
    ef = get_embedder()
    if not ef:
        return []
    try:
        return [v.tolist() for v in ef.embed(texts)]
    except Exception as e:
        logger.warning(f"embed_many failed: {e}")
        return []
