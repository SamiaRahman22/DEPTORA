"""Admin-only endpoints: dashboard stats, query logs, user management."""

import os
import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_admin, hash_password
from app.models.user import User
from app.models.query_log import QueryLog
from app.models.faq import FAQ
from app.models.document import Document
from app.models.procedure import Procedure
from app.services.cache_service import cache_service

router = APIRouter()

EVAL_RESULTS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "eval_results.json"
)
ANSWER_QUALITY_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "answer_quality_results.json"
)
LOAD_TEST_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "load_test_results.json"
)


def _load_json_if_exists(path):
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


@router.get("/dashboard")
async def dashboard_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Comprehensive dashboard statistics."""
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    total_queries = db.query(QueryLog).filter(QueryLog.created_at >= thirty_days_ago).count()
    resolved = db.query(QueryLog).filter(
        QueryLog.created_at >= thirty_days_ago, QueryLog.status == "resolved"
    ).count()
    rejected = db.query(QueryLog).filter(
        QueryLog.created_at >= thirty_days_ago, QueryLog.is_in_domain == False
    ).count()
    active_students = db.query(User).filter(User.role == "student", User.is_active == True).count()
    faq_count = db.query(FAQ).filter(FAQ.is_active == True).count()
    doc_count = db.query(Document).filter(Document.status == "indexed").count()
    proc_count = db.query(Procedure).filter(Procedure.is_active == True).count()

    avg_response = db.query(func.avg(QueryLog.response_time_ms)).filter(
        QueryLog.created_at >= thirty_days_ago,
        QueryLog.response_time_ms.isnot(None)
    ).scalar() or 0

    # Recent activity
    recent_logs = db.query(QueryLog).order_by(desc(QueryLog.created_at)).limit(10).all()

    return {
        "stats": {
            "total_queries_30d": total_queries,
            "resolved": resolved,
            "rejected_ood": rejected,
            "resolution_rate": round(resolved / total_queries * 100, 1) if total_queries else 0,
            "active_students": active_students,
            "faq_count": faq_count,
            "document_count": doc_count,
            "procedure_count": proc_count,
            "avg_response_ms": round(avg_response),
        },
        "recent_activity": [
            {
                "id": l.id,
                "query": l.query[:100],
                "status": l.status,
                "is_in_domain": l.is_in_domain,
                "response_time_ms": l.response_time_ms,
                "created_at": l.created_at.isoformat(),
            }
            for l in recent_logs
        ],
    }


@router.get("/performance")
async def performance_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Real, measured system performance — no placeholder numbers.

    Combines two sources:
    - Live aggregates computed on-demand from the database (always current)
    - The last offline run of scripts/evaluate_system.py (domain-restriction
      accuracy against a labeled test set, and retrieval latency), which is
      loaded from data/eval_results.json if it exists.
    """
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    logs = db.query(QueryLog).filter(QueryLog.created_at >= thirty_days_ago).all()
    total_logs = len(logs)

    response_times = [l.response_time_ms for l in logs if l.response_time_ms is not None]
    confidences = [l.confidence_score for l in logs if l.confidence_score is not None]
    method_counts = {}
    for l in logs:
        m = l.retrieval_method or "unknown"
        method_counts[m] = method_counts.get(m, 0) + 1

    response_time_stats = None
    if response_times:
        response_times.sort()
        n = len(response_times)
        response_time_stats = {
            "avg_ms": round(sum(response_times) / n, 1),
            "p50_ms": response_times[n // 2],
            "p95_ms": response_times[min(n - 1, int(n * 0.95))],
            "min_ms": response_times[0],
            "max_ms": response_times[-1],
            "sample_size": n,
        }

    docs = db.query(Document).all()
    doc_total = len(docs)
    doc_indexed = sum(1 for d in docs if d.status == "indexed")
    doc_failed = sum(1 for d in docs if d.status == "failed")

    # ── Response validation / hallucination rate (from persisted validator output) ──
    validity_flags = [l.is_valid for l in logs if l.is_valid is not None]
    unverified_counts = [l.unverified_claims_count for l in logs if l.unverified_claims_count is not None]
    hallucination_stats = None
    if validity_flags:
        flagged = sum(1 for v in validity_flags if v is False)
        hallucination_stats = {
            "sample_size": len(validity_flags),
            "flagged_as_hallucinated": flagged,
            "hallucination_rate": round(flagged / len(validity_flags) * 100, 1),
            "faithfulness_rate": round((len(validity_flags) - flagged) / len(validity_flags) * 100, 1),
            "avg_unverified_claims": round(sum(unverified_counts) / len(unverified_counts), 2) if unverified_counts else None,
        }

    # ── Human-graded answer accuracy (admin_rating set from the Query Logs panel) ──
    rated = [l.admin_rating for l in logs if l.admin_rating]
    answer_accuracy_stats = None
    if rated:
        correct = rated.count("correct")
        partial = rated.count("partial")
        incorrect = rated.count("incorrect")
        answer_accuracy_stats = {
            "reviewed_count": len(rated),
            "correct": correct,
            "partial": partial,
            "incorrect": incorrect,
            "accuracy_rate": round(correct / len(rated) * 100, 1),
            "accuracy_rate_incl_partial": round((correct + 0.5 * partial) / len(rated) * 100, 1),
        }

    # ── System reliability: error rate, throughput ──
    failed = sum(1 for l in logs if l.status == "failed")
    error_rate = round(failed / total_logs * 100, 1) if total_logs else None
    oldest = min((l.created_at for l in logs), default=None)
    newest = max((l.created_at for l in logs), default=None)
    throughput_per_hour = None
    if oldest and newest and total_logs:
        span_hours = max((newest - oldest).total_seconds() / 3600, 1 / 60)  # avoid div-by-zero on a single-minute burst
        throughput_per_hour = round(total_logs / span_hours, 2)

    # ── Cache effectiveness: time saved (avg cached vs avg non-cached response time) ──
    cache_stats = cache_service.get_stats()
    cached_times = [l.response_time_ms for l in logs if l.status == "resolved_cached" and l.response_time_ms is not None]
    noncached_times = [l.response_time_ms for l in logs if l.status != "resolved_cached" and l.response_time_ms is not None]
    if cached_times and noncached_times:
        avg_cached = sum(cached_times) / len(cached_times)
        avg_noncached = sum(noncached_times) / len(noncached_times)
        cache_stats["avg_cached_response_ms"] = round(avg_cached, 1)
        cache_stats["avg_noncached_response_ms"] = round(avg_noncached, 1)
        cache_stats["est_ms_saved_per_hit"] = round(max(avg_noncached - avg_cached, 0), 1)

    live_stats = {
        "response_time": response_time_stats,
        "avg_confidence_score": round(sum(confidences) / len(confidences), 3) if confidences else None,
        "low_confidence_response_count": sum(1 for c in confidences if c < 0.5) if confidences else 0,
        "retrieval_method_breakdown": method_counts,
        "domain_rejection_rate": round(
            sum(1 for l in logs if l.is_in_domain is False) / total_logs * 100, 1
        ) if total_logs else None,
        "total_queries_30d": total_logs,
        "throughput_per_hour": throughput_per_hour,
        "error_rate": error_rate,
        "hallucination": hallucination_stats,
        "answer_accuracy": answer_accuracy_stats,
        "document_indexing": {
            "total_uploaded": doc_total,
            "indexed": doc_indexed,
            "failed": doc_failed,
            "extraction_success_rate": round(doc_indexed / doc_total * 100, 1) if doc_total else None,
        },
        "cache": cache_stats,
    }

    eval_results = None
    eval_generated_at = None
    if os.path.exists(EVAL_RESULTS_PATH):
        try:
            with open(EVAL_RESULTS_PATH) as f:
                raw = json.load(f)
            eval_generated_at = raw.get("generated_at")
            eval_results = {
                "domain_restriction": raw.get("domain_restriction"),
                "retrieval_latency": raw.get("retrieval_latency"),
                "retrieval_quality": raw.get("retrieval_quality"),
                "retrieval_baseline_comparison": raw.get("retrieval_baseline_comparison"),
            }
        except Exception:
            eval_results = None

    answer_quality = _load_json_if_exists(ANSWER_QUALITY_PATH)
    load_test = _load_json_if_exists(LOAD_TEST_PATH)

    return {
        "live": live_stats,
        "offline_evaluation": eval_results,
        "offline_evaluation_generated_at": eval_generated_at,
        "offline_evaluation_note": (
            None if eval_results else
            "No evaluation run yet. Run `python scripts/evaluate_system.py` on the "
            "backend to measure domain-restriction accuracy, retrieval quality, and retrieval latency."
        ),
        "answer_quality": answer_quality.get("summary") if answer_quality else None,
        "answer_quality_generated_at": answer_quality.get("generated_at") if answer_quality else None,
        "answer_quality_note": (
            None if answer_quality else
            "No answer-quality run yet. Run `python scripts/evaluate_answer_quality.py` "
            "(server must be running) to score generated answers against FAQ reference answers."
        ),
        "scalability": load_test.get("levels") if load_test else None,
        "scalability_generated_at": load_test.get("generated_at") if load_test else None,
        "scalability_note": (
            None if load_test else
            "No load test run yet. Run `python scripts/load_test.py` "
            "(server must be running) to measure response time and success rate at increasing concurrency."
        ),
    }


@router.patch("/logs/{log_id}/rate")
async def rate_query_log(
    log_id: int,
    rating: str = Query(..., pattern="^(correct|partial|incorrect)$"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Human-graded answer accuracy. The system can't judge whether an answer is
    factually correct on its own — an admin marks resolved queries as
    correct/partial/incorrect from the Query Logs panel, and /performance
    aggregates these into a real, defensible "Answer Accuracy" figure.
    """
    from fastapi import HTTPException
    log = db.query(QueryLog).filter(QueryLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Query log not found")
    log.admin_rating = rating
    db.commit()
    return {"id": log.id, "admin_rating": log.admin_rating}


@router.get("/logs")
async def query_logs(
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    in_domain: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Paginated query logs with filtering."""
    q = db.query(QueryLog).order_by(desc(QueryLog.created_at))

    if status:
        q = q.filter(QueryLog.status == status)
    if in_domain is not None:
        q = q.filter(QueryLog.is_in_domain == in_domain)
    if search:
        q = q.filter(QueryLog.query.ilike(f"%{search}%"))

    total = q.count()
    logs = q.offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "logs": [
            {
                "id": l.id,
                "user_id": l.user_id,
                "query": l.query,
                "response": l.response[:500] if l.response else None,
                "is_in_domain": l.is_in_domain,
                "domain_score": l.domain_score,
                "retrieval_method": l.retrieval_method,
                "sources_used": l.sources_used,
                "response_time_ms": l.response_time_ms,
                "status": l.status,
                "confidence_score": l.confidence_score,
                "is_valid": l.is_valid,
                "unverified_claims_count": l.unverified_claims_count,
                "admin_rating": l.admin_rating,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
    }


@router.get("/users")
async def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    users = db.query(User).filter(User.role == "student").order_by(desc(User.created_at)).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "student_id": u.student_id,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "query_count": u.query_logs.count(),
        }
        for u in users
    ]


@router.post("/users/{user_id}/toggle")
async def toggle_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.post("/seed")
async def seed_database(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Seed initial FAQs and procedures (idempotent)."""
    if db.query(FAQ).count() > 0:
        return {"message": "Already seeded"}

    faqs = [
        FAQ(question="What is the minimum CGPA requirement to graduate?",
            answer="Students must maintain a minimum CGPA of 2.5 to be eligible for graduation. Students with CGPA below 2.0 will receive academic probation.",
            category="Academic", is_active=True, created_by=admin.id),
        FAQ(question="How do I get my official transcript?",
            answer="Submit Form TR-01 to the department office. Processing takes 5-7 working days. Rush processing (2 days) is available at additional cost.",
            category="Administrative", is_active=True, created_by=admin.id),
        FAQ(question="What is the attendance policy?",
            answer="Minimum 75% attendance is required to sit for final exams. Below 75% results in automatic NC (Not Complete) grade. Medical certificates must be submitted within 3 working days.",
            category="Exams", is_active=True, created_by=admin.id),
        FAQ(question="When are tuition fees due?",
            answer="Fees are due within the first 2 weeks of each semester. Late payment incurs a 2% monthly surcharge. Scholarship students must confirm renewal annually.",
            category="Fees", is_active=True, created_by=admin.id),
        FAQ(question="Can I take courses from other departments?",
            answer="Yes, with advisor approval. Elective slots allow up to 2 courses from other departments per semester, subject to prerequisites.",
            category="Academic", is_active=True, created_by=admin.id),
    ]
    db.add_all(faqs)

    procedures = [
        Procedure(
            title="Thesis Submission Process", category="Academic",
            steps=["Get supervisor approval by November 30", "Upload soft copy to portal by December 15",
                   "Submit 3 hard copies to department office by December 17",
                   "Pay binding fee at accounts section", "Collect receipt and submit to coordinator"],
            is_active=True, created_by=admin.id
        ),
        Procedure(
            title="Course Waiver Application", category="Administrative",
            steps=["Obtain Form DW-01 from department office",
                   "Attach syllabi from equivalent course at previous institution",
                   "Get supervisor signature", "Submit to Academic Section before add/drop deadline",
                   "Await 7-10 day processing time"],
            is_active=True, created_by=admin.id
        ),
        Procedure(
            title="Official Transcript Request", category="Administrative",
            steps=["Fill Form TR-01 at department office", "Pay applicable fee at accounts",
                   "Attach payment receipt to form", "Submit to department office",
                   "Collect after 5-7 working days"],
            is_active=True, created_by=admin.id
        ),
    ]
    db.add_all(procedures)
    db.commit()
    return {"message": "Database seeded successfully", "faqs": len(faqs), "procedures": len(procedures)}
