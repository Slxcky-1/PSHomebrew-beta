# Quick Setup Guide for Arch Linux

## Option 1: Clone with GitHub Token (Recommended)

**Step 1: Get GitHub Token**
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scope: ✅ **repo**
4. Copy the token

**Step 2: Clone and Install**
```bash
# Clone (enter your GitHub token when prompted for password)
git clone https://github.com/Slxcky-1/PSHomebrew-beta.git
cd PSHomebrew-beta

# Run automated installer
chmod +x linux-installation/install-arch-auto.sh
./linux-installation/install-arch-auto.sh
```

---

## Option 2: Download ZIP (No Git Required)

**Step 1: Download**
1. Go to: https://github.com/Slxcky-1/PSHomebrew-beta
2. Click **Code** → **Download ZIP**
3. Transfer to Arch Linux PC

**Step 2: Extract and Install**
```bash
unzip PSHomebrew-beta-main.zip
cd PSHomebrew-beta-main
chmod +x linux-installation/install-arch-auto.sh
./linux-installation/install-arch-auto.sh
```

This will automatically:
- ✅ Install Node.js and dependencies
- ✅ Install npm packages
- ✅ Deploy Discord commands
- ✅ Setup systemd service
- ✅ Start the bot automatically

---

## Manual Installation (Alternative)

If you prefer manual setup:

```bash
# 1. Clone repository
git clone https://github.com/Slxcky-1/PSHomebrew-beta.git
cd PSHomebrew-beta

# 2. Install Node.js
sudo pacman -S nodejs npm

# 3. Install dependencies
npm install

# 4. Deploy commands
node deploy-commands.js

# 5. Run bot
node bot.js
```

---

## Service Management

**Start bot:**
```bash
sudo systemctl start discord-bot
```

**Stop bot:**
```bash
sudo systemctl stop discord-bot
```

**Restart bot:**
```bash
sudo systemctl restart discord-bot
```

**Check status:**
```bash
sudo systemctl status discord-bot
```

**View logs:**
```bash
sudo journalctl -u discord-bot -f
```

---

## Updating the Bot

```bash
cd PSHomebrew-beta
git pull
npm install
sudo systemctl restart discord-bot
```

---

## Features

- ✅ AI Chat Assistant (DeepSeek)
- ✅ PlayStation Database (PS1-PS5, Vita, PSP)
- ✅ Real-time Firmware Monitoring
- ✅ 347 PS3 Error Codes
- ✅ Leveling System
- ✅ Moderation Tools
- ✅ Ticket System
- ✅ 15+ Interactive Games
- ✅ YouTube Monitoring
- ✅ Auto-optimized for low-end systems

See `DOCUMENTATION.md` for full feature list.
