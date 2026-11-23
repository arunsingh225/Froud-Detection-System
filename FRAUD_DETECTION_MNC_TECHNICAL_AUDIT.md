# FraudGuard AI — Technical Audit

**Scope:** local workspace at `Froud-Detection-System/` (branch `main`, HEAD `052bfd4`). No files other than this report were created or modified. Nothing was cloned, pushed or deleted.

**Method:** static source inspection plus the committed result artifacts (`models/*.json`, `data/processed/*.csv`). **I did not build the solution or run any test suite.** Every "passed/failed" statement below is taken from a committed document and is labelled as such. The raw datasets (`data/raw/`) and `train_features.parquet` are not present in the workspace, so the training results could not be reproduced.

Legend: ✅ implemented and seen in source · 🟡 partial · ❌ missing · ❓ unverified

---

## 1. Executive summary

FraudGuard AI is a three-tier fraud-investigation platform: Angular 17, then ASP.NET Core 8 with SQL Server, then a FastAPI service serving a LightGBM model trained on IEEE-CIS. It is unusually broad for a fresher project, and the engineering hygiene around auth and artifact integrity is above average.

**The central weakness is that the AI does not do what the README and UI imply.**

1. The model was trained on IEEE-CIS (Vesta e-commerce) features. The app's own transactions have no such features, so `FraudPredictionMapper` fabricates most of them with constants (`Card2=111`, `Card3=150`, `Card5=226`, `D15=20`, `ProductCD="W"`) and heuristics. The mapper's own comment admits scores are "not calibrated" and "should be treated as relative risk indicators". The displayed fraud probability is therefore not a real prediction about the real transaction.
2. The "Agentic AI investigator" is a rule engine plus TF-IDF search. `get_llm_provider()` always returns `DeterministicTemplateProvider`, even when `LLM_PROVIDER=openai` and a key are set. There is no LLM, no tool-calling, no planning loop and no memory.
3. When the investigator has no ML score, it scores a dummy payload (`card1=10000, addr1=100, gmail.com…`). If that throws, it **hard-codes `82.4`** as the fraud probability (`investigator_service.py`), which pushes the case to "HIGH / FLAGGED". That is a fabricated number presented as model output.
4. Model metrics are measured on the same validation set used for early stopping and threshold selection. They are optimistic. There is no untouched test set.
5. There is no Docker, no CI and no frontend test runner. Test status is only documented, never enforced.

**Score: 57 / 100.** It is a good portfolio project if it is described honestly (a demo platform wrapping a real IEEE-CIS model). It will be damaged in interviews if it is presented as production fraud detection on real bank transactions.

---

## 2. Actual local repository structure

Tracked files, grouped:

```
/ (root)
├─ README.md, walkthrough.md, metadata.json, .env.example, .gitignore
├─ package.json, angular.json, tailwind/postcss/tsconfig, proxy.conf.json
├─ 5× generate_and_run_*.py + calculate_metrics.py + download_and_extract_ieee.ps1
├─ 12× test_*.ps1 / verify_*.ps1 ad-hoc scripts        (root clutter)
├─ notebooks/ 01..04 (inspection, EDA, feature eng, training)
├─ data/processed/  CSV reports, PNG plots, validation_features.parquet (19.5 MB)
├─ models/ fraud_model.pkl (2.1 MB), preprocessing.pkl (1.1 MB), manifest, metadata, training_config
├─ docs/audit-remediation-baseline.md
└─ src/
   ├─ app/            Angular 17 standalone components (~4.8k LOC in pages/)
   ├─ backend/
   │   ├─ FraudGuard.Api/        13 controllers, ~20 services, EF Core, SignalR hub, 3 middlewares (~3.6k LOC services)
   │   ├─ FraudGuard.Api.Tests/  9 test files (xUnit, 35 [Fact]/[Theory] by my count)
   │   └─ sql/                   schema, seed, synthetic data, verification
   └─ ai_engine/      FastAPI app (config, routes, schemas, 7 services), knowledge_base/ (5 md), tests/ (6 files)
```

Git state: working tree clean except `.angular/cache/.../.tsbuildinfo` (modified). **No untracked files were found** and no local-only source changes exist beyond that cache file, so the local workspace equals `HEAD`.

**Hygiene problems in git:**
- 26 `__pycache__/*.pyc` files are tracked, even though `.gitignore` lists them.
- `.angular/cache/...` is tracked, even though `.gitignore` lists `.angular/`.
- A 19.5 MB parquet and pickled models are in plain git history.
- `.vs/`, `dist/` and `node_modules/` exist locally and are correctly ignored.

**Missing entirely:** `Dockerfile`, `docker-compose`, `.github/workflows`, any lint config, any frontend `test` script, `pyproject`/lockfile for Python.

---

## 3. Architecture assessment (9 / 15)

**Good**
- ✅ A clean split: UI, orchestration API with persistence, and a stateless ML microservice. The API is the only caller of the engine, secured by `X-Internal-Secret` with `secrets.compare_digest` (`ai_engine/app/main.py`).
- ✅ Interface-based DI on the backend (`IFastApiClient`, `IFraudPredictionService`, …). The LLM provider is an abstract `ILLMProvider` with a factory.
- ✅ The model is loaded once at startup. The service degrades instead of crashing and exposes `/health`.
- ✅ A central `Roles` class, `ApiResponse<T>` envelope, DTO separation, and global exception middleware.

