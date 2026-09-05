$baseUrl = "http://localhost:5000"
$ErrorActionPreference = "Stop"

$globalToken = $null

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url,
        [object]$Body = $null,
        [bool]$UseAuth = $true
    )

    try {
        $headers = @{}
        if ($UseAuth -and $script:globalToken) {
            $headers["Authorization"] = "Bearer $script:globalToken"
        }

        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = "application/json"
            Headers = $headers
        }
        if ($Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
        }

        $res = Invoke-RestMethod @params
        Write-Host "[PASS] [$Method] $Name -> OK" -ForegroundColor Green
        return @{ Name = $Name; Method = $Method; Url = $Url; Status = "PASS"; Data = $res }
    }
    catch {
        Write-Host "[FAIL] [$Method] $Name -> FAILED: $($_.Exception.Message)" -ForegroundColor Red
        return @{ Name = $Name; Method = $Method; Url = $Url; Status = "FAIL"; Error = $_.Exception.Message }
    }
}

Write-Host "=========================================================="
Write-Host "FraudGuard AI - ASP.NET Core 8 Web API Automated Test Suite"
Write-Host "=========================================================="

# 1. Swagger (Public)
$r1 = Test-Endpoint -Name "Swagger OpenAPI Schema" -Url ($baseUrl + "/swagger/v1/swagger.json") -UseAuth $false

# 2. Auth Login (Admin user: Priyanka Iyer)
$loginPayload = @{
    email = "priyanka.iyer@fraudguard.enterprise.io"
    password = "password123"
}
$rAuth = Test-Endpoint -Name "Auth Login" -Method "POST" -Url ($baseUrl + "/api/auth/login") -Body $loginPayload -UseAuth $false
$script:globalToken = $rAuth.Data.data.token
$userId = $rAuth.Data.data.user.userId

# 3. Auth Me (Authenticated via claims)
$rMe = Test-Endpoint -Name "Auth Get Current User" -Url ($baseUrl + "/api/auth/me")

# 4. Customers List
$rCustList = Test-Endpoint -Name "Get Customers (Paged)" -Url ($baseUrl + "/api/customers?page=1" + [char]38 + "pageSize=5")
$firstCustId = $rCustList.Data.data.items[0].customerId

# 5. Customer Detail
$rCustDetail = Test-Endpoint -Name "Get Customer By ID" -Url ($baseUrl + "/api/customers/" + $firstCustId)

# 6. Customer Transactions
$rCustTxns = Test-Endpoint -Name "Get Customer Transactions" -Url ($baseUrl + "/api/customers/" + $firstCustId + "/transactions")

# 7. Customer Alerts
$rCustAlerts = Test-Endpoint -Name "Get Customer Alerts" -Url ($baseUrl + "/api/customers/" + $firstCustId + "/alerts")

# 8. Accounts List
$rAccts = Test-Endpoint -Name "Get Accounts" -Url ($baseUrl + "/api/accounts")
$firstAcctId = $rAccts.Data.data[0].accountId

# 9. Account Detail
$rAcctDetail = Test-Endpoint -Name "Get Account By ID" -Url ($baseUrl + "/api/accounts/" + $firstAcctId)

# 10. Account By Customer
$rAcctCust = Test-Endpoint -Name "Get Accounts By Customer" -Url ($baseUrl + "/api/accounts/customer/" + $firstCustId)

# 11. Transactions List (Paged)
$rTxns = Test-Endpoint -Name "Get Transactions (Paged)" -Url ($baseUrl + "/api/transactions?page=1" + [char]38 + "pageSize=5")
$firstTxnId = $rTxns.Data.data.items[0].transactionId

# 12. Transaction Detail
$rTxnDetail = Test-Endpoint -Name "Get Transaction By ID" -Url ($baseUrl + "/api/transactions/" + $firstTxnId)

# 13. Create Ingested Transaction
$createTxnPayload = @{
    accountId = $firstAcctId
    customerId = $firstCustId
    amountInr = 150000.00
    paymentMethod = "UPI"
    merchantCategory = "Electronics"
    ipAddress = "103.21.244.0"
    deviceType = "Mobile"
    city = "Mumbai"
    country = "India"
    vpnOrProxyDetected = $false
}
$rCreateTxn = Test-Endpoint -Name "Create Transaction" -Method "POST" -Url ($baseUrl + "/api/transactions") -Body $createTxnPayload
$newTxnId = $rCreateTxn.Data.data.transactionId

# 14. Update Transaction Status
$rUpdateTxn = Test-Endpoint -Name "Update Transaction Status" -Method "PATCH" -Url ($baseUrl + "/api/transactions/" + $newTxnId + "/status") -Body @{ status = "Investigating" }

# 15. Fraud Alerts List
$rAlerts = Test-Endpoint -Name "Get Fraud Alerts" -Url ($baseUrl + "/api/fraud-alerts?page=1" + [char]38 + "pageSize=5")
$firstAlertId = $rAlerts.Data.data.items[0].alertId

