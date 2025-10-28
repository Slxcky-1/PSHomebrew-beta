# Linux Installation Guide

Quick setup guide for installing the PSHomebrew Discord Bot on Arch Linux and Ubuntu/Debian.

## �️ Installation Methods

Choose your preferred installation method:

### 🎨 GUI Installation (Recommended for Beginners)
Interactive wizard with dialog boxes - easiest method!

**Arch Linux:**
```bash
bash install-arch-gui.sh
```

**Ubuntu/Debian:**
```bash
bash install-ubuntu-gui.sh
```

### ⌨️ CLI Installation (For Advanced Users)
Fully automated command-line installation.

**Arch Linux:**
```bash
bash install-arch.sh
```

**Ubuntu/Debian:**
```bash
bash install-ubuntu.sh
```

---

##  Arch Linux Installation

### GUI Installation (Recommended)

```bash
bash install-arch-gui.sh
```

**Features:**
- Interactive dialog-based wizard
- Guided configuration setup
- Option to install systemd service
- Choose startup mode (Normal/Low-End)
- Automatic start after installation

### CLI Installation (Automatic)

```bash
bash install-arch.sh
```

### Manual Installation

1. **Update system:**
```bash
sudo pacman -Syu
```

2. **Install Node.js and npm:**
```bash
sudo pacman -S nodejs npm
```

3. **Verify installation:**
```bash
node --version  # Should be v18+
npm --version
```

5. **Install dependencies:**
```bash
npm install
```

6. **Configure bot:**
```bash
nano config.json
# Add your token, clientId, deepseekApiKey, and botOwnerId
```

7. **Deploy commands:**
```bash
node deploy-commands.js
```

7. **Start the bot:**
```bash
npm start              # Normal mode
npm run start:lowend   # Low-end PC mode
```

---

## 🐧 Ubuntu/Debian Installation

### GUI Installation (Recommended)

```bash
bash install-ubuntu-gui.sh
```

**Features:**
- Interactive dialog-based wizard
- Guided configuration setup
- Option to install systemd service
- Choose startup mode (Normal/Low-End)
- Automatic start after installation

### CLI Installation (Automatic)

```bash
bash install-ubuntu.sh
```

### Manual Installation

1. **Update system:**
```bash
sudo apt update
sudo apt upgrade -y
```

2. **Install Node.js (LTS):**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

3. **Install build tools:**
```bash
sudo apt install -y build-essential
```

4. **Verify installation:**
```bash
node --version  # Should be v18+
npm --version
```

5. **Install dependencies:**
```bash
npm install
```

6. **Configure bot:**
```bash
nano config.json
# Add your token, clientId, deepseekApiKey, and botOwnerId
```

7. **Deploy commands:**
```bash
node deploy-commands.js
```

8. **Start the bot:**
```bash
npm start              # Normal mode
npm run start:lowend   # Low-end PC mode
```

---

## 🔧 System Service Setup (Optional)

To run the bot automatically on system startup:

### 1. Edit the service file

```bash
nano discord-bot.service
```

Replace:
- `YOUR_USERNAME_HERE` with your Linux username
- `/path/to/your/bot/directory` with the actual path

Example:
```ini
User=john
WorkingDirectory=/home/john/discord-bot
```

### 2. Install the service

