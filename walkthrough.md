# FraudGuard AI - Phase 7 Walkthrough

## Phase 7: Angular 17 <-> ASP.NET Core 8 Real API Integration
**Status: COMPLETE**

## Architecture

Angular 17 (port 4200)
 => HTTP REST (localhost:5000 ONLY)
ASP.NET Core 8 Web API (port 5000)
 => SQL Server 2022
 => FastAPI AI Engine (port 8000)
    => LightGBM Model (fraud_model.pkl)
    => Fraud Prediction
    => SQL Server 2022

Architecture mandate enforced: Angular NEVER calls FastAPI directly.

## E2E Test Results - 11/11 PASSED

[1]  POST /api/auth/login              PASS - Riya Desai / INVESTIGATOR
[2]  GET  /api/analytics/dashboard     PASS - Flagged: 15, Investigations: 15
[3]  GET  /api/transactions            PASS - Total: 161 transactions
[4]  POST /api/transactions (AI score) PASS - TXN-2026-590810, 64.08%, High Risk
[5]  GET  /api/fraud-alerts            PASS - Total: 19 alerts
[6]  GET  /api/customers               PASS - Total: 8 customers
[7]  GET  /api/investigations          PASS - Total: 17 investigations
[8]  GET  /api/reports                 PASS - Total: 6 reports
[9]  GET  /api/audit-logs              PASS - Total: 13 records
[10] GET  /api/fraud/engine-health     PASS - ASP.NET: healthy, FastAPI: healthy, Model: True
[11] GET  /api/fraud/model-info        PASS - LightGBM_Fraud_Classifier, ROC-AUC: 0.9168, Threshold: 0.80

## Angular Build
npm run build - 0 errors, 0 TypeScript errors
main bundle: 570.00 kB (125.77 kB gzipped)

## Login Credentials
Riya Desai: riya.desai@fraudguard.enterprise.io / password123 / INVESTIGATOR
Priyanka Iyer: priyanka.iyer@fraudguard.enterprise.io / password123 / ADMIN

## Running the Full Stack
Terminal 1: cd src/backend/FraudGuard.Api; dotnet run
Terminal 2: cd src/ai_engine; python -m uvicorn app:app --host 127.0.0.1 --port 8000
Terminal 3: npm start (open http://localhost:4200)
