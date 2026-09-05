# ============================================================
#  cleanup-gcp.ps1  -  Cleanup Cloud Run Revisions & Images
# ============================================================

$PROJECT_ID   = "jts-ordering-app"
$SERVICE_NAME = "jts-tiffin-app"
$REGION       = "asia-south1"

function Log-Step($msg)  { Write-Host "`n- $msg" -ForegroundColor Cyan }
function Log-OK($msg)    { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Log-Error($msg) { Write-Host "`n[ERROR] $msg" -ForegroundColor Red; exit 1 }

Log-Step "Checking Authentication and Project..."
gcloud config set project $PROJECT_ID --quiet 2>&1 | Out-Null
Log-OK "Set project to $PROJECT_ID"

# 1. Cleanup Cloud Run Revisions
Log-Step "Cleaning up old Cloud Run revisions for $SERVICE_NAME..."

# Get all revisions sorted by creation time (descending)
$revisionsJson = gcloud run revisions list --service $SERVICE_NAME --region $REGION --format="json" | ConvertFrom-Json

if ($revisionsJson.Count -le 2) {
    Log-OK "Only $($revisionsJson.Count) revision(s) found. Nothing to delete."
} else {
    # Find active revisions (ones with traffic allocation)
    $activeRevisions = @()
    $serviceJson = gcloud run services describe $SERVICE_NAME --region $REGION --format="json" | ConvertFrom-Json
    foreach ($traffic in $serviceJson.status.traffic) {
        $activeRevisions += $traffic.revisionName
    }
    
    Log-OK "Active Revision(s): $($activeRevisions -join ', ')"
    
    # Keep the most recent 2 revisions (plus any active ones)
    $revisionsToDelete = $revisionsJson | Select-Object -Skip 2
    
    $deletedCount = 0
    foreach ($rev in $revisionsToDelete) {
        $revName = $rev.metadata.name
        if ($activeRevisions -notcontains $revName) {
            Write-Host "   Deleting revision: $revName..." -ForegroundColor Gray
            gcloud run revisions delete $revName --region $REGION --quiet 2>&1 | Out-Null
            $deletedCount++
        }
    }
    Log-OK "Deleted $deletedCount old revision(s)."
}

# 2. Cleanup Artifact Registry Images
Log-Step "Cleaning up old Docker images in Artifact Registry..."
$REPO_NAME = "cloud-run-source-deploy"
$IMAGE_PATH = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME"

# Get all image digests
$imagesJson = gcloud artifacts docker images list $IMAGE_PATH --sort-by="~UPDATE_TIME" --format="json" 2>$null
if ($LASTEXITCODE -ne 0) {
    Log-Error "Failed to list images or repository does not exist."
}

$images = $imagesJson | ConvertFrom-Json
if ($images.Count -le 2) {
    Log-OK "Only $($images.Count) image(s) found. Nothing to delete."
} else {
    # Keep the most recent 2 images (which corresponds to active and previous deployment)
    $imagesToDelete = $images | Select-Object -Skip 2
    
    $deletedImages = 0
    foreach ($img in $imagesToDelete) {
        $imgDigest = $img.version
        $fullPath = "$IMAGE_PATH@$imgDigest"
        Write-Host "   Deleting image: $imgDigest..." -ForegroundColor Gray
        gcloud artifacts docker images delete $fullPath --delete-tags --quiet 2>&1 | Out-Null
        $deletedImages++
    }
    Log-OK "Deleted $deletedImages old container image(s)."
}

Write-Host "`n Cleanup Complete! Storage costs have been optimized." -ForegroundColor Green
