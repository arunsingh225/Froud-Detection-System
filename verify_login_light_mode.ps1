# Verify FraudGuard AI Login UI - Light Mode & Dark Mode Integrity
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FRAUDGUARD AI - LOGIN LIGHT MODE & DARK MODE VERIFICATION  " -ForegroundColor Cyan
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

# 1. Inspect login.component.ts code
$loginFile = Get-Content "src/app/pages/login/login.component.ts" -Raw

Assert-Test "Login component has :host-context(html.light) .login-card" ($loginFile -match ':host-context\(html\.light\)\s*\.login-card')
Assert-Test "Login card uses off-white/cream light surface (rgba(255, 255, 255, 0.95))" ($loginFile -match '\.login-card\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.95\)')
Assert-Test "Login card uses subtle border" ($loginFile -match '\.login-card\s*\{[^}]*border-color:\s*rgba\(0,\s*0,\s*0,\s*0\.09\)')
Assert-Test "Login card uses soft professional shadow" ($loginFile -match '\.login-card\s*\{[^}]*box-shadow:')
Assert-Test "Login heading uses dark readable color (#121212)" ($loginFile -match '\.login-heading\s*\{[^}]*#121212')
Assert-Test "Login labels use dark readable gray (#3F3F46)" ($loginFile -match '\.login-label\s*\{[^}]*#3F3F46')
Assert-Test "Login supporting text uses medium gray (#52525B)" ($loginFile -match '\.login-subtext\s*\{[^}]*#52525B')
Assert-Test "Login input containers have light background (#F7F6F2)" ($loginFile -match '\.login-input-container\s*\{[^}]*#F7F6F2')
Assert-Test "Login input container focus state has gold border (#9C782B)" ($loginFile -match '\.login-input-container:focus-within\s*\{[^}]*#9C782B')
Assert-Test "Login input text is dark (#121212)" ($loginFile -match '\.login-input\s*\{[^}]*#121212')
Assert-Test "Login input placeholder is readable gray (#8E8E93)" ($loginFile -match '\.login-input::placeholder\s*\{[^}]*#8E8E93')
Assert-Test "Password visibility icon is styled (#71717A)" ($loginFile -match '\.login-toggle-pw\s*\{[^}]*#71717A')
Assert-Test "Remember FIDO2 checkbox label is readable (#3F3F46)" ($loginFile -match '\.login-checkbox-label\s*\{[^}]*#3F3F46')
Assert-Test "Remember FIDO2 checkbox has light bg and border" ($loginFile -match '\.login-checkbox\s*\{[^}]*#FFFFFF')
Assert-Test "Device Verified badge retains semantic green (#065F46)" ($loginFile -match '\.login-verified-badge\s*\{[^}]*#065F46')
Assert-Test "Quick-Fill buttons have light surface (#F7F6F2)" ($loginFile -match '\.login-profile-btn\s*\{[^}]*#F7F6F2')
Assert-Test "Quick-Fill names are dark (#121212)" ($loginFile -match '\.login-profile-name\s*\{[^}]*#121212')
Assert-Test "Quick-Fill roles retain gold accent (#826320)" ($loginFile -match '\.login-profile-role\s*\{[^}]*#826320')
Assert-Test "Theme toggle in light mode has light surface" ($loginFile -match '\.login-theme-toggle\s*\{[^}]*rgba\(255,\s*255,\s*255')
Assert-Test "Left branding heading has dark readable color (#121212)" ($loginFile -match '\.login-left-heading\s*\{[^}]*#121212')
Assert-Test "Left feature pills have light surface and dark text" ($loginFile -match '\.login-feature-pill\s*\{[^}]*rgba\(255,\s*255,\s*255')

# 2. Inspect styles.css global overrides
$stylesFile = Get-Content "src/styles.css" -Raw
Assert-Test "Global CSS includes html.light .bg-[#0D0D0D]/95 override" ($stylesFile -match 'html\.light\s+\.bg-\\\[\\\#0D0D0D\\\]\\\/95')
Assert-Test "Global CSS includes html.light app-login .login-card override" ($stylesFile -match 'html\.light\s+app-login\s+\.login-card')
Assert-Test "Global CSS includes html.light app-login .login-input-container override" ($stylesFile -match 'html\.light\s+app-login\s+\.login-input-container')

# 3. Verify Dark Mode integrity
Assert-Test "Dark Mode card classes preserved in template (bg-[#0D0D0D]/95)" ($loginFile -match 'bg-\[\#0D0D0D\]/95')
Assert-Test "Dark Mode text-white preserved in template" ($loginFile -match 'text-white')
Assert-Test "Dark Mode border-white/10 preserved in template" ($loginFile -match 'border-white/10')
Assert-Test "Primary submit button has gold bg with deep dark text (#0A0A0A)" ($loginFile -match 'bg-\[\#C5A059\][^"]*text-\[\#0A0A0A\]')

# 4. HTTP and Login Flow verification
try {
    $ngLocal = (Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5).StatusCode
    Assert-Test "Angular server responding on localhost:3000 (200 OK)" ($ngLocal -eq 200)
} catch {
    Assert-Test "Angular server responding on localhost:3000" $false $_.Exception.Message
}

$profiles = @(
    @{ name = "Riya Desai"; email = "riya.desai@fraudguard.enterprise.io"; role = "INVESTIGATOR" },
    @{ name = "Priyanka Iyer"; email = "priyanka.iyer@fraudguard.enterprise.io"; role = "ADMIN" },
    @{ name = "Amit Bose"; email = "amit.bose@fraudguard.enterprise.io"; role = "COMPLIANCE" }
)

foreach ($p in $profiles) {
    try {
        $body = @{ email = $p.email; password = "password123" } | ConvertTo-Json
        $res = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10
        $userData = if ($res.data) { $res.data.user } else { $res.user }
        $token = if ($res.data) { $res.data.token } else { $res.token }
        $match = ($userData.fullName -eq $p.name -and $userData.role -eq $p.role -and $token.Length -gt 20)
        Assert-Test "Auth verification for $($p.name) ($($p.role))" $match
    } catch {
        Assert-Test "Auth verification for $($p.name)" $false $_.Exception.Message
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " RESULTS: $passed PASSED / $failed FAILED                   " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
