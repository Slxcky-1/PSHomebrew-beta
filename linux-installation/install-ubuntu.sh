#!/bin/bash
# PSHomebrew Discord Bot - Ubuntu/Debian Installation Script
# Run with: bash install-ubuntu.sh

set -e  # Exit on error

echo "🚀 PSHomebrew Discord Bot - Ubuntu/Debian Setup"
echo "================================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "❌ Please do NOT run this script as root"
    exit 1
fi

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        NODE_ARCH="x64"
        ;;
    aarch64|arm64)
        NODE_ARCH="arm64"
        ;;
    armv7l)
        NODE_ARCH="armv7l"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "✅ Detected architecture: $ARCH"

# Update system
echo ""
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Node.js (using NodeSource repository for latest LTS)
echo ""
echo "📦 Installing Node.js and npm..."

# Check if Node.js is already installed and meets minimum version (v18+)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo "✅ Node.js $(node --version) already installed"
    else
        echo "⚠️  Node.js version too old (v${NODE_VERSION}), updating to LTS..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    echo "📥 Installing Node.js LTS..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install build essentials (required for some npm packages)
echo ""
echo "📦 Installing build essentials..."
sudo apt install -y build-essential git

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
echo "================================================"
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
    echo "================================================"
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
    echo "================================================"
fi