**Weak**
- 🟡 **Service layer is anemic and fat.** `AnalyticsService` is a 17-method interface with direct `DbContext` use, repeated string-matching queries and magic numbers (`83.5m` appears in both `AnalyticsService` and `FraudPredictionMapper`). This breaks SRP and makes it hard to extend.
- 🟡 **Domain/ML contract mismatch is the key architectural flaw.** The ML schema (IEEE-CIS: `card1`, `C13`, `D15`, `V1…V339`) leaks into the API. A proper design defines a *domain feature contract* (amount, merchant category, velocity, device, geo) and trains on it, or uses a feature store.
- 🟡 Scoring is **synchronous inside the HTTP request** (`PredictAsync` then `SaveChangesAsync` in `TransactionService`). There is no queue, retry policy beyond EF's, circuit breaker or timeout budget beyond the 30 s client timeout.
- ❌ No Docker, so the three runtimes (Node, .NET, Python) must be started by hand from the README.
- ❌ Model versioning and registry are only a JSON manifest. There is no MLflow or DVC, and no canary or rollback.

---

## 4. Module-wise code review

### 4.1 AI engine, investigator fallback · **Critical**
`src/ai_engine/app/services/investigator_service.py` (Step 2):

```python
pred_req = PredictionRequest(TransactionAmt=ctx.amount_inr, ProductCD=ctx.payment_method or "W",
    card1=10000, addr1=100.0, P_emaildomain="gmail.com", C1=1.0, ...)
...
except Exception as e:
    ctx.model_fraud_probability = 82.4  # Fallback based on metadata
```

Problems:
- It passes **INR amounts as if they were USD**; the mapper divides by 83.5 but this path does not. It also sets `ProductCD` to the payment method string, which is not a valid IEEE-CIS code.
- It fabricates a 82.4 % probability when scoring fails. That value flows into the risk tier, the recommendation, the audit trail and the SAR workflow.
- `risk_tier = CRITICAL if any(severity == "critical")` combined with the fabricated score means failures look like fraud.

Fix (fail closed, never invent a score):

```python
try:
    pred = model_service.predict(self._to_prediction_request(ctx))
    ctx.model_fraud_probability = pred["fraud_probability"] * 100
except Exception:
    logger.exception("scoring failed")
    ctx.model_fraud_probability = None
    ctx.model_score_status = "UNAVAILABLE"   # surfaced in UI/response
# downstream: if None -> rule-only tiering, confidence capped, banner "ML score unavailable"
```

### 4.2 "LLM provider" does not call an LLM · **High**
`ai_engine/app/services/llm_provider.py`, `get_llm_provider()`:

```python
if api_key and provider_type in ["openai", "azure", "gemini"]:
    # For now, deterministic provider serves as zero-dependency safe baseline
    return DeterministicTemplateProvider()
return DeterministicTemplateProvider()
```

Setting `LLM_PROVIDER=openai` silently does nothing. The "confidence" values (`0.94, 0.89, 0.82, 0.85, 0.92`) are **hard-coded per branch**, not computed, yet they are persisted and shown as "AI confidence %" (`AIInvestigatorService.cs:236`).

An MNC-level implementation would:
- implement a real provider (Anthropic or OpenAI SDK) with structured output validated by Pydantic;
- constrain it to retrieved evidence and cite chunk IDs;
- keep the deterministic engine as an explicit fallback with `is_fallback=true` shown in the UI;
- drop fake confidence, or calibrate it and label it as a heuristic.

### 4.3 Feature mapper fabricates features · **High**
`FraudGuard.Api/Services/FraudPredictionMapper.cs`:

```csharp
Card2 = 111.0m, Card3 = 150.0m, Card5 = 226.0m, ProductCD = "W", D15 = 20.0m,
decimal? c13Val = (VPN || Tor) ? 15.0m : 2.0m;
long dtSeconds = Math.Abs(ts.ToUnixTimeSeconds() % (86400 * 180));
```

- `TransactionDT` in training is *seconds since a reference date over about 6 months*. Taking the unix time modulo 180 days gives an arbitrary offset, so `TransactionDay/Week/Hour` features are meaningless.
- `card1` is derived from a hash of the card last-4 (`StableHash`). That is identity noise, not a signal.
- `C13` is "velocity" but is faked from a VPN flag.

Net effect: the 464-feature model gets about 10 real-ish inputs and 450 NaNs/constants. The AUC 0.9168 in the metadata does **not** transfer to this pipeline.

Fix: either (a) retrain on the app's own domain features (generate labelled synthetic data with realistic fraud patterns), or (b) clearly present the score as a "demo IEEE-CIS model score" and gate decisions on rules, not on it.

### 4.4 Model evaluation methodology · **High** (see §5)

### 4.5 RAG · **Medium** (see §6)

### 4.6 Backend security and auth · mostly good, with gaps · **Medium**
Verified in source:
- ✅ Fail-fast JWT key (`JwtKeyResolver`, ≥32 bytes, no dev fallback).
- ✅ HttpOnly cookie, `Secure` and `SameSite=Strict` outside Development.
- ✅ PBKDF2 via `IPasswordHasher`, a dummy-hash timing equalizer, 5-strike lockout for 15 minutes, and audit logging of failed logins.
- ✅ Per-controller `[Authorize(Roles=…)]`, and the SignalR hub is `[Authorize]`.
- ✅ Security headers middleware, and CORS locked down outside Development.

Gaps:

