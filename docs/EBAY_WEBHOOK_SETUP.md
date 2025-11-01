# eBay Webhook Setup Guide

## Prerequisites
1. eBay Developer Account (free)
2. eBay Application with Production Keys
3. Your bot server must be publicly accessible with a domain or IP

## Step 1: Create eBay Developer Account
1. Go to https://developer.ebay.com/
2. Click "Register" and create an account
3. Verify your email

## Step 2: Create an eBay Application
1. Go to https://developer.ebay.com/my/keys
2. Click "Create Application Key Set"
3. Fill in application details:
   - Application Title: "Discord Bot Notifications"
   - Application Description: "Receives sale notifications"
4. Save your App ID (Client ID) and Cert ID (Client Secret)

## Step 3: Enable Platform Notifications
1. In your application settings, find "Platform Notifications"
2. Click "Configure Platform Notifications"
3. Set notification delivery to "HTTP/HTTPS"
4. Enter your webhook URL: `http://YOUR_SERVER_IP:3000/ebay-webhook`
   - Replace YOUR_SERVER_IP with your actual server IP or domain
   - If using HTTPS (recommended): `https://yourdomain.com:3000/ebay-webhook`

## Step 4: Subscribe to Notifications
Subscribe to these notification types:
- **ItemSold** - When an item sells
- **AuctionCheckoutComplete** - When auction payment completes
- **FixedPriceTransaction** - For Buy It Now sales

## Step 5: Configure Bot
Add to your `config.json`:
```json
{
  "token": "your-bot-token",
  "clientId": "your-client-id",
  "botOwnerId": "your-user-id",
  "sellixNotificationChannel": "channel-id-for-sellix",
  "ebayNotificationChannel": "channel-id-for-ebay"
}
```

If you want eBay and Sellix notifications in the same channel, you can use the same channel ID or omit `ebayNotificationChannel` (it will use Sellix channel as fallback).

## Step 6: Verify Setup
1. Restart your bot (use `/poweroptions` → Update & Restart)
2. Make a test sale on eBay
3. Check your Discord channel for the notification

## Webhook URLs
- Sellix: `http://YOUR_SERVER_IP:3000/sellix-webhook`
- eBay: `http://YOUR_SERVER_IP:3000/ebay-webhook`

## Troubleshooting
- **No notifications?** Check eBay Developer Dashboard → Notifications → Delivery Status
- **403/404 errors?** Ensure your firewall allows port 3000
- **Need HTTPS?** Use nginx reverse proxy or Cloudflare Tunnel
- **Check logs:** Bot console will show webhook activity

## Security Notes
- For production, use HTTPS (SSL certificate)
- Consider adding webhook signature verification
- Keep your eBay App ID and Cert ID secret
- Never commit credentials to GitHub

## eBay Notification Testing
eBay provides a "Send Test Notification" button in Platform Notifications settings. Use this to test without making real sales.
