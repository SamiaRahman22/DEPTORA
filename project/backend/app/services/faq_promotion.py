"""
FAQ auto-promotion service.

Unlike simple text-normalization matching, this uses sentence embeddings so
that a question asked 5 times in 5 different phrasings still counts as "the
same question" — e.g. "when is advising?" and "what's the advising schedule?"
match via cosine similarity, not exact wording.

Flow, called after every confidently-answered, in-domain chat response:
1. Embed the query.
2. If it semantically matches an existing active FAQ -> already covered, stop.
3. Otherwise find/create a FAQCandidate row and bump its count.
4. Once a candidate's count reaches FAQ_AUTO_PROMOTE_THRESHOLD -> promote it
   to a real FAQ and delete the candidate.
"""

import json
import numpy as np
from typing import Optional
from sqlalchemy.orm import Session
from loguru import logger

from app.core.config import settings
from app.models.faq import FAQ
from app.models.faq_candidate import FAQCandidate


def _get_embedding(text: str) -> Optional[np.ndarray]:
    """Embed a single string. Returns a flat (dim,) L2-normalized vector, or
    None if the embedding model can't be loaded (never let this break chat)."""
    try:
        from app.rag.embedder import embedding_service
        vec = embedding_service.embed_query(text)  # shape (1, dim)
        return vec[0]
    except Exception as e:
        logger.warning(f"FAQ promotion: could not embed text ({e}) — skipping this check")
        return None


def _batch_embed(texts: list) -> Optional[np.ndarray]:
    try:
        from app.rag.embedder import embedding_service
        return embedding_service.embed_texts(texts)
    except Exception as e:
        logger.warning(f"FAQ promotion: could not batch-embed ({e}) — skipping this check")
        return None


def _find_matching_faq(db: Session, query_embedding: np.ndarray) -> Optional[FAQ]:
    """Semantic (not keyword) check: does an existing active FAQ already
    cover this question, possibly worded differently?"""
    faqs = db.query(FAQ).filter(FAQ.is_active == True).all()
    if not faqs:
        return None
    embeddings = _batch_embed([f.question for f in faqs])
    if embeddings is None:
        return None
    sims = embeddings @ query_embedding
    best_idx = int(np.argmax(sims))
    if float(sims[best_idx]) >= settings.FAQ_SIMILARITY_THRESHOLD:
        return faqs[best_idx]
    return None


def _find_matching_candidate(db: Session, query_embedding: np.ndarray) -> Optional[FAQCandidate]:
    """Does this question match a question we're already tracking as a
    possible recurring FAQ (asked before, but not yet promoted)?"""
    candidates = db.query(FAQCandidate).all()
    best_candidate, best_sim = None, -1.0
    for c in candidates:
        try:
            c_emb = np.array(json.loads(c.embedding), dtype=np.float32)
        except (json.JSONDecodeError, TypeError):
            continue
        sim = float(np.dot(c_emb, query_embedding))
        if sim > best_sim:
            best_sim, best_candidate = sim, c
    if best_candidate is not None and best_sim >= settings.FAQ_SIMILARITY_THRESHOLD:
        return best_candidate
    return None


def check_and_promote(
    db: Session,
    query: str,
    response_text: str,
    confidence_score: Optional[float],
    is_in_domain: bool,
    category: str = "General",
) -> bool:
    """
    Call after logging a chat query. Returns True if a new FAQ was just
    created as a result of this call.
    """
    if not is_in_domain:
        return False
    if confidence_score is None or confidence_score < settings.FAQ_AUTO_PROMOTE_MIN_CONFIDENCE:
        return False
    query = query.strip()
    if not query:
        return False

    try:
        query_embedding = _get_embedding(query)
        if query_embedding is None:
            return False  # embedder unavailable — fail safe, don't block chat

        if _find_matching_faq(db, query_embedding) is not None:
            return False  # already an FAQ, nothing to do

        candidate = _find_matching_candidate(db, query_embedding)

        if candidate is None:
            candidate = FAQCandidate(
                representative_question=query,
                embedding=json.dumps(query_embedding.tolist()),
                count=1,
                best_answer=response_text,
                best_confidence=confidence_score,
                category=category,
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)
        else:
            candidate.count = (candidate.count or 0) + 1
            if confidence_score > (candidate.best_confidence or 0):
                candidate.best_answer = response_text
                candidate.best_confidence = confidence_score
            db.commit()
            db.refresh(candidate)

        if candidate.count >= settings.FAQ_AUTO_PROMOTE_THRESHOLD:
            new_faq = FAQ(
                question=candidate.representative_question,
                answer=candidate.best_answer or response_text,
                category=candidate.category,
                is_active=True,
                usage_count=candidate.count,
            )
            db.add(new_faq)
            db.delete(candidate)
            db.commit()
            logger.info(
                f"📌 Auto-promoted to FAQ after {candidate.count} (paraphrased) "
                f"repeats: {new_faq.question[:60]}..."
            )
            return True

        return False

    except Exception as e:
        logger.error(f"FAQ auto-promotion check failed: {e}")
        db.rollback()
        return False
