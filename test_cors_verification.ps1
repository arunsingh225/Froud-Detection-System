# Test CORS verification script
$origins = @(
    "http://192.168.1.109:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4200",
    "http://127.0.0.1:4200"
)

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  FRAUDGUARD AI - CORS VERIFICATION SUITE       " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$allPassed = $true

foreach ($orig in $origins) {
    Write-Host "`nTesting Origin: $orig" -ForegroundColor Yellow

    # 1. Preflight OPTIONS
    try {
        $optHeaders = @{
            "Origin" = $orig
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "content-type"
        }
        $optRes = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method Options -Headers $optHeaders
        $allowOrigin = $optRes.Headers["Access-Control-Allow-Origin"]
        $allowCreds = $optRes.Headers["Access-Control-Allow-Credentials"]
        
        if ($optRes.StatusCode -eq 204 -and $allowOrigin -eq $orig -and $allowCreds -eq "true") {
            Write-Host "  [PASS] Preflight OPTIONS 204 No Content" -ForegroundColor Green
            Write-Host "         Allow-Origin: $allowOrigin | Allow-Credentials: $allowCreds" -ForegroundColor Gray
        } else {
            Write-Host "  [FAIL] Preflight OPTIONS check failed ($($optRes.StatusCode))" -ForegroundColor Red
            $allPassed = $false
        }
    } catch {
        Write-Host "  [FAIL] Preflight OPTIONS exception: $($_.Exception.Message)" -ForegroundColor Red
        $allPassed = $false
    }

    # 2. Actual POST /api/auth/login
    try {
        $postHeaders = @{
            "Origin" = $orig
            "Content-Type" = "application/json"
        }
        $body = '{"email":"riya.desai@fraudguard.enterprise.io","password":"password123"}'
        $postRes = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method Post -Headers $postHeaders -Body $body
        $allowOriginPost = $postRes.Headers["Access-Control-Allow-Origin"]
        $allowCredsPost = $postRes.Headers["Access-Control-Allow-Credentials"]

        if ($postRes.StatusCode -eq 200 -and $allowOriginPost -eq $orig -and $allowCredsPost -eq "true") {
            $json = $postRes.Content | ConvertFrom-Json
            if ($json.success -eq $true -and $json.data.token) {
                $savedToken = $json.data.token
                Write-Host "  [PASS] POST /api/auth/login 200 OK with valid JWT" -ForegroundColor Green
                Write-Host "         Allow-Origin: $allowOriginPost | User: $($json.data.user.fullName)" -ForegroundColor Gray
            } else {
                Write-Host "  [FAIL] Login returned success=false" -ForegroundColor Red
                $allPassed = $false
            }
        } else {
            Write-Host "  [FAIL] POST check failed ($($postRes.StatusCode))" -ForegroundColor Red
            $allPassed = $false
        }
    } catch {
        Write-Host "  [FAIL] POST login exception: $($_.Exception.Message)" -ForegroundColor Red
        $allPassed = $false
    }
}

# 3. Disallowed Origin test (Ensure NOT wildcard or AllowAnyOrigin)
Write-Host "`nTesting Disallowed Origin: http://malicious-site.com" -ForegroundColor Yellow
try {
    $badHeaders = @{
        "Origin" = "http://malicious-site.com"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type"
    }
    $badRes = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method Options -Headers $badHeaders
    $badAllowOrigin = $badRes.Headers["Access-Control-Allow-Origin"]
    if ($badAllowOrigin -eq $null) {
        Write-Host "  [PASS] Disallowed origin blocked: No Access-Control-Allow-Origin header returned" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Disallowed origin returned Access-Control-Allow-Origin: $badAllowOrigin" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  [PASS] Disallowed origin rejected" -ForegroundColor Green
}

# 4. Protected Endpoints with Origin: http://192.168.1.109:3000
Write-Host "`nTesting Protected Endpoints with Origin: http://192.168.1.109:3000" -ForegroundColor Yellow
try {
    if (-not $savedToken) {
        $loginBody = '{"email":"riya.desai@fraudguard.enterprise.io","password":"password123"}'
        $loginRes = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Headers @{ "Origin" = "http://192.168.1.109:3000"; "Content-Type" = "application/json" } -Body $loginBody
        $savedToken = $loginRes.data.token
    }
    $authHeaders = @{ "Origin" = "http://192.168.1.109:3000"; "Authorization" = "Bearer $savedToken" }

    $meRes = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/me" -Method Get -Headers $authHeaders
    $meOrigin = $meRes.Headers["Access-Control-Allow-Origin"]
    if ($meRes.StatusCode -eq 200 -and $meOrigin -eq "http://192.168.1.109:3000") {
        Write-Host "  [PASS] GET /api/auth/me succeeded with 200 OK & CORS header ($meOrigin)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] GET /api/auth/me failed ($($meRes.StatusCode), Origin: $meOrigin)" -ForegroundColor Red
        $allPassed = $false
    }

    $txnRes = Invoke-WebRequest -Uri "http://localhost:5000/api/transactions?pageSize=2" -Method Get -Headers $authHeaders
    $txnOrigin = $txnRes.Headers["Access-Control-Allow-Origin"]
    if ($txnRes.StatusCode -eq 200 -and $txnOrigin -eq "http://192.168.1.109:3000") {
        Write-Host "  [PASS] GET /api/transactions succeeded with 200 OK & CORS header ($txnOrigin)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] GET /api/transactions failed ($($txnRes.StatusCode), Origin: $txnOrigin)" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  [FAIL] Protected endpoint exception: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  ALL CORS VERIFICATION CHECKS PASSED (100%)    " -ForegroundColor Green
} else {
    Write-Host "  SOME CORS CHECKS FAILED                       " -ForegroundColor Red
}
Write-Host "=================================================" -ForegroundColor Cyan
