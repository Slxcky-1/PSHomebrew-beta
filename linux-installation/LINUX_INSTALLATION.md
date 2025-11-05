# 🎮 PSHomebrew Discord Bot - Linux Installation Guide

Complete installation guide for deploying the **PSHomebrew Discord Bot** on Linux systems with **automatic startup** and **systemd integration**.

## 🤖 Bot Features

**Advanced PlayStation Homebrew Community Bot:**
- 🤖 **AI Chat Integration** (DeepSeek/OpenAI APIs)
- 🛠️ **500+ PlayStation Error Codes Database** (PS1-PS5, PSP, Vita)
- 📡 **Real-Time Firmware Tracking** with exploit warnings
- 📦 **PKG Database & Analysis** for PlayStation packages
- 🛡️ **Advanced Moderation Tools** (auto-ban, raid protection)
- 💰 **Economy System** (gambling, shop, daily rewards)
- 🎮 **15+ Mini-Games** (Snake, 2048, Wordle, etc.)
- 🎫 **Ticket System** with category support
- 📊 **Server Analytics & Statistics**
- 🔗 **Webhook Management**
- 🆙 **Leveling System** with role rewards

---

## 🚀 Quick Installation (Recommended)

**One-Command Setup with Auto-Start:**

### Ubuntu/Debian:
```bash
curl -fsSL https://raw.githubusercontent.com/Slxcky-1/PSHomebrew-beta/main/linux-installation/install-ubuntu.sh | bash
```

### Arch Linux:
```bash
curl -fsSL https://raw.githubusercontent.com/Slxcky-1/PSHomebrew-beta/main/linux-installation/install-arch.sh | bash
```

**What this does:**
- ✅ Installs all dependencies (Node.js, npm, build tools)
- ✅ Creates dedicated `psbot` user for security
- ✅ Sets up bot in `/opt/pshomebrew-bot/`
- ✅ Configures systemd service for automatic startup
- ✅ Sets up log rotation and monitoring
- ✅ Enables auto-restart on crashes

---

## 📋 Manual Installation

### 🐧 Ubuntu/Debian

```bash
# Download the installation script
wget https://raw.githubusercontent.com/Slxcky-1/PSHomebrew-beta/main/linux-installation/install-ubuntu.sh

# Make executable and run
chmod +x install-ubuntu.sh
./install-ubuntu.sh
```

### 🔷 Arch Linux

```bash
# Download the installation script
wget https://raw.githubusercontent.com/Slxcky-1/PSHomebrew-beta/main/linux-installation/install-arch.sh

# Make executable and run
chmod +x install-arch.sh
./install-arch.sh
```

---

## ⚙️ Post-Installation Configuration

### 1. Configure Bot Credentials

```bash
sudo nano /opt/pshomebrew-bot/config.json
```

**Add your credentials:**
```json
{
  "token": "YOUR_BOT_TOKEN_HERE",
  "clientId": "YOUR_CLIENT_ID_HERE", 
  "deepseekApiKey": "YOUR_DEEPSEEK_API_KEY_HERE",
  "botOwnerId": "YOUR_DISCORD_USER_ID_HERE"
}
```

### 2. Deploy Slash Commands

```bash
cd /opt/pshomebrew-bot
sudo -u psbot node scripts/deploy-commands.js
```

### 3. Start the Bot Service

```bash
sudo systemctl enable pshomebrew-bot
sudo systemctl start pshomebrew-bot
```

### 4. Verify Installation

```bash
sudo systemctl status pshomebrew-bot
```

**Expected output:**
```
● pshomebrew-bot.service - PSHomebrew Discord Bot - PlayStation Homebrew Community Bot
   Loaded: loaded (/etc/systemd/system/pshomebrew-bot.service; enabled; vendor preset: enabled)
   Active: active (running) since [timestamp]
```

---

## 🔧 System Management

### Service Control Commands

```bash
# Check bot status
sudo systemctl status pshomebrew-bot

# Start the bot
sudo systemctl start pshomebrew-bot

# Stop the bot
sudo systemctl stop pshomebrew-bot

# Restart the bot
sudo systemctl restart pshomebrew-bot

# View live logs
sudo journalctl -u pshomebrew-bot -f

# View recent logs
sudo journalctl -u pshomebrew-bot -n 50

# Disable auto-start
sudo systemctl disable pshomebrew-bot
```

### Update Bot

```bash
# Use the built-in update script
sudo /opt/pshomebrew-bot/update-bot.sh
```

**The update script automatically:**
- Creates a timestamped backup
- Stops the service
- Updates dependencies
- Restarts the service
- Verifies successful startup

---

## 📊 System Requirements

### Minimum Requirements
- **OS:** Ubuntu 20.04+, Debian 11+, Arch Linux (current)
- **CPU:** 1 core (2 cores recommended)
- **RAM:** 512MB (2GB recommended)
- **Storage:** 500MB free space
- **Network:** Stable internet connection

### Recommended for Production
- **CPU:** 2+ cores
- **RAM:** 2GB+
- **Storage:** SSD with 2GB+ free space
- **Network:** Low latency connection

---

## � Security Features

### Built-in Security Hardening

The installation automatically implements:

