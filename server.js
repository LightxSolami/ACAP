require('dotenv').config();
const express = require('express');
const binance = require('./src/services/binance');
const signalStore = require('./src/services/signalStore');
const webhookRoutes = require('./src/routes/webhook');
const mcpRoutes = require('./src/routes/mcp');
const testRoutes = require('./src/routes/test');
const logger = require('./src/services/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS middleware for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API Key protection for MCP endpoints
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// ===== STATIC ROUTES (NO ASYNC OPERATIONS) =====
app.use('/webhook', webhookRoutes);
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Serve main GUI
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve signals chart page
app.get('/signals', (req, res) => {
  res.sendFile(__dirname + '/public/signals.html');
});

// ===== PUBLIC API ROUTES (NO AUTH REQUIRED) =====

// Get signals chart data
app.get('/api/signals-chart/:symbol?', async (req, res) => {
  try {
    const symbol = (req.params.symbol || 'BTCUSDT').toUpperCase();
    const limit = parseInt(req.query.limit) || 20;

    // Get market data for context
    const data = await binance.getMarketData(symbol, '1h');
    
    // Get signals for this symbol
    const signals = signalStore.getSignalsBySymbol(symbol, limit);
    
    // Get signal stats
    const stats = signalStore.getSignalStats();

    // Convert signals to chart markers
    const markers = signals.map(signal => ({
      time: Math.floor(new Date(signal.timestamp).getTime() / 1000),
      position: signal.signal.toUpperCase() === 'BUY' ? 'belowBar' : 'aboveBar',
      color: signal.signal.toUpperCase() === 'BUY' ? '#00ff88' : '#ff4444',
      shape: signal.signal.toUpperCase() === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: `${signal.signal.toUpperCase()} @${signal.price}`,
      id: signal.id
    }));

    res.json({
      symbol,
      marketData: data,
      signals: signals.slice(0, 5),
      allSignals: limit,
      markers,
      stats,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Signals chart error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get signal history
app.get('/api/signals-history/:symbol?', async (req, res) => {
  try {
    const symbol = req.params.symbol ? req.params.symbol.toUpperCase() : null;
    const limit = parseInt(req.query.limit) || 50;

    const signals = symbol 
      ? signalStore.getSignalsBySymbol(symbol, limit)
      : signalStore.getSignalHistory(limit);

    const stats = signalStore.getSignalStats();

    res.json({
      symbol: symbol || 'ALL',
      signals,
      total: signals.length,
      stats,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Signals history error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get signal statistics
app.get('/api/signals-stats', (req, res) => {
  try {
    const stats = signalStore.getSignalStats();
    const latestSignal = signalStore.getLatestSignal();
    
    res.json({
      stats,
      latestSignal,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Signals stats error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Public market data endpoint (no auth)
app.get('/api/market-data/:symbol?', async (req, res) => {
  try {
    const symbol = (req.params.symbol || 'BTCUSDT').toUpperCase();
    const interval = req.query.interval || '1h';
    const data = await binance.getMarketData(symbol, interval);
    res.json(data);
  } catch (error) {
    logger.error('Market data error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// ===== DEBUG/TEST ROUTES (NO AUTH) =====
app.use('/test', testRoutes);

// ===== PROTECTED API ROUTES (WITH AUTH) =====
app.use('/api', apiKeyAuth, mcpRoutes);
app.use('/mcp', apiKeyAuth, mcpRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});