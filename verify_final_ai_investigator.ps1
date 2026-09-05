# Comprehensive Verification for AI Investigator Page Fixes
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FRAUDGUARD AI - FINAL AI INVESTIGATOR E2E VERIFICATION    " -ForegroundColor Cyan
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

# 1. Login as Riya Desai (INVESTIGATOR)
$loginPayload = @{
    email = "riya.desai@fraudguard.enterprise.io"
    password = "password123"
} | ConvertTo-Json

try {
    $authRes = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post `
        -Headers @{ "Origin" = "http://192.168.1.109:3000" } `
        -ContentType "application/json" -Body $loginPayload

    $token = $authRes.data.token
    $role = $authRes.data.user.role

    Assert-Test "Login as Riya Desai returns valid JWT token" ($token.Length -gt 20)
    Assert-Test "User role is INVESTIGATOR" ($role -eq "INVESTIGATOR")
} catch {
    Assert-Test "Login as Riya Desai" $false $_.Exception.Message
}

$headers = @{
    "Origin" = "http://192.168.1.109:3000"
    "Authorization" = "Bearer $token"
}

# 2. RBAC: Verify engine-health & model-info strictly 403 for INVESTIGATOR
try {
    $eh = Invoke-WebRequest -Uri "http://localhost:5000/api/fraud/engine-health" -Method Get -Headers $headers
    Assert-Test "Backend RBAC: engine-health returns 403 to INVESTIGATOR" $false
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert-Test "Backend RBAC: engine-health returns 403 to INVESTIGATOR" ($status -eq 403)
}

try {
    $mi = Invoke-WebRequest -Uri "http://localhost:5000/api/fraud/model-info" -Method Get -Headers $headers
    Assert-Test "Backend RBAC: model-info returns 403 to INVESTIGATOR" $false
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert-Test "Backend RBAC: model-info returns 403 to INVESTIGATOR" ($status -eq 403)
}

# 3. Retrieve transactions and verify target transaction
try {
    $txnsRes = Invoke-RestMethod -Uri "http://localhost:5000/api/transactions?pageSize=50" -Method Get -Headers $headers
    $targetTxn = $txnsRes.data.items | Where-Object { $_.transactionCode -eq "TXN-2026-606076" }

    Assert-Test "Found TXN-2026-606076 in transactions store" ($null -ne $targetTxn)
    Assert-Test "TXN-2026-606076 has valid Guid transactionId" ($targetTxn.transactionId -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    Assert-Test "Target transaction customer is Arjun Mehta" ($targetTxn.customerName -eq "Arjun Mehta")
    Assert-Test "Target transaction amount is 50,000 INR" ($targetTxn.amountInr -eq 50000)

    $guid = $targetTxn.transactionId
} catch {
    Assert-Test "Transactions fetch" $false $_.Exception.Message
}

# 4. Post investigation payload with exact GUID
$investigatePayload = @{
    transactionId = $guid
} | ConvertTo-Json

try {
    $invRes = Invoke-RestMethod -Uri "http://localhost:5000/api/ai-investigator/investigate" -Method Post `
        -Headers $headers -ContentType "application/json" -Body $investigatePayload

    Assert-Test "POST /api/ai-investigator/investigate returns HTTP 200 OK" ($invRes.success -eq $true)
    Assert-Test "Section: Subject Case Dossier populated (transactionCode & customer)" ($invRes.data.transactionCode -eq "TXN-2026-606076" -and $invRes.data.customerName -eq "Arjun Mehta")
    Assert-Test "Section: ML Anomaly Score present (fraudProbability)" ($invRes.data.fraudProbability -gt 0)
    Assert-Test "Section: Executive Summary present" ($invRes.data.summary.Length -gt 15)
    Assert-Test "Section: Synthesized Evidence present" ($invRes.data.evidence.Count -gt 0)
    Assert-Test "Section: Findings present" ($invRes.data.findings.Count -gt 0)
    Assert-Test "Section: Regulatory RAG Grounding present (policy references)" ($invRes.data.policyReferences.Count -gt 0)
    Assert-Test "Section: Investigation Timeline present" ($invRes.data.timeline.Count -gt 0)
    Assert-Test "Section: Human-in-the-Loop Decision Controls actionable (recommendedAction)" ($null -ne $invRes.data.recommendedAction)
} catch {
    Assert-Test "POST /api/ai-investigator/investigate" $false $_.Exception.Message
}

# 5. Verify Angular Server is live with latest build
try {
    $ngRes = Invoke-WebRequest -Uri "http://localhost:3000" -Method Head -UseBasicParsing
    Assert-Test "Angular App serving on http://localhost:3000 (200 OK)" ($ngRes.StatusCode -eq 200)
} catch {
    Assert-Test "Angular App serving" $false $_.Exception.Message
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " RESULTS: $passed PASSED / $failed FAILED                   " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
