#!/bin/bash

echo "🚀 Claude Market Analysis Demo"
echo "================================"

echo "1️⃣ Getting live market data..."
curl -s -H "x-api-key: test123" http://localhost:3000/mcp/market-data/BTCUSDT | jq '.currentPrice, .stats' 2>/dev/null || echo "Raw output (install jq for pretty formatting)"

echo -e "\n\n2️⃣ Asking Claude: 'Should I buy BTC now?'"
curl -s -X POST -H "x-api-key: test123" \
  -H "Content-Type: application/json" \
  -d '{"question":"Should I buy BTC now? Analyze the current market conditions.", "symbol":"BTCUSDT"}' \
  http://localhost:3000/mcp/ask-claude | jq '.analysis' 2>/dev/null || echo "Raw Claude response"

echo -e "\n\n3️⃣ Asking Claude: 'What does the order book tell us?'"
curl -s -X POST -H "x-api-key: test123" \
  -H "Content-Type: application/json" \
  -d '{"question":"Analyze the current order book. What does it indicate about market sentiment?", "symbol":"BTCUSDT"}' \
  http://localhost:3000/mcp/ask-claude | jq '.analysis' 2>/dev/null || echo "Raw Claude response"

echo -e "\n✅ Demo complete! Claude now analyzes real-time market data."