# Global Application Scrolling & Layout Inspection Script
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FRAUDGUARD AI - GLOBAL APPLICATION SCROLLING VERIFICATION " -ForegroundColor Cyan
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

# 1. Inspect Shell Layout in app.component.ts
$appComp = Get-Content "src/app/app.component.ts" -Raw
Assert-Test "App shell has flex container with h-screen" ($appComp -match 'h-screen flex overflow-hidden')
Assert-Test "Sidebar has shrink-0 class" ($appComp -match 'app-sidebar class="shrink-0"')
Assert-Test "Main container has flex-1 min-w-0 min-h-0 flex flex-col" ($appComp -match 'flex-1 min-w-0 min-h-0 flex flex-col')
Assert-Test "TopHeader has shrink-0 class" ($appComp -match 'app-top-header\s+class="shrink-0"')
Assert-Test "Main routed outlet container has flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden (ONLY SCROLL CONTAINER)" ($appComp -match 'main class="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden relative"')

# 2. Inspect Global CSS in styles.css
$stylesCss = Get-Content "src/styles.css" -Raw
Assert-Test "Global CSS sets html, body { height: 100% }" ($stylesCss -match 'html,\s*body\s*\{\s*height:\s*100%')
Assert-Test "Global CSS sets app-root { height: 100% }" ($stylesCss -match 'app-root\s*\{\s*display:\s*block;\s*width:\s*100%;\s*height:\s*100%')
Assert-Test "Global CSS sets routed components to block width 100% min-height 100%" ($stylesCss -match 'display:\s*block;\s*width:\s*100%;\s*min-height:\s*100%;')

# 3. Inspect All Page Roots for Preferred Architecture: w-full min-h-full pb-12, no internal overflow-y-auto
$pageFiles = @{
    "Dashboard"             = "src/app/pages/dashboard/dashboard.component.ts"
    "Transactions List"     = "src/app/pages/transactions/transactions-list.component.ts"
    "Transaction Detail"    = "src/app/pages/transactions/transaction-detail.component.ts"
    "Fraud Alerts"          = "src/app/pages/fraud-alerts/fraud-alerts.component.ts"
    "Investigations List"   = "src/app/pages/investigations/investigations-list.component.ts"
    "Investigation Detail"  = "src/app/pages/investigations/investigation-detail.component.ts"
    "Customers List"        = "src/app/pages/customers/customers-list.component.ts"
    "Customer Detail"       = "src/app/pages/customers/customer-detail.component.ts"
    "Investigation Reports" = "src/app/pages/investigation-reports/investigation-reports.component.ts"
    "Risk Analytics"        = "src/app/pages/risk-analytics/risk-analytics.component.ts"
    "Audit Logs"            = "src/app/pages/audit-logs/audit-logs.component.ts"
    "Settings"              = "src/app/pages/settings/settings.component.ts"
    "AI Investigator"       = "src/app/pages/ai-investigator/ai-investigator.component.ts"
}

foreach ($entry in $pageFiles.GetEnumerator()) {
    $name = $entry.Key
    $path = $entry.Value
    $content = Get-Content $path -Raw

    $hasHostStyles = ($content -match ':host\s*\{[^}]*min-height:\s*100%')
    $hasScrollRoot = ($content -match 'w-full min-h-full')
    $hasPb12 = ($content -match 'pb-12')
    $noHScreen = -not ($content -match 'class="[^"]*\bh-screen\b')
    $noNestedScroll = -not ($content -match 'overflow-y-auto')

    Assert-Test "$name : Host styles set min-height 100%" $hasHostStyles
    Assert-Test "$name : Root container has w-full min-h-full" $hasScrollRoot
    Assert-Test "$name : Root container has pb-12" $hasPb12
    Assert-Test "$name : No h-screen inside page" $noHScreen
    Assert-Test "$name : No nested overflow-y-auto" $noNestedScroll
}

# 4. Live Server HTTP Check
try {
    $res = Invoke-WebRequest -Uri "http://localhost:3000" -Method Head -UseBasicParsing -TimeoutSec 5
    Assert-Test "Frontend server responding on port 3000 (200 OK)" ($res.StatusCode -eq 200)
} catch {
    Assert-Test "Frontend server responding on port 3000" $false $_.Exception.Message
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " RESULTS: $passed PASSED / $failed FAILED                   " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
