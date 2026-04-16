const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

// Test Groq API keys directly
router.post('/groq-keys', async (req, res) => {
  try {
    const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY2].filter(Boolean);
    
    if (keys.length === 0) {
      return res.json({ 
        status: 'error',
        message: 'No Groq API keys configured',
        details: 'Set GROQ_API_KEY and/or GROQ_API_KEY2 in .env'
      });
    }

    const results = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        logger.info(`Testing Groq API key ${i + 1}...`);
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Say WORKING' }],
            max_tokens: 10,
            temperature: 0.0,
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          results.push({
            keyNumber: i + 1,
            keyPreview: `${key.substring(0, 10)}...${key.substring(key.length - 4)}`,
            status: 'VALID ✓',
            response: data.choices[0]?.message?.content?.trim() || 'No content'
          });
        } else {
          results.push({
            keyNumber: i + 1,
            keyPreview: `${key.substring(0, 10)}...${key.substring(key.length - 4)}`,
            status: 'INVALID ✗',
            error: `${response.status} ${response.statusText}`,
            details: data.error?.message || 'Unknown error'
          });
        }
      } catch (error) {
        results.push({
          keyNumber: i + 1,
          status: 'ERROR',
          error: error.message
        });
      }
    }

    res.json({
      status: 'completed',
      testedKeys: keys.length,
      results,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Groq key test error', { error: error.message });
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

// Test Binance connection
router.post('/binance', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: { symbol: 'BTCUSDT' },
      timeout: 5000
    });

    res.json({
      status: 'VALID ✓',
      btcPrice: response.data.price,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Binance test error', { error: error.message });
    res.status(500).json({
      status: 'INVALID ✗',
      error: error.message,
      hint: 'Check your internet connection and ensure Binance API is accessible'
    });
  }
});

// Test full market analysis flow
router.post('/full-analysis', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', question = 'Is the market bullish or bearish?' } = req.body;
    const marketAnalysis = require('../services/marketAnalysis');
    
    logger.info('Starting full analysis test', { symbol, question });

    const result = await marketAnalysis.askClaudeAboutMarket(question, symbol);
    
    res.json({
      status: 'SUCCESS ✓',
      result,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Full analysis test error', { error: error.message, stack: error.stack });
    res.status(500).json({
      status: 'ERROR ✗',
      error: error.message,
      type: error.constructor.name,
      hint: 'Check logs for detailed error information'
    });
  }
});

module.exports = router;
