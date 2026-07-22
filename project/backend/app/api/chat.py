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
        background_tasks.add_task(
            _log_query, db, current_user.id, query, cached_response["response"],
            True, cached_response.get("confidence_score", 0.8), "resolved_cached",
            cached_response.get("sources", []), session_id, response_ms
        )
        return ChatResponse(
            response=cached_response["response"],
            is_in_domain=cached_response.get("is_in_domain", True),
            sources=cached_response.get("sources", []),
            retrieval_method=cached_response.get("retrieval_method", "cache"),
            response_time_ms=response_ms,
            session_id=session_id,
            confidence_score=cached_response.get("confidence_score", 0.8),
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
            False, domain_result.confidence_score, "rejected", [], session_id, response_ms
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
    try:
        response_text = await ollama_client.generate(
            query=query,
            context=full_context,
            conversation_history=request.conversation_history or [],
            department=current_user.department,
        )
        
        # ── STEP 6.5: RESPONSE VALIDATION (NEW) ──
        from app.services.response_validator import response_validator
        validation_result = response_validator.validate_response(
            response=response_text,
            source_chunks=rag_context + [structured_context] if structured_context else rag_context,
            query=query
        )
        response_confidence = validation_result["confidence_score"]
        
        # If confidence low, add disclaimer
        if response_confidence < 0.5:
            response_text += "\n\n⚠️ **Note:** This answer has limited source backing. For critical information, please verify with the department office."
        
        logger.info(f"Response validation: confidence={response_confidence:.2f}, unverified={len(validation_result['unverified_claims'])}")
        
    except Exception as e:
        logger.error(f"Ollama generation failed: {e}")
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

    response_ms = int((time.time() - start_time) * 1000)

    # ── STEP 7: LOG IN BACKGROUND ──
    status = "resolved" if full_context else "partial"
    background_tasks.add_task(
        _log_query, db, current_user.id, query, response_text,
        True, domain_result.confidence_score, status, all_sources, session_id, response_ms
    )
    # ── STEP 7.5: CACHE RESPONSE (NEW) ──
    cache_response = {
        "response": response_text,
        "is_in_domain": True,
        "sources": all_sources,
        "retrieval_method": retrieval_method,
        "confidence_score": response_confidence,
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
    domain_score, status, sources, session_id, response_ms
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
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log query: {e}")
        db.rollback()
