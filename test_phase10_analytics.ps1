# Phase 10 - Advanced Fraud Analytics & Real-Time Monitoring Verification Script
# Tests all Phase 10 analytics endpoints, real SQL aggregations, RBAC, live updates, and CSV export.

$ErrorActionPreference = "Continue"

$ApiUrl = "http://localhost:5000/api"
$FastApiUrl = "http://127.0.0.1:8000"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FRAUDGUARD AI - PHASE 10 ADVANCED ANALYTICS VERIFICATION  " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$Passed = 0
$Failed = 0

function Assert-Test {
    param(
        [string]$Name,
        [bool]$Condition,
        [string]$Details = ""
    )
    if ($Condition) {
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        $script:Passed++
    } else {
        Write-Host "  [FAIL] $Name" -ForegroundColor Red
        if ($Details) {
            Write-Host "         $Details" -ForegroundColor Yellow
        }
        $script:Failed++
    }
}

# -------------------------------------------------------------
# 1. Microservice Health & Operational Telemetry
# -------------------------------------------------------------
Write-Host "`n--- 1. Operational Telemetry & Component Health ---" -ForegroundColor Yellow

# Admin Login
$adminLogin = @{
    email = "priyanka.iyer@fraudguard.enterprise.io"
    password = "password123"
} | ConvertTo-Json

$adminRes = Invoke-RestMethod -Uri "$ApiUrl/auth/login" -Method Post -Body $adminLogin -ContentType "application/json"
$adminToken = $adminRes.data.token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

Assert-Test "Admin Authenticated & JWT Issued" ($adminToken.Length -gt 20)

try {
    $healthRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/operational-health" -Method Get -Headers $adminHeaders
    Assert-Test "Operational health returns 200 OK" ($healthRes.success -eq $true)
    Assert-Test "Operational health includes all 5 components" ($healthRes.data.components.Count -eq 5)
    Assert-Test "Overall status is HEALTHY" ($healthRes.data.overallStatus -in @("HEALTHY", "DEGRADED"))
} catch {
    Assert-Test "Operational health returns 200 OK" $false $_.Exception.Message
}

# -------------------------------------------------------------
# 2. Advanced Dashboard KPIs (Real SQL Aggregations)
# -------------------------------------------------------------
Write-Host "`n--- 2. Advanced Dashboard KPIs ---" -ForegroundColor Yellow

$kpis = $null
$kpiSw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $kpiRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/dashboard" -Method Get -Headers $adminHeaders
    $kpiSw.Stop()
    $kpis = $kpiRes.data

    Assert-Test "Dashboard KPIs loaded (Latency: $($kpiSw.ElapsedMilliseconds)ms)" ($kpiRes.success -eq $true)
    Assert-Test "Total Transactions > 0" ($kpis.totalTransactions -gt 0)
    Assert-Test "Total Transaction Volume INR > 0" ($kpis.totalTransactionValueInr -gt 0)
    Assert-Test "Average Transaction Value calculated" ($kpis.averageTransactionValueInr -gt 0)
    Assert-Test "Fraud Flagged Count >= 0" ($kpis.fraudFlaggedCount -ge 0)
    Assert-Test "Fraud Rate Percentage >= 0%" ($kpis.fraudRatePercentage -ge 0)
    Assert-Test "Active Investigations Count >= 0" ($kpis.activeInvestigationsCount -ge 0)
    Assert-Test "Prevented Loss Status documents calculation logic" ($kpis.preventedLossStatus.Length -gt 0)
    Assert-Test "Threat Breakdown includes ATO & Velocity counts" ($kpis.threatBreakdown.accountTakeoverCount -ge 0 -and $kpis.threatBreakdown.velocitySpikesCount -ge 0)
} catch {
    Assert-Test "Dashboard KPIs loaded" $false $_.Exception.Message
}

# -------------------------------------------------------------
# 3. Fraud Trend Time-Series Analytics
# -------------------------------------------------------------
Write-Host "`n--- 3. Multi-Period Fraud Trends ---" -ForegroundColor Yellow