| # | Issue | Severity |
|---|---|---|
| a | `TokenRevocationService` is an in-memory dictionary. A restart or a second instance resurrects revoked tokens for up to the 60-minute JWT lifetime. | Medium |
| b | `README.md` publishes `password123` for ADMIN/INVESTIGATOR/ANALYST, and `02_seed_demo_data.sql` uses **one identical hash for all four users**. If the seed script is run on any shared host, those are live admin credentials. Gate seeding behind a `Development`-only flag or force a password change. | High (if deployed) |
| c | No `UseHttpsRedirection`, `UseHsts` or `ForwardedHeaders`. HSTS only fires when the request itself is HTTPS, so it never fires behind a TLS-terminating proxy. `AllowedHosts: "*"`. | Medium |
| d | Cookie auth with `AllowCredentials` and no antiforgery token. `SameSite` is the only CSRF defence. | Medium |
| e | Rate limiter keys unauthenticated traffic by `RemoteIpAddress` only. Behind a proxy all users share one bucket. The limiter is also single-node. | Low |
| f | README says ANALYST can view audit logs, but `AuditLogsController` allows only `ADMIN,COMPLIANCE`. This is a doc/code mismatch (the `Roles` comment claims they are kept in sync). | Low |
| g | `X-XSS-Protection` is deprecated, and there is no `Content-Security-Policy`. | Low |
| h | `SecurityHeadersMiddleware` and the CORS policy are fine, but `allow_credentials=False` on FastAPI while the secret header relies on a single shared static secret (no rotation, no mTLS). | Low |

### 4.7 Database · **Medium**
- ✅ 14 tables, reasonable normalization, 9 targeted nonclustered indexes (e.g. `IX_Transactions_CustomerId (CustomerId, TransactionTimestamp DESC)`), and a Merkle hash column on audit logs and reports.
- 🟡 `MerkleHash` is a per-row hash field. I saw no chain verification endpoint, so "tamper-evident" is only claimed, not shown. ❓
- 🟡 `AnalyticsService` runs many sequential `CountAsync` calls per dashboard load (cached 10 s) and uses `LIKE '%…%'` filters (`fa.Reason.Contains("Device")`, `c.FullName.ToLower().Contains(q)`), which cannot use indexes. `AsNoTracking` appears only 22 times across services, so read paths are tracked by default.
- 🟡 Alert categorisation by substring of free text (`AlertType.Contains("Takeover")`) is fragile. Use an enum or category column.
- ❌ No EF migrations were seen. Schema is hand-written SQL plus `FraudGuardDbContext`, so drift between the two is possible. ❓
- ❌ No data-retention or partitioning strategy for `AuditLogs` and `Transactions`.

Fix example:

```csharp
var counts = await _db.FraudAlerts.AsNoTracking()
    .GroupBy(a => a.Category)                   // add enum Category column + index
    .Select(g => new { g.Key, N = g.Count() })
    .ToListAsync(ct);                           // 1 round-trip instead of 4+
```

### 4.8 Frontend · **Medium** (6 / 10)
- ✅ Angular 17 standalone components, `strict: true` and `strictTemplates`, an HTTP interceptor, auth and role guards, signals, and tokens kept out of `localStorage`.
- 🟡 **Zero `loadComponent` lazy routes** (`app.routes.ts`), so everything is in a single bundle. The committed baseline doc records `main.js` at **2.17 MB**.
- 🟡 No `OnPush` change detection anywhere (0 matches). Page components are very large (`risk-analytics` 637 LOC, `ai-investigator` 617 LOC, `dashboard` 550 LOC), with templates and logic inline in one file.
- 🟡 Only 4 service spec files (11 `it()` cases). There are no component, guard or interceptor tests, no e2e tests, and no `test`/`lint` script in `package.json`.
- ❓ `@microsoft/signalr ^10` against Angular 17 is untested here.

### 4.9 Dependency and config hygiene · **Medium**
- `ai_engine/requirements.txt` uses open `>=` ranges and no lock. The model was pickled with scikit-learn 1.9.0 / lightgbm 4.7.0 / pandas 3.0.5 (`training_config.json`), but `>=1.4.0` lets any version install.
- `docs/audit-remediation-baseline.md` records an actual failure caused by this: a sklearn 1.6.1 vs 1.9.0 mismatch broke `predict_proba`. Pin exact versions and add a startup check against `training_config.json`.
- `find_project_root()` (`config.py`) walks a fixed number of `parents[n]`, which is brittle. It also silently falls back to the CWD.
- `joblib.load` on pickles is only safe because of the SHA-256 manifest. The manifest sits next to the artifacts, so an attacker who can write the models can rewrite the manifest too. Sign it, or store the hash outside the artifact directory.

---

## 5. ML evaluation (AI/ML: 10 / 20)

**Facts read from committed artifacts** (`models/model_metadata.json`, `data/processed/model_comparison.csv`, `threshold_analysis.csv`):

| Model | ROC-AUC | PR-AUC | Precision | Recall | F1 | Thr |
|---|---:|---:|---:|---:|---:|---:|
| Logistic Regression | 0.7944 | 0.1692 | 0.0663 | 0.8364 | 0.1229 | 0.5 |
| Random Forest | 0.8670 | 0.4224 | 0.1818 | 0.6678 | 0.2857 | 0.5 |
| **LightGBM (production)** | **0.9168** | **0.5393** | **0.5544** | **0.4653** | **0.5060** | **0.8** |

- Train rows 472,432, validation rows 118,108, 464 features, fraud rate about 3.4 % (`scale_pos_weight` 27.46).
- At threshold 0.8 on validation: TP 1,891 / FP 1,520 / FN 2,173 / TN 112,524, which gives **recall 46.5 %**. More than half of the fraud is missed at the shipped operating point.