- **Dedicated User:** Bot runs as non-privileged `psbot` user
- **Filesystem Protection:** Read-only system files, isolated temp directories
- **Resource Limits:** Memory and CPU usage constraints
- **Network Security:** Minimal network permissions
- **Process Isolation:** Restricted capabilities and namespace access

### Security Best Practices

1. **Regular Updates:**
```bash
# Update system packages
sudo apt update && sudo apt upgrade  # Ubuntu/Debian
sudo pacman -Syu                     # Arch Linux

# Update bot dependencies
sudo /opt/pshomebrew-bot/update-bot.sh
```

2. **Monitor Logs:**
```bash
# Set up log monitoring
sudo journalctl -u pshomebrew-bot --since "1 hour ago"
```

3. **Firewall Configuration:**
```bash
# Ubuntu/Debian (UFW)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow out 443  # HTTPS for Discord API

# Arch Linux (iptables)
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
```

---

## � Troubleshooting

### Common Issues

#### 1. Service Won't Start
```bash
# Check detailed status
sudo systemctl status pshomebrew-bot -l

# View error logs
sudo journalctl -u pshomebrew-bot -n 20 --no-pager
```

#### 2. Permission Errors
```bash
# Fix ownership
sudo chown -R psbot:psbot /opt/pshomebrew-bot

# Fix permissions
sudo chmod 755 /opt/pshomebrew-bot
sudo chmod 600 /opt/pshomebrew-bot/config.json
```

#### 3. Node.js Issues
```bash
# Check Node.js version (requires v18+)
node --version

# Reinstall if needed (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Reinstall if needed (Arch Linux)
sudo pacman -S nodejs npm
```

#### 4. Memory Issues
```bash
# Check memory usage
sudo systemctl show pshomebrew-bot --property=MemoryCurrent

# Modify memory limits in service file
sudo nano /etc/systemd/system/pshomebrew-bot.service
```

#### 5. Network Connectivity
```bash
# Test Discord API connectivity
curl -s https://discord.com/api/v10/gateway
```

### Log Analysis

```bash
# Real-time logs with filtering
sudo journalctl -u pshomebrew-bot -f | grep -E "(ERROR|WARN|CRITICAL)"

# Export logs for analysis
sudo journalctl -u pshomebrew-bot --since "24 hours ago" > bot_logs.txt

# Check for specific errors
sudo journalctl -u pshomebrew-bot | grep -i "error\|fail\|exception"
```

---

## � File Structure

```
/opt/pshomebrew-bot/
├── bot.js                    # Main bot file
├── config.json               # Bot configuration
├── package.json              # Dependencies
├── commands/                 # Slash commands
│   ├── firmware.js          # Firmware tracker
│   ├── pkg.js               # PKG database
│   └── [50+ other commands]
├── features/                 # Feature configurations
│   ├── consoleErrorCodes.json # 500+ error codes
│   ├── firmware.json        # Firmware settings
│   └── [20+ other features]
├── data/                     # Bot data (user-writable)
│   ├── serverSettings.json
│   ├── userData.json
│   └── [persistent data]
├── backups/                  # Automatic backups
├── logs/                     # Application logs
└── scripts/                  # Utility scripts
    ├── deploy-commands.js
    └── update-bot.sh
```

---

## 🔄 Automatic Features

### Auto-Restart on Failure
The systemd service automatically:
- Restarts the bot if it crashes
- Limits restart attempts (3 attempts in 60 seconds)
- Logs all restart events

### Log Rotation
Automatic log management:
- Daily rotation
- 7-day retention
- Compressed storage
- Automatic cleanup

### System Integration
- Starts automatically on boot
- Respects system shutdown/restart
- Integrates with system monitoring tools

---

## � Additional Resources

### Documentation
- **Bot Commands:** See `/help` command in Discord
- **Configuration:** Check `features/*.json` files
- **API Documentation:** Discord.js v14 guide

### Support Channels
- **GitHub Issues:** Report bugs and request features
- **Discord Server:** Community support and updates
- **Wiki/Documentation:** Comprehensive guides

### Monitoring Tools

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs  # Ubuntu/Debian
sudo pacman -S htop iotop nethogs    # Arch Linux

# Monitor bot performance
htop                                 # System resources
sudo iotop                          # Disk usage
sudo nethogs                        # Network usage
```

---

## 🎯 Production Deployment Checklist

- [ ] **System updated** to latest packages
- [ ] **Bot user created** (`psbot`) with proper permissions
- [ ] **Bot files deployed** to `/opt/pshomebrew-bot/`
- [ ] **Dependencies installed** via npm
- [ ] **Config file configured** with valid tokens
- [ ] **Slash commands deployed** successfully
- [ ] **Systemd service enabled** and running
- [ ] **Firewall configured** appropriately
- [ ] **Log rotation setup** working
- [ ] **Monitoring configured** (optional)
- [ ] **Backup strategy implemented** (automatic)
- [ ] **Update procedure tested**

---

**Bot Version:** Latest (Auto-updating)  
**Supported Distributions:** Ubuntu 20.04+, Debian 11+, Arch Linux  
**Installation Method:** Fully Automated with SystemD Integration  
**Status:** Production Ready ✅  
**Security Level:** Hardened 🔒
