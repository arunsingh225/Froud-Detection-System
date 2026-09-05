#!/usr/bin/env pwsh
# Phase 8 — Authentication, RBAC & Security Hardening Automated Verification Suite

$baseUrl = "http://localhost:5000"
$apiBase = "$baseUrl/api"
$passed = 0
$failed = 0

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " FraudGuard AI - Phase 8 Security & RBAC Verification Suite" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

function Assert-Test {
    param(
        [string]$TestName,
        [bool]$Condition,
        [string]$Details = ""
    )
    if ($Condition) {
        Write-Host " [PASS] $TestName" -ForegroundColor Green
        if ($Details) { Write-Host "        $Details" -ForegroundColor DarkGray }
        $script:passed++
    } else {
        Write-Host " [FAIL] $TestName" -ForegroundColor Red
        if ($Details) { Write-Host "        $Details" -ForegroundColor DarkYellow }
        $script:failed++
    }
}

# ============================================================================
# 1. Security Headers Verification
# ============================================================================
Write-Host "--- 1. Security Headers & Defense-in-Depth ---" -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/swagger/v1/swagger.json" -Method GET -UseBasicParsing
    $headers = $resp.Headers

    $hasNoSniff = $headers["X-Content-Type-Options"] -eq "nosniff" -or $headers["x-content-type-options"] -eq "nosniff"
    Assert-Test -TestName "X-Content-Type-Options: nosniff present" -Condition $hasNoSniff

    $hasDenyFrame = $headers["X-Frame-Options"] -eq "DENY" -or $headers["x-frame-options"] -eq "DENY"
    Assert-Test -TestName "X-Frame-Options: DENY present" -Condition $hasDenyFrame

    $hasReferrer = $headers["Referrer-Policy"] -eq "strict-origin-when-cross-origin" -or $headers["referrer-policy"] -eq "strict-origin-when-cross-origin"
    Assert-Test -TestName "Referrer-Policy: strict-origin-when-cross-origin present" -Condition $hasReferrer

    $hasXss = $headers["X-XSS-Protection"] -like "*mode=block*" -or $headers["x-xss-protection"] -like "*mode=block*"
    Assert-Test -TestName "X-XSS-Protection: 1; mode=block present" -Condition $hasXss
} catch {
    Assert-Test -TestName "Security Headers Check" -Condition $false -Details $_.Exception.Message
}

# ============================================================================
# 2. Unauthenticated Request Blocking (401 Unauthorized)
# ============================================================================
Write-Host "`n--- 2. Unauthenticated Request Blocking (401) ---" -ForegroundColor Yellow
$protectedUrls = @(
    "/transactions",
    "/fraud-alerts",
    "/audit-logs",
    "/users",
    "/auth/me"
)

foreach ($url in $protectedUrls) {
    try {
        $null = Invoke-RestMethod -Uri "$apiBase$url" -Method GET
        Assert-Test -TestName "GET $url without token rejected" -Condition $false -Details "Expected 401 but succeeded"
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        Assert-Test -TestName "GET $url without token rejected (HTTP $status)" -Condition ($status -eq 401)
    }
}

# ============================================================================
# 3. Authentication & JWT Token Issuance
# ============================================================================
Write-Host "`n--- 3. Authentication & Role Token Issuance ---" -ForegroundColor Yellow
$adminToken = $null
$investigatorToken = $null
$complianceToken = $null

# Admin Login (Priyanka Iyer)
try {
    $loginBody = '{"email":"priyanka.iyer@fraudguard.enterprise.io","password":"password123"}'
    $res = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $adminToken = $res.data.token
    Assert-Test -TestName "Admin Login (Priyanka Iyer)" -Condition ($res.success -and $res.data.user.role -eq "ADMIN" -and $adminToken)
} catch {
    Assert-Test -TestName "Admin Login" -Condition $false -Details $_.Exception.Message
}

# Investigator Login (Riya Desai)
try {
    $loginBody = '{"email":"riya.desai@fraudguard.enterprise.io","password":"password123"}'
    $res = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $investigatorToken = $res.data.token
    Assert-Test -TestName "Investigator Login (Riya Desai)" -Condition ($res.success -and $res.data.user.role -eq "INVESTIGATOR" -and $investigatorToken)
} catch {
    Assert-Test -TestName "Investigator Login" -Condition $false -Details $_.Exception.Message
}

# Compliance Login (Amit Bose)
try {
    $loginBody = '{"email":"amit.bose@fraudguard.enterprise.io","password":"password123"}'
    $res = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $complianceToken = $res.data.token
    Assert-Test -TestName "Compliance Login (Amit Bose)" -Condition ($res.success -and $res.data.user.role -eq "COMPLIANCE" -and $complianceToken)
} catch {
    Assert-Test -TestName "Compliance Login" -Condition $false -Details $_.Exception.Message
}

