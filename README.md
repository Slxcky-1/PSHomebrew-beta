# 🎮 PSHomebrew Discord Bot

A powerful multi-purpose Discord bot for PlayStation homebrew communities with AI assistance, moderation, leveling, tickets, and more.

## ✨ Features

### 🤖 AI Chat Assistant
- **DeepSeek & ChatGPT Integration** - Intelligent AI responses with web search
- **PlayStation Expertise** - Specialized in PS1-PS5 homebrew, jailbreaking, and troubleshooting
- **Token Quota System** - 5,000 tokens per user per day
- **Response Caching** - 30-50% API call reduction
- **Jailbreak Protection** - Automatic detection and lockdown

### 📊 Leveling System
- **XP Per Message** - Configurable XP range (default: 15-25)
- **Level Roles** - Auto-assign roles based on levels
- **Leaderboard** - Track top users
- **Server-Specific Progress** - Separate progress per server

### 🎫 Advanced Ticket System
- **Private Support Channels** - One-click ticket creation
- **Staff Management** - Claim and close tickets
- **Transcripts** - Full conversation history export
- **Customizable Messages** - Branded ticket embeds

### 🛡️ Moderation System
- **Warning System** - Track user infractions
- **Auto-Actions** - Timeout/kick/ban after threshold
- **Moderation Logs** - Full audit trail
- **Raid Protection** - Automatic lockdown on suspicious joins
- **Role Management** - Easy moderator setup

### 🎮 Games (15 Built-in)
Snake, TicTacToe, Connect4, Wordle, Minesweeper, 2048, Memory Match, Fast Type, Find Emoji, Guess Pokémon, Rock Paper Scissors, Hangman, Trivia, Slots, Would You Rather

### 🔍 Error Code Detection
- **351+ Console Error Codes** - PS1, PS2, PS3, PS4, PS5, PSP, PS Vita
- **Auto-Detection** - Instant explanations when codes are mentioned
- **Custom Firmware Codes** - Homebrew-specific error codes

### 💰 SellHub Integration
- **Webhook Support** - Automatic role assignment on purchase
- **Pending Purchases** - Store purchases for users not yet in server
- **Purchase Logging** - Track all transactions
- **DM Notifications** - Confirm purchases to buyers

### 🌐 Multi-Language Support
English, Spanish, French, German, Portuguese, Japanese

### 📺 YouTube Notifications
- **Channel Monitoring** - RSS feed integration
- **Custom Messages** - Branded notifications
- **Configurable Intervals** - Adjust check frequency

### 📝 Other Features
- **Webhooks & Custom Embeds** - Professional announcements
- **Server Stats** - Live member counts
- **Welcome/Leave Messages** - Customizable greetings
- **Auto-Nickname** - Prefix/suffix automation
- **Comprehensive Logging** - Track all server activity

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- DeepSeek API Key (optional - [DeepSeek Platform](https://platform.deepseek.com/))
- ChatGPT API Key (optional - [OpenAI Platform](https://platform.openai.com/))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Slxcky-1/PSHomebrew-beta.git
cd PSHomebrew-beta
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure the bot**
```bash
cp config.example.json config.json
# Edit config.json with your credentials
```

4. **Deploy slash commands**
```bash
node deploy-commands.js
```

5. **Start the bot**
```bash
npm start
```

## ⚙️ Configuration

### Basic Config (`config.json`)
```json
{
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "clientId": "YOUR_APPLICATION_CLIENT_ID",
  "botOwnerId": "YOUR_DISCORD_USER_ID",
  "deepseekApiKey": "YOUR_DEEPSEEK_API_KEY_OPTIONAL",
  "openaiApiKey": "YOUR_OPENAI_API_KEY_OPTIONAL"
}
```

### SellHub Integration (Optional)
```json
{
  "sellhubGuildId": "YOUR_GUILD_ID",
  "sellhubRoleId": "ROLE_TO_GIVE_BUYERS",
  "sellhubLogChannelId": "LOG_CHANNEL_ID",
  "sellhubWebhookSecret": "YOUR_WEBHOOK_SECRET"
}
```

### Environment Variables (Optional)
Create a `.env` file:
```env
CONFIG_ENCRYPTION_KEY=your_encryption_key
RESTART_TIMEZONE=America/New_York
WEBHOOK_PORT=3000
```

## 📦 Commands Overview

### Information
- `/help` - Show all commands
- `/ping` - Check bot latency
- `/features` - View feature list

### Leveling
- `/level` - Check your level
- `/rank` - Your rank position
- `/leaderboard` - Top 10 users

### Admin Only
- `/toggle` - Enable/disable features
- `/viewsettings` - View server settings
- `/setxp` - Configure XP range
- `/ticket` - Setup ticket system
- `/moderator` - Moderation commands
- `/webhook` - Create custom embeds
- `/botcustom` - Customize bot appearance

### Bot Owner Only
- `/poweroptions` - Update, restart, or shutdown bot
- `/aistats` - View AI token usage

## 🎨 Low-End PC Mode

For servers running on limited resources:
```bash
npm run start:lowend
```
This limits memory to 512MB and enables garbage collection.

## 🔄 Auto-Updates

The bot includes a built-in update system:
1. Run `/poweroptions` (bot owner only)
2. Click "Update & Restart"
3. Bot pulls latest code from GitHub and restarts automatically

## 📚 Documentation

- **[Full Documentation](docs/DOCUMENTATION.md)** - Complete feature guide
- **[Linux Installation](linux-installation/LINUX_INSTALLATION.md)** - Arch & Ubuntu setup
- **[Auto Deploy Setup](docs/AUTO_DEPLOY_SETUP.md)** - PM2 and systemd configuration
- **[Code Obfuscation](docs/OBFUSCATION.md)** - Protect your code

## 🔧 Performance Features

- **Memory Cleanup** - Automatic garbage collection every 10 minutes
- **Message Compression** - 40-60% storage savings
- **Response Caching** - Reduced API calls
- **Debounced Saves** - Optimized file writes
- **Discord Cache Limits** - Memory-efficient settings

## 🛡️ Security

- Encrypted configuration support
- Webhook signature verification
- Admin permission checks
- Bot owner-only commands
- Jailbreak attempt detection
- Raid protection system

## 🌟 Support

For issues, feature requests, or questions:
- **GitHub Issues**: [Report a bug](https://github.com/Slxcky-1/PSHomebrew-beta/issues)
- **Discord**: Join our support server (link in bot status)

## 📄 License

This project is unlicensed and private. All rights reserved.

## 🙏 Credits

Built with:
- [Discord.js](https://discord.js.org/) - Discord API library
- [DeepSeek AI](https://www.deepseek.com/) - AI integration
- [OpenAI](https://openai.com/) - ChatGPT integration
- [Discord-Gamecord](https://github.com/Gamecord/discord-gamecord) - Game commands
- [Express.js](https://expressjs.com/) - Webhook server

---

Made with ❤️ by Slxcky-1 for the PlayStation Homebrew community
