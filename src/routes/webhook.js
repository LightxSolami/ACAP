const express = require('express');
const router = express.Router();
const { validateTradingViewPayload } = require('../utils/validate');
const signalStore = require('../services/signalStore');
const telegram = require('../services/telegram');
const logger = require('../services/logger');

// Simple webhook secret validation
function validateWebhookSecret(req) {
  const secret = req.headers['x-webhook-secret'] || req.query.secret;
  return secret === process.env.WEBHOOK_SECRET;
}

router.post('/tradingview', (req, res) => {
  try {
    // Validate webhook secret
    if (!validateWebhookSecret(req)) {
      logger.warn('Invalid webhook secret', { ip: req.ip });
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    // Validate payload
    const signal = validateTradingViewPayload(req.body);

    // Store signal (with enhanced storage that keeps history)
    const storedSignal = signalStore.storeSignal(signal);

    // Log and notify
    logger.signal(storedSignal);
    telegram.notifySignal(storedSignal);

    res.json({ 
      status: 'Signal received and stored', 
      signal: storedSignal,
      id: storedSignal.id
    });
  } catch (error) {
    logger.error('Webhook error', { error: error.message, body: req.body });
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;