"""
Answer Quality Evaluation Script.
Measures response quality against REAL reference answers — your seeded FAQ
answers — by sending each FAQ question through the live chat pipeline (exactly
what a student would get) and scoring the generated response against the
stored FAQ answer.

Metrics (implemented directly, no extra dependencies needed):
  - BLEU-1..4 (standard n-gram precision with brevity penalty)
  - ROUGE-L (longest common subsequence based F1)
  - Semantic similarity (cosine similarity via the app's own SentenceTransformer
    embedder — used as an embedding-based proxy for BERTScore, since pulling in
    a separate BERTScore model would mean downloading a second, unrelated
    transformer just to grade the first one)

Requires the backend to be running (uvicorn) with Ollama + Redis reachable:

    python scripts/evaluate_answer_quality.py

Results print to console and save to data/answer_quality_results.json.
"""

import sys
import os
import json
import time
import math
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

API_BASE = os.environ.get("DEPTAI_API_BASE", "http://localhost:8000/api")
STUDENT_EMAIL = os.environ.get("DEPTAI_TEST_STUDENT", "student@test.edu")
STUDENT_PASSWORD = os.environ.get("DEPTAI_TEST_STUDENT_PW", "student123")


# ══════════════════════════════════════════════════════════════
# Lightweight BLEU (no external deps)
# ══════════════════════════════════════════════════════════════
def _ngrams(tokens, n):
    return Counter(tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1))


def bleu_score(candidate: str, reference: str, max_n: int = 4) -> dict:
    cand_tokens = candidate.lower().split()
    ref_tokens = reference.lower().split()

    if not cand_tokens or not ref_tokens:
        return {f"bleu_{n}": 0.0 for n in range(1, max_n + 1)} | {"bleu": 0.0}

    precisions = []
    for n in range(1, max_n + 1):
        cand_ngrams = _ngrams(cand_tokens, n)
        ref_ngrams = _ngrams(ref_tokens, n)
        overlap = sum(min(cand_ngrams[g], ref_ngrams[g]) for g in cand_ngrams)
        total = max(sum(cand_ngrams.values()), 1)
        precisions.append(overlap / total)

    # Brevity penalty
    bp = 1.0 if len(cand_tokens) > len(ref_tokens) else math.exp(1 - len(ref_tokens) / max(len(cand_tokens), 1))

    per_n = {f"bleu_{n}": round(p * 100, 1) for n, p in enumerate(precisions, 1)}
    nonzero = [p for p in precisions if p > 0]
    geo_mean = math.exp(sum(math.log(p) for p in nonzero) / len(nonzero)) if nonzero else 0.0
    per_n["bleu"] = round(bp * geo_mean * 100, 1)
    return per_n


# ══════════════════════════════════════════════════════════════
# Lightweight ROUGE-L (LCS-based F1, no external deps)
# ══════════════════════════════════════════════════════════════
def _lcs_length(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            dp[i][j] = dp[i - 1][j - 1] + 1 if a[i - 1] == b[j - 1] else max(dp[i - 1][j], dp[i][j - 1])
    return dp[-1][-1]


def rouge_l_score(candidate: str, reference: str) -> float:
    cand_tokens = candidate.lower().split()
    ref_tokens = reference.lower().split()
    if not cand_tokens or not ref_tokens:
        return 0.0
    lcs = _lcs_length(cand_tokens, ref_tokens)
    precision = lcs / len(cand_tokens)
    recall = lcs / len(ref_tokens)
    if precision + recall == 0:
        return 0.0
    f1 = 2 * precision * recall / (precision + recall)
    return round(f1 * 100, 1)


def semantic_similarity(candidate: str, reference: str) -> float:
    """Cosine similarity via the app's own embedder (BERTScore-style proxy)."""
    from app.rag.embedder import embedding_service
    import numpy as np
    if not embedding_service.is_loaded or not candidate.strip() or not reference.strip():
        return None
    emb = embedding_service.embed_texts([candidate, reference])
    cand_vec, ref_vec = emb[0], emb[1]
    sim = float(np.dot(cand_vec, ref_vec) / (np.linalg.norm(cand_vec) * np.linalg.norm(ref_vec) + 1e-8))
    return round(max(0.0, min(1.0, (sim + 1) / 2)) * 100, 1)


def main():
    print("=" * 70)
    print("DeptAI — Answer Quality Evaluation (vs FAQ reference answers)")
    print(f"Run at: {datetime.utcnow().isoformat()}Z")
    print("=" * 70)

    from app.core.database import SessionLocal
    from app.models.faq import FAQ

    db = SessionLocal()
    faqs = db.query(FAQ).filter(FAQ.is_active == True).all()
    db.close()

    if not faqs:
        print("No active FAQs found. Seed the database first: python scripts/seed_db.py")
        return

    client = httpx.Client(base_url=API_BASE, timeout=60.0)

    login = client.post("/auth/login", json={"email": STUDENT_EMAIL, "password": STUDENT_PASSWORD})
    if login.status_code != 200:
        print(f"Login failed ({login.status_code}): {login.text}")
        print("Is the backend running? Has the DB been seeded (scripts/seed_db.py)?")
        return
    token = login.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    results = []
    for faq in faqs:
        try:
            resp = client.post("/chat/message", json={"message": faq.question})
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  Query failed for '{faq.question[:50]}...': {e}")
            continue

        generated = data["response"]
        reference = faq.answer

        bleu = bleu_score(generated, reference)
        rouge_l = rouge_l_score(generated, reference)
        sem_sim = semantic_similarity(generated, reference)

        results.append({
            "question": faq.question,
            "reference_answer": reference,
            "generated_answer": generated,
            "retrieval_method": data.get("retrieval_method"),
            "confidence_score": data.get("confidence_score"),
            "bleu": bleu["bleu"],
            "bleu_breakdown": bleu,
            "rouge_l": rouge_l,
            "semantic_similarity": sem_sim,
        })
        print(f"  '{faq.question[:55]}...' → BLEU {bleu['bleu']}, ROUGE-L {rouge_l}, "
              f"semantic sim {sem_sim}")

    if not results:
        print("\nNo results collected — nothing to save.")
        return

    n = len(results)
    summary = {
        "n": n,
        "avg_bleu": round(sum(r["bleu"] for r in results) / n, 1),
        "avg_rouge_l": round(sum(r["rouge_l"] for r in results) / n, 1),
        "avg_semantic_similarity": round(
            sum(r["semantic_similarity"] for r in results if r["semantic_similarity"] is not None) /
            max(sum(1 for r in results if r["semantic_similarity"] is not None), 1), 1
        ),
    }

    print("\n" + "=" * 70)
    print(f"Summary over {n} FAQ questions:")
    print(f"  Avg BLEU: {summary['avg_bleu']}")
    print(f"  Avg ROUGE-L: {summary['avg_rouge_l']}")
    print(f"  Avg semantic similarity: {summary['avg_semantic_similarity']}%")
    print("=" * 70)

    output = {"generated_at": datetime.utcnow().isoformat() + "Z", "summary": summary, "per_question": results}
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "answer_quality_results.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved full results to {out_path}")


if __name__ == "__main__":
    main()
