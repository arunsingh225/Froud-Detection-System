# FraudGuard AI — Audit Remediation Baseline

**Date**: 2026-09-11  
**Branch**: `main`  
**Commit**: `621db1f` (Implement audit remediation fixes — Phase A)  

---

## Build Results

### Angular 17 (Frontend)
- **Status**: ✅ BUILD SUCCESS
- **Output**: `dist/fraudguard-ai`
- **Bundle**: main.js 2.17 MB, polyfills.js 88.09 kB, styles.css 51.51 kB
- **Duration**: ~30 seconds

### ASP.NET Core 8 (Backend API)
- **Status**: ✅ BUILD SUCCESS (0 Warnings, 0 Errors)
- **Output**: `bin/Debug/net8.0/FraudGuard.Api.dll`

### Python FastAPI (AI Engine)
- **Status**: ✅ Service starts (model loads with sklearn version warning)

---

## Test Results

### ASP.NET Core Tests (FraudGuard.Api.Tests)
- **Status**: ✅ PASSED
- **Results**: 43 passed, 0 failed, 0 skipped
- **Test Files**: 10 files
  - AIInvestigatorServiceTests.cs
  - AnalyticsServiceTests.cs
  - CsvSanitizationTests.cs
  - FastApiClientTests.cs
  - FraudGuard.Api.Tests.csproj
  - FraudPredictionMapperTests.cs
  - FraudPredictionServiceTests.cs
  - JwtTokenServiceTests.cs
  - PasswordSecurityTests.cs
  - RoleAuthorizationTests.cs

### Python Tests
- **Status**: ⚠️ PARTIAL (17 passed, 3 failed)
- **Failures**: `test_predict_normal_transaction`, `test_predict_suspicious_transaction`, `test_predict_minimal_payload`
- **Root Cause**: sklearn version mismatch (model pickled with v1.9.0, running v1.6.1). LightGBM `predict_proba` fails with `AttributeError: 'Booster' object has no attribute 'handle'`
- **Note**: Pre-existing issue, not introduced by remediation

---

## Known Pre-Existing Issues

1. **sklearn version mismatch** — Model artifacts were pickled with sklearn 1.9.0 but local environment has 1.6.1
2. **JWT stored in localStorage** — `auth.service.ts` stores token in `localStorage`
3. **Hardcoded inference latency** — `FraudPredictionService.cs` L77: `InferenceLatencyMs = 15`
4. **Hardcoded fraud probability in DTO mapping** — `AIInvestigatorService.cs` L396: `FraudProbability = 85.0m`
5. **Hardcoded confidence** — `AIInvestigatorService.cs` L403: `Confidence = 0.88m`
6. **No token revocation** — No server-side session invalidation
7. **No Dockerfile/docker-compose** — No containerization
8. **No CI/CD pipeline** — No GitHub Actions workflows
9. **No health check endpoint** — Backend has no `/health` route
10. **CSP allows unsafe-inline/unsafe-eval** — SecurityHeadersMiddleware.cs L53

## Environment Assumptions

- **OS**: Windows 11
- **Node**: Available via PATH
- **Angular CLI**: 17.3.x
- **.NET SDK**: 8.0.x
- **Python**: 3.11
- **SQL Server**: LocalDB (MSSQLLocalDB)
- **Database**: FraudGuardAI_DB (existing, must not be destroyed)
