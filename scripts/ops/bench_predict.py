"""Latency benchmark of POST /api/fraud/predict through the running stack (browser path: API -> engine -> DB).

    python scripts/ops/bench_predict.py --email you@example.com --password ... [--n 60] [--api http://localhost:5000]

The password can also come from the FG_BENCH_PASSWORD environment variable. Each request scores one stored
transaction (it also persists the prediction), so the numbers include the API, the engine and the database.
"""
import argparse
import json
import os
import statistics
import time
import urllib.error
import urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--api", default="http://localhost:5000")
ap.add_argument("--email", required=True)
ap.add_argument("--password", default=os.environ.get("FG_BENCH_PASSWORD"))
ap.add_argument("--n", type=int, default=25)
ap.add_argument("--delay", type=float, default=2.2, help="seconds between requests; the endpoint is rate limited (HTTP 429)")
a = ap.parse_args()
if not a.password:
    raise SystemExit("password missing: pass --password or set FG_BENCH_PASSWORD")

H = {"Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest"}


def call(method, path, body=None, cookie=None):
    h = dict(H)
    if cookie:
        h["Cookie"] = cookie
    req = urllib.request.Request(a.api + "/api" + path, method=method, headers=h,
                                 data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return r, (json.loads(raw) if raw else None)


r, _ = call("POST", "/auth/login", {"email": a.email, "password": a.password})
cookie = "; ".join(c.split(";")[0] for c in r.headers.get_all("Set-Cookie") or [])
_, tx = call("GET", "/transactions?pageSize=50", cookie=cookie)
data = tx.get("data", tx)
items = data.get("items") or data.get("transactions") or (data if isinstance(data, list) else [])
ids = [t.get("transactionId") or t.get("id") for t in items if (t.get("transactionId") or t.get("id"))]
if not ids:
    raise SystemExit("no transactions found to score")

times, fails, limited = [], 0, 0
for i in range(a.n):
    tid = ids[i % len(ids)]
    t0 = time.perf_counter()
    try:
        call("POST", "/fraud/predict", {"transactionId": tid}, cookie)
        times.append((time.perf_counter() - t0) * 1000)
    except urllib.error.HTTPError as e:
        limited += e.code == 429
        fails += e.code != 429
    except Exception:
        fails += 1
    time.sleep(a.delay)

times.sort()
pct = lambda p: times[min(len(times) - 1, int(p * len(times)))]
print(f"requests={a.n} ok={len(times)} rate_limited={limited} failed={fails} distinct_transactions={min(len(ids), a.n)}")
if times:
    print(f"latency ms: min={times[0]:.0f} median={statistics.median(times):.0f} p95={pct(0.95):.0f} p99={pct(0.99):.0f} max={times[-1]:.0f}")
