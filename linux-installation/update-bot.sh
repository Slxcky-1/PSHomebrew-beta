#!/bin/bash

# Auto-update script for PSHomebrew Discord Bot
# This script pulls the latest changes and restarts the bot service

echo "🔄 Updating PSHomebrew Discord Bot..."

# Navigate to bot directory
cd /home/elontusk/Desktop/PSHomebrew-beta-main || exit 1

# Clean up node_modules to prevent buildup
echo "🧹 Cleaning old dependencies..."
rm -rf node_modules

# Reset any local changes to code files (keeps data files)
echo "🔄 Resetting code files..."
git reset --hard HEAD

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pulled updates"
    
    # Reinstall dependencies
    echo "📦 Installing dependencies..."
    npm install --production
    
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
