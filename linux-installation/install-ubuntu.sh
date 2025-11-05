#!/bin/bash
# PSHomebrew Discord Bot - Ubuntu/Debian Installation Script
# Advanced PlayStation Homebrew Community Bot with AI, Moderation, Economy & More
# Run with: bash install-ubuntu.sh

set -e  # Exit on error

echo "🎮 PSHomebrew Discord Bot - Ubuntu/Debian Setup"
echo "==============================================="
echo "Features: AI Chat, Error Codes, Firmware Tracking, PKG Database,"
echo "          Moderation, Economy, Games, Tickets, Webhooks & More"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "❌ Please do NOT run this script as root"
    echo "   This script will use sudo when needed"
    exit 1
fi

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

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
        print_error "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

print_success "Detected architecture: $ARCH"

# Update system
print_step "Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install essential packages
print_step "Installing system dependencies..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    htop \
    nano

# Install Node.js (using NodeSource repository for latest LTS)
print_step "Installing Node.js LTS..."

# Remove old Node.js if present
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        print_success "Node.js $(node --version) already installed"
    else
        print_warning "Node.js version too old (v${NODE_VERSION}), updating to LTS..."
        sudo apt remove -y nodejs npm
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    print_step "Installing Node.js LTS..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Verify installation
print_step "Verifying installations..."
print_success "Node.js: $(node --version)"
print_success "npm: $(npm --version)"
print_success "Git: $(git --version)"

# Create dedicated user for the bot (security best practice)
BOT_USER="psbot"
BOT_DIR="/opt/pshomebrew-bot"

if ! id "$BOT_USER" &>/dev/null; then
    print_step "Creating dedicated bot user: $BOT_USER"
    sudo useradd -r -s /bin/false -d "$BOT_DIR" "$BOT_USER"
    print_success "Bot user created"
else
    print_success "Bot user already exists"
fi

# Create bot directory
print_step "Setting up bot directory: $BOT_DIR"
sudo mkdir -p "$BOT_DIR"
sudo mkdir -p "$BOT_DIR/data"
sudo mkdir -p "$BOT_DIR/backups"
sudo mkdir -p "$BOT_DIR/logs"

