# Vercel Deployment Guide

## Setup Instructions

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Click "Deploy"

### Step 3: Add Environment Variables
In Vercel Dashboard → Settings → Environment Variables, add:

```
GROQ_API_KEY=gsk_your_key_here
GROQ_API_KEY2=gsk_your_second_key_here
ANTHROPIC_API_KEY=sk_your_key_here (optional)
BINANCE_API_KEY=your_key_here (optional)
BINANCE_API_SECRET=your_secret_here (optional)
WEBHOOK_SECRET=test123
API_KEY=test123
NODE_ENV=production
```

### Step 4: Redeploy
After adding environment variables, redeploy:
- Dashboard → Deployments → Click latest → Click "Redeploy"

## What Changed for Vercel

1. **vercel.json** - Tells Vercel how to build and run your app
2. **.vercelignore** - Excludes unnecessary files from deployment
3. **server.js** - Modified to export the app and only listen locally
4. **package.json** - Already compatible (no changes needed)

## Testing Your Deployment

Once deployed, test the endpoints:

```bash
# Test server health
curl https://your-app.vercel.app/health

# Test Groq API keys
curl https://your-app.vercel.app/test/groq-keys

# Test market data
curl https://your-app.vercel.app/api/market-data/BTCUSDT

# Test AI analysis (requires API key)
curl -X POST https://your-app.vercel.app/mcp/ask-claude \
  -H "Content-Type: application/json" \
  -H "x-api-key: test123" \
  -d '{"question":"Is BTC bullish?","symbol":"BTCUSDT"}'
```

## Troubleshooting

### Still getting 500 error?
1. Check Vercel logs: Dashboard → Deployments → Click failed build → View logs
2. Make sure ALL environment variables are set
3. Verify GROQ_API_KEY is valid and not expired
4. Try redeploying: Deployments → Redeploy

### "Cannot find module" errors?
- Run `npm install` locally first
- Push node_modules to ensure dependencies are there
- Or add `npm install` to build command

### Port issues?
- Vercel assigns the PORT automatically
- Don't hardcode port 3000
- Check `.env` - PORT should be dynamic

## Production Tips

1. **Use environment variables** - Never hardcode API keys
2. **Monitor logs** - Check Vercel dashboard regularly
3. **Test locally first** - `npm start` before deploying
4. **Use node version** - Specify Node version in vercel.json if needed
5. **Cache dependencies** - Vercel caches by default, good for speed

## Rollback if needed
- Dashboard → Deployments → Click previous deployment → Click "Redeploy"
