# Auto-Deploy Setup Instructions

This guide will help you set up automatic deployment from GitHub to your Linux server whenever you push changes.

## Overview
When you push changes to GitHub from Windows, GitHub Actions will automatically:
1. Connect to your Linux server via SSH
2. Pull the latest changes
3. Restart the Discord bot service

## Setup Steps

### 1. Generate SSH Key on Your Linux Server

On your Linux machine, run:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy"
```

Press Enter to save to the default location (`~/.ssh/id_ed25519`)
Press Enter twice to skip the passphrase (important for automation)

### 2. Add SSH Key to Authorized Keys

```bash
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. Get Your Private Key

```bash
cat ~/.ssh/id_ed25519
```

Copy the ENTIRE output (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`)

### 4. Set Up GitHub Secrets

Go to your GitHub repository:
1. Click **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**

Add these three secrets:

**SSH_PRIVATE_KEY**
- Paste the entire private key you copied from step 3

**SERVER_HOST**
- Your Linux server's IP address or hostname
- Example: `192.168.1.100` or `myserver.com`

**SERVER_USER**
- Your Linux username: `elontusk`

### 5. Allow Sudo Without Password (for restarting service)

On your Linux machine, run:
```bash
sudo visudo
```

Add this line at the bottom (replace `elontusk` with your username if different):
```
elontusk ALL=(ALL) NOPASSWD: /bin/systemctl restart discord-bot, /bin/systemctl status discord-bot
```

Save and exit (Ctrl+X, then Y, then Enter)

### 6. Test the Setup

From Windows, make a small change and push:
```powershell
git add .
git commit -m "Test auto-deploy"
git push
```

Go to your GitHub repository → **Actions** tab to see the deployment running!

## How to Use

From now on, whenever you push to the `main` branch:
```powershell
git add .
git commit -m "your changes"
git push
```

GitHub Actions will automatically deploy to your Linux server! 🎉

## Manual Update (Alternative)

If you prefer to update manually on Linux, use the provided script:
```bash
chmod +x /home/elontusk/Desktop/PSHomebrew-beta-main/linux-installation/update-bot.sh
/home/elontusk/Desktop/PSHomebrew-beta-main/linux-installation/update-bot.sh
```

## Troubleshooting

### Deployment fails with "Permission denied"
- Check that your SSH key is correctly added to GitHub Secrets
- Ensure the key doesn't have a passphrase

### "sudo: no tty present" error
- Make sure you added the sudoers entry in step 5

### Can't connect to server
- Verify `SERVER_HOST` is correct
- Ensure SSH is enabled on your Linux server: `sudo systemctl status ssh`
- Check firewall allows SSH (port 22)

### Check deployment logs
Go to your GitHub repository → **Actions** tab to see detailed logs
