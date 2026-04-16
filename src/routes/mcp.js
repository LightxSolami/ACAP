const express = require('express');
const router = express.Router();
const { validateOrderPayload } = require('../utils/validate');
const signalStore = require('../services/signalStore');
const claude = require('../services/claude');
const binance = require('../services/binance');
const telegram = require('../services/telegram');
const marketAnalysis = require('../services/marketAnalysis');
const logger = require('../services/logger');

// Simple in-memory queue for processing (bonus)
let processingQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || processingQueue.length === 0) return;

  isProcessing = true;
  const task = processingQueue.shift();

  try {
    await task();
  } catch (error) {
    logger.error('Queue processing error', { error: error.message });
  } finally {
    isProcessing = false;
    // Process next if any
    setImmediate(processQueue);
  }
}

router.get('/get-signal', (req, res) => {
  const signal = signalStore.getLatestSignal();
  if (!signal) {
    return res.status(404).json({ error: 'No signal available' });
  }
  res.json(signal);
});

// Get real-time market data
router.get('/market-data/:symbol?', async (req, res) => {
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

// Get signals with chart data for visualization
router.get('/signals-chart/:symbol?', async (req, res) => {
  try {
    const symbol = (req.params.symbol || 'BTCUSDT').toUpperCase();
    const limit = parseInt(req.query.limit) || 20;

    // Get market data for context
    const marketData = await binance.getMarketData(symbol, '1h');
    
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
      marketData,
      signals: signals.slice(0, 5), // Last 5 signals
      allSignals: limit,
      markers,
      stats,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Signals chart error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch signals chart' });
  }
});

// Get signal history
router.get('/signals-history/:symbol?', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch signal history' });
  }
});

// Get signal statistics
router.get('/signals-stats', (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch signal stats' });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const signal = signalStore.getLatestSignal();
    if (!signal) {
      return res.status(404).json({ error: 'No signal to analyze' });
    }

    const decision = await claude.analyzeSignal(signal);
    telegram.notifyDecision(signal, decision);

    res.json({ decision });
  } catch (error) {
    logger.error('Analyze error', { error: error.message });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

router.post('/send-order', async (req, res) => {
  try {
    const { symbol, side, quantity } = validateOrderPayload(req.body);

    // Enqueue for processing (bonus: queue system)
    const task = async () => {
      const result = await binance.placeMarketOrder(symbol, side, quantity);
      telegram.notifyTrade({ symbol, side, quantity, orderId: result.orderId });
      return result;
    };

    processingQueue.push(task);
    processQueue();

    res.json({ status: 'Order queued for processing' });
  } catch (error) {
    logger.error('Send order error', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

router.post('/log', (req, res) => {
  const { message, data } = req.body;
  logger.info('Manual log', { message, data });
  res.json({ status: 'Logged' });
});

// Ask Claude about market with real-time data
router.post('/ask-claude', async (req, res) => {
  try {
    const { question, symbol = 'BTCUSDT' } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    logger.info('Ask Claude request', { question, symbol });

    try {
      const result = await marketAnalysis.askClaudeAboutMarket(question, symbol.toUpperCase());
      res.json(result);
    } catch (innerError) {
      // Enhanced error handling
      logger.error('Market analysis failed', { 
        question, 
        symbol, 
        error: innerError.message,
        errorType: innerError.constructor.name
      });

      // Provide more specific error messages
      let errorMessage = innerError.message;
      if (innerError.message.includes('Groq API failed with all')) {
        errorMessage = 'Groq API keys failed. Check your API keys at /test/groq-keys';
      } else if (innerError.message.includes('timeout')) {
        errorMessage = 'Request timeout - Binance API may be slow. Try again.';
      } else if (innerError.message.includes('No API')) {
        errorMessage = 'No API keys configured. Check your .env file.';
      }

      res.status(500).json({ 
        error: 'Analysis failed',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? innerError.message : undefined,
        testEndpoint: 'POST /test/groq-keys to verify API keys'
      });
    }
  } catch (error) {
    logger.error('Ask Claude error', { error: error.message });
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

// Combined endpoint for full automation
router.post('/auto-trade', async (req, res) => {
  try {
    // Get signal
    const signal = signalStore.getLatestSignal();
    if (!signal) {
      return res.status(404).json({ error: 'No signal available' });
    }

    // Analyze
    const decision = await claude.analyzeSignal(signal);
    telegram.notifyDecision(signal, decision);

    // Execute if not SKIP
    if (decision !== 'SKIP') {
      const quantity = parseFloat(process.env.MAX_TRADE_SIZE) || 0.001;
      const task = async () => {
        const result = await binance.placeMarketOrder(signal.symbol, decision, quantity);
        telegram.notifyTrade({ symbol: signal.symbol, side: decision, quantity, orderId: result.orderId });
        return result;
      };

      processingQueue.push(task);
      processQueue();
    }

    res.json({ signal, decision, traded: decision !== 'SKIP' });
  } catch (error) {
    logger.error('Auto trade error', { error: error.message });
    res.status(500).json({ error: 'Auto trade failed' });
  }
});

module.exports = router;