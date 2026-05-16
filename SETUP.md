# Vintage Bud Threads — Platform Setup Guide

## Overview

This platform consists of:
- **Frontend**: Next.js 15 app (deploy to Vercel)
- **Backend**: FastAPI + Claude AI agents (deploy to Railway or Render)

---

## 1. Anthropic API Key (Required)

The AI content generation, trend research, and influencer discovery all run on Claude.

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-`)
5. Set it as `ANTHROPIC_API_KEY` in your backend environment

---

## 2. Meta (Instagram + Facebook)

Instagram Business and Facebook Pages use the same Meta Graph API credentials.

### Prerequisites
- Facebook Business account
- Instagram Business or Creator account connected to a Facebook Page
- Your Facebook Page must be an **Admin**

### Setup Steps

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Choose **Business** app type
3. Add products: **Instagram Graph API** and **Facebook Login**
4. Under **App Settings → Basic**:
   - Copy `App ID` → `META_APP_ID`
   - Copy `App Secret` → `META_APP_SECRET`

#### Get a Long-Lived User Access Token
1. Use the [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app, grant permissions:
   - `instagram_basic`, `instagram_content_publish`
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
3. Generate a short-lived token, then exchange for a long-lived token (60-day):
   ```
   GET https://graph.facebook.com/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_LIVED_TOKEN}
   ```
4. Copy the result → `META_ACCESS_TOKEN`

#### Get Account IDs
```bash
# Get Facebook Page ID
GET https://graph.facebook.com/me/accounts?access_token={TOKEN}

# Get Instagram Business Account ID
GET https://graph.facebook.com/{PAGE_ID}?fields=instagram_business_account&access_token={TOKEN}
```
- Set `META_FACEBOOK_PAGE_ID` and `META_INSTAGRAM_ACCOUNT_ID`

### Token Refresh
Long-lived tokens last 60 days. Set a reminder to refresh before expiry, or implement the token refresh endpoint.

---

## 3. TikTok

TikTok uses the Content Posting API v2 (for business accounts).

### Prerequisites
- TikTok Business Account
- Apply for API access at [developers.tiktok.com](https://developers.tiktok.com)

### Setup Steps

1. Go to [developers.tiktok.com](https://developers.tiktok.com) → **Manage Apps** → **Connect an App**
2. Create a new app, select **Content Posting API**
3. Under **App Info**:
   - Copy `Client Key` → `TIKTOK_CLIENT_KEY`
   - Copy `Client Secret` → `TIKTOK_CLIENT_SECRET`
4. Complete OAuth flow to get an access token:
   - Redirect URI: your backend's `/api/auth/tiktok/callback`
   - Scopes: `video.publish`, `video.upload`
5. Copy the resulting token → `TIKTOK_ACCESS_TOKEN`

### Notes
- TikTok access tokens expire; implement refresh token handling before production
- Video uploads require the video to be hosted at a public URL first

---

## 4. Shopify (Product Sync)

Used to pull your product catalog into the app.

### Setup Steps

1. In your Shopify Admin, go to **Apps** → **Develop Apps**
2. Create a private app or custom app
3. Under **Configuration**, grant Admin API scopes:
   - `read_products`, `read_product_listings`
4. Install the app and copy the **Admin API access token** → `SHOPIFY_ACCESS_TOKEN`
5. Your store domain (e.g., `vintagebudthreads.myshopify.com`) → `SHOPIFY_STORE_DOMAIN`

---

## 5. Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and fill in your API keys

uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install

cp .env.local.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

### Using Docker Compose (easiest)
```bash
# From the repo root
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

docker compose up
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 6. Production Deployment

### Backend → Railway

1. Create account at [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub Repo** → select this repo
3. Set **Root Directory** to `backend`
4. Railway auto-detects Python; add a `Procfile` if needed:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. Add all environment variables from `backend/.env.example` in Railway's **Variables** tab
6. Copy the deployed URL (e.g., `https://budthreads-api.railway.app`)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this repo
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Railway backend URL
4. Deploy

---

## 7. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI |
| `META_APP_ID` | Facebook App ID |
| `META_APP_SECRET` | Facebook App Secret |
| `META_ACCESS_TOKEN` | Long-lived Meta user access token |
| `META_INSTAGRAM_ACCOUNT_ID` | Instagram Business Account ID |
| `META_FACEBOOK_PAGE_ID` | Facebook Page ID |
| `TIKTOK_CLIENT_KEY` | TikTok app client key |
| `TIKTOK_CLIENT_SECRET` | TikTok app client secret |
| `TIKTOK_ACCESS_TOKEN` | TikTok access token |
| `SHOPIFY_STORE_DOMAIN` | e.g. `vintagebudthreads.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Shopify Admin API token |
| `DATABASE_URL` | SQLite for dev, PostgreSQL for prod |
| `FRONTEND_URL` | Frontend origin for CORS |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