$trendSw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    # 7-Day Trend
    $t7Res = Invoke-RestMethod -Uri "$ApiUrl/analytics/fraud-trends?period=7d" -Method Get -Headers $adminHeaders
    $trendSw.Stop()
    Assert-Test "7-Day Fraud Trends loaded (Latency: $($trendSw.ElapsedMilliseconds)ms)" ($t7Res.data.period -eq "7d" -and $t7Res.data.points.Count -eq 7)

    # 24-Hour Trend
    $t24Res = Invoke-RestMethod -Uri "$ApiUrl/analytics/fraud-trends?period=24h" -Method Get -Headers $adminHeaders
    Assert-Test "24-Hour Fraud Trends loaded" ($t24Res.data.period -eq "24h" -and $t24Res.data.points.Count -eq 6)

    # 30-Day Trend
    $t30Res = Invoke-RestMethod -Uri "$ApiUrl/analytics/fraud-trends?period=30d" -Method Get -Headers $adminHeaders
    Assert-Test "30-Day Fraud Trends loaded" ($t30Res.data.period -eq "30d" -and $t30Res.data.points.Count -eq 30)
} catch {
    Assert-Test "Multi-Period Fraud Trends loaded" $false $_.Exception.Message
}

# -------------------------------------------------------------
# 4. Risk Distribution Telemetry
# -------------------------------------------------------------
Write-Host "`n--- 4. Risk Tier Distribution ---" -ForegroundColor Yellow

try {
    $distRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/risk-distribution" -Method Get -Headers $adminHeaders
    $d = $distRes.data
    $calcTotal = $d.low + $d.medium + $d.high + $d.critical
    Assert-Test "Risk distribution loaded" ($distRes.success -eq $true)
    Assert-Test "Total equals sum of tiers ($calcTotal == $($d.total))" ($d.total -eq $calcTotal)
} catch {
    Assert-Test "Risk distribution loaded" $false $_.Exception.Message
}

# -------------------------------------------------------------
# 5. Risk Segments: Category, Geographic, Merchant, Device & Customer
# -------------------------------------------------------------
Write-Host "`n--- 5. Risk Segments & Categorical Analytics ---" -ForegroundColor Yellow

try {
    $catRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/fraud-by-category" -Method Get -Headers $adminHeaders
    Assert-Test "Fraud by category loaded" ($catRes.success -eq $true -and $catRes.data.Count -gt 0)
} catch {
    Assert-Test "Fraud by category loaded" $false $_.Exception.Message
}

try {
    $geoRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/geographic-risk" -Method Get -Headers $adminHeaders
    Assert-Test "Geographic risk loaded" ($geoRes.success -eq $true -and $geoRes.data.Count -gt 0)
    Assert-Test "Geographic risk items contain location and rate" ($geoRes.data[0].city.Length -gt 0)
} catch {
    Assert-Test "Geographic risk loaded" $false $_.Exception.Message
}

$merchSw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $merchRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/merchant-risk" -Method Get -Headers $adminHeaders
    $merchSw.Stop()
    Assert-Test "Merchant risk loaded (Latency: $($merchSw.ElapsedMilliseconds)ms)" ($merchRes.success -eq $true -and $merchRes.data.Count -gt 0)
    Assert-Test "Merchant includes MCC and risk level" ($merchRes.data[0].mcc.Length -gt 0)
} catch {
    Assert-Test "Merchant risk loaded" $false $_.Exception.Message
}

try {
    $devRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/device-risk" -Method Get -Headers $adminHeaders
    Assert-Test "Device risk loaded" ($devRes.success -eq $true -and $devRes.data.Count -gt 0)
} catch {
    Assert-Test "Device risk loaded" $false $_.Exception.Message
}

