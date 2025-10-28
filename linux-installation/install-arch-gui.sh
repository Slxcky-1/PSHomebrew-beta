#!/bin/bash
# PSHomebrew Discord Bot - Arch Linux GUI Installation Script
# Run with: bash install-arch-gui.sh

# Check for dialog/whiptail
if command -v whiptail &> /dev/null; then
    DIALOG=whiptail
elif command -v dialog &> /dev/null; then
    DIALOG=dialog
else
    echo "Installing dialog for GUI installer..."
    sudo pacman -S --noconfirm dialog
    DIALOG=dialog
fi

# Welcome screen
$DIALOG --title "PSHomebrew Discord Bot" --msgbox "Welcome to the PSHomebrew Discord Bot installer for Arch Linux!\n\nThis wizard will guide you through the installation process." 10 60

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    $DIALOG --title "Error" --msgbox "Please do NOT run this script as root!" 7 50
    exit 1
fi

# Update system
if $DIALOG --title "System Update" --yesno "Update system packages before installation?" 7 50; then
    sudo pacman -Syu --noconfirm 2>&1 | $DIALOG --title "Updating System" --programbox 20 70
fi

# Install Node.js
$DIALOG --title "Installing Dependencies" --infobox "Installing Node.js and npm..." 5 50
sudo pacman -S --noconfirm nodejs npm 2>&1 | $DIALOG --title "Installing Node.js" --programbox 20 70

# Show versions
NODE_VER=$(node --version)
NPM_VER=$(npm --version)
$DIALOG --title "Installation Check" --msgbox "Node.js: $NODE_VER\nnpm: $NPM_VER" 8 50

# Install bot dependencies
$DIALOG --title "Installing Bot" --infobox "Installing Discord bot dependencies..." 5 50
npm install 2>&1 | $DIALOG --title "Installing Dependencies" --programbox 20 70

# Config setup
if [ ! -f "config.json" ]; then
    # Get bot token
    BOT_TOKEN=$($DIALOG --title "Bot Configuration" --inputbox "Enter your Discord Bot Token:" 8 60 3>&1 1>&2 2>&3)
    
    # Get client ID
    CLIENT_ID=$($DIALOG --title "Bot Configuration" --inputbox "Enter your Discord Client ID:" 8 60 3>&1 1>&2 2>&3)
    
    # Get guild ID
    # Create config.json
    cat > config.json << EOF
{
  "token": "$BOT_TOKEN",
  "clientId": "$CLIENT_ID"
}
EOF
    
    $DIALOG --title "Configuration" --msgbox "config.json created successfully!" 6 50
else
    if $DIALOG --title "Configuration Exists" --yesno "config.json already exists. Do you want to reconfigure?" 7 50; then
        # Reconfigure
        BOT_TOKEN=$($DIALOG --title "Bot Configuration" --inputbox "Enter your Discord Bot Token:" 8 60 3>&1 1>&2 2>&3)
        CLIENT_ID=$($DIALOG --title "Bot Configuration" --inputbox "Enter your Discord Client ID:" 8 60 3>&1 1>&2 2>&3)
        
        cat > config.json << EOF
{
  "token": "$BOT_TOKEN",
  "clientId": "$CLIENT_ID"
}
EOF
    fi
fi

# Deploy commands
$DIALOG --title "Deploying Commands" --infobox "Deploying slash commands to Discord..." 5 50
node deploy-commands.js 2>&1 | $DIALOG --title "Command Deployment" --programbox 20 70

# Ask about systemd service
if $DIALOG --title "Systemd Service" --yesno "Do you want to install the systemd service for auto-start on boot?" 7 60; then
    # Edit service file
    USERNAME=$(whoami)
    WORKDIR=$(pwd)
    
    sed -i "s|YOUR_USERNAME_HERE|$USERNAME|g" discord-bot.service
    sed -i "s|/path/to/your/bot/directory|$WORKDIR|g" discord-bot.service
    
    sudo cp discord-bot.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable discord-bot
    
    $DIALOG --title "Service Installed" --msgbox "Systemd service installed and enabled!\n\nThe bot will now start automatically on boot." 8 60
    
    if $DIALOG --title "Start Service" --yesno "Start the bot service now?" 7 50; then
        sudo systemctl start discord-bot
        $DIALOG --title "Service Started" --msgbox "Bot is now running as a system service!\n\nView logs: sudo journalctl -u discord-bot -f" 9 60
        START_NOW=0
    else
        START_NOW=1
    fi
else
    START_NOW=1
fi

# Ask to start bot now (if not started as service)
if [ $START_NOW -eq 1 ]; then
    MODE=$($DIALOG --title "Start Bot" --menu "Choose startup mode:" 12 60 2 \
        "1" "Normal Mode" \
        "2" "Low-End PC Mode" \
        3>&1 1>&2 2>&3)
    
    if [ $? -eq 0 ]; then
        clear
        echo "=============================================="
        echo "✅ Installation complete!"
        echo "🤖 Starting PSHomebrew Discord Bot..."
        echo "   Press Ctrl+C to stop the bot"
        echo "=============================================="
        echo ""
        
        if [ "$MODE" = "2" ]; then
            npm run start:lowend
        else
            npm start
        fi
    fi
fi

clear
echo "=============================================="
echo "✅ Installation Complete!"
echo "=============================================="
echo ""
echo "📖 Documentation: See DOCUMENTATION.md"
echo ""
echo "🔧 Useful commands:"
echo "   Start bot:        npm start"
echo "   Low-end mode:     npm run start:lowend"
echo "   Service status:   sudo systemctl status discord-bot"
echo "   View logs:        sudo journalctl -u discord-bot -f"
echo ""
echo "=============================================="
