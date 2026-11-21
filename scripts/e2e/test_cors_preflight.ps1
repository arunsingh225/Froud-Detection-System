$testOrigins = @(
    "http://localhost:64988",
    "http://127.0.0.1:64988",
    "http://localhost:3000",
    "http://localhost:4200",
    "http://192.168.1.110:3000"
)

Write-Host "Testing CORS Preflight OPTIONS /api/auth/login..." -ForegroundColor Cyan

foreach ($origin in $testOrigins) {
    try {
        $headers = @{
            "Origin" = $origin
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "content-type,authorization"
        }
        $res = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method Options -Headers $headers -UseBasicParsing
        $allowOrigin = $res.Headers["Access-Control-Allow-Origin"]
        $allowCreds = $res.Headers["Access-Control-Allow-Credentials"]
        $allowMethods = $res.Headers["Access-Control-Allow-Methods"]
        
        if ($allowOrigin -eq $origin -and $allowCreds -eq "true") {
            Write-Host "  [PASS] Preflight for $origin -> Allow-Origin: $allowOrigin, Allow-Credentials: $allowCreds" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Preflight for $origin -> Allow-Origin: $allowOrigin, Allow-Credentials: $allowCreds" -ForegroundColor Red
        }
    } catch {
        Write-Host "  [FAIL] Preflight for $origin -> $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nTesting Actual POST /api/auth/login from http://localhost:64988..." -ForegroundColor Cyan
try {
    $loginHeaders = @{
        "Origin" = "http://localhost:64988"
        "Content-Type" = "application/json"
    }
    $body = @{ email = "riya.desai@fraudguard.enterprise.io"; password = "password123" } | ConvertTo-Json
    $res = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method Post -Headers $loginHeaders -Body $body -UseBasicParsing
    $allowOrigin = $res.Headers["Access-Control-Allow-Origin"]
    $allowCreds = $res.Headers["Access-Control-Allow-Credentials"]
    $data = $res.Content | ConvertFrom-Json
    
    if ($res.StatusCode -eq 200 -and $allowOrigin -eq "http://localhost:64988" -and $data.data.token.Length -gt 20) {
        Write-Host "  [PASS] Login from http://localhost:64988 -> 200 OK, User: $($data.data.user.fullName), Token Length: $($data.data.token.Length)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Login response: StatusCode=$($res.StatusCode), Allow-Origin=$allowOrigin" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] Login from http://localhost:64988 -> $($_.Exception.Message)" -ForegroundColor Red
}
