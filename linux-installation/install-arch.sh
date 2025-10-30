#!/bin/bash
# PSHomebrew Discord Bot - Arch Linux Installation Script
# Run with: bash install-arch.sh

set -e  # Exit on error

echo "🚀 PSHomebrew Discord Bot - Arch Linux Setup"
echo "=============================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "❌ Please do NOT run this script as root"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo pacman -Syu --noconfirm

# Install Node.js, npm, and git
echo ""
echo "📦 Installing Node.js, npm, and git..."
sudo pacman -S --needed --noconfirm nodejs npm git base-devel

# Verify installation
echo ""
echo "✅ Checking installations..."
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Git: $(git --version)"

# Navigate to script directory
cd "$(dirname "$0")/.." || exit 1

# Install bot dependencies
echo ""
echo "📦 Installing Discord bot dependencies..."
npm install --silent --no-audit --no-fund --production

# Check if config.json exists
if [ ! -f "config.json" ]; then
    echo ""
    echo "⚠️  config.json not found!"
    echo "📝 Creating config.json template..."
    cat > config.json << 'EOF'
{
  "token": "YOUR_BOT_TOKEN_HERE",
  "clientId": "YOUR_CLIENT_ID_HERE",
  "deepseekApiKey": "YOUR_DEEPSEEK_API_KEY_HERE",
  "botOwnerId": "YOUR_DISCORD_USER_ID_HERE"
}
EOF
    echo "✅ config.json created! Please edit it with your bot credentials."
    NEED_CONFIG=true
else
    echo "✅ config.json already exists"
    NEED_CONFIG=false
fi

# Deploy commands
if [ "$NEED_CONFIG" = false ] && ! grep -q "YOUR_BOT_TOKEN_HERE" config.json; then
    echo ""
    echo "📤 Deploying slash commands..."
    node deploy-commands.js
fi

echo ""
echo "=============================================="
echo "✅ Installation complete!"
echo ""

# Check if config is still default
if [ "$NEED_CONFIG" = true ] || grep -q "YOUR_BOT_TOKEN_HERE" config.json; then
    echo "⚠️  Please edit config.json with your bot credentials before starting!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Edit config.json with your bot token and IDs:"
    echo "   nano config.json"
    echo ""
    echo "2. Deploy slash commands:"
    echo "   node deploy-commands.js"
    echo ""
    echo "3. Start the bot:"
    echo "   npm start                  # Normal mode"
    echo "   npm run start:lowend       # Low-end PC mode"
    echo ""
    echo "4. Optional - Set up systemd service for auto-start:"
    echo "   sudo cp linux-installation/discord-bot.service /etc/systemd/system/"
    echo "   sudo nano /etc/systemd/system/discord-bot.service  # Edit paths"
    echo "   sudo systemctl enable discord-bot"
    echo "   sudo systemctl start discord-bot"
    echo ""
    echo "📖 Documentation: See DOCUMENTATION.md"
    echo "=============================================="
else
    echo "🤖 Bot is configured and ready!"
    echo ""
    echo "To start the bot:"
    echo "  npm start                  # Normal mode"
    echo "  npm run start:lowend       # Low-end PC mode"
    echo ""
    echo "To set up as a systemd service (runs on boot):"
    echo "  sudo cp linux-installation/discord-bot.service /etc/systemd/system/"
    echo "  sudo nano /etc/systemd/system/discord-bot.service  # Edit paths"
    echo "  sudo systemctl enable discord-bot"
    echo "  sudo systemctl start discord-bot"
    echo ""
    echo "=============================================="
fi
