# TradingView Claude AI Trading Assistant

A production-ready system that connects TradingView alerts to Claude AI for automated trading decisions, with optional execution via Binance API.

## Features

- ✅ TradingView webhook ingestion
- ✅ MCP-compatible API endpoints
- ✅ Claude AI decision engine
- ✅ Binance API trade execution
- ✅ Telegram notifications (optional)
- ✅ Comprehensive logging
- ✅ Input validation and security
- ✅ In-memory queue system
- ✅ Error handling and retries

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Run the server:**
   ```bash
   npm start
   # Or for development:
   npm run dev
   ```

## Configuration

### Required Environment Variables

```env
WEBHOOK_SECRET=your_webhook_secret_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_API_SECRET=your_binance_api_secret_here
API_KEY=your_api_key_for_protection_here
```

### Optional Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
MAX_TRADE_SIZE=0.001
PORT=3000
```

## API Endpoints

### Webhook

- `POST /webhook/tradingview` - Receive TradingView alerts

### MCP Tools

All MCP endpoints require `x-api-key` header with your API_KEY.

- `GET /mcp/get-signal` - Get latest signal
- `POST /mcp/analyze` - Analyze signal with Claude
- `POST /mcp/send-order` - Execute trade
- `POST /mcp/log` - Manual logging
- `POST /mcp/auto-trade` - Full automation (analyze + execute)
- `GET /mcp/market-data/:symbol?` - Get real-time market data
- `POST /mcp/ask-claude` - Ask Claude questions about market with live data

## TradingView Setup

1. Create a new alert in TradingView
2. Set Webhook URL: `https://your-domain.com/webhook/tradingview?secret=YOUR_WEBHOOK_SECRET`
3. Set Message format to JSON:

```json
{
  "symbol": "{{ticker}}",
  "price": {{close}},
  "signal": "{{strategy.order.action}}",
  "rsi": {{rsi}},
  "timeframe": "{{interval}}"
}
```

4. Add header: `x-webhook-secret: YOUR_WEBHOOK_SECRET`

## 🤖 Real-Time Market Analysis

Ask Claude questions about live market data:

```bash
# Get current market data
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3000/mcp/market-data/BTCUSDT

# Ask Claude about market conditions
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the current market sentiment?", "symbol":"BTCUSDT"}' \
  http://localhost:3000/mcp/ask-claude
```

Claude now has access to:
- Real-time price and 24h statistics
- Order book (top bids/asks)
- Recent trades
- Price chart data (last 10 hours)
- Technical analysis

## Usage Examples

### Manual Flow

1. TradingView sends signal → stored in memory
2. Call `/mcp/get-signal` to get latest signal
3. Call `/mcp/analyze` to get AI decision
4. Call `/mcp/send-order` to execute trade

### Automated Flow

Use `/mcp/auto-trade` to automatically analyze and execute trades based on signals.

### Using with curl

```bash
# Get signal
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3000/mcp/get-signal

# Analyze
curl -X POST -H "x-api-key: YOUR_API_KEY" http://localhost:3000/mcp/analyze

# Send order
curl -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","side":"BUY","quantity":0.001}' \
  http://localhost:3000/mcp/send-order

# Auto trade
curl -X POST -H "x-api-key: YOUR_API_KEY" http://localhost:3000/mcp/auto-trade
```

## Security

- Webhook endpoints validate secret keys
- MCP endpoints require API key authentication
- Input validation on all payloads
- No secrets exposed in logs

## Logging

All activities are logged to `logs/trading.log` and console:

- Incoming signals
- AI decisions
- Executed trades
- Errors

## Architecture

```
TradingView → Webhook → Signal Store → Claude AI → Decision → Binance API → Trade
                    ↓
               Telegram Notifications
```

## Project Structure

```
src/
├── routes/
│   ├── webhook.js
│   └── mcp.js
├── services/
│   ├── claude.js
│   ├── binance.js
│   ├── telegram.js
│   ├── logger.js
│   └── signalStore.js
└── utils/
    └── validate.js
```

## Risk Management

- Maximum trade size configurable
- Only executes BUY/SELL, skips on SKIP
- Comprehensive error handling
- Queue system prevents concurrent executions

## Dependencies

- express: Web server
- @anthropic-ai/sdk: Claude AI integration
- axios: HTTP requests
- node-telegram-bot-api: Telegram notifications
- dotenv: Environment configuration

## License

ISC