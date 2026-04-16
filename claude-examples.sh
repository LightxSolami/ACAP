#!/bin/bash

echo "💬 CLAUDE MARKET Q&A EXAMPLES"
echo "=============================="
echo ""
echo "📝 Ready to ask Claude? Here are examples:"
echo ""

QUESTIONS=(
    "Should I buy BTC now?"
    "What's the current market sentiment?"
    "Analyze the order book - what does it tell us?"
    "What technical patterns do you see in the chart?"
    "How volatile is the market currently?"
)

for question in "${QUESTIONS[@]}"; do
    echo "🤖 Question: $question"
    echo "Command:"
    echo "curl -X POST -H \"x-api-key: test123\" \\"
    echo "  -H \"Content-Type: application/json\" \\"
    echo "  -d '{\"question\":\"$question\", \"symbol\":\"BTCUSDT\"}' \\"
    echo "  http://localhost:3000/mcp/ask-claude"
    echo ""
done

echo "🔑 IMPORTANT: Add your Claude API key to .env first!"
echo "Get it from: https://console.anthropic.com/"
echo ""
echo "Then restart server and try the commands above! 🚀"