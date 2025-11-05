# Auto Git Upload Script for PSHomebrew Discord Bot
# Automatically commits and pushes changes to GitHub

param(
    [string]$CommitMessage = "",
    [switch]$Force = $false,
    [switch]$DryRun = $false
)

# Colors for output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Blue = "Cyan"

Write-Host "🚀 PSHomebrew Auto Git Upload Script" -ForegroundColor $Blue
Write-Host "=====================================" -ForegroundColor $Blue

# Change to bot directory
$BotDir = Split-Path -Parent $PSScriptRoot
Set-Location $BotDir

Write-Host "📁 Working directory: $BotDir" -ForegroundColor $Blue

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not a git repository!" -ForegroundColor $Red
    Write-Host "💡 Tip: Run 'git init' first" -ForegroundColor $Yellow
    exit 1
}

# Check git status
Write-Host "🔍 Checking git status..." -ForegroundColor $Blue
$GitStatus = git status --porcelain

if (-not $GitStatus) {
    Write-Host "✅ No changes to commit - repository is clean" -ForegroundColor $Green
    exit 0
}

# Show changes
Write-Host "📝 Changes detected:" -ForegroundColor $Yellow
git status --short

# If dry run, just show what would happen
if ($DryRun) {
    Write-Host "🧪 DRY RUN MODE - No changes will be made" -ForegroundColor $Yellow
    Write-Host "Would add and commit the following files:" -ForegroundColor $Yellow
    git status --short
    exit 0
}

# Generate automatic commit message if not provided
if (-not $CommitMessage) {
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    # Analyze changes to create smart commit message
    $ModifiedFiles = git diff --name-only
    $NewFiles = git ls-files --others --exclude-standard
    $DeletedFiles = git diff --name-only --diff-filter=D
    
    $Changes = @()
    
    if ($ModifiedFiles) {
        $ModCount = ($ModifiedFiles | Measure-Object).Count
        $Changes += "📝 $ModCount modified"
    }
    
    if ($NewFiles) {
        $NewCount = ($NewFiles | Measure-Object).Count
        $Changes += "➕ $NewCount new"
    }
    
    if ($DeletedFiles) {
        $DelCount = ($DeletedFiles | Measure-Object).Count
        $Changes += "🗑️ $DelCount deleted"
    }
    
    # Check for specific file types
    $BotChanges = @()
    if ($ModifiedFiles -contains "bot.js") { $BotChanges += "🤖 bot core" }
    if ($ModifiedFiles | Where-Object { $_ -like "commands/*" }) { $BotChanges += "⚡ commands" }
    if ($ModifiedFiles | Where-Object { $_ -like "features/*" }) { $BotChanges += "🔧 features" }
    if ($ModifiedFiles | Where-Object { $_ -like "data/*" }) { $BotChanges += "💾 data" }
    if ($ModifiedFiles | Where-Object { $_ -like "linux-installation/*" }) { $BotChanges += "🐧 linux" }
    if ($ModifiedFiles | Where-Object { $_ -like "scripts/*" }) { $BotChanges += "📜 scripts" }
    
    $CommitMessage = "🔄 Auto-update: $($Changes -join ', ')"
    if ($BotChanges) {
        $CommitMessage += " ($($BotChanges -join ', '))"
    }
    $CommitMessage += " - $Timestamp"
}

Write-Host "💬 Commit message: $CommitMessage" -ForegroundColor $Blue

# Confirm changes unless forced
if (-not $Force) {
    $Confirm = Read-Host "❓ Proceed with commit and push? (y/N)"
    if ($Confirm -ne "y" -and $Confirm -ne "Y") {
        Write-Host "❌ Cancelled by user" -ForegroundColor $Yellow
        exit 0
    }
}

# Add all changes
Write-Host "📦 Adding changes to git..." -ForegroundColor $Blue
git add .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error adding files to git!" -ForegroundColor $Red
    exit 1
}

# Commit changes
Write-Host "💾 Committing changes..." -ForegroundColor $Blue
git commit -m $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error committing changes!" -ForegroundColor $Red
    exit 1
}

# Push to GitHub
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor $Blue
git push

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error pushing to GitHub!" -ForegroundColor $Red
    Write-Host "💡 Possible solutions:" -ForegroundColor $Yellow
    Write-Host "   • Check internet connection" -ForegroundColor $Yellow
    Write-Host "   • Verify GitHub credentials" -ForegroundColor $Yellow
    Write-Host "   • Try: git push origin main" -ForegroundColor $Yellow
    exit 1
}

# Success!
Write-Host "✅ Successfully uploaded to GitHub!" -ForegroundColor $Green
Write-Host "🔗 Repository: https://github.com/Slxcky-1/PSHomebrew-beta" -ForegroundColor $Blue

# Show final status
Write-Host "📊 Final status:" -ForegroundColor $Blue
git log --oneline -1
git status

Write-Host "🎉 Auto-upload complete!" -ForegroundColor $Green