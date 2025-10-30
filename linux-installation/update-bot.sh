#!/bin/bash

# Auto-update script for PSHomebrew Discord Bot
# This script pulls the latest changes and restarts the bot service

echo "🔄 Updating PSHomebrew Discord Bot..."

# Navigate to bot directory
cd /home/elontusk/Desktop/PSHomebrew-beta-main || exit 1

# Fetch latest changes
echo "📥 Fetching latest changes from GitHub..."
git fetch origin

# Force reset to match remote (handles conflicts automatically)
echo "🔄 Resetting to latest version..."
git reset --hard origin/main

if [ $? -eq 0 ]; then
    echo "✅ Successfully updated to latest version"
    
    # Reinstall dependencies silently
    echo "📦 Installing dependencies..."
    npm install --silent --no-audit --no-fund --production
    
    # Restart the bot service
    echo "🔄 Restarting bot service..."
    sudo systemctl restart discord-bot
    
    if [ $? -eq 0 ]; then
        echo "✅ Bot restarted successfully!"
        sudo systemctl status discord-bot --no-pager
    else
        echo "❌ Failed to restart bot service"
        exit 1
    fi
else
    echo "❌ Failed to pull updates"
    exit 1
fi
