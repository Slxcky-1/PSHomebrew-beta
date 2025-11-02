# eBay Webhook Setup Guide

## Prerequisites
1. eBay Developer Account (free)
2. eBay Application with Production Keys
3. Your bot server must be publicly accessible with a domain or IP
4. eBay Access Token for Inventory Mapping API

---

## Part 1: Sale Notifications (Trading API)

### Step 1: Create eBay Developer Account
1. Go to https://developer.ebay.com/
2. Click "Register" and create an account
3. Verify your email

### Step 2: Create an eBay Application
1. Go to https://developer.ebay.com/my/keys
2. Click "Create Application Key Set"
3. Fill in application details:
   - Application Title: "Discord Bot Notifications"
   - Application Description: "Receives sale notifications"
4. Save your App ID (Client ID) and Cert ID (Client Secret)

### Step 3: Enable Platform Notifications
1. In your application settings, find "Platform Notifications"
2. Click "Configure Platform Notifications"
3. Set notification delivery to "HTTP/HTTPS"
4. Enter your webhook URL: `http://YOUR_SERVER_IP:3000/ebay-webhook`
   - Replace YOUR_SERVER_IP with your actual server IP or domain
   - If using HTTPS (recommended): `https://yourdomain.com:3000/ebay-webhook`

### Step 4: Subscribe to Notifications
Subscribe to these notification types:
- **ItemSold** - When an item sells
- **AuctionCheckoutComplete** - When auction payment completes
- **FixedPriceTransaction** - For Buy It Now sales

---

## Part 2: Inventory Mapping API (AI-Powered Listing Creation)

### Step 1: Get OAuth Access Token
1. Go to https://developer.ebay.com/my/auth
2. Select your application
3. Generate User Token (OAuth 2.0)
4. Scopes needed:
   - `https://api.ebay.com/oauth/api_scope/sell.inventory`
   - `https://api.ebay.com/oauth/api_scope/sell.inventory.readonly`
5. Save your access token

### Step 2: Enable Inventory Mapping API
1. Go to https://developer.ebay.com/my/graphql_explorer
2. Test API access with your token
3. Note: Currently US marketplace only (`EBAY_US`)

### Step 3: Subscribe to Listing Preview Notifications
1. In Platform Notifications, subscribe to:
   - **LISTING_PREVIEW_CREATION_TASK_STATUS** - When AI listing preview completes
2. Set notification URL: `http://YOUR_SERVER_IP:3000/ebay-listing-notification`

---

## Configuration

Add to your `config.json`:
```json
{
  "token": "your-bot-token",
  "clientId": "your-client-id",
  "botOwnerId": "your-user-id",
  "sellixNotificationChannel": "channel-id-for-sellix",
  "ebayNotificationChannel": "channel-id-for-ebay",
  "ebayAccessToken": "your-ebay-oauth-token"
}
```

If you want eBay and Sellix notifications in the same channel, you can use the same channel ID or omit `ebayNotificationChannel` (it will use Sellix channel as fallback).

---

## API Endpoints

### 1. Sale Notifications
- **URL**: `POST /ebay-webhook`
- **Purpose**: Receives item sold notifications
- **Notification Types**: ItemSold, marketplace.order.completed

### 2. Create Listing Preview (AI-Powered)
- **URL**: `POST /ebay-create-listing-preview`
- **Purpose**: Create AI-powered listing with eBay recommendations
- **Request Body**:
```json
{
  "productTitle": "PlayStation 5 Console",
  "productDescription": "Brand new PS5 disc edition",
  "photos": ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
  "aspects": {
    "Brand": "Sony",
    "Model": "PS5",
    "Condition": "New"
  },
  "productIdentifiers": {
    "UPC": "711719541509"
  },
  "mappingReferenceID": "custom-ref-12345"
}
```
- **Response**: Returns task ID for tracking

### 3. Query Listing Task Status
- **URL**: `GET /ebay-listing-task/:taskId`
- **Purpose**: Check if listing preview is ready
- **Example**: `GET /ebay-listing-task/abc123xyz`
- **Response**: Task status, AI recommendations (category, aspects, description)

### 4. Listing Preview Notifications
- **URL**: `POST /ebay-listing-notification`
- **Purpose**: Receives status updates when listing previews complete
- **Notification Type**: LISTING_PREVIEW_CREATION_TASK_STATUS

---

## Usage Examples

### Create Listing Preview via cURL:
```bash
curl -X POST http://YOUR_SERVER_IP:3000/ebay-create-listing-preview \
  -H "Content-Type: application/json" \
  -d '{
    "productTitle": "PlayStation 5 Console",
    "photos": ["https://example.com/ps5.jpg"],
    "productIdentifiers": {
      "UPC": "711719541509"
    }
  }'
```

### Check Task Status:
```bash
curl http://YOUR_SERVER_IP:3000/ebay-listing-task/your-task-id
```

---

## Verify Setup
1. Restart your bot (use `/poweroptions` → Update & Restart)
2. **Test Sale Notifications**: Make a test sale on eBay
3. **Test Listing API**: Send POST request to `/ebay-create-listing-preview`
4. Check your Discord channel for notifications

---

## Webhook URLs
- **Sellix**: `http://YOUR_SERVER_IP:3000/sellix-webhook`
- **eBay Sale Notifications**: `http://YOUR_SERVER_IP:3000/ebay-webhook`
- **eBay Create Listing**: `http://YOUR_SERVER_IP:3000/ebay-create-listing-preview`
- **eBay Task Query**: `http://YOUR_SERVER_IP:3000/ebay-listing-task/:taskId`
- **eBay Listing Notifications**: `http://YOUR_SERVER_IP:3000/ebay-listing-notification`

---

## Troubleshooting
- **No notifications?** Check eBay Developer Dashboard → Notifications → Delivery Status
- **401 Unauthorized?** Refresh your OAuth access token (expires after ~2 hours)
- **403/404 errors?** Ensure your firewall allows port 3000
- **Need HTTPS?** Use nginx reverse proxy or Cloudflare Tunnel
- **Check logs:** Bot console will show webhook activity
- **GraphQL errors?** Verify your access token has correct scopes

---

## Security Notes
- For production, use HTTPS (SSL certificate)
- Consider adding webhook signature verification
- Keep your eBay App ID, Cert ID, and Access Token secret
- Never commit credentials to GitHub
- Refresh OAuth tokens regularly (they expire)

---

## eBay Testing
- **Sale Notifications**: eBay provides "Send Test Notification" button
- **Inventory Mapping API**: Use GraphQL Explorer at https://developer.ebay.com/my/graphql_explorer
- **Test Marketplace**: US only (EBAY_US) currently supported