# Copy bot files
print_step "Copying bot files..."
SCRIPT_DIR="$(dirname "$0")/.."
sudo cp -r "$SCRIPT_DIR"/* "$BOT_DIR/"
sudo chown -R "$BOT_USER:$BOT_USER" "$BOT_DIR"
sudo chmod 755 "$BOT_DIR"
sudo chmod 644 "$BOT_DIR"/*.js
sudo chmod 644 "$BOT_DIR"/*.json
sudo chmod 755 "$BOT_DIR"/scripts/*.sh
sudo chmod 644 "$BOT_DIR"/features/*.json
sudo chmod 644 "$BOT_DIR"/commands/*.js

# Install bot dependencies
print_step "Installing Discord bot dependencies..."
cd "$BOT_DIR"
sudo -u "$BOT_USER" npm install --production --silent --no-audit --no-fund

# Check if config.json exists and configure it
CONFIG_FILE="$BOT_DIR/config.json"
if [ ! -f "$CONFIG_FILE" ] || [ ! -s "$CONFIG_FILE" ]; then
    print_step "Creating config.json template..."
    sudo -u "$BOT_USER" cat > "$CONFIG_FILE" << 'EOF'
{
  "token": "YOUR_BOT_TOKEN_HERE",
  "clientId": "YOUR_CLIENT_ID_HERE",
  "deepseekApiKey": "YOUR_DEEPSEEK_API_KEY_HERE",
  "botOwnerId": "YOUR_DISCORD_USER_ID_HERE"
}
EOF
    print_success "config.json created! Please edit it with your bot credentials."
    NEED_CONFIG=true
else
    print_success "config.json already exists"
    NEED_CONFIG=false
fi

# Set up systemd service
print_step "Installing systemd service..."
sudo cp "$BOT_DIR/linux-installation/discord-bot.service" /etc/systemd/system/pshomebrew-bot.service
sudo systemctl daemon-reload

# Set up log rotation
print_step "Setting up log rotation..."
sudo tee /etc/logrotate.d/pshomebrew-bot > /dev/null << EOF
/var/log/journal/*pshomebrew-bot* {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        systemctl reload systemd-journald
    endscript
}
EOF

# Deploy commands if config is ready
if [ "$NEED_CONFIG" = false ] && ! sudo -u "$BOT_USER" grep -q "YOUR_BOT_TOKEN_HERE" "$CONFIG_FILE"; then
    print_step "Deploying slash commands..."
    cd "$BOT_DIR"
    sudo -u "$BOT_USER" node scripts/deploy-commands.js
    print_success "Slash commands deployed"
fi

# Enable and start the service if config is ready
if [ "$NEED_CONFIG" = false ] && ! sudo -u "$BOT_USER" grep -q "YOUR_BOT_TOKEN_HERE" "$CONFIG_FILE"; then
    print_step "Enabling and starting the bot service..."
    sudo systemctl enable pshomebrew-bot
    sudo systemctl start pshomebrew-bot
    
    # Wait a moment and check status
    sleep 3
    if sudo systemctl is-active --quiet pshomebrew-bot; then
        print_success "Bot service started successfully!"
        echo ""
        echo "🎮 PSHomebrew Discord Bot is now running!"
        echo "   • Service: pshomebrew-bot"
        echo "   • Status:  $(sudo systemctl is-active pshomebrew-bot)"
        echo "   • Logs:    sudo journalctl -u pshomebrew-bot -f"
        echo "   • Control: sudo systemctl {start|stop|restart|status} pshomebrew-bot"
    else
        print_warning "Bot service failed to start. Check configuration."
    fi
else
    print_warning "Bot service not started - configuration needed"
fi

# Create update script
print_step "Creating update script..."
sudo tee "$BOT_DIR/update-bot.sh" > /dev/null << 'EOF'
#!/bin/bash
# PSHomebrew Bot Update Script
set -e

BOT_DIR="/opt/pshomebrew-bot"
BACKUP_DIR="$BOT_DIR/backups/$(date +%Y%m%d_%H%M%S)"

echo "🔄 Updating PSHomebrew Discord Bot..."

# Create backup
echo "📦 Creating backup..."
mkdir -p "$BACKUP_DIR"
cp -r "$BOT_DIR/data" "$BACKUP_DIR/"
cp "$BOT_DIR/config.json" "$BACKUP_DIR/" 2>/dev/null || true

# Stop service
echo "⏹️  Stopping bot service..."
sudo systemctl stop pshomebrew-bot

# Update dependencies
echo "📦 Updating dependencies..."
cd "$BOT_DIR"
sudo -u psbot npm update

# Restart service
echo "▶️  Starting bot service..."
sudo systemctl start pshomebrew-bot

# Check status
if sudo systemctl is-active --quiet pshomebrew-bot; then
    echo "✅ Bot updated and restarted successfully!"
    echo "📋 Backup created at: $BACKUP_DIR"
else
    echo "❌ Bot failed to start after update"
    echo "📋 Check logs: sudo journalctl -u pshomebrew-bot -f"
    exit 1
fi
EOF

sudo chmod +x "$BOT_DIR/update-bot.sh"

echo ""
echo "==============================================="
print_success "PSHomebrew Discord Bot Installation Complete!"
echo "==============================================="
echo ""

# Final status
if [ "$NEED_CONFIG" = true ] || sudo -u "$BOT_USER" grep -q "YOUR_BOT_TOKEN_HERE" "$CONFIG_FILE"; then
    print_warning "CONFIGURATION REQUIRED"
    echo ""
    echo "📋 Next steps:"
    echo "1. Edit the bot configuration:"
    echo "   sudo nano $CONFIG_FILE"
    echo ""
    echo "2. Deploy slash commands:"
    echo "   cd $BOT_DIR && sudo -u $BOT_USER node scripts/deploy-commands.js"
    echo ""
    echo "3. Start the bot service:"
    echo "   sudo systemctl enable pshomebrew-bot"
    echo "   sudo systemctl start pshomebrew-bot"
    echo ""
    echo "4. Check bot status:"
    echo "   sudo systemctl status pshomebrew-bot"
else
    print_success "BOT IS RUNNING AUTOMATICALLY!"
    echo ""
    echo "🎮 Your PSHomebrew Discord Bot is active!"
    echo "   • Auto-starts on system boot"
    echo "   • Restarts automatically if it crashes"
    echo "   • Full systemd integration"
fi

echo ""
echo "📖 Useful commands:"
echo "   • Status:    sudo systemctl status pshomebrew-bot"
echo "   • Logs:      sudo journalctl -u pshomebrew-bot -f"
echo "   • Restart:   sudo systemctl restart pshomebrew-bot"
echo "   • Stop:      sudo systemctl stop pshomebrew-bot"
echo "   • Update:    sudo $BOT_DIR/update-bot.sh"
echo ""
echo "📁 Bot location: $BOT_DIR"
echo "👤 Bot user:     $BOT_USER"
echo "📋 Config file:  $CONFIG_FILE"
echo ""
print_success "Installation complete! Enjoy your advanced Discord bot! 🚀"
