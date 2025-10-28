# Quick Setup Guide for Arch Linux

## Automated Installation (Recommended)

**One-command setup:**
```bash
git clone https://github.com/Slxcky-1/PSHomebrew-beta.git
cd PSHomebrew-beta
chmod +x linux-installation/install-arch-auto.sh
./linux-installation/install-arch-auto.sh
```

This will:
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