# 16. Fraud Alert Detail
$rAlertDetail = Test-Endpoint -Name "Get Fraud Alert By ID" -Url ($baseUrl + "/api/fraud-alerts/" + $firstAlertId)

# 17. Assign Fraud Alert
$rAssignAlert = Test-Endpoint -Name "Assign Fraud Alert" -Method "PATCH" -Url ($baseUrl + "/api/fraud-alerts/" + $firstAlertId + "/assign") -Body @{ userId = $userId }

# 18. Resolve Fraud Alert
$rResolveAlert = Test-Endpoint -Name "Resolve Fraud Alert" -Method "PATCH" -Url ($baseUrl + "/api/fraud-alerts/" + $firstAlertId + "/resolve") -Body @{ notes = "Verified legitimate transaction via customer callback." }

# 19. Investigations List
$rInvs = Test-Endpoint -Name "Get Investigations" -Url ($baseUrl + "/api/investigations?page=1" + [char]38 + "pageSize=5")
$firstInvId = $rInvs.Data.data.items[0].investigationId

# 20. Investigation Detail
$rInvDetail = Test-Endpoint -Name "Get Investigation By ID" -Url ($baseUrl + "/api/investigations/" + $firstInvId)

# 21. Create Investigation
$createInvPayload = @{
    transactionId = $firstTxnId
    assignedTo = $userId
    priority = "CRITICAL"
    summary = "High velocity anomaly investigation opened from test suite."
}
$rCreateInv = Test-Endpoint -Name "Create Investigation" -Method "POST" -Url ($baseUrl + "/api/investigations") -Body $createInvPayload
$newInvId = $rCreateInv.Data.data.investigationId

# 22. Submit Investigation Decision (Auto-Flag for Review)
$rDecision = Test-Endpoint -Name "Submit Decision (Auto-Flag for Review)" -Method "PATCH" -Url ($baseUrl + "/api/investigations/" + $newInvId + "/decision") -Body @{
    decision = "Auto-Flag for Review"
    notes = "Flagged for Tier-2 compliance supervisor sign-off."
}

# 23. Reports List
$rReports = Test-Endpoint -Name "Get Reports" -Url ($baseUrl + "/api/reports?page=1" + [char]38 + "pageSize=5")
$firstRptId = $rReports.Data.data.items[0].reportId

# 24. Report By ID
$rRptDetail = Test-Endpoint -Name "Get Report By ID" -Url ($baseUrl + "/api/reports/" + $firstRptId)

# 25. Create SAR Report
$createRptPayload = @{
    customerId = $firstCustId
    transactionId = $firstTxnId
    reportTitle = "Automated Test FinCEN SAR Report"
    category = "SAR Report"
    riskLevel = "CRITICAL"
    summary = "Suspicious velocity anomaly draft."
}
$rCreateRpt = Test-Endpoint -Name "Create SAR Report" -Method "POST" -Url ($baseUrl + "/api/reports?userId=" + $userId) -Body $createRptPayload

# 26. Audit Logs List
$rAuditList = Test-Endpoint -Name "Get Audit Logs" -Url ($baseUrl + "/api/audit-logs?page=1" + [char]38 + "pageSize=5")
$firstAuditId = $rAuditList.Data.data.items[0].auditLogId

# 27. Audit Log By ID
$rAuditDetail = Test-Endpoint -Name "Get Audit Log By ID" -Url ($baseUrl + "/api/audit-logs/" + $firstAuditId)

# 28. Analytics Dashboard KPIs
$rKpis = Test-Endpoint -Name "Analytics Dashboard KPIs" -Url ($baseUrl + "/api/analytics/dashboard")

# 29. Analytics Risk Trends
$rTrends = Test-Endpoint -Name "Analytics 30-Day Risk Trends" -Url ($baseUrl + "/api/analytics/risk-trends")

# 30. Analytics MCC Breakdown
$rMcc = Test-Endpoint -Name "Analytics MCC Risk Breakdown" -Url ($baseUrl + "/api/analytics/mcc-breakdown")

# 31. Analytics Telemetry
$rTelemetry = Test-Endpoint -Name "Analytics Model Telemetry" -Url ($baseUrl + "/api/analytics/telemetry")

# 32. AI Engine Health Integration
$rEngineHealth = Test-Endpoint -Name "AI Fraud Engine Health Check" -Url ($baseUrl + "/api/fraud/engine-health")

# 33. AI Model Provenance & Info
$rModelInfo = Test-Endpoint -Name "AI Model Specifications & Metrics" -Url ($baseUrl + "/api/fraud/model-info")

# 34. AI Fraud Prediction Scoring & DB Persistence
$predPayload = @{
    transactionId = $firstTxnId
}
$rPredict = Test-Endpoint -Name "AI Fraud Prediction & Alert Evaluation" -Method "POST" -Url ($baseUrl + "/api/fraud/predict") -Body $predPayload

# 35. Admin User Management (New in Phase 8)
$rUsers = Test-Endpoint -Name "Admin Get All Users" -Url ($baseUrl + "/api/users")

Write-Host "=========================================================="
Write-Host "All endpoints executed and validated with Bearer JWT Auth."
Write-Host "=========================================================="
