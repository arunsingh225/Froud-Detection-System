$destDir = "data\raw\ieee_cis"
$kaggleExe = "C:\Users\SONY\AppData\Roaming\Python\Python313\Scripts\kaggle.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Downloading IEEE-CIS Fraud Detection Dataset via Kaggle API" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

# Run Kaggle Download
& $kaggleExe competitions download -c ieee-fraud-detection -p $destDir

$zipFile = Join-Path $destDir "ieee-fraud-detection.zip"
if (Test-Path $zipFile) {
    Write-Host "Download complete. Extracting $zipFile..." -ForegroundColor Green
    Expand-Archive -Path $zipFile -DestinationPath $destDir -Force
    Write-Host "Extraction complete." -ForegroundColor Green
} else {
    Write-Host "Checking for any other downloaded ZIP files in $destDir..." -ForegroundColor Yellow
    Get-ChildItem -Path $destDir -Filter "*.zip" | ForEach-Object {
        Write-Host "Extracting $($_.FullName)..."
        Expand-Archive -Path $_.FullName -DestinationPath $destDir -Force
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Verifying Dataset Files in $destDir" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$expectedFiles = @(
    "train_transaction.csv",
    "train_identity.csv",
    "test_transaction.csv",
    "test_identity.csv",
    "sample_submission.csv"
)

$allFound = $true
foreach ($file in $expectedFiles) {
    $filePath = Join-Path $destDir $file
    if (Test-Path $filePath) {
        $item = Get-Item $filePath
        $sizeMB = [math]::Round($item.Length / 1MB, 2)
        Write-Host "✅ [FOUND] $file ($($item.Length.ToString("N0")) bytes / $sizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "❌ [MISSING] $file" -ForegroundColor Red
        $allFound = $false
    }
}

if ($allFound) {
    Write-Host "All 5 raw dataset files verified successfully!" -ForegroundColor Green
} else {
    Write-Host "Some files are missing. Please check download status." -ForegroundColor Red
}
