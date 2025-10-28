#!/bin/bash
# Automated Discord Bot Installer for Arch Linux
# Run this script to automatically install and run the bot

set -e  # Exit on error

echo "🚀 Starting Discord Bot automated installation..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Please don't run as root. Run as regular user."
   exit 1
fi

# Install Node.js and Git if not already installed
echo "📦 Installing dependencies..."
sudo pacman -S --needed --noconfirm nodejs npm git

# Assume the script is being run from the cloned repo
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📂 Bot directory: $BOT_DIR"

# Install Node.js dependencies
echo "📥 Installing Node.js packages..."
cd "$BOT_DIR"
npm install

# Deploy Discord slash commands
echo "⚡ Deploying slash commands..."
node deploy-commands.js

# Setup systemd service
echo "🔧 Setting up systemd service..."
sudo cp "$BOT_DIR/linux-installation/discord-bot.service" /etc/systemd/system/

# Update paths in service file
sudo sed -i "s|/path/to/discord-bot|$BOT_DIR|g" /etc/systemd/system/discord-bot.service
sudo sed -i "s|your-username|$USER|g" /etc/systemd/system/discord-bot.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
echo "🚀 Starting bot service..."
sudo systemctl enable discord-bot
sudo systemctl start discord-bot

# Wait a moment for service to start
sleep 2

# Show status
echo ""
echo "✅ Installation complete!"
echo ""
echo "📊 Bot Status:"
sudo systemctl status discord-bot --no-pager

echo ""
echo "📝 Useful commands:"
echo "  View logs:    sudo journalctl -u discord-bot -f"
echo "  Stop bot:     sudo systemctl stop discord-bot"
echo "  Restart bot:  sudo systemctl restart discord-bot"
echo "  Bot status:   sudo systemctl status discord-bot"