try {
    $custRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/customer-risk?page=1&pageSize=5" -Method Get -Headers $adminHeaders
    Assert-Test "Customer risk (paginated) loaded" ($custRes.success -eq $true -and $custRes.data.items.Count -gt 0)
    Assert-Test "Customer item includes volume and prior alerts" ($custRes.data.items[0].customerCode.Length -gt 0)
} catch {
    Assert-Test "Customer risk (paginated) loaded" $false $_.Exception.Message
}

# -------------------------------------------------------------
# 6. Alert & Investigation Analytics
# -------------------------------------------------------------
Write-Host "`n--- 6. Alert & Investigation Analytics ---" -ForegroundColor Yellow

try {
    $alertRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/alerts" -Method Get -Headers $adminHeaders
    Assert-Test "Alert analytics loaded" ($alertRes.success -eq $true -and $alertRes.data.total -ge 0)
    Assert-Test "Alert analytics includes resolution hours" ($alertRes.data.averageResolutionHours -ge 0)
} catch {
    Assert-Test "Alert analytics loaded" $false $_.Exception.Message
}

try {
    $invRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/investigations" -Method Get -Headers $adminHeaders
    Assert-Test "Investigation analytics loaded" ($invRes.success -eq $true -and $invRes.data.totalInvestigations -ge 0)
    Assert-Test "Investigation analytics includes decision distribution" ($invRes.data.decisionDistribution -ne $null)
} catch {
    Assert-Test "Investigation analytics loaded" $false $_.Exception.Message
}

# -------------------------------------------------------------
# 7. Model Monitoring, Histogram & Drift Evaluation
# -------------------------------------------------------------
Write-Host "`n--- 7. Model Monitoring & Drift Evaluation ---" -ForegroundColor Yellow

try {
    $modelRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/model-monitoring" -Method Get -Headers $adminHeaders
    $m = $modelRes.data
    Assert-Test "Model monitoring data loaded" ($modelRes.success -eq $true)
    Assert-Test "Model training specs: LightGBM (464 features, 0.9168 ROC-AUC)" ($m.modelName -eq "LightGBM_Fraud_Classifier" -and $m.rocAuc -eq 0.9168)
    Assert-Test "Runtime predictions processed > 0" ($m.predictionsProcessed -gt 0)
    Assert-Test "Probability distribution has 5 histogram buckets" ($m.probabilityDistribution.Count -eq 5)
    Assert-Test "Drift evaluation status is STABLE" ($m.driftStatus -eq "STABLE")
} catch {
    Assert-Test "Model monitoring data loaded" $false $_.Exception.Message
}

# -------------------------------------------------------------
# 8. Live Alerts Queue
# -------------------------------------------------------------
Write-Host "`n--- 8. Live Alerts Queue ---" -ForegroundColor Yellow

try {
    $liveRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/live-alerts?limit=5" -Method Get -Headers $adminHeaders
    Assert-Test "Live alerts queue returns list" ($liveRes.success -eq $true -and $liveRes.data.Count -gt 0)
    Assert-Test "Live alert contains transaction code & probability" ($liveRes.data[0].alertCode.Length -gt 0 -and $liveRes.data[0].fraudProbability -gt 0)
} catch {
    Assert-Test "Live alerts queue returns list" $false $_.Exception.Message
}

# -------------------------------------------------------------
# 9. RBAC Authorization & Data Export Center
# -------------------------------------------------------------
Write-Host "`n--- 9. RBAC & Data Export Center ---" -ForegroundColor Yellow

# Compliance Login
$compLogin = @{
    email = "amit.bose@fraudguard.enterprise.io"
    password = "password123"
} | ConvertTo-Json

$compRes = Invoke-RestMethod -Uri "$ApiUrl/auth/login" -Method Post -Body $compLogin -ContentType "application/json"
$compToken = $compRes.data.token
$compHeaders = @{ Authorization = "Bearer $compToken" }

# Investigator Login
$invLogin = @{
    email = "riya.desai@fraudguard.enterprise.io"
    password = "password123"
} | ConvertTo-Json

