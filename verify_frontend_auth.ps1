# Frontend Authentication & Dashboard API Verification Script
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FRAUDGUARD AI - FRONTEND AUTHENTICATION VERIFICATION      " -ForegroundColor Cyan
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

# 1. Test Login with Origin http://192.168.1.109:3000
$loginBody = @{
    email = "riya.desai@fraudguard.enterprise.io"
    password = "password123"
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post `
        -Headers @{ "Origin" = "http://192.168.1.109:3000" } `
        -Body $loginBody -ContentType "application/json"
    
    $token = $loginRes.data.token
    $user = $loginRes.data.user

    Assert-Test "POST /api/auth/login returns 200 OK & valid JWT" ($token.Length -gt 20)
    Assert-Test "Login response maps user (Riya Desai, INVESTIGATOR)" ($user.fullName -eq "Riya Desai" -and $user.role -eq "INVESTIGATOR")
} catch {
    Assert-Test "POST /api/auth/login" $false $_.Exception.Message
}

$authHeaders = @{
    "Origin" = "http://192.168.1.109:3000"
    "Authorization" = "Bearer $token"
}

# 2. Test GET /api/auth/me
try {
    $meRes = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/me" -Method Get -Headers $authHeaders
    Assert-Test "GET /api/auth/me resolves identity claims" ($meRes.data.fullName -eq "Riya Desai")
} catch {
    Assert-Test "GET /api/auth/me" $false $_.Exception.Message
}

# 3. Test GET /api/analytics/dashboard
try {
    $dashRes = Invoke-WebRequest -Uri "http://localhost:5000/api/analytics/dashboard" -Method Get -Headers $authHeaders
    Assert-Test "GET /api/analytics/dashboard with Bearer returns HTTP 200" ($dashRes.StatusCode -eq 200)
    $dashData = $dashRes.Content | ConvertFrom-Json
    Assert-Test "Dashboard KPIs contain totalTransactions" ($dashData.data.totalTransactions -gt 0)
} catch {
    Assert-Test "GET /api/analytics/dashboard with Bearer" $false $_.Exception.Message
}

# 4. Test GET /api/analytics/live-alerts?limit=10
try {
    $liveRes = Invoke-WebRequest -Uri "http://localhost:5000/api/analytics/live-alerts?limit=10" -Method Get -Headers $authHeaders
    Assert-Test "GET /api/analytics/live-alerts?limit=10 with Bearer returns HTTP 200" ($liveRes.StatusCode -eq 200)
    $liveData = $liveRes.Content | ConvertFrom-Json
    Assert-Test "Live alerts array returned" ($liveData.data.Count -gt 0)
} catch {
    Assert-Test "GET /api/analytics/live-alerts?limit=10 with Bearer" $false $_.Exception.Message
}

# 5. Verify Angular is serving on http://192.168.1.109:3000
try {
    $ngRes = Invoke-WebRequest -Uri "http://192.168.1.109:3000" -Method Head
    Assert-Test "Angular App serving on http://192.168.1.109:3000" ($ngRes.StatusCode -eq 200)
} catch {
    Assert-Test "Angular App serving on http://192.168.1.109:3000" $false $_.Exception.Message
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " RESULTS: $passed PASSED / $failed FAILED                   " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
