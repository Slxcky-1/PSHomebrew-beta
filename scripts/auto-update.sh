#!/bin/bash
# Automatic Update Script - Updates bot without user confirmation
# Usage: bash scripts/auto-update.sh
# Cron example: 0 4 * * * cd /path/to/bot && bash scripts/auto-update.sh

echo -e "\033[36m🔄 PSHomebrew Bot - Automatic Update\033[0m"
echo -e "\033[36m====================================\033[0m"
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "\033[31m❌ ERROR: Git is not installed\033[0m"
    exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "\033[31m❌ ERROR: Not in a git repository\033[0m"
    exit 1
fi

# Backup config files
echo -e "\033[33m💾 Backing up config files...\033[0m"
backup_dir="backup-$(date +%Y-%m-%d-%H%M%S)"

for file in config.json .secure-config .env; do
    if [ -f "$file" ]; then
        mkdir -p "$backup_dir"
        cp "$file" "$backup_dir/"
        echo -e "  \033[32m✅ Backed up: $file\033[0m"
    fi
done

# Backup data files
echo ""
echo -e "\033[33m💾 Backing up data files...\033[0m"
if [ -d "data" ]; then
    mkdir -p "$backup_dir/data"
    cp -r data/* "$backup_dir/data/" 2>/dev/null
    echo -e "  \033[32m✅ Backed up: data folder\033[0m"
fi

# Fetch latest changes
echo ""
echo -e "\033[36m📥 Fetching latest changes from GitHub...\033[0m"
git fetch origin 2>&1

# Check if there are updates
behind=$(git rev-list HEAD..origin/main --count 2>/dev/null)
if [ "$behind" -eq "0" ]; then
    echo -e "\033[32m✅ Already up to date!\033[0m"
    echo ""
    # Clean up backup if no updates
    rm -rf "$backup_dir"
    exit 0
fi

echo -e "\033[33m📦 $behind new commit(s) available - updating automatically...\033[0m"
echo ""

# Show what will be updated
echo -e "\033[36m📋 Changes to be applied:\033[0m"
git log HEAD..origin/main --oneline --decorate --color=always
echo ""

# Stash any local changes
echo -e "\033[33m💼 Stashing local changes...\033[0m"
git stash push -m "Auto-stash before update $(date '+%Y-%m-%d %H:%M:%S')" 2>&1

# Pull latest changes
echo ""
echo -e "\033[36m⬇️  Pulling latest changes...\033[0m"
git pull origin main 2>&1

if [ $? -ne 0 ]; then
    echo -e "\033[31m❌ ERROR: Failed to pull updates\033[0m"
    echo -e "\033[33m🔧 Restoring from backup...\033[0m"
    
    # Restore from backup on failure
    for file in config.json .secure-config .env; do
        if [ -f "$backup_dir/$file" ]; then
            cp "$backup_dir/$file" .
        fi
    done
    if [ -d "$backup_dir/data" ]; then
        cp -r "$backup_dir/data/"* data/ 2>/dev/null
    fi
    
    exit 1
fi

# Restore config files
echo ""
echo -e "\033[33m🔧 Restoring config files...\033[0m"
for file in config.json .secure-config .env; do
    if [ -f "$backup_dir/$file" ]; then
        cp "$backup_dir/$file" .
        echo -e "  \033[32m✅ Restored: $file\033[0m"
    fi
done

# Restore data files
if [ -d "$backup_dir/data" ]; then
    cp -r "$backup_dir/data/"* data/ 2>/dev/null
    echo -e "  \033[32m✅ Restored: data folder\033[0m"
fi

# Install/update dependencies
echo ""
echo -e "\033[36m📦 Checking dependencies...\033[0m"
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    echo -e "  \033[33m📥 Installing new dependencies...\033[0m"
    npm install 2>&1
else
    echo -e "  \033[32m✅ No dependency changes\033[0m"
fi

# Restart bot if running as systemd service
echo ""
if systemctl is-active --quiet discord-bot 2>/dev/null; then
    echo -e "\033[33m🔄 Restarting bot service...\033[0m"
    sudo systemctl restart discord-bot
    sleep 2
    if systemctl is-active --quiet discord-bot; then
        echo -e "\033[32m✅ Bot restarted successfully\033[0m"
    else
        echo -e "\033[31m⚠️  Bot failed to restart - check logs: sudo journalctl -u discord-bot -n 50\033[0m"
    fi
else
    echo -e "\033[33m⚠️  Bot service not found - manual restart required\033[0m"
    echo -e "\033[36m   Restart command: npm start\033[0m"
fi

echo ""
echo -e "\033[32m✅ Automatic update completed!\033[0m"
echo ""
echo -e "\033[36m📁 Backup location: $backup_dir\033[0m"
echo -e "\033[36m📅 Updated: $(date '+%Y-%m-%d %H:%M:%S')\033[0m"
echo ""

# Log update to file
echo "$(date '+%Y-%m-%d %H:%M:%S') - Updated to commit: $(git rev-parse --short HEAD)" >> update.log
