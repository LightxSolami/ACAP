# API Error Fix Guide

## Issue: "API Error: Failed to fetch"

This happens when the Groq API request fails. Here's how to diagnose and fix:

## Step 1: Verify Your Groq API Keys

Your current keys in `.env` look suspicious (they appear to be test/placeholder keys).

**Get real Groq API keys:**
1. Go to: https://console.groq.com
2. Sign up or log in
3. Create an API key
4. Copy it and paste into `.env`:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY2=gsk_yyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

## Step 2: Test Your Setup

Start your server first:
```bash
npm start
```

Then test your API keys using the new test endpoint:

```bash
# Test Groq API keys
curl -X POST http://localhost:3000/test/groq-keys

# Test Binance connection  
curl -X POST http://localhost:3000/test/binance

# Test full analysis flow
curl -X POST http://localhost:3000/test/full-analysis \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","question":"Is BTC bullish?"}'
```

## Step 3: Check Logs

Look for errors in the server logs. The test endpoint will show:
- ✓ VALID if the API key works
- ✗ INVALID if there's an auth issue
- ERROR if there's a network issue

## Common Issues & Fixes

### "INVALID ✗" - Auth Error
- Your Groq API key is wrong/expired
- **Fix**: Get a new key from https://console.groq.com

### "ERROR" - Network Issue
- Can't reach Groq servers or Binance API
- **Fix**: Check your internet connection, try `ping api.groq.com`

### "Request timeout"
- Binance API is slow or not responding
- **Fix**: Try again, or increase timeout in `src/services/binance.js` (currently 15s)

## Step 4: Verify in UI

1. Open http://localhost:3000
2. Type your question: "Is BTC bullish?"
3. If it works: You'll see an analysis ✓
4. If it fails: You'll see a detailed error message

## Need Help?

Check these files for detailed logs:
- Server console output
- Browser console (F12 → Console tab)

The error messages now include:
- What went wrong
- Why it happened  
- Where to get help
