# Quick Update Script - Replaces bot files with latest from GitHub
# Usage: .\scripts\quick-update.ps1

Write-Host "🔄 PSHomebrew Bot - Quick Update Script" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Host "❌ ERROR: Not in a git repository" -ForegroundColor Red
    exit 1
}

# Backup config files (don't want to lose credentials)
Write-Host "💾 Backing up config files..." -ForegroundColor Yellow
$backupFiles = @("config.json", ".secure-config", ".env")
$backupDir = "backup-$(Get-Date -Format 'yyyy-MM-dd-HHmmss')"

foreach ($file in $backupFiles) {
    if (Test-Path $file) {
        if (-not (Test-Path $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir | Out-Null
        }
        Copy-Item $file "$backupDir\" -Force
        Write-Host "  ✅ Backed up: $file" -ForegroundColor Green
    }
}

# Save current data files
Write-Host ""
Write-Host "💾 Backing up data files..." -ForegroundColor Yellow
$dataBackupDir = "$backupDir\data"
if (Test-Path "data") {
    New-Item -ItemType Directory -Path $dataBackupDir -Force | Out-Null
    Copy-Item "data\*" $dataBackupDir -Force
    Write-Host "  ✅ Backed up: data folder" -ForegroundColor Green
}

# Fetch latest changes
Write-Host ""
Write-Host "📥 Fetching latest changes from GitHub..." -ForegroundColor Cyan
git fetch origin

# Check if there are updates
$behind = git rev-list HEAD..origin/main --count
if ($behind -eq "0") {
    Write-Host "✅ Already up to date!" -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host "📦 $behind new commit(s) available" -ForegroundColor Yellow
Write-Host ""

# Show what will be updated
Write-Host "📋 Changes to be applied:" -ForegroundColor Cyan
git log HEAD..origin/main --oneline --decorate --color=always
Write-Host ""

# Ask for confirmation
$confirm = Read-Host "Continue with update? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ Update cancelled" -ForegroundColor Yellow
    exit 0
}

# Stash any local changes
Write-Host ""
Write-Host "💼 Stashing local changes..." -ForegroundColor Yellow
git stash push -m "Auto-stash before update $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Pull latest changes
Write-Host ""
Write-Host "⬇️  Pulling latest changes..." -ForegroundColor Cyan
git pull origin main

# Restore config files
Write-Host ""
Write-Host "🔧 Restoring config files..." -ForegroundColor Yellow
foreach ($file in $backupFiles) {
    if (Test-Path "$backupDir\$file") {
        Copy-Item "$backupDir\$file" . -Force
        Write-Host "  ✅ Restored: $file" -ForegroundColor Green
    }
}

# Restore data files
if (Test-Path $dataBackupDir) {
    Copy-Item "$dataBackupDir\*" "data\" -Force
    Write-Host "  ✅ Restored: data folder" -ForegroundColor Green
}

# Install/update dependencies
Write-Host ""
Write-Host "📦 Checking dependencies..." -ForegroundColor Cyan
$packageChanged = git diff HEAD@{1} HEAD --name-only | Select-String "package.json"
if ($packageChanged) {
    Write-Host "  📥 Installing new dependencies..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "  ✅ No dependency changes" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Update completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Backup location: $backupDir" -ForegroundColor Cyan
Write-Host "🔄 Restart the bot to apply changes: npm start" -ForegroundColor Cyan
Write-Host ""
