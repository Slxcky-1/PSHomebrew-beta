# Quick script to copy game database to Linux server
# Update these variables with your Linux server details
$linuxUser = "elontusk"
$linuxHost = "YOUR_LINUX_IP_OR_HOSTNAME"  # e.g., "192.168.1.100" or "myserver.com"
$linuxPath = "/home/elontusk/Desktop/PSHomebrew-beta-main/data/"

$localDatabase = "C:\Users\ElonTusk\Desktop\Discord\data\gameDatabase.json"

Write-Host "📦 Copying game database to Linux server..." -ForegroundColor Cyan

# Use SCP to copy the file
scp $localDatabase "${linuxUser}@${linuxHost}:${linuxPath}"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database copied successfully!" -ForegroundColor Green
    Write-Host "Now restart the bot on Linux:" -ForegroundColor Yellow
    Write-Host "  pkill -f 'node bot.js'" -ForegroundColor Gray
    Write-Host "  cd /home/elontusk/Desktop/PSHomebrew-beta-main" -ForegroundColor Gray
    Write-Host "  nohup node bot.js > bot.log 2>&1 &" -ForegroundColor Gray
} else {
    Write-Host "❌ Failed to copy database. Check your SSH connection." -ForegroundColor Red
}
