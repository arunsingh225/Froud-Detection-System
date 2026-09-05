# AI Investigator & RBAC Comprehensive Verification Script
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FRAUDGUARD AI - AI INVESTIGATOR & RBAC VERIFICATION       " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Assert-Test {
    param([string]$Name, [bool]$Condition, [string]$Details = "")
    if ($Condition) {
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  [FAIL] $Name" -ForegroundColor Red
        if ($Details) { Write-Host "         $Details" -ForegroundColor Yellow }
        $script:failed++
    }
}

# -------------------------------------------------------------
# TEST 1: INVESTIGATOR Login (Riya Desai)
# -------------------------------------------------------------
$investigatorLogin = @{
    email = "riya.desai@fraudguard.enterprise.io"
    password = "password123"
} | ConvertTo-Json

try {
    $invLoginRes = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post `
        -Headers @{ "Origin" = "http://192.168.1.109:3000" } `
        -ContentType "application/json" -Body $investigatorLogin

    $invToken = $invLoginRes.data.token
    $invRole = $invLoginRes.data.user.role

    Assert-Test "Login as Riya Desai (INVESTIGATOR) returns JWT" ($invToken.Length -gt 20)
    Assert-Test "Role is strictly INVESTIGATOR" ($invRole -eq "INVESTIGATOR")
} catch {
    Assert-Test "INVESTIGATOR login failed" $false $_.Exception.Message
}

$invHeaders = @{
    "Origin" = "http://192.168.1.109:3000"
    "Authorization" = "Bearer $invToken"
}

# -------------------------------------------------------------
# TEST 2: Preserved Backend RBAC Check
# -------------------------------------------------------------
# Backend MUST return 403 Forbidden to INVESTIGATOR on engine-health and model-info
try {
    $res = Invoke-WebRequest -Uri "http://localhost:5000/api/fraud/engine-health" -Method Get -Headers $invHeaders
    Assert-Test "Backend RBAC: engine-health returns 403 to INVESTIGATOR" $false "Received unexpected 200"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert-Test "Backend RBAC: engine-health strictly returns 403 to INVESTIGATOR" ($statusCode -eq 403)
}

try {
    $res = Invoke-WebRequest -Uri "http://localhost:5000/api/fraud/model-info" -Method Get -Headers $invHeaders
    Assert-Test "Backend RBAC: model-info returns 403 to INVESTIGATOR" $false "Received unexpected 200"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert-Test "Backend RBAC: model-info strictly returns 403 to INVESTIGATOR" ($statusCode -eq 403)
}

# -------------------------------------------------------------
# TEST 3: ADMIN CAN access engine-health and model-info
# -------------------------------------------------------------
$adminLogin = @{
    email = "priyanka.iyer@fraudguard.enterprise.io"
    password = "password123"
} | ConvertTo-Json

try {
    $adminLoginRes = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post `
        -Headers @{ "Origin" = "http://192.168.1.109:3000" } `
        -ContentType "application/json" -Body $adminLogin

    $adminHeaders = @{
        "Origin" = "http://192.168.1.109:3000"
        "Authorization" = "Bearer $($adminLoginRes.data.token)"
    }

    $ehRes = Invoke-WebRequest -Uri "http://localhost:5000/api/fraud/engine-health" -Method Get -Headers $adminHeaders
    Assert-Test "ADMIN role can access /api/fraud/engine-health (200 OK)" ($ehRes.StatusCode -eq 200)

    $miRes = Invoke-WebRequest -Uri "http://localhost:5000/api/fraud/model-info" -Method Get -Headers $adminHeaders
    Assert-Test "ADMIN role can access /api/fraud/model-info (200 OK)" ($miRes.StatusCode -eq 200)
} catch {
    Assert-Test "ADMIN RBAC check" $false $_.Exception.Message
}

# -------------------------------------------------------------
# TEST 4: Fetch Transaction TXN-2026-606076 & Verify GUID mapping
# -------------------------------------------------------------
try {
    $txnsRes = Invoke-RestMethod -Uri "http://localhost:5000/api/transactions?pageSize=50" -Method Get -Headers $invHeaders
    $targetTxn = $txnsRes.data.items | Where-Object { $_.transactionCode -eq "TXN-2026-606076" }

    Assert-Test "Found target transaction TXN-2026-606076 in database" ($null -ne $targetTxn)
    Assert-Test "Transaction has valid GUID transactionId" ($targetTxn.transactionId -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    Assert-Test "Amount is ₹50,000" ($targetTxn.amountInr -eq 50000)
    Assert-Test "Customer is Arjun Mehta" ($targetTxn.customerName -eq "Arjun Mehta")

    $txnGuid = $targetTxn.transactionId
} catch {
    Assert-Test "Fetch transaction error" $false $_.Exception.Message
}

# -------------------------------------------------------------
# TEST 5: POST /api/ai-investigator/investigate with valid GUID
# -------------------------------------------------------------
$investigatePayload = @{
    transactionId = $txnGuid
} | ConvertTo-Json

try {
    $invRes = Invoke-RestMethod -Uri "http://localhost:5000/api/ai-investigator/investigate" -Method Post `
        -Headers $invHeaders -ContentType "application/json" -Body $investigatePayload

    Assert-Test "POST /api/ai-investigator/investigate returns 200 OK (Not 400)" ($invRes.success -eq $true)
    Assert-Test "Investigation details generated" ($null -ne $invRes.data.investigationCode)
    Assert-Test "Evidence array populated" ($invRes.data.evidence.Count -gt 0)
    Assert-Test "Findings array populated" ($invRes.data.findings.Count -gt 0)
    Assert-Test "Executive summary provided" ($invRes.data.summary.Length -gt 20)
    Assert-Test "Timeline steps generated" ($invRes.data.timeline.Count -gt 0)
    Assert-Test "Recommended action provided" ($null -ne $invRes.data.recommendedAction)
} catch {
    Assert-Test "POST /api/ai-investigator/investigate" $false $_.Exception.Message
}

# -------------------------------------------------------------
# TEST 6: Frontend Host & Service Reachability
# -------------------------------------------------------------
try {
    $ngRes = Invoke-WebRequest -Uri "http://192.168.1.109:3000" -Method Head
    Assert-Test "Angular serving on http://192.168.1.109:3000 (200 OK)" ($ngRes.StatusCode -eq 200)
} catch {
    Assert-Test "Angular App serving" $false $_.Exception.Message
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " RESULTS: $passed PASSED / $failed FAILED                   " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