**Strengths**
- ✅ A time-aware (chronological) split, which is correct for fraud data.
- ✅ Baselines (LR, RF) and a threshold sweep from 0.10 to 0.80 with a confusion matrix per threshold.
- ✅ A documented leakage audit that drops `TransactionID`, plus a feature quality report, a fixed seed, and recorded package versions.
- ✅ Handling of imbalance with `scale_pos_weight`, and reporting of PR-AUC, not just ROC-AUC.
- ✅ The SHA-256 integrity manifest is verified at load time.

**Weaknesses**
1. **No held-out test set.** Early stopping (`eval_set=[(X_val,y_val)]`), model selection and threshold choice all use the same 118k validation rows. All reported numbers are therefore optimistic. Use train / validation / chronologically later test.
2. **Threshold choice is not cost-based.** 0.8 was chosen for precision, but no cost matrix (fraud loss vs review cost) or recall target backs it. Recall 46.5 % is weak for a "fraud detection" claim.
3. **No calibration.** `scale_pos_weight` distorts probabilities, yet the app displays them as "% fraud probability" and thresholds the tiers at 0.2/0.5/0.8. Add isotonic or Platt calibration.
4. `TransactionDT` is retained as a raw feature, which invites drift as time moves forward (the usual IEEE-CIS pitfall). `TransactionDT`-derived day/week features are also in the model.
5. **No hyperparameter search, no cross-validation (time-series CV), no SHAP** (feature importance is gain-based only). No drift monitoring: `GetModelMonitoringAsync` exists, but ❓ I did not verify that it computes real drift rather than DB aggregates.
6. **Train/serve skew.** Notebook feature engineering is re-implemented by hand in `preprocessing_service.py` (about 165 lines), with no shared code and no parity test beyond a few smoke cases.
7. **Serving mismatch** (see §4.3): the production model sees mostly constants. The headline metrics do not describe real application behaviour.
8. `calculate_metrics.py` and the `generate_and_run_*.py` scripts embed notebook code as strings. They are hard to review and not reproducible without the raw data.
9. The README claims "sub-10 ms inference". No benchmark exists in the repo. ❓ Unverified.

**Rating of ML work: respectable for a student (correct split, baselines, leakage thinking), not production-grade.**

---

## 6. RAG and Agentic AI evaluation

| Capability | Status | Evidence |
|---|---|---|
| Document chunking by markdown header | ✅ | `rag_service.py` `re.split(r"\n(?=###?\s+)")` |
| Retrieval | 🟡 TF-IDF (1-2 gram) + cosine, no embeddings | `TfidfVectorizer` |
| Citations with chunk IDs | ✅ and honest (empty list when below `min_score`) | `get_citations` |
| Knowledge base | 🟡 5 short markdown files, authored in-repo | `knowledge_base/` |
| LLM generation | ❌ none | `get_llm_provider()` |
| Tool use / planning / multi-step agent loop | ❌ a fixed 6-step pipeline of if-statements | `investigator_service.py` |
| Prompt-injection defense | 🟡 regex blocklist on 3 fields + prompt; irrelevant without an LLM and trivially bypassable | `sanitize_untrusted_input` |
| Human-in-the-loop guard | ✅ disclaimer and "awaiting human sign-off" timeline entry | `AIInvestigatorService.cs:236` |
| Retrieval evaluation (recall@k, MRR) | ❌ | none |
| Persisted index / eval set | ❌ index rebuilt at import time | `rag_service.initialize()` at module load |

Verdict: this is **"rule-based investigation assistant with keyword retrieval"**, labelled honestly in the investigator docstring ("AI-Assisted Rule-Based…") but not in the README/UI wording ("Agentic"). Calling it "agentic AI" in a resume or interview without qualification will be challenged. Issues in detail:

- The RAG query is built by concatenating keywords like `"enhanced due diligence"`, which tests the retriever against the author's own vocabulary. This is brittle.
- `rag_service.initialize()` runs at import and `query()` lazily re-initializes. There is no concurrency guard, which is a minor race on first request.
- Prompt-injection regex (`act\s+as`, `disregard`) will redact legitimate merchant names, and it protects nothing because no model consumes the text.

How an experienced engineer would do it:
- embeddings (e.g. `text-embedding-3-small` or a local sentence-transformer) in a vector index (pgvector, FAISS or Azure AI Search);
- hybrid BM25 + dense retrieval and a reranker;
- an LLM call with a JSON schema, grounded only on retrieved chunks, with a citation-validation step that rejects any answer citing an unknown chunk ID;
- an offline eval set (30+ questions) tracking hit-rate and faithfulness;
- tool-calling for read-only lookups (customer history, device graph), with a step budget and tracing.

---

## 7. Security assessment (7 / 10)

**Verified strengths:** fail-fast JWT secret, HttpOnly cookie, hashed passwords with lockout and timing equalization, RBAC on every controller, internal-secret between services, a constant-time comparison, the artifact hash check, security headers, a production CORS guard, rate limits on login / AI / fraud endpoints, and audit logging. The CSV export has sanitization tests (`CsvSanitizationTests`), which indicates formula-injection awareness.

**Risks** are the items in §4.6 a–h, plus:
- Weak demo credentials are documented in the README. **High** if the seed script ever reaches a non-local environment.
- No secrets scanning or dependency scanning (no CI to run them). `npm audit`, `pip-audit` and `dotnet list package --vulnerable` were not run by me.
- `ExceptionMiddleware` ❓ not checked for stack-trace leakage in production.
- The FastAPI `/docs` and `/openapi.json` are public by design. Disable them outside dev.
- Swagger is on only in Development unless `EnableSwaggerInProduction` is set. Good.

