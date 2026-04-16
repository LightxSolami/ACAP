#!/bin/bash

echo "🔥 Testing Real-Time Market Analysis..."

# Test market data endpoint
echo "📊 Getting market data..."
curl -s -H "x-api-key: test123" http://localhost:3000/mcp/market-data/BTCUSDT | head -20

echo -e "\n\n🤖 Asking Claude about market..."
# Test Claude analysis
curl -s -X POST -H "x-api-key: test123" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the current market sentiment for BTC? Should I buy now?"}' \
  http://localhost:3000/mcp/ask-claude | jq '.analysis' 2>/dev/null || echo "Install jq to format JSON, or remove '| jq' to see raw output"

echo -e "\n✅ Test complete! Claude now has real-time market data."