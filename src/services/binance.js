const axios = require('axios');
const crypto = require('crypto');
const logger = require('./logger');

const BASE_URL = 'https://api.binance.com';
const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;

// Helper function to detect token type
function parseTokenSymbol(symbol) {
  // Format: "chain:TOKEN" = DexScreener, "TOKENUSDT" = Binance
  if (symbol.includes(':')) {
    const [chain, token] = symbol.split(':');
    return { type: 'dex', chain: chain.toLowerCase(), token: token.toUpperCase(), symbol };
  }
  return { type: 'binance', symbol };
}

// Market data functions (no authentication needed)
async function getCurrentPrice(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/v3/ticker/price`, {
      params: { symbol }
    });
    return response.data;
  } catch (error) {
    logger.error('Get current price error', { symbol, error: error.message });
    throw error;
  }
}

async function get24hStats(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/v3/ticker/24hr`, {
      params: { symbol }
    });
    return response.data;
  } catch (error) {
    logger.error('Get 24h stats error', { symbol, error: error.message });
    throw error;
  }
}

async function getOrderBook(symbol, limit = 20) {
  try {
    const response = await axios.get(`${BASE_URL}/api/v3/depth`, {
      params: { symbol, limit }
    });
    return response.data;
  } catch (error) {
    logger.error('Get order book error', { symbol, error: error.message });
    throw error;
  }
}

async function getRecentTrades(symbol, limit = 50) {
  try {
    const response = await axios.get(`${BASE_URL}/api/v3/trades`, {
      params: { symbol, limit }
    });
    return response.data;
  } catch (error) {
    logger.error('Get recent trades error', { symbol, error: error.message });
    throw error;
  }
}

async function getKlines(symbol, interval = '1h', limit = 1000) {
  try {
    const response = await axios.get(`${BASE_URL}/api/v3/klines`, {
      params: { symbol, interval, limit }
    });
    return response.data.map(kline => ({
      time: new Date(kline[0]),
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
      closeTime: new Date(kline[6]),
      quoteVolume: parseFloat(kline[7]),
      trades: parseInt(kline[8])
    }));
  } catch (error) {
    logger.error('Get klines error', { symbol, interval, error: error.message });
    throw error;
  }
}

async function getMarketData(symbol, interval = '1h', klinesLimit = 1000) {
  try {
    const [price, stats, orderBook, trades, klines] = await Promise.race([
      Promise.all([
        getCurrentPrice(symbol),
        get24hStats(symbol),
        getOrderBook(symbol, 20),
        getRecentTrades(symbol, 20),
        getKlines(symbol, interval, klinesLimit)
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Market data request timeout')), 15000)
      )
    ]);

    return {
      symbol,
      currentPrice: price.price,
      stats: {
        priceChange: stats.priceChange,
        priceChangePercent: stats.priceChangePercent,
        high24h: stats.highPrice,
        low24h: stats.lowPrice,
        volume24h: stats.volume,
        quoteVolume24h: stats.quoteVolume
      },
      orderBook: {
        bids: orderBook.bids.slice(0, 10).map(([price, qty]) => ({ price: parseFloat(price), quantity: parseFloat(qty) })),
        asks: orderBook.asks.slice(0, 10).map(([price, qty]) => ({ price: parseFloat(price), quantity: parseFloat(qty) }))
      },
      recentTrades: trades.slice(0, 10).map(trade => ({
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.qty),
        time: new Date(trade.time),
        isBuyerMaker: trade.isBuyerMaker
      })),
      klines: klines,
      totalKlines: klines.length,
      firstKlineTime: klines[0]?.time,
      lastKlineTime: klines[klines.length - 1]?.time
    };
  } catch (error) {
    logger.error('Get market data error', { symbol, error: error.message });
    throw error;
  }
}

function generateSignature(queryString) {
  return crypto
    .createHmac('sha256', API_SECRET)
    .update(queryString)
    .digest('hex');
}

async function placeMarketOrder(symbol, side, quantity) {
  const timestamp = Date.now();
  const params = {
    symbol,
    side,
    type: 'MARKET',
    quantity,
    timestamp
  };

  const queryString = Object.keys(params)
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const signature = generateSignature(queryString);

  try {
    const response = await axios.post(
      `${BASE_URL}/api/v3/order`,
      null,
      {
        params: { ...params, signature },
        headers: {
          'X-MBX-APIKEY': API_KEY
        }
      }
    );

    logger.trade({ symbol, side, quantity, orderId: response.data.orderId, status: response.data.status });
    return response.data;
  } catch (error) {
    logger.error('Binance order error', {
      symbol,
      side,
      quantity,
      error: error.response?.data || error.message
    });
    throw error;
  }
}

// Multi-chain market data handler (supports Binance and DexScreener)
async function getMarketDataMultichain(symbol, interval = '1h', klinesLimit = 1000) {
  try {
    const tokenInfo = parseTokenSymbol(symbol);
    
    if (tokenInfo.type === 'dex') {
      // Use DexScreener for DEX tokens
      const dexscreener = require('./dexscreener');
      const dexToken = dexscreener.POPULAR_TOKENS[tokenInfo.token];
      
      if (!dexToken) {
        throw new Error(`Token ${tokenInfo.token} not found in DexScreener`);
      }
      
      logger.info('Fetching DEX data', { chain: tokenInfo.chain, token: tokenInfo.token });
      const data = await dexscreener.getDexChartData(tokenInfo.chain, dexToken.address, klinesLimit);
      return data;
    } else {
      // Use Binance for spot trading pairs
      logger.info('Fetching Binance data', { symbol: tokenInfo.symbol });
      return await getMarketData(tokenInfo.symbol, interval, klinesLimit);
    }
  } catch (error) {
    logger.error('Get market data multi-chain error', { symbol, error: error.message });
    throw error;
  }
}

module.exports = {
  placeMarketOrder,
  getCurrentPrice,
  get24hStats,
  getOrderBook,
  getRecentTrades,
  getKlines,
  getMarketData,
  getMarketDataMultichain,
  parseTokenSymbol
};