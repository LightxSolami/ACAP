const TelegramBot = require('node-telegram-bot-api');
const logger = require('./logger');

const bot = process.env.TELEGRAM_BOT_TOKEN ? new TelegramBot(process.env.TELEGRAM_BOT_TOKEN) : null;
const chatId = process.env.TELEGRAM_CHAT_ID;

async function sendMessage(message) {
  if (!bot || !chatId) {
    logger.warn('Telegram not configured, skipping message');
    return;
  }

  try {
    await bot.sendMessage(chatId, message);
  } catch (error) {
    logger.error('Telegram send error', { error: error.message });
  }
}

async function notifySignal(signal) {
  const message = `📊 Signal Received\nSymbol: ${signal.symbol}\nPrice: ${signal.price}\nSignal: ${signal.signal}\nRSI: ${signal.rsi}\nTimeframe: ${signal.timeframe}`;
  await sendMessage(message);
}

async function notifyDecision(signal, decision) {
  const message = `🤖 AI Decision\nSymbol: ${signal.symbol}\nDecision: ${decision}`;
  await sendMessage(message);
}

async function notifyTrade(trade) {
  const message = `💰 Trade Executed\nSymbol: ${trade.symbol}\nSide: ${trade.side}\nQuantity: ${trade.quantity}\nOrder ID: ${trade.orderId}`;
  await sendMessage(message);
}

module.exports = {
  notifySignal,
  notifyDecision,
  notifyTrade
};