---

## 8. Testing assessment (Testing & DevOps: 3 / 10)

| Area | Present | Notes |
|---|---|---|
| .NET xUnit | 9 files, about 35 test methods | JWT, password security, role authorization, mapper, FastApi client, analytics, CSV sanitization, investigator |
| Python pytest | 6 files, 20 test functions | health, predict, model-info, RAG, investigator, integrity |
| Angular | 4 spec files, 11 `it()` | services only; no runner script |
| Integration / e2e | 12 ad-hoc PowerShell scripts at repo root | require a running stack; not automated |
| Coverage tooling | ❌ | no coverage config or reports |
| CI | ❌ | no `.github/workflows` |
| Docker | ❌ | |
| Load / performance tests | ❌ | |

**Documented results (not re-run by me):** `docs/audit-remediation-baseline.md` (dated 2026-09-11, commit `621db1f`) records 43 .NET tests passed and a Python run of **17 passed / 3 failed** at that time, with the sklearn version mismatch as the root cause. Later commits (`b670334`, `052bfd4`) claim fixes, but no newer result is committed. ❓ **Current pass/fail status is unverified.**

Also: the ML tests assert only structural properties (keys present, 200 OK), not that fraudulent inputs score higher than benign ones. There is no train/serve parity test and no golden-prediction regression test against the validation parquet that is committed (19.5 MB), which would be an easy win.

---

## 9. Performance assessment

- ❓ No benchmarks anywhere. "Sub-10 ms" is an assertion. LightGBM single-row `predict_proba` plus the pandas row assembly in `preprocessing_service.transform` is plausibly low-ms, but building a one-row DataFrame per request in pandas 3 is typically the bottleneck and is not measured.
- Backend: scoring is synchronous per request, and N sequential `CountAsync` calls feed the dashboard (mitigated by a 10 s `IMemoryCache`, single-node only).
- Transaction listing paginates (`Skip/Take`) and uses `Include` of 4 navigations. It is fine at demo scale, but every filter that uses `Contains` or `ToLower()` is a table scan.
- Frontend: 2.17 MB initial bundle, no lazy loading, no OnPush.
- Uvicorn runs as a single process; `reload=True` is hard-coded in `__main__`. There are no workers, no batching endpoint, and no async offload for CPU-bound inference (`def` routes run in the threadpool, which is acceptable).
- Scalability limits: in-memory revocation, cache and rate limits all prevent horizontal scaling without Redis.

---

## 10. Final rating

| Category | Max | Score | Basis |
|---|---:|---:|---|
| Architecture | 15 | 9 | Clean tiers and DI. Domain/ML contract mismatch, no async scoring, no containers |
| Code Quality | 15 | 9 | Readable, documented, consistent. Fat services and components, magic constants, root script clutter, tracked build artifacts |
| AI/ML | 20 | 10 | Sound split and baselines. No test set, no calibration, fabricated serving features, no LLM despite "agentic" claims |
| Backend | 10 | 7 | Solid auth/middleware. Query patterns, in-memory state, no HTTPS handling |
| Frontend | 10 | 6 | Modern Angular and strict mode. No lazy loading or OnPush, big components, thin tests |
| Database | 10 | 6 | Good schema and indexes. Substring queries, no migrations, no retention |
| Security | 10 | 7 | Better than typical. Seed credentials, revocation, CSRF/HTTPS gaps |
| Testing & DevOps | 10 | 3 | Tests exist on 3 stacks, but no CI, no Docker, no coverage, status unverified |
| **Total** | **100** | **57** | |

| Dimension | /10 |
|---|---:|
| Overall project quality | 6.0 |
| AI/ML engineering | 5.0 |
| Software engineering | 6.5 |
| Production readiness | 3.5 |
| MNC placement readiness | 6.0 |
| Resume value | 6.5 |
| Interview readiness | 5.5 |

---

## 11. Hiring-manager verdict (as a fresher submission)

| Role | Verdict |
|---|---|
| **SDE** | **Strongest fit.** Full-stack breadth, JWT/RBAC/lockout, middleware, DI, SignalR and tests are above fresher norm. Gaps (no CI/Docker, fat services, query design) are fixable and would prompt discussion, not rejection. |
| **AI Software Engineer** | Mixed. The platform integration is good, but a probing interviewer will find that the "agent" is if-statements and the "LLM provider" is a stub. |
| **ML Engineer** | Borderline. Serving, artifact integrity and the SHA manifest are good MLE instincts. Missing: model registry, monitoring, calibration, train/serve parity, and the serving feature mismatch. |
| **AI/ML Engineer** | Borderline, same reasons. |
| **Data Scientist** | Weakest fit. EDA and leakage notes exist, but there is no test set, no cost-based thresholding, no SHAP and no calibration. Recall 46.5 % at the shipped threshold invites hard questions. |

**What a technical interviewer will notice in the first 20 minutes:**
1. "Show me where the LLM is called." There is no such place.
2. "What does `Card2 = 111` mean?" They will see the mapper feeds constants to a 464-feature model, then ask how the AUC applies.
3. "Where did 82.4 come from?"
4. "Is the threshold tuned on your test set?" It is tuned on validation, and there is no test set.
5. "How do I run it?" Three terminals and a manual SQL setup, with no Docker or CI badge.
6. "Why are `.pyc` files in git?"

