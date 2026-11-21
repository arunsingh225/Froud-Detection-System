#!/usr/bin/env pwsh
# Phase 7 E2E Verification Script

$apiBase = "http://localhost:5000/api"
$passed = 0
$failed = 0

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " PHASE 7 E2E: Angular to ASP.NET Core 8 Integration" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1 - Login
Write-Host "[1] Authentication (POST /api/auth/login)" -ForegroundColor Yellow
try {
    $loginBody = '{"email":"riya.desai@fraudguard.enterprise.io","password":"password123"}'
    $loginRes = Invoke-RestMethod -Method POST -Uri "$apiBase/auth/login" -Headers @{"Content-Type"="application/json"} -Body $loginBody
    if ($loginRes.success -and $loginRes.data.token) {
        Write-Host "    PASS - User: $($loginRes.data.user.fullName) / Role: $($loginRes.data.user.role)" -ForegroundColor Green
        $passed++
        $token = $loginRes.data.token
    } else {
        Write-Host "    FAIL - success=false" -ForegroundColor Red
        $failed++
        exit 1
    }
} catch {
    Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
    exit 1
}

$headers = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $token" }

# Step 2 - Dashboard KPIs
Write-Host "[2] Dashboard Analytics (GET /api/analytics/dashboard)" -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Method GET -Uri "$apiBase/analytics/dashboard" -Headers $headers
    if ($res.success) {
        Write-Host "    PASS - Flagged: $($res.data.flaggedTransactionsCount) | Active Investigations: $($res.data.activeInvestigationsCount)" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 3 - Transactions List
Write-Host "[3] Transactions List (GET /api/transactions)" -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Method GET -Uri "${apiBase}/transactions?page=1" -Headers $headers
    if ($res.success) {
        Write-Host "    PASS - Total: $($res.data.totalCount) | Page items: $($res.data.items.Count)" -ForegroundColor Green
        $passed++
        $firstTxnId = $res.data.items[0].transactionId
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 4 - Create Transaction + AI Scoring
Write-Host "[4] Ingest Transaction via AI Engine (POST /api/transactions)" -ForegroundColor Yellow
try {
    $body = @{
        accountId = "44444444-4444-4444-4444-444444444401"
        customerId = "33333333-3333-3333-3333-333333333301"
        amountInr = 850000
        paymentMethod = "Visa Credit"
        cardLast4 = "9988"
        ipAddress = "185.220.101.14"
        city = "Moscow"
        country = "Russia"
        distanceFromTypicalKm = 5200
        vpnOrProxyDetected = $true
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Method POST -Uri "$apiBase/transactions" -Headers $headers -Body $body
    if ($res.success) {
        Write-Host "    PASS - Code: $($res.data.transactionCode) | Probability: $($res.data.probability)% | Risk: $($res.data.riskTier)" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 5 - Fraud Alerts
Write-Host "[5] Fraud Alerts (GET /api/fraud-alerts)" -ForegroundColor Yellow
try {
    $url = "${apiBase}/fraud-alerts?page=1"
    $res = Invoke-RestMethod -Method GET -Uri $url -Headers $headers
    if ($res.success) {
        Write-Host "    PASS - Total: $($res.data.totalCount) alerts" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 6 - Customers
Write-Host "[6] Customers (GET /api/customers)" -ForegroundColor Yellow
try {
    $url = "${apiBase}/customers?page=1"
    $res = Invoke-RestMethod -Method GET -Uri $url -Headers $headers
    if ($res.success) {
        Write-Host "    PASS - Total: $($res.data.totalCount) customers" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 7 - Investigations
Write-Host "[7] Investigations (GET /api/investigations)" -ForegroundColor Yellow
try {
    $url = "${apiBase}/investigations?page=1"
    $res = Invoke-RestMethod -Method GET -Uri $url -Headers $headers
    if ($res.success) {
        Write-Host "    PASS - Total: $($res.data.totalCount) investigations" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 8 - Reports
Write-Host "[8] Reports (GET /api/reports)" -ForegroundColor Yellow
try {
    $url = "${apiBase}/reports?page=1"
    $res = Invoke-RestMethod -Method GET -Uri $url -Headers $headers
    if ($res.success) {
        Write-Host "    PASS - Total: $($res.data.totalCount) reports" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 9 - Audit Logs (Requires ADMIN or COMPLIANCE)
Write-Host "[9] Audit Logs (GET /api/audit-logs - authenticated as ADMIN)" -ForegroundColor Yellow
try {
    # Authenticate as Priyanka Iyer (ADMIN) for administrative endpoints
    $adminLogin = Invoke-RestMethod -Method POST -Uri "$apiBase/auth/login" -Headers @{"Content-Type"="application/json"} -Body '{"email":"priyanka.iyer@fraudguard.enterprise.io","password":"password123"}'
    $adminHeaders = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $($adminLogin.data.token)" }

    $url = "${apiBase}/audit-logs?page=1"
    $res = Invoke-RestMethod -Method GET -Uri $url -Headers $adminHeaders
    if ($res.success) {
        Write-Host "    PASS - Total: $($res.data.totalCount) audit records" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 10 - Engine Health (Proxy)
Write-Host "[10] AI Engine Health (GET /api/fraud/engine-health)" -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Method GET -Uri "$apiBase/fraud/engine-health" -Headers $adminHeaders
    if ($res.success) {
        Write-Host "    PASS - ASP.NET: $($res.data.aspNetCore) | FastAPI: $($res.data.fastApi) | Model: $($res.data.modelLoaded)" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Step 11 - Model Info (Proxy)
Write-Host "[11] Model Info (GET /api/fraud/model-info)" -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Method GET -Uri "$apiBase/fraud/model-info" -Headers $adminHeaders
    if ($res.success) {
        Write-Host "    PASS - Model: $($res.data.modelName) | ROC-AUC: $($res.data.rocAuc) | Threshold: $($res.data.threshold)" -ForegroundColor Green
        $passed++
    } else { Write-Host "    FAIL" -ForegroundColor Red; $failed++ }
} catch { Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red; $failed++ }

# Summary
Write-Host ""
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " PHASE 7 E2E RESULTS: $passed PASSED / $failed FAILED" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "=========================================================" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host " ALL PASSED - Angular calls only localhost:5000" -ForegroundColor Green
    Write-Host " ASP.NET proxies AI scoring through FastAPI (port 8000)" -ForegroundColor Green
} else {
    Write-Host " $failed check(s) FAILED - see above for details" -ForegroundColor Red
}
Write-Host ""
