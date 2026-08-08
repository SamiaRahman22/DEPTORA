"""
Chat endpoint — the heart of the system.
Pipeline: Query → Domain Check → Structured Retrieval → RAG Retrieval → Ollama LLM → Response
"""

import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_student
from app.models.user import User
from app.models.query_log import QueryLog
from app.rag.pipeline import rag_pipeline
from app.services.domain_checker import domain_checker
from app.services.structured_retrieval import structured_retrieval
from app.services.ollama_client import ollama_client
from app.services.response_validator import response_validator
from app.services.cache_service import cache_service
from app.services import faq_promotion

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None
    conversation_history: Optional[List[dict]] = []


class ChatResponse(BaseModel):
    response: str
    is_in_domain: bool
    sources: List[str] = []
    retrieval_method: str = "none"
    response_time_ms: int
    session_id: str
    confidence_score: float = 0.5  # NEW
    new_faq_added: bool = False  # NEW — true the exact moment this question crosses the auto-promotion threshold


@router.post("/message", response_model=ChatResponse)
async def chat_message(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Main chat endpoint implementing the hybrid RAG pipeline.
    
    Pipeline:
    1. Domain check — reject non-department queries
    2. Structured retrieval — search FAQs and procedures
    3. RAG retrieval — semantic search in FAISS index
    4. Hybrid context assembly
    5. Ollama LLM generation with context
    6. Log the query
    """
    start_time = time.time()
    session_id = request.session_id or str(uuid.uuid4())
    query = request.message.strip()

    # ── STEP 0.5: CHECK CACHE (NEW) ──
    cached_response = cache_service.get(query)
    if cached_response:
        response_ms = int((time.time() - start_time) * 1000)
        cached_confidence = cached_response.get("confidence_score", 0.8)
        try:
            faq_just_added = faq_promotion.check_and_promote(
                db, query, cached_response["response"], cached_confidence, True
            )
        except Exception as e:
            logger.error(f"FAQ auto-promotion errored (non-fatal): {e}")
            faq_just_added = False
        background_tasks.add_task(
            _log_query, db, current_user.id, query, cached_response["response"],
            True, cached_confidence, "resolved_cached",
            cached_response.get("sources", []), session_id, response_ms,
            confidence_score=cached_confidence,
            is_valid=cached_response.get("is_valid"),
            unverified_claims_count=cached_response.get("unverified_claims_count"),
        )
        return ChatResponse(
            response=cached_response["response"],
            is_in_domain=cached_response.get("is_in_domain", True),
            sources=cached_response.get("sources", []),
            retrieval_method=cached_response.get("retrieval_method", "cache"),
            response_time_ms=response_ms,
            session_id=session_id,
            confidence_score=cached_confidence,
            new_faq_added=faq_just_added,
        )

    # ── STEP 1: DOMAIN CHECK (Multi-layer with confidence) ──
    domain_result = await domain_checker.check(query)
    domain_confidence = domain_result.confidence_score
    
    # Route based on confidence score
    if domain_result.confidence_score == 0.0:
        # HARD REJECT: Clearly out of domain
        response_ms = int((time.time() - start_time) * 1000)
        rejection_msg = (
            "⚠️ **Out-of-Domain Query Detected**\n\n"
            "I can only answer questions related to the department — "
            "courses, procedures, faculty, notices, deadlines, and academic policies.\n\n"
            "Please rephrase your question to be department-related, or contact "
            "the main university helpdesk for general queries."
        )
        background_tasks.add_task(
            _log_query, db, current_user.id, query, rejection_msg,
            False, domain_result.confidence_score, "rejected", [], session_id, response_ms,
            confidence_score=0.0, is_valid=None, unverified_claims_count=None,
        )
        return ChatResponse(
            response=rejection_msg,
            is_in_domain=False,
            sources=[],
            retrieval_method="domain_filter",
            response_time_ms=response_ms,
            session_id=session_id,
            confidence_score=0.0,
        )
    
    # For medium/low confidence, we'll still try to answer but with caveats
    # This will be handled later when generating response

    # ── STEP 2: STRUCTURED RETRIEVAL (FAQs + Procedures) ──
    structured_context = await structured_retrieval.retrieve(query, db)

    # ── STEP 3: RAG RETRIEVAL (FAISS semantic search) ──
    rag_context = []
    rag_sources = []
    if rag_pipeline.is_ready:
        rag_result = await rag_pipeline.retrieve(query, top_k=5)
        rag_context = rag_result.chunks
        rag_sources = rag_result.sources
    else:
        logger.warning("RAG pipeline not ready — using structured retrieval only")

    # ── STEP 4: DETERMINE RETRIEVAL METHOD ──
    retrieval_method = "none"
    if structured_context and rag_context:
        retrieval_method = "hybrid"
    elif structured_context:
        retrieval_method = "structured"
    elif rag_context:
        retrieval_method = "rag"

    # ── STEP 5: ASSEMBLE CONTEXT ──
    all_sources = list(set(rag_sources))
    context_parts = []

    if structured_context:
        context_parts.append("## Department Knowledge Base (FAQs & Procedures)\n" + structured_context)
    if rag_context:
        context_parts.append("## Retrieved Document Excerpts\n" + "\n\n---\n".join(rag_context))

    full_context = "\n\n".join(context_parts) if context_parts else ""

    # ── STEP 6: LLM GENERATION ──
    ollama_succeeded = False
    try:
        response_text = await ollama_client.generate(
            query=query,
            context=full_context,
            conversation_history=request.conversation_history or [],
            department=current_user.department,
        )
        ollama_succeeded = True
        
        # ── STEP 6.5: RESPONSE VALIDATION (NEW) ──
        from app.services.response_validator import response_validator
        validation_result = response_validator.validate_response(
            response=response_text,
            source_chunks=rag_context + [structured_context] if structured_context else rag_context,
            query=query
        )
        response_confidence = validation_result["confidence_score"]
        response_is_valid = validation_result["is_valid"]
        response_unverified_count = len(validation_result["unverified_claims"])
        
        # If confidence low, add disclaimer
        if response_confidence < 0.5:
            response_text += "\n\n⚠️ **Note:** This answer has limited source backing. For critical information, please verify with the department office."
        
        logger.info(f"Response validation: confidence={response_confidence:.2f}, unverified={response_unverified_count}")
        
    except Exception as e:
        logger.error(f"Ollama generation failed: {type(e).__name__}: {e}")
        if full_context:
            response_text = (
                "Based on the department knowledge base:\n\n" + full_context[:1500]
                + "\n\n*Note: AI synthesis unavailable. Showing raw retrieved context.*"
            )
        else:
            response_text = (
                "I couldn't find specific information about that in the department knowledge base. "
                "Please contact the department office directly for assistance."
            )
        response_confidence = 0.3
        response_is_valid = None
        response_unverified_count = None

    response_ms = int((time.time() - start_time) * 1000)

    # ── STEP 6.6: FAQ AUTO-PROMOTION (synchronous — must happen before the
    # response is returned, so the asking user sees it appear immediately) ──
    try:
        faq_just_added = faq_promotion.check_and_promote(
            db, query, response_text, response_confidence, True
        )
    except Exception as e:
        logger.error(f"FAQ auto-promotion errored (non-fatal): {e}")
        faq_just_added = False

    # ── STEP 7: LOG IN BACKGROUND ──
    status = "resolved" if full_context else "partial"
    background_tasks.add_task(
        _log_query, db, current_user.id, query, response_text,
        True, domain_result.confidence_score, status, all_sources, session_id, response_ms,
        confidence_score=response_confidence, is_valid=response_is_valid,
        unverified_claims_count=response_unverified_count,
    )
    # ── STEP 7.5: CACHE RESPONSE (NEW) ──
    # Only cache real, successfully-generated answers. Caching the fallback
    # (raw context dump, used when Ollama itself failed) would mean every
    # future ask of this question gets stuck with that degraded answer for
    # the full cache TTL, even after Ollama recovers.
    if ollama_succeeded:
        cache_response = {
            "response": response_text,
            "is_in_domain": True,
            "sources": all_sources,
            "retrieval_method": retrieval_method,
            "confidence_score": response_confidence,
            "is_valid": response_is_valid,
            "unverified_claims_count": response_unverified_count,
        }
        background_tasks.add_task(cache_service.set, query, cache_response)

    return ChatResponse(
        response=response_text,
        is_in_domain=True,
        sources=all_sources,
        retrieval_method=retrieval_method,
        response_time_ms=response_ms,
        session_id=session_id,
        confidence_score=max(response_confidence * domain_confidence, 0.1),  # NEW
        new_faq_added=faq_just_added,
    )


@router.get("/history")
async def get_chat_history(
    limit: int = 20,
    current_user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Get recent chat history for current user."""
    logs = (
        db.query(QueryLog)
        .filter(QueryLog.user_id == current_user.id, QueryLog.is_in_domain == True)
        .order_by(QueryLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "query": l.query,
            "response": l.response,
            "sources": l.sources_used,
            "created_at": l.created_at.isoformat(),
        }
        for l in reversed(logs)
    ]


# ── BACKGROUND TASK ──
def _log_query(
    db: Session, user_id, query, response, is_in_domain,
    domain_score, status, sources, session_id, response_ms,
    confidence_score=None, is_valid=None, unverified_claims_count=None,
):
    try:
        log = QueryLog(
            user_id=user_id,
            query=query,
            response=response,
            is_in_domain=is_in_domain,
            domain_score=domain_score,
            status=status,
            sources_used=sources,
            session_id=session_id,
            response_time_ms=response_ms,
            confidence_score=confidence_score if confidence_score is not None else 0.5,
            is_valid=is_valid,
            unverified_claims_count=unverified_claims_count,
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log query: {e}")
        db.rollback()
