# ============================================================
#  deploy.ps1  –  JTS Tiffin App  →  Google Cloud Run
#  Usage: .\deploy.ps1
# ============================================================

$PROJECT_ID   = "jts-ordering-app"
$SERVICE_NAME = "jts-tiffin-app"
$REGION       = "asia-south1"   # Mumbai – lowest latency for India

# ── 0. Helper ────────────────────────────────────────────────
function Log-Step($msg)  { Write-Host "`n🔹 $msg" -ForegroundColor Cyan }
function Log-OK($msg)    { Write-Host "   ✅ $msg" -ForegroundColor Green }
function Log-Warn($msg)  { Write-Host "   ⚠️  $msg" -ForegroundColor Yellow }
function Log-Error($msg) { Write-Host "`n❌ $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║      JTS Tiffin App  –  Cloud Run Deploy         ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Magenta

# ── 1. Check gcloud is installed ────────────────────────────
Log-Step "Checking gcloud installation..."
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Log-Error "gcloud CLI not found. Download from https://cloud.google.com/sdk and run 'gcloud auth login' first."
}
Log-OK "gcloud found"

# ── 2. Check authentication ──────────────────────────────────
Log-Step "Checking gcloud authentication..."
$authCheck = gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>&1
if (-not $authCheck) {
    Log-Error "Not authenticated. Run: gcloud auth login"
}
Log-OK "Authenticated as: $authCheck"

# ── 3. Set project ───────────────────────────────────────────
Log-Step "Setting project to '$PROJECT_ID'..."
gcloud config set project $PROJECT_ID --quiet 2>&1 | Out-Null
Log-OK "Project set to $PROJECT_ID"

# ── 4. Read .env file ────────────────────────────────────────
Log-Step "Reading .env file..."
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Log-Error ".env file not found. Copy .env.example to .env and fill in your values."
}

$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
        $key   = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"')
        if ($value -ne "" -and -not $value.StartsWith("your-") -and -not $value.StartsWith("your_") -and -not $value.StartsWith("PASTE_")) {
            $envVars[$key] = $value
        }
    }
}

# ── 5. Validate required secrets ────────────────────────────
Log-Step "Validating required environment variables..."

$required = @("GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "SPREADSHEET_ID", "ADMIN_PASSWORD")
foreach ($key in $required) {
    if (-not $envVars.ContainsKey($key) -or $envVars[$key] -eq "") {
        Log-Error "$key is missing or empty in .env – fill it in before deploying."
    }
}

if ($envVars["ADMIN_PASSWORD"] -eq "changeme") {
    Log-Error "ADMIN_PASSWORD is still 'changeme'. Set a strong password in .env first."
}

if ($envVars["SPREADSHEET_ID"] -eq "") {
    Log-Error "SPREADSHEET_ID is empty. Run 'node scripts/init-google-sheet.js' first."
}

Log-OK "All required variables present"

# ── 6. Build env.yaml file for Cloud Run ─────────────────────
Log-Step "Preparing environment variables for Cloud Run..."

$envVars["NODE_ENV"]       = "production"
$envVars["USE_MOCK_DATA"]  = "false"
$envVars["PORT"]           = "8080"

$envYamlPath = Join-Path $PSScriptRoot "env.yaml"
$yamlContent = @()
foreach ($pair in $envVars.GetEnumerator()) {
    $key = $pair.Key
    $val = $pair.Value
    
    # Simple YAML escaping for the private key and other strings
    if ($val -match "`n" -or $val -match "\\n") {
        # The private key string already has \n literals, we wrap in quotes
        $yamlContent += "$key: `"$val`""
    } else {
        $yamlContent += "$key: `"$val`""
    }
}
$yamlContent | Set-Content $envYamlPath -Encoding UTF8

Log-OK "Generated env.yaml ($($envVars.Count) vars)"

# ── 7. Enable required APIs (idempotent) ────────────────────
Log-Step "Enabling required Google Cloud APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet 2>&1 | Out-Null
Log-OK "Cloud Run and Cloud Build APIs enabled"

# ── 8. Deploy ────────────────────────────────────────────────
Log-Step "Deploying to Cloud Run (this takes 3-5 minutes)..."
Write-Host "   Region:  $REGION" -ForegroundColor Gray
Write-Host "   Service: $SERVICE_NAME" -ForegroundColor Gray
Write-Host ""

$deployOutput = gcloud run deploy $SERVICE_NAME `
    --source . `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory 512Mi `
    --min-instances 0 `
    --max-instances 3 `
    --env-vars-file $envYamlPath `
    --quiet 2>&1

# Print deploy output
$deployOutput | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Log-Error "Deployment failed. Check the output above."
}

# Clean up env.yaml so secrets aren't left around
Remove-Item $envYamlPath -ErrorAction SilentlyContinue

# ── 9. Get the deployed URL ──────────────────────────────────
Log-Step "Fetching deployed service URL..."
$SERVICE_URL = gcloud run services describe $SERVICE_NAME `
    --region $REGION `
    --format "value(status.url)" 2>&1

if (-not $SERVICE_URL -or $SERVICE_URL -eq "") {
    Log-Warn "Could not retrieve URL automatically. Check the Cloud Run console."
} else {
    Log-OK "Service URL: $SERVICE_URL"

    # ── 10. Update PRODUCTION_DOMAIN and redeploy env var ───
    Log-Step "Updating PRODUCTION_DOMAIN env var on Cloud Run..."
    gcloud run services update $SERVICE_NAME `
        --region $REGION `
        --update-env-vars "PRODUCTION_DOMAIN=$SERVICE_URL" `
        --quiet 2>&1 | Out-Null
    Log-OK "PRODUCTION_DOMAIN set to $SERVICE_URL (CORS updated)"
}

# ── Done ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║            ✅  Deployment Complete!              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
if ($SERVICE_URL) {
    Write-Host "  🌐 App URL:    $SERVICE_URL" -ForegroundColor White
    Write-Host "  🔐 Admin:      $SERVICE_URL/admin" -ForegroundColor White
}
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open the App URL above and verify the menu loads" -ForegroundColor Gray
Write-Host "  2. Login to /admin with your ADMIN_PASSWORD and set tomorrow's menu" -ForegroundColor Gray
Write-Host "  3. Place a test order and verify data appears in your Google Sheet" -ForegroundColor Gray
Write-Host ""