**What will impress:** the time-aware split, the leakage audit, the model hash verification, the fail-fast secrets, the HttpOnly cookie design, the honest comments in the mapper, and the existence of a remediation history.

**Interview-safe framing:** "A fraud-operations platform demonstrating end-to-end integration of a LightGBM model trained on IEEE-CIS. The app's transactions are synthetic, so scoring uses an approximate feature mapping. The investigator is a deterministic, evidence-grounded rule engine with TF-IDF policy retrieval, designed so an LLM provider can be plugged in." That is accurate and defensible. The current README wording is not.

---

## 12. Prioritized improvement roadmap

**P0 — correctness and honesty (1–2 days)**
1. Remove the `82.4` fallback and the dummy-payload scoring in `investigator_service.py`. Fail closed with an explicit "ML score unavailable" state.
2. Make `get_llm_provider()` raise or log loudly when `LLM_PROVIDER` is set but unimplemented, or implement it.
3. Replace hard-coded `confidence` with a computed value, or rename it "heuristic priority".
4. Update the README. Say the transactions are synthetic, the scoring is an IEEE-CIS approximation, and the investigator is rule-based. Remove the unbenchmarked "sub-10 ms" claim or add the benchmark.
5. `git rm -r --cached` for `__pycache__` and `.angular`. Make the demo seed users development-only with distinct, generated passwords.

**P1 — engineering baseline (3–5 days)**
6. Add `Dockerfile`s and a `docker-compose.yml` (sql-server, api, ai-engine, web).
7. Add a GitHub Actions workflow: `dotnet test`, `pytest`, `ng build` plus a test target, `pip-audit`, `npm audit`, and coverage upload.
8. Pin Python dependencies exactly, assert versions against `training_config.json` at startup, and move the root scripts into `scripts/`.
9. Add `ng test` / `lint` scripts, plus lazy `loadComponent` routes and `OnPush`.
10. Add `UseHttpsRedirection`, `UseHsts` and `ForwardedHeaders`. Move token revocation into the DB or Redis.

**P2 — ML credibility (1–2 weeks)**
11. Re-split train / validation / test (chronological). Pick the threshold on validation using a cost matrix. Report final metrics once, on test.
12. Calibrate probabilities, add SHAP explanations to `/predict`, and add time-series CV.
13. Either retrain on the app's real feature set, or build a domain-feature adapter and document its limits. Add a golden train/serve parity test using `validation_features.parquet`.
14. Benchmark inference latency and publish p50/p95. Add drift monitoring (PSI on key features).

**P3 — real agentic RAG (1–2 weeks)**
15. Implement an LLM provider with structured output and a citation validator. Add embeddings with hybrid retrieval and a small retrieval-eval set.
16. Add read-only tools (customer history, device graph) with a step budget and tracing. Keep the rule engine as the labelled fallback.

**P4 — database and scale**
17. Introduce EF migrations. Replace substring alert classification with a category column. Add `AsNoTracking`, projection queries and full-text or computed-column indexes for search.
18. Move scoring to a queue (background service or message bus) with retry and a circuit breaker.

---

*Not verified in this audit (no execution performed):* current test pass/fail counts, build success, inference latency, Angular bundle size at present, `npm audit` / `pip-audit` results, `ExceptionMiddleware` production behaviour, the model-monitoring endpoint's data source, EF migration state, and reproducibility of the training notebooks (raw data absent).

---

## Addendum: remediation status (after the first fix pass)

**Correction to §4.6/§7:** `SecurityHeadersMiddleware` already sets a `Content-Security-Policy`. It is permissive (`unsafe-inline`, `unsafe-eval`, wildcard localhost/192.168 connect-src), so the finding is "CSP too loose", not "CSP missing".

| Item | Status | Verified by |
|---|---|---|
| Fabricated `82.4` score and dummy-payload scoring | Fixed: missing score reports `ml_score_available=false`, never recommends NO_ACTION | `tests/test_investigator_honesty.py` (ran) |
| Stub "LLM provider" and hard-coded confidence | Fixed: warns and falls back; confidence computed and labelled heuristic | same tests (ran) |
| Python dependency pins and version drift | Fixed: exact pins matching `training_config.json`; startup mismatch check | clean Python 3.13 venv: 27/27 pytest pass (previously 3 failed on a version mismatch) |
| Published metrics reproducibility | Added regression test: ROC-AUC 0.9168, PR-AUC 0.5393, P 0.554, R 0.465 recomputed | ran |
| HTTPS/HSTS/forwarded headers, `AllowedHosts`, `/health` | Added to `Program.cs` and `appsettings.json` | `dotnet test`: 44/44 pass (build included) |
| 2.17 MB single bundle | Lazy `loadComponent` routes; initial 565 kB (145 kB transferred) | `ng build` (ran) |
| Tracked `.pyc` and `.angular` | Untracked from the git index (files kept; not committed) | `git ls-files` |
| Docker and CI | Added `docker-compose.yml`, 3 Dockerfiles, nginx, GitHub Actions | `docker compose config` valid; **images not built** (Docker daemon not running); **CI not run** |
| README overclaims | Rewritten: scope/limitations, honest model/investigator description | read-through |

**Still open:** held-out test set and calibration, cost-based threshold, real LLM provider, persistent token revocation, EF migrations and substring-query fixes, Angular test runner/lint/OnPush, tighter CSP, CSRF token, SAR/seed hardening, inference benchmark.

### Second pass: held-out evaluation and calibration

