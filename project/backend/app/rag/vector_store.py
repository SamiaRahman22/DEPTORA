"""
FAISS Vector Store.
Manages the FAISS index for semantic similarity search.
Supports persistent storage and incremental updates.
"""

import os
import json
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass, asdict
from loguru import logger
from app.core.config import settings
from app.rag.bm25_search import bm25_searcher  #NEW

@dataclass
class IndexedChunk:
    text: str
    source: str
    chunk_index: int
    doc_id: Optional[int] = None


class FAISSVectorStore:
    """
    FAISS-based vector store with metadata management.
    
    Stores:
    - FAISS index (binary) for fast similarity search
    - Chunk metadata (JSON) for text retrieval
    """

    def __init__(self, index_path: str = None):
        self.index_path = index_path or settings.FAISS_INDEX_PATH
        self.index_file = os.path.join(self.index_path, "index.faiss")
        self.meta_file = os.path.join(self.index_path, "metadata.json")
        
        self._index = None
        self._chunks: List[IndexedChunk] = []
        self._dimension: Optional[int] = None

    def _get_faiss(self):
        try:
            import faiss
            return faiss
        except ImportError:
            raise ImportError("faiss-cpu not installed. Run: pip install faiss-cpu")

    def initialize(self, dimension: int):
        """Initialize a new empty FAISS flat IP index."""
        faiss = self._get_faiss()
        self._dimension = dimension
        # Inner product index (works with L2-normalized embeddings for cosine similarity)
        self._index = faiss.IndexFlatIP(dimension)
        self._chunks = []
        logger.info(f"✅ FAISS index initialized (dim={dimension})")

    def add_embeddings(self, embeddings: np.ndarray, chunks: List[IndexedChunk]):
        """Add embeddings and their metadata to the index."""
        if self._index is None:
            raise RuntimeError("Index not initialized. Call initialize() first.")
        if len(embeddings) != len(chunks):
            raise ValueError("embeddings and chunks must have same length")

        embeddings = embeddings.astype(np.float32)
        self._index.add(embeddings)
        self._chunks.extend(chunks)
        logger.debug(f"Added {len(chunks)} chunks to FAISS index (total: {len(self._chunks)})")

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Tuple[IndexedChunk, float]]:
        """
        Search for most similar chunks.
        Returns list of (chunk, score) tuples, sorted by descending score.
        """
        if self._index is None or self._index.ntotal == 0:
            return []

        query = query_embedding.astype(np.float32)
        if query.ndim == 1:
            query = query.reshape(1, -1)

        k = min(top_k, self._index.ntotal)
        scores, indices = self._index.search(query, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self._chunks) and score > 0.1:
                results.append((self._chunks[idx], float(score)))

        return results

    def rebuild_bm25_index(self):                                #NEW
        """Rebuild BM25 index from stored chunks."""
        chunks_data = [
            {
                "text": chunk.text,
                "source": chunk.source,
                "index": chunk.chunk_index,
            }
            for chunk in self._chunks
        ]
        bm25_searcher.build_index(chunks_data)
        logger.info(f"BM25 index rebuilt from {len(chunks_data)} chunks")

    def hybrid_search(
        self,
        query_embedding: np.ndarray,
        query_text: str,
        top_k: int = 5,
        alpha: float = 0.6
    ) -> List[Tuple[IndexedChunk, float]]:
        """
        Hybrid search combining FAISS (semantic) + BM25 (keyword).
        
        Args:
            query_embedding: Query vector from embedder
            query_text: Original query text
            top_k: Number of results to return
            alpha: Weight for semantic vs keyword (0.6 = 60% semantic, 40% keyword)
        
        Returns:
            List of (chunk, hybrid_score) tuples, sorted by hybrid_score
        """
        if self._index is None or self._index.ntotal == 0:
            return []
        
        # Get semantic results (top 20 for blending)
        semantic_results = self.search(query_embedding, top_k=20)
        semantic_scores = {chunk.text: score for chunk, score in semantic_results}
        
        # Get keyword results (top 20 for blending)
        keyword_results = bm25_searcher.search(query_text, top_k=20)
        
        # Normalize BM25 scores to [0, 1] range
        if keyword_results:
            max_bm25_score = max(score for _, score, _ in keyword_results)
            keyword_scores = {
                text: (score / max_bm25_score) if max_bm25_score > 0 else 0
                for text, score, _ in keyword_results
            }
        else:
            keyword_scores = {}
        
        # Blend scores for all results
        all_texts = set(semantic_scores.keys()) | set(keyword_scores.keys())
        blended_results = []
        
        for text in all_texts:
            semantic_score = semantic_scores.get(text, 0)
            keyword_score = keyword_scores.get(text, 0)
            
            # Weighted blend
            blended_score = (alpha * semantic_score) + ((1 - alpha) * keyword_score)
            
            # Find the chunk object
            chunk = None
            for c in self._chunks:
                if c.text == text:
                    chunk = c
                    break
            
            if chunk:
                blended_results.append((chunk, blended_score))
        
        # Sort by blended score and return top-k
        blended_results.sort(key=lambda x: x[1], reverse=True)
        return blended_results[:top_k]

    def save(self):
        """Persist index and metadata to disk."""
        if self._index is None:
            return
        faiss = self._get_faiss()
        os.makedirs(self.index_path, exist_ok=True)
        faiss.write_index(self._index, self.index_file)
        
        meta = {
            "dimension": self._dimension,
            "total_chunks": len(self._chunks),
            "chunks": [asdict(c) for c in self._chunks],
        }
        with open(self.meta_file, "w") as f:
            json.dump(meta, f, indent=2)
        
        logger.info(f"💾 FAISS index saved ({len(self._chunks)} chunks)")

    def load(self) -> bool:
        """Load index and metadata from disk. Returns True if successful."""
        if not os.path.exists(self.index_file) or not os.path.exists(self.meta_file):
            return False
        try:
            faiss = self._get_faiss()
            self._index = faiss.read_index(self.index_file)
            
            with open(self.meta_file) as f:
                meta = json.load(f)
            
            self._dimension = meta["dimension"]
            self._chunks = [IndexedChunk(**c) for c in meta["chunks"]]

            # Rebuild BM25 index after loading metadata
            self.rebuild_bm25_index()

            logger.info(f"✅ FAISS index loaded ({len(self._chunks)} chunks)")
            return True
        except Exception as e:
            logger.error(f"Failed to load FAISS index: {e}")
            return False

    def clear(self):
        """Reset the index."""
        if self._dimension:
            self.initialize(self._dimension)

    @property
    def total_chunks(self) -> int:
        return len(self._chunks)

    @property
    def is_ready(self) -> bool:
        return self._index is not None and self._index.ntotal > 0
    def remove_document(self, doc_id: int):
        """Remove all chunks belonging to a document."""

        self._chunks = [
            c for c in self._chunks
            if c.doc_id != doc_id
        ]

        if not self._chunks:
            self.clear()
        return

    logger.warning(
        "Document removal requires FAISS rebuild."
    )

vector_store = FAISSVectorStore()
