#!/bin/bash

# Simple test script for the trading system

echo "🚀 Testing TradingView Claude Trader..."

# Check if server is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Server is running"
else
    echo "❌ Server not running. Start with: npm start"
    exit 1
fi

# Test webhook with sample data
echo "📡 Testing webhook..."
RESPONSE=$(curl -s -X POST http://localhost:3000/webhook/tradingview?secret=test123 \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: test123" \
  -d '{"symbol":"BTCUSDT","price":65000,"signal":"buy","rsi":28,"timeframe":"5m"}')

if echo "$RESPONSE" | grep -q "Signal received"; then
    echo "✅ Webhook working"
else
    echo "❌ Webhook failed: $RESPONSE"
fi

# Test MCP endpoint
echo "🤖 Testing AI analysis..."
ANALYSIS=$(curl -s -H "x-api-key: test123" http://localhost:3000/mcp/analyze)

if echo "$ANALYSIS" | grep -q "decision"; then
    echo "✅ AI analysis working"
else
    echo "❌ AI analysis failed (check API keys): $ANALYSIS"
fi

echo "🎯 Test complete! Check logs/trading.log for details"