# ============================================================================
# 4. Tampered & Invalid JWT Token Handling (401)
# ============================================================================
Write-Host "`n--- 4. Tampered & Invalid JWT Token Protection ---" -ForegroundColor Yellow
try {
    # Modify the signature of the admin token
    $tamperedToken = $adminToken.Substring(0, $adminToken.Length - 8) + "badSig99"
    $headers = @{ "Authorization" = "Bearer $tamperedToken" }
    $null = Invoke-RestMethod -Uri "$apiBase/auth/me" -Method GET -Headers $headers
    Assert-Test -TestName "Tampered JWT signature rejected" -Condition $false -Details "Expected 401"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert-Test -TestName "Tampered JWT signature rejected (HTTP $status)" -Condition ($status -eq 401)
}

try {
    $headers = @{ "Authorization" = "Bearer NotARealTokenAtAll" }
    $null = Invoke-RestMethod -Uri "$apiBase/auth/me" -Method GET -Headers $headers
    Assert-Test -TestName "Malformed JWT token rejected" -Condition $false -Details "Expected 401"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert-Test -TestName "Malformed JWT token rejected (HTTP $status)" -Condition ($status -eq 401)
}

# ============================================================================
# 5. Claims-Based Identity Resolution (GET /api/auth/me)
# ============================================================================
Write-Host "`n--- 5. Claims-Based Identity Resolution ---" -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer $adminToken" }
    $res = Invoke-RestMethod -Uri "$apiBase/auth/me" -Method GET -Headers $headers
    Assert-Test -TestName "Identity resolved from Admin JWT claims" -Condition ($res.data.email -eq "priyanka.iyer@fraudguard.enterprise.io" -and $res.data.role -eq "ADMIN")
} catch {
    Assert-Test -TestName "Admin Claims Identity" -Condition $false -Details $_.Exception.Message
}

try {
    $headers = @{ "Authorization" = "Bearer $investigatorToken" }
    $res = Invoke-RestMethod -Uri "$apiBase/auth/me" -Method GET -Headers $headers
    Assert-Test -TestName "Identity resolved from Investigator JWT claims" -Condition ($res.data.email -eq "riya.desai@fraudguard.enterprise.io" -and $res.data.role -eq "INVESTIGATOR")
} catch {
    Assert-Test -TestName "Investigator Claims Identity" -Condition $false -Details $_.Exception.Message
}

# ============================================================================
# 6. RBAC Matrix Enforcement
# ============================================================================
Write-Host "`n--- 6. RBAC Role Matrix Enforcement ---" -ForegroundColor Yellow

# Investigator: Allowed actions
try {
    $headers = @{ "Authorization" = "Bearer $investigatorToken" }
    $res = Invoke-RestMethod -Uri "$apiBase/transactions?page=1&pageSize=5" -Method GET -Headers $headers
    Assert-Test -TestName "Investigator can view Transactions (200 OK)" -Condition ($res.success)
} catch {
    Assert-Test -TestName "Investigator Transactions" -Condition $false -Details $_.Exception.Message
}

# Investigator: Denied actions (Audit logs & Users)
try {
    $headers = @{ "Authorization" = "Bearer $investigatorToken" }
    $null = Invoke-RestMethod -Uri "$apiBase/audit-logs" -Method GET -Headers $headers
    Assert-Test -TestName "Investigator blocked from Audit Logs (403)" -Condition $false
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert-Test -TestName "Investigator blocked from Audit Logs (HTTP $status)" -Condition ($status -eq 403)
}

try {
    $headers = @{ "Authorization" = "Bearer $investigatorToken" }
    $null = Invoke-RestMethod -Uri "$apiBase/users" -Method GET -Headers $headers
    Assert-Test -TestName "Investigator blocked from User Management (403)" -Condition $false
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert-Test -TestName "Investigator blocked from User Management (HTTP $status)" -Condition ($status -eq 403)
}

# Compliance: Allowed actions
try {
    $headers = @{ "Authorization" = "Bearer $complianceToken" }
    $res = Invoke-RestMethod -Uri "$apiBase/audit-logs?page=1&pageSize=5" -Method GET -Headers $headers
    Assert-Test -TestName "Compliance can view Audit Logs (200 OK)" -Condition ($res.success)
} catch {
    Assert-Test -TestName "Compliance Audit Logs" -Condition $false -Details $_.Exception.Message
}

