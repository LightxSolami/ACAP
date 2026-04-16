const logger = require('../services/logger');

function validateTradingViewPayload(payload) {
  const required = ['symbol', 'price', 'signal', 'rsi', 'timeframe'];
  for (const field of required) {
    if (!(field in payload)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (typeof payload.price !== 'number' || payload.price <= 0) {
    throw new Error('Invalid price: must be a positive number');
  }

  if (!['buy', 'sell'].includes(payload.signal.toLowerCase())) {
    throw new Error('Invalid signal: must be buy or sell');
  }

  if (typeof payload.rsi !== 'number' || payload.rsi < 0 || payload.rsi > 100) {
    throw new Error('Invalid RSI: must be between 0 and 100');
  }

  return {
    symbol: payload.symbol.toUpperCase(),
    price: payload.price,
    signal: payload.signal.toLowerCase(),
    rsi: payload.rsi,
    timeframe: payload.timeframe
  };
}

function validateOrderPayload(payload) {
  const required = ['symbol', 'side', 'quantity'];
  for (const field of required) {
    if (!(field in payload)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!['BUY', 'SELL'].includes(payload.side.toUpperCase())) {
    throw new Error('Invalid side: must be BUY or SELL');
  }

  if (typeof payload.quantity !== 'number' || payload.quantity <= 0) {
    throw new Error('Invalid quantity: must be a positive number');
  }

  return {
    symbol: payload.symbol.toUpperCase(),
    side: payload.side.toUpperCase(),
    quantity: payload.quantity
  };
}

module.exports = {
  validateTradingViewPayload,
  validateOrderPayload
};