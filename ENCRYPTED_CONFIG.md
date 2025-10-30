# Encrypted Configuration System

## 🔐 Overview
Your bot credentials (token, API keys) are now encrypted and stored in `.secure-config` using AES-256-GCM encryption with password "Savannah23".

## 📁 Files
- `.secure-config` - Encrypted credentials (safe to commit to GitHub)
- `config.json` - Local unencrypted config (gitignored, stays on your PC)
- `encrypt-config.js` - Encryption/decryption tool

## 🚀 How It Works

### On This PC (Windows)
1. You have `config.json` locally
2. Bot loads from `config.json` directly
3. When you run `/update`, it backs up your local files before updating

### On SSH Server (Linux)
1. Has `.secure-config` (encrypted) from GitHub
2. Bot automatically decrypts it on startup
3. No need to manually create config.json

## 🛠️ Commands

### Encrypt config.json
```bash
node encrypt-config.js encrypt
```
Creates `.secure-config` from your `config.json`

### Decrypt .secure-config
```bash
node encrypt-config.js decrypt
```
Creates `config.json` from `.secure-config`

## 🔄 Update Process

### This PC (Windows)
```
/update → Backs up config.json → Pulls latest code → Restores config.json
```
Your local credentials are never overwritten!

### SSH Server (Linux)
```
git pull → Bot reads .secure-config → Auto-decrypts on startup
```

## 🔒 Security Features

1. **AES-256-GCM Encryption** - Military-grade encryption
2. **Password Protected** - Requires "Savannah23" to decrypt
3. **Authentication Tag** - Prevents tampering
4. **Safe for GitHub** - Encrypted data can be publicly committed
5. **Auto-Backup** - `/update` backs up local files before overwriting

## 📝 What's Protected

```json
{
  "token": "YOUR_BOT_TOKEN",
  "clientId": "YOUR_CLIENT_ID",
  "deepseekApiKey": "YOUR_API_KEY",
  "botOwnerId": "YOUR_USER_ID"
}
```

All credentials are encrypted in `.secure-config` and safe to push to GitHub!

## ⚠️ Important Notes

- **This PC**: Keeps using `config.json` (unencrypted, local only)
- **SSH Server**: Uses `.secure-config` (encrypted, from GitHub)
- **Password**: Hardcoded as "Savannah23" in bot code
- **GitHub**: `.secure-config` is committed, `config.json` is gitignored

## 🔄 Updating Credentials

1. Edit `config.json` locally
2. Run `node encrypt-config.js encrypt`
3. Commit and push `.secure-config`
4. SSH server gets new encrypted config on next `git pull`

Done! 🎉