| Item | Result | Verified by |
|---|---|---|
| Held-out set | Later half of validation (59,054 rows) used only for reporting; calibrator fit on the earlier half. TEST: ROC-AUC 0.9167 (CI 0.911-0.922), PR-AUC 0.550, precision 0.560, recall 0.473 | `ml/calibrate_and_evaluate.py` run; recomputed by `test_calibration_holdout.py` |
| Calibration | Raw score badly miscalibrated (ECE 0.168, mean 0.21 vs 3.7% fraud). Isotonic: ECE 0.002, Brier 0.0746 to 0.0235 on TEST | same |
| Serving | `/predict` adds `raw_score` and `calibrated_probability`; `fraud_probability`, tiers, decisions unchanged. Calibrator is JSON, SHA-256 in the manifest | pytest 32/32; dotnet 44/44 |
| Observation | `best_iteration_` = 299 of 300: early stopping never triggered, so the model is likely under-trained. Not yet investigated | read from the pickle |
| Remaining | 3-way split with retrain (raw data is present locally; needs notebooks 02 to 04 re-run), cost-based threshold, switching UI/investigator thresholds to the calibrated scale (about 10 hard-coded percent thresholds in Python/C# plus seeded DB data) | open |

### Third pass: clean retrain experiment and cost-based threshold

| Item | Result | Verified by |
|---|---|---|
| Pipeline reproduced from raw data (notebooks 02 and 03 run in a scratch dir) | Same train/validation membership (identical TransactionID sets). Features identical after ID alignment except 3 label-encoded interactions (`card1_card2/3/5`): about 80 of 118k rows differ by one code, caused by unstable sort on 2,698 tied `TransactionDT` values | ran |
| Challenger (clean 4-way split: train / early-stop / calibrate+threshold / test) | 689 trees (champion 300). TEST ROC-AUC 0.9153 vs champion 0.9195, PR-AUC 0.571 vs 0.575, CIs overlap. **Not promoted.** The earlier "under-trained" suspicion is rejected | `ml/train_challenger.py` (ran); `ml/results/challenger_evaluation.json` |
| Cost-based threshold (champion, held-out TEST third, 39,370 rows) | 0.80 is cost-optimal only at about $50 per alert. At $5/alert: threshold about 0.37, recall 0.82, cost $76k vs $142k (no model: $248k). At $100/alert a model costs more than no model | `ml/cost_threshold_analysis.py` (ran); asserted in tests |
| `DECISION_THRESHOLD` env override | Added; default unchanged (0.80) so no behaviour change | pytest 34/34; dotnet 44/44 |

**Needs a human decision:** what an alert really costs. Until then production stays at 0.80. **Known gap:** the sort in `03_feature_engineering` should be `kind="stable"` with `TransactionID` as a tiebreaker so reruns are bit-identical.

### Fourth pass: housekeeping

| Item | Result | Verified by |
|---|---|---|
| Root-folder clutter | 11 ad-hoc `.ps1` scripts moved to `scripts/e2e/`; data/ML pipeline scripts to `scripts/data_pipeline/`; `walkthrough.md` to `docs/`. README paths updated. (`metadata.json` is unrelated AI Studio app metadata, left in place.) | `git mv`; README grep |
| Hard-coded foreign path | `download_and_extract_ieee.ps1` pointed at another user's `kaggle.exe`; now resolves `kaggle` from PATH | read |
| Non-deterministic feature engineering | Sort now `['TransactionDT','TransactionID']`, `kind='stable'` in the notebook and generator. Old sort gave a different order in 5/5 shuffled inputs (2,698 tied timestamps); new gives identical order in 5/5 | ran on committed validation IDs. **A full end-to-end FE rerun was not repeated** |
| Python coverage | `pytest-cov` added to dev requirements and CI (report and artifact, no threshold yet) | **not run**: CI has not executed |

### Fifth pass: security items

| Item | Result | Verified by |
|---|---|---|
| Token revocation was in-memory (lost on restart) | Now persisted: `Users.TokensRevokedAt`, DB-backed with a 30 s per-instance cache (the revoking node is immediate; other nodes converge within 30 s). Deactivated or deleted users are rejected. Upgrade script: `sql/05_security_hardening_migration.sql` | 5 new xUnit tests incl. a simulated restart; dotnet 57/57 |
| **New bug found:** SQL `CK_Users_Role` omitted `COMPLIANCE`, so creating that role via the API would fail at the database | Fixed in schema and migration | read; **not run against SQL Server** |
| Demo seed users with one known password | `02_seed_demo_data.sql` now aborts unless run with `-v ALLOW_DEMO_SEED=YES` (compose passes it only when `SEED_DEMO_DATA=true`) | read; **not run against SQL Server** |
| FastAPI `/docs`, `/redoc`, `/openapi.json` public | Off by default; `ENABLE_DOCS=true` for local dev | 3 new pytest cases; pytest 37/37 |
| CSRF | New `CsrfHeaderMiddleware`: cookie-authenticated POST/PUT/PATCH/DELETE must send `X-Requested-With: XMLHttpRequest` (the Angular interceptor sends it). Layered on `SameSite=Strict` | 8 new xUnit cases |
| CSP too loose | The JSON API now serves `default-src 'none'` (relaxed only under `/swagger`). The SPA gets nginx security headers with CSP in **Report-Only** mode, because inline-style handling could not be checked in a browser | read; **no browser test** |

**Still open:** FastAPI shared-secret rotation/mTLS, enforcing (not report-only) the SPA CSP after a browser check, EF migrations.

### Sixth pass: query efficiency

| Item | Result | Verified by |
|---|---|---|
| **Correction to §4.7:** "read paths are tracked by default" | Wrong for the main paths: list and detail queries in Transaction/Customer/FraudAlert/Investigation/Report services already use `AsNoTracking`. Not changed | read |
| Dashboard KPIs ran 4 separate `LIKE '%..%'` counts over `FraudAlerts` | Consolidated into one conditional-aggregate query (`GroupBy(_ => 1)`) | 2 new xUnit tests (overlapping categories counted exactly like the old four queries); dotnet 59/59 |
| Caveat | Tests use the EF InMemory provider, which proves the semantics but **not the SQL translation**; not run against SQL Server. The `LIKE '%..%'` predicates still cannot use an index; a category column is the real fix (open) | n/a |

### Seventh pass: frontend test runner

| Item | Result | Verified by |
|---|---|---|
| **No Angular test runner existed** (the 11 spec files had never been executed) | Added Karma + Jasmine (`npm test`, headless Chrome), `tsconfig.spec.json`, `karma.conf.js`, angular.json `test` target, CI step | ran locally |
| First real run: **11 of 11 existing specs failed** | They asserted stale behaviour (a hard-coded `http://localhost:5000/api` URL; constructor-triggered HTTP calls) | ran |
| **Real bug found:** `TransactionService`, `CustomerService`, `FraudAlertService` constructors called `this.loadX()`, which returns a cold Observable that nobody subscribed to. The call did nothing except set `loading = true` forever until a page subscribed | Dead constructor calls removed (pages already subscribe explicitly); regression test added | ran |
| Specs rewritten for current behaviour (analytics spec now stubs `AuthService`, covers logged-out and role-gated calls) | Karma: 13/13 pass; `ng build` OK | ran |
| Still open | No component, guard or interceptor tests; no ESLint; no coverage threshold | n/a |

### Eighth pass: frontend security-path tests

| Item | Result | Verified by |
|---|---|---|
| `apiInterceptor`, `authGuard`, `roleGuard` had zero tests | 11 new Karma specs: credentials + anti-CSRF header sent and no Authorization header injected; 401 handling (normal vs login call); friendly messages without leaking backend details; connection failure; guard redirects (anonymous, role denied with `accessDenied`, case-insensitive roles, empty roles) | Karma 24/24 |
| Are the tests real? | Mutation check: removing the `X-Requested-With` header made exactly that test fail; file restored | ran |
| Still open | Component tests, ESLint, coverage threshold | n/a |

### Ninth pass: alert category column and real SQL Server verification

| Item | Result | Verified by |
|---|---|---|
| Alert category was inferred by `LIKE '%..%'` over free text on every dashboard load | `FraudAlerts.Category` (CHECK constraint + index), set at creation and backfilled by `sql/06_alert_category.sql`; analytics is one indexed `GROUP BY`. `AlertCategories.Classify` mirrors the SQL rules | 14 new xUnit cases; dotnet 70 pass |
| **Semantics change:** an alert now has exactly one category (first rule wins: takeover, velocity, synthetic, card-testing). Before, one alert could be counted in several, so dashboard threat counts can differ slightly | Documented; "Other" is not shown in the breakdown. Note the original rules match "AML" in `Reason` only, so a seed alert titled "AML ..." falls into Other (behaviour preserved) | read |
| **All SQL scripts were previously never run.** Executed on a throwaway LocalDB instance (a separate DB name; the real `FraudGuardAI_DB` was not touched; the instance and database were deleted afterwards) | 01 schema OK; seed refuses without `ALLOW_DEMO_SEED=YES` and succeeds with it; 03 procedure compiles and runs; 05 and 06 upgrade a simulated pre-hardening schema (old constraint rejected COMPLIANCE, new one accepts it); both re-run cleanly; CHECK rejects a bogus category | ran |
| Real-database integration tests (`FG_TEST_SQL`, skipped by default) | 4/4 pass on SQL Server: every dashboard KPI query translates and the threat counts match stored categories; SQL backfill agrees with the C# classifier for every seeded alert; token revocation persists across a new service instance; COMPLIANCE accepted | ran |
| Correction: no script hazard | An earlier note claimed `01_create_database_and_schema.sql` was unsafe about file paths. That was caused by my verification setup (a second LocalDB instance sharing the profile directory with the real instance's `.mdf`), not by the script: in normal use the database lives in the same instance, so `IF NOT EXISTS` skips creation. SQL Server refused to overwrite the file; nothing was harmed | observed |
| Still open | CI job `backend-sql` (SQL Server container + scripts + integration tests) is written but has **not run yet**; the synthetic-data procedure produced no High/Critical alerts in the 40-row run, so its in-procedure backfill is compiled but not exercised | n/a |

### Tenth pass: end-to-end compose smoke test (written, not yet run)

| Item | Result | Verified by |
|---|---|---|
| "One command brings up the whole stack" was never exercised (db-init, API, engine, nginx together) | New CI job `compose-smoke`: `docker compose up --build` with the demo seed, then real HTTP checks through nginx: SPA served + security headers; anonymous call is 401; ADMIN login sets an HttpOnly cookie; authenticated call works; AI engine reachable via `/api/fraud/engine-health`; cookie POST without `X-Requested-With` is 403; after logout the old token is 401 (persistent revocation) | workflow YAML parses; routes and response field names checked against the controllers. **Not run**: Docker Desktop was not running locally and was deliberately not started; the first CI run will show it |
