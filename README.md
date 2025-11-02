# 🎮 PSHomebrew Discord Bot

A powerful all-in-one Discord bot for PlayStation homebrew communities featuring AI chat, advanced moderation, automatic role assignment, and 351+ console error code detection.

## ✨ Key Features

- 🤖 **AI Chat** - DeepSeek & ChatGPT with web search
- 🎮 **351+ Error Codes** - PS1-PS5, PSP, Vita detection
- 🛡️ **Advanced Moderation** - Warnings, raid protection, auto-actions
- 📊 **Leveling System** - Server-specific XP and role rewards
- 🎫 **Ticket System** - Professional support channels
- 💰 **SellHub Integration** - Auto role assignment on purchase
- 🎮 **15 Games** - Built-in entertainment
- 🌐 **6 Languages** - Multi-language support
- � **Auto-Updates** - GitHub integration
- ⚡ **Low-End Optimized** - Runs on 512MB RAM

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/Slxcky-1/PSHomebrew-beta.git
cd PSHomebrew-beta
npm install

# Configure
cp config.example.json config.json
# Edit config.json with your bot token and API keys

# Deploy commands and start
node deploy-commands.js
npm start

# Optional: Low-end PC mode (512MB RAM limit)
npm run start:lowend
```

### What You Need
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Discord Bot Token** - [Get from here](https://discord.com/developers/applications)
- **API Keys** (Optional):
  - DeepSeek (Free) - [platform.deepseek.com](https://platform.deepseek.com)
  - ChatGPT (Paid) - [platform.openai.com](https://platform.openai.com)

## 📖 Documentation

**[📚 Complete Documentation](docs/DOCUMENTATION.md)** - Full setup guide, all features, commands, and configuration

### Quick Links
- [Installation Guide](docs/DOCUMENTATION.md#quick-start-installation)
- [Configuration Guide](docs/DOCUMENTATION.md#configuration-guide)
- [All Commands](docs/DOCUMENTATION.md#commands-reference)
- [AI Chat System](docs/DOCUMENTATION.md#ai-chat-system)
- [Moderation System](docs/DOCUMENTATION.md#moderation-system)
- [SellHub Integration](docs/DOCUMENTATION.md#sellhub-integration)
- [Troubleshooting](docs/DOCUMENTATION.md#troubleshooting)

## � Additional Setup Guides

- **[Linux Installation](linux-installation/LINUX_INSTALLATION.md)** - Arch & Ubuntu setup with systemd
- **[Auto Deploy](docs/AUTO_DEPLOY_SETUP.md)** - PM2 and systemd configuration
- **[Code Obfuscation](docs/OBFUSCATION.md)** - Protect your bot code

## ⚡ Performance

- **512MB RAM** minimum requirement
- **Memory cleanup** every 10 minutes
- **Response caching** reduces API calls 30-50%
- **Message compression** saves 40-60% storage
- **Auto-updates** via `/poweroptions` command

## 📄 License

Unlicensed - All rights reserved

## 🙏 Credits

Built with [Discord.js](https://discord.js.org/), [DeepSeek AI](https://www.deepseek.com/), [OpenAI](https://openai.com/), and [Express.js](https://expressjs.com/)

---

**Made for the PlayStation Homebrew community** 🎮  
Repository: [Slxcky-1/PSHomebrew-beta](https://github.com/Slxcky-1/PSHomebrew-beta)