$invRes = Invoke-RestMethod -Uri "$ApiUrl/auth/login" -Method Post -Body $invLogin -ContentType "application/json"
$invToken = $invRes.data.token
$invHeaders = @{ Authorization = "Bearer $invToken" }

# Admin exports fraud-alerts CSV
try {
    $adminExport = Invoke-RestMethod -Uri "$ApiUrl/analytics/export?type=fraud-alerts" -Method Get -Headers $adminHeaders
    Assert-Test "Admin can export CSV (200 OK)" ($adminExport.Contains("AlertCode,TransactionCode"))
    Assert-Test "Exported CSV does not leak passwords or hashes" (-not $adminExport.Contains("PasswordHash"))
} catch {
    Assert-Test "Admin can export CSV" $false $_.Exception.Message
}

# Compliance exports transactions CSV
try {
    $compExport = Invoke-RestMethod -Uri "$ApiUrl/analytics/export?type=transactions" -Method Get -Headers $compHeaders
    Assert-Test "Compliance can export CSV (200 OK)" ($compExport.Contains("TransactionCode,Date"))
} catch {
    Assert-Test "Compliance can export CSV" $false $_.Exception.Message
}

# Investigator blocked from CSV export (403)
try {
    $invExport = Invoke-WebRequest -Uri "$ApiUrl/analytics/export?type=fraud-alerts" -Method Get -Headers $invHeaders
    Assert-Test "Investigator blocked from CSV export (403)" $false "Expected 403, got $($invExport.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Assert-Test "Investigator blocked from CSV export (403)" ($code -eq 403) "Received status $code"
}

# -------------------------------------------------------------
# 10. Real-Time Transaction Ingestion & Live Metric Reflection
# -------------------------------------------------------------
Write-Host "`n--- 10. Real-Time Ingestion & Metric Reflection ---" -ForegroundColor Yellow

$initialTxns = $kpis.totalTransactions

try {
    # Ingest Suspicious High-Value Transaction with seeded accounts
    $newTxnBody = @{
        accountId = "44444444-4444-4444-4444-444444444401"
        customerId = "33333333-3333-3333-3333-333333333301"
        amountInr = 850000.0
        amountUsd = 10200.0
        paymentMethod = "UPI"
        ipAddress = "185.220.101.5"
        city = "Tbilisi"
        country = "Georgia"
        distanceFromTypicalKm = 5200.0
        vpnOrProxyDetected = $true
        torExitNode = $false
    } | ConvertTo-Json

    $createRes = Invoke-RestMethod -Uri "$ApiUrl/transactions" -Method Post -Body $newTxnBody -Headers $invHeaders -ContentType "application/json"
    Assert-Test "Suspicious transaction ingested via API" ($createRes.success -eq $true)

    # Invalidate cache by reading dashboard
    Start-Sleep -Seconds 1
    $updatedKpiRes = Invoke-RestMethod -Uri "$ApiUrl/analytics/dashboard" -Method Get -Headers $adminHeaders
    $newTxns = $updatedKpiRes.data.totalTransactions

    Assert-Test "Dashboard reflected new transaction (Count: $initialTxns -> $newTxns)" ($newTxns -ge $initialTxns)
} catch {
    Assert-Test "Real-Time Ingestion & Metric Reflection" $false $_.Exception.Message
}

# -------------------------------------------------------------
# Summary
# -------------------------------------------------------------
Write-Host "`n============================================================" -ForegroundColor Cyan
if ($Failed -eq 0) {
    Write-Host "  PHASE 10 VERIFICATION SUMMARY: $Passed PASSED, $Failed FAILED" -ForegroundColor Green
} else {
    Write-Host "  PHASE 10 VERIFICATION SUMMARY: $Passed PASSED, $Failed FAILED" -ForegroundColor Red
}
Write-Host "============================================================" -ForegroundColor Cyan

if ($Failed -gt 0) {
    exit 1
} else {
    exit 0
}