```bash
sudo cp discord-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 3. Enable and start

```bash
sudo systemctl enable discord-bot  # Auto-start on boot
sudo systemctl start discord-bot   # Start now
```

### 4. Check status

```bash
sudo systemctl status discord-bot
```

### 5. View logs

```bash
sudo journalctl -u discord-bot -f
```

### 6. Control the service

```bash
sudo systemctl stop discord-bot     # Stop bot
sudo systemctl restart discord-bot  # Restart bot
sudo systemctl disable discord-bot  # Disable auto-start
```

---

## 📦 Requirements

### Minimum
- Node.js v18.0.0 or higher
- npm v8.0.0 or higher
- 2GB RAM (512MB for low-end mode)
- 100MB disk space

### Recommended
- Node.js v20+ LTS
- 4GB RAM
- SSD storage

---

## 🔍 Troubleshooting

### Permission Denied

```bash
chmod +x install-arch.sh
chmod +x install-ubuntu.sh
```

### Node.js Version Too Old

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

**Arch Linux:**
```bash
sudo pacman -S nodejs npm
```

### npm install fails

Install build tools:

**Ubuntu/Debian:**
```bash
sudo apt install -y build-essential
```

**Arch Linux:**
```bash
sudo pacman -S base-devel
```

### Bot won't start

1. Check config.json is valid:
```bash
cat config.json
```

2. Ensure commands are deployed:
```bash
node deploy-commands.js
```

3. Check for errors:
```bash
npm start
```

### Service won't start

1. Check service file:
```bash
sudo systemctl status discord-bot
```

2. View detailed logs:
```bash
sudo journalctl -u discord-bot -n 50
```

3. Verify file paths and permissions:
```bash
ls -la /path/to/your/bot/directory
```

---

## 🚀 Quick Start Commands

```bash
# Clone or download bot files
cd ~/discord-bot

# Choose installation method:

# GUI Installation (Interactive)
bash install-arch-gui.sh      # For Arch Linux
bash install-ubuntu-gui.sh    # For Ubuntu/Debian

# OR

# CLI Installation (Automatic)
bash install-arch.sh          # For Arch Linux
bash install-ubuntu.sh        # For Ubuntu/Debian

# Manual start (if not using installer)
npm start                     # Normal mode
npm run start:lowend          # Low-end PC mode
```

---

## 📊 Performance Tips for Linux

### 1. Use Low-End Mode
```bash
npm run start:lowend
```

### 2. Monitor Resource Usage
```bash
htop                    # Install: sudo pacman -S htop (Arch) or sudo apt install htop (Ubuntu)
```

### 3. Check Bot Memory
```bash
ps aux | grep node
```

### 4. Limit CPU Usage (if needed)
```bash
cpulimit -e node -l 50  # Install: sudo pacman -S cpulimit or sudo apt install cpulimit
```

### 5. Run in Background (without systemd)
```bash
# Using screen
screen -S discord-bot
npm start
# Press Ctrl+A then D to detach

# Reattach later
screen -r discord-bot

# Or using tmux
tmux new -s discord-bot
npm start
# Press Ctrl+B then D to detach

# Reattach later
tmux attach -t discord-bot
```

---

## 🔐 Security Best Practices

1. **Don't run as root:**
```bash
# Never use sudo when starting the bot
npm start  # ✅ Correct
sudo npm start  # ❌ Wrong
```

2. **Protect config.json:**
```bash
chmod 600 config.json
```

3. **Keep system updated:**
```bash
# Arch Linux
sudo pacman -Syu

# Ubuntu/Debian
sudo apt update && sudo apt upgrade
```

4. **Use environment variables (optional):**
```bash
# Instead of config.json, use .env file
export DISCORD_TOKEN="your_token_here"
export CLIENT_ID="your_client_id"
export GUILD_ID="your_guild_id"
```

---

## 📖 Additional Resources

- [DOCUMENTATION.md](./DOCUMENTATION.md) - Complete bot documentation
- [Node.js Official Site](https://nodejs.org/)
- [Discord.js Guide](https://discordjs.guide/)
- [Arch Wiki - Node.js](https://wiki.archlinux.org/title/Node.js)
- [Ubuntu Package Search](https://packages.ubuntu.com/)

---

**Installation Scripts:**
- `install-arch-gui.sh` - Interactive GUI installer for Arch Linux
- `install-arch.sh` - Automatic CLI installer for Arch Linux
- `install-ubuntu-gui.sh` - Interactive GUI installer for Ubuntu/Debian
- `install-ubuntu.sh` - Automatic CLI installer for Ubuntu/Debian
- `discord-bot.service` - Systemd service configuration

**Platform:** Linux (Arch, Ubuntu, Debian)  
**Tested On:** Arch Linux (latest), Ubuntu 22.04 LTS, Ubuntu 24.04 LTS  
**Status:** Production Ready ✅
