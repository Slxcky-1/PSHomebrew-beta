#!/bin/bash
# Quick Update Script - Replaces bot files with latest from GitHub
# Usage: bash scripts/quick-update.sh

echo -e "\033[36m🔄 PSHomebrew Bot - Quick Update Script\033[0m"
echo -e "\033[36m=======================================\033[0m"
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
    cp -r data/* "$backup_dir/data/"
    echo -e "  \033[32m✅ Backed up: data folder\033[0m"
fi

# Fetch latest changes
echo ""
echo -e "\033[36m📥 Fetching latest changes from GitHub...\033[0m"
git fetch origin

# Check if there are updates
behind=$(git rev-list HEAD..origin/main --count)
if [ "$behind" -eq "0" ]; then
    echo -e "\033[32m✅ Already up to date!\033[0m"
    echo ""
    exit 0
fi

echo -e "\033[33m📦 $behind new commit(s) available\033[0m"
echo ""

# Show what will be updated
echo -e "\033[36m📋 Changes to be applied:\033[0m"
git log HEAD..origin/main --oneline --decorate --color=always
echo ""

# Ask for confirmation
read -p "Continue with update? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo -e "\033[33m❌ Update cancelled\033[0m"
    exit 0
fi

# Stash any local changes
echo ""
echo -e "\033[33m💼 Stashing local changes...\033[0m"
git stash push -m "Auto-stash before update $(date '+%Y-%m-%d %H:%M:%S')"

# Reset to match GitHub exactly (removes deleted files)
echo ""
echo -e "\033[36m🧹 Cleaning workspace to match GitHub...\033[0m"
git reset --hard origin/main

# Clean untracked files
echo -e "\033[36m🗑️  Removing untracked files...\033[0m"
git clean -fd

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
    cp -r "$backup_dir/data/"* data/
    echo -e "  \033[32m✅ Restored: data folder\033[0m"
fi

# Install/update dependencies
echo ""
echo -e "\033[36m📦 Checking dependencies...\033[0m"
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    echo -e "  \033[33m📥 Installing new dependencies...\033[0m"
    npm install
else
    echo -e "  \033[32m✅ No dependency changes\033[0m"
fi

echo ""
echo -e "\033[32m✅ Update completed successfully!\033[0m"
echo ""
echo -e "\033[36m📁 Backup location: $backup_dir\033[0m"
echo -e "\033[36m🔄 Restart the bot to apply changes: npm start\033[0m"
echo ""
