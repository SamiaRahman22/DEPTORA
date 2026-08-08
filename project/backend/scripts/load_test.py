"""
Scalability / Load Test Script.
Fires concurrent chat requests at the live API and measures response time and
success rate at increasing concurrency levels — the actual measurement behind
a "scalability testing" table (1 / 10 / 50 / 100 concurrent users).

Requires the backend to be running (uvicorn) with Ollama + Redis reachable:

    python scripts/load_test.py

Results print to console and save to data/load_test_results.json.

Note: each concurrency level reuses a small pool of real, varied queries so
results aren't skewed by cache hits alone — but repeated runs will show
improving numbers as more responses get cached, which is worth noting in
your report rather than treating a single run as the final word.
"""

import sys
import os
import json
import asyncio
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

API_BASE = os.environ.get("DEPTAI_API_BASE", "http://localhost:8000/api")
STUDENT_EMAIL = os.environ.get("DEPTAI_TEST_STUDENT", "student@test.edu")
STUDENT_PASSWORD = os.environ.get("DEPTAI_TEST_STUDENT_PW", "student123")

CONCURRENCY_LEVELS = [1, 10, 50, 100]

SAMPLE_QUERIES = [
    "What is the minimum CGPA required to graduate?",
    "How do I submit my thesis?",
    "When is the course registration deadline?",
    "What is the attendance policy?",
    "How do I apply for a scholarship?",
    "Who is the department head?",
    "How do I get my official transcript?",
    "Can I take courses from other departments?",
    "When are tuition fees due?",
    "How do I register for thesis?",
]


async def _one_request(client: httpx.AsyncClient, query: str) -> dict:
    start = time.perf_counter()
    try:
        resp = await client.post("/chat/message", json={"message": query})
        elapsed_ms = (time.perf_counter() - start) * 1000
        return {"success": resp.status_code == 200, "status_code": resp.status_code, "elapsed_ms": elapsed_ms}
    except Exception as e:
        elapsed_ms = (time.perf_counter() - start) * 1000
        return {"success": False, "status_code": None, "error": str(e), "elapsed_ms": elapsed_ms}


async def run_level(client: httpx.AsyncClient, concurrency: int) -> dict:
    queries = [SAMPLE_QUERIES[i % len(SAMPLE_QUERIES)] for i in range(concurrency)]
    start = time.perf_counter()
    results = await asyncio.gather(*[_one_request(client, q) for q in queries])
    wall_ms = (time.perf_counter() - start) * 1000

    successes = [r for r in results if r["success"]]
    times = [r["elapsed_ms"] for r in results]
    times.sort()
    n = len(times)

    return {
        "concurrency": concurrency,
        "total_requests": n,
        "successful": len(successes),
        "success_rate": round(len(successes) / n * 100, 1) if n else 0.0,
        "avg_response_ms": round(sum(times) / n, 1) if n else None,
        "p95_response_ms": round(times[min(n - 1, int(n * 0.95))], 1) if n else None,
        "max_response_ms": round(times[-1], 1) if n else None,
        "wall_clock_ms": round(wall_ms, 1),
        "throughput_req_per_sec": round(n / (wall_ms / 1000), 2) if wall_ms else None,
    }


async def main():
    print("=" * 70)
    print("DeptAI — Scalability / Load Test")
    print(f"Run at: {datetime.utcnow().isoformat()}Z")
    print("=" * 70)

    async with httpx.AsyncClient(base_url=API_BASE, timeout=60.0) as client:
        login = await client.post("/auth/login", json={"email": STUDENT_EMAIL, "password": STUDENT_PASSWORD})
        if login.status_code != 200:
            print(f"Login failed ({login.status_code}): {login.text}")
            print("Is the backend running? Has the DB been seeded (scripts/seed_db.py)?")
            return
        token = login.json()["access_token"]
        client.headers["Authorization"] = f"Bearer {token}"

        all_results = []
        for level in CONCURRENCY_LEVELS:
            print(f"\nTesting {level} concurrent request(s)...")
            result = await run_level(client, level)
            all_results.append(result)
            print(f"  Success rate: {result['success_rate']}% | "
                  f"Avg: {result['avg_response_ms']}ms | p95: {result['p95_response_ms']}ms | "
                  f"Throughput: {result['throughput_req_per_sec']} req/s")

    output = {"generated_at": datetime.utcnow().isoformat() + "Z", "levels": all_results}
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "load_test_results.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved full results to {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