try {
    $headers = @{ "Authorization" = "Bearer $complianceToken" }
    $res = Invoke-RestMethod -Uri "$apiBase/reports?page=1&pageSize=5" -Method GET -Headers $headers
    Assert-Test -TestName "Compliance can view Reports (200 OK)" -Condition ($res.success)
} catch {
    Assert-Test -TestName "Compliance Reports" -Condition $false -Details $_.Exception.Message
}

# Compliance: Denied actions (User Management & Direct AI Predict Mutation)
try {
    $headers = @{ "Authorization" = "Bearer $complianceToken" }
    $null = Invoke-RestMethod -Uri "$apiBase/users" -Method GET -Headers $headers
    Assert-Test -TestName "Compliance blocked from User Management (403)" -Condition $false
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert-Test -TestName "Compliance blocked from User Management (HTTP $status)" -Condition ($status -eq 403)
}

# Admin: Allowed all
try {
    $headers = @{ "Authorization" = "Bearer $adminToken" }
    $res = Invoke-RestMethod -Uri "$apiBase/users" -Method GET -Headers $headers
    Assert-Test -TestName "Admin can access User Management (200 OK)" -Condition ($res.success -and $res.data.Count -gt 0)
} catch {
    Assert-Test -TestName "Admin User Management" -Condition $false -Details $_.Exception.Message
}

# ============================================================================
# 7. Admin Safety Guard (Last Active Admin Protection)
# ============================================================================
Write-Host "`n--- 7. Admin Safety Guard (Last Admin Deactivation Protection) ---" -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer $adminToken"; "Content-Type" = "application/json" }
    # Look up Priyanka's UserId
    $users = (Invoke-RestMethod -Uri "$apiBase/users" -Method GET -Headers $headers).data
    $priyanka = $users | Where-Object { $_.email -eq "priyanka.iyer@fraudguard.enterprise.io" }

    # Attempt to deactivate the only active admin
    $deactivateBody = '{"isActive": false}'
    $null = Invoke-RestMethod -Uri "$apiBase/users/$($priyanka.userId)/status" -Method PATCH -Headers $headers -Body $deactivateBody
    Assert-Test -TestName "Deactivating last active Admin blocked (400)" -Condition $false
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert-Test -TestName "Deactivating last active Admin blocked (HTTP $status)" -Condition ($status -eq 400)
}

# ============================================================================
# 8. User Creation & Role Modification Lifecycle
# ============================================================================
Write-Host "`n--- 8. User Management Lifecycle & Audit Logging ---" -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer $adminToken"; "Content-Type" = "application/json" }
    $newEmail = "test.officer." + (Get-Random -Minimum 1000 -Maximum 9999) + "@fraudguard.enterprise.io"
    $createBody = @{
        fullName = "Test Security Officer"
        email = $newEmail
        password = "SecurePassword123!"
        role = "INVESTIGATOR"
        department = "Tier-2 Investigation"
    } | ConvertTo-Json

    $createRes = Invoke-RestMethod -Uri "$apiBase/users" -Method POST -Headers $headers -Body $createBody
    $newUserId = $createRes.data.userId
    Assert-Test -TestName "Admin created new user ($newEmail)" -Condition ($createRes.success -and $newUserId)

    # Modify role to COMPLIANCE
    $roleBody = '{"role": "COMPLIANCE"}'
    $roleRes = Invoke-RestMethod -Uri "$apiBase/users/$newUserId/role" -Method PATCH -Headers $headers -Body $roleBody
    Assert-Test -TestName "Admin updated user role to COMPLIANCE" -Condition ($roleRes.success -and $roleRes.data.role -eq "COMPLIANCE")
} catch {
    Assert-Test -TestName "User Management Lifecycle" -Condition $false -Details $_.Exception.Message
}

# ============================================================================
# 9. Sanitized Error Payloads (No Stack Traces Leaked)
# ============================================================================
Write-Host "`n--- 9. Error Sanitization (Zero Trace Leakage) ---" -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer $adminToken" }
    # Request non-existent customer
    $fakeId = "00000000-0000-0000-0000-000000000000"
    $null = Invoke-RestMethod -Uri "$apiBase/customers/$fakeId" -Method GET -Headers $headers
    Assert-Test -TestName "Non-existent resource returns 404" -Condition $false
} catch {
    $rawError = $_.ErrorDetails.Message
    $leaksStackTrace = $rawError -like "*Exception:*" -or $rawError -like "*\src\backend\*" -or $rawError -like "*at System.*"
    Assert-Test -TestName "Error response is sanitized without stack traces" -Condition (-not $leaksStackTrace)
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " PHASE 8 SECURITY TEST RESULTS: $passed PASSED / $failed FAILED" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
