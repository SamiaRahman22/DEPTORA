"""
Reranking Module using Cross-Encoders.
Reranks retrieved chunks by relevance to the query.
"""

from typing import List, Tuple
from loguru import logger


class Reranker:
    """
    Uses cross-encoder model to rerank retrieval results.
    More accurate than raw embedding similarity.
    """

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L12-v2"):
        self._model_name = model_name
        self._model = None

    def _load_model(self):
        """Lazy-load cross-encoder model."""
        if self._model is None:
            logger.info(f"Loading cross-encoder model: {self._model_name}")
            try:
                from sentence_transformers import CrossEncoder
                self._model = CrossEncoder(self._model_name)
                logger.info("✅ Cross-encoder model loaded")
            except ImportError:
                logger.warning("sentence-transformers not installed for cross-encoder")
                self._model = False
            except Exception as e:
                # Model download/network/config errors shouldn't take down chat —
                # fall back to unreranked results instead.
                logger.warning(f"Failed to load cross-encoder model ({self._model_name}): {e}")
                self._model = False
        return self._model if self._model else None

    def rerank(
        self,
        query: str,
        chunks: List[Tuple[str, float]],  # (text, original_score)
        top_k: int = 5
    ) -> List[Tuple[str, float]]:
        """
        Rerank chunks using cross-encoder.
        
        Args:
            query: User query
            chunks: List of (chunk_text, original_score) tuples
            top_k: Number of top results to return
        
        Returns:
            List of (chunk_text, rerank_score) tuples
        """
        model = self._load_model()
        if model is None or not chunks:
            # Fallback: return original top-k
            return chunks[:top_k]
        
        try:
            # Prepare inputs for cross-encoder
            # Each input is [query, chunk]
            pairs = [[query, chunk[0]] for chunk in chunks]
            
            # Get rerank scores
            scores = model.predict(pairs)
            
            # Pair scores with chunks
            reranked = [
                (chunk[0], float(score))
                for chunk, score in zip(chunks, scores)
            ]
            
            # Sort by rerank score
            reranked.sort(key=lambda x: x[1], reverse=True)
            
            logger.debug(f"Reranked {len(chunks)} chunks, returning top-{top_k}")
            return reranked[:top_k]
            
        except Exception as e:
            logger.warning(f"Reranking failed: {e}, returning original order")
            return chunks[:top_k]

    @property
    def is_available(self) -> bool:
        """Check if model is available."""
        return self._load_model() is not None


reranker = Reranker()