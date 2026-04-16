const axios = require('axios');
const logger = require('./logger');

const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

// Popular tokens on different chains
const POPULAR_TOKENS = {
  // Solana
  SOL: { chain: 'solana', address: 'So11111111111111111111111111111111111111112', name: 'Solana', symbol: 'SOL' },
  RAY: { chain: 'solana', address: '4k3Dyjzvzp8eMZWUUbCbRQKkwQ4PL9pYYcD2F7W3bGuM', name: 'Raydium', symbol: 'RAY' },
  COPE: { chain: 'solana', address: '8HGyAAB1yoM1ttS7pnqLvA3LsDCVVhMg1kdqKWvpump', name: 'Cope', symbol: 'COPE' },
  ORCA: { chain: 'solana', address: 'orcaEKTdK7LKz57oWNB9JiFpjGF3BZ3n7L6BeB7eMCC', name: 'Orca', symbol: 'ORCA' },
  SLND: { chain: 'solana', address: 'SLNDpmoWTVADgEdndyvWzroNL7zSgooonMoYX001Qe', name: 'Solidend', symbol: 'SLND' },
  
  // Ethereum
  AAVE: { chain: 'ethereum', address: '0x7fc66500c84a76ad7e9c93437e434122a1aa72d5', name: 'Aave', symbol: 'AAVE' },
  UNI: { chain: 'ethereum', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap', symbol: 'UNI' },
  MATIC: { chain: 'ethereum', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', name: 'Polygon', symbol: 'MATIC' },
  USDC: { chain: 'ethereum', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', name: 'USDC', symbol: 'USDC' },
  DAI: { chain: 'ethereum', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', name: 'Dai', symbol: 'DAI' },
  
  // Base (Ethereum Layer 2)
  DEGEN: { chain: 'base', address: '0x4ed4e862860bed51a9570b96d89af5e1b0efefc', name: 'Degen', symbol: 'DEGEN' },
  BRETT: { chain: 'base', address: '0x532f06ff96b9cacaa327aec6484040fb667b02e6', name: 'Brett', symbol: 'BRETT' },
  HIGHER: { chain: 'base', address: '0xE7eD6b1bd59B1Ee87c97A87a34858Ce0A82f0f6B', name: 'Higher', symbol: 'HIGHER' },
};

async function getDexPrice(chain, tokenAddress) {
  try {
    const response = await axios.get(`${DEXSCREENER_API}/dex/tokens/${tokenAddress}`, {
      timeout: 10000
    });

    if (response.data && response.data.pairs && response.data.pairs.length > 0) {
      const pair = response.data.pairs[0]; // Get most liquid pair
      return {
        symbol: pair.baseToken.symbol,
        price: parseFloat(pair.priceUsd) || 0,
        priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
        volume24h: parseFloat(pair.volume?.h24) || 0,
        liquidity: parseFloat(pair.liquidity?.usd) || 0,
        chain,
        dexName: pair.dexId,
        pairAddress: pair.pairAddress,
        baseToken: pair.baseToken,
        quoteToken: pair.quoteToken,
      };
    }

    throw new Error('No trading pairs found');
  } catch (error) {
    logger.error('DexScreener price fetch error', { chain, tokenAddress, error: error.message });
    throw error;
  }
}

async function getDexChartData(chain, tokenAddress, limit = 100) {
  try {
    const response = await axios.get(`${DEXSCREENER_API}/dex/tokens/${tokenAddress}`, {
      timeout: 10000
    });

    if (response.data && response.data.pairs && response.data.pairs.length > 0) {
      const pair = response.data.pairs[0];
      
      // Return price data structure compatible with Binance format
      return {
        symbol: `${pair.baseToken.symbol}/USDT`,
        chain,
        currentPrice: parseFloat(pair.priceUsd),
        stats: {
          priceChange: pair.priceChange?.h24 ? pair.priceChange.h24 * (parseFloat(pair.priceUsd) || 1) : 0,
          priceChangePercent: pair.priceChange?.h24 || 0,
          volume: pair.volume?.h24 || 0,
          high24h: 0,
          low24h: 0,
        },
        orderBook: {
          bids: [],
          asks: []
        },
        recentTrades: [],
        // Mock klines - DexScreener doesn't provide full OHLCV data
        klines: generateMockKlines(parseFloat(pair.priceUsd), pair.priceChange?.h24 || 0)
      };
    }

    throw new Error('No trading pairs found');
  } catch (error) {
    logger.error('DexScreener chart data error', { chain, tokenAddress, error: error.message });
    throw error;
  }
}

function generateMockKlines(currentPrice, priceChange24h) {
  // Generate mock OHLCV data based on current price and 24h change
  const klines = [];
  let price = currentPrice / (1 + priceChange24h / 100);
  
  for (let i = 0; i < 100; i++) {
    const volatility = (Math.random() - 0.5) * 0.02; // 2% volatility
    const open = price;
    const close = price * (1 + volatility);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    klines.push({
      time: new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000,
      closeTime: new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000),
      quoteVolume: Math.random() * 1000000,
      trades: Math.floor(Math.random() * 10000)
    });
    
    price = close;
  }
  
  return klines;
}

async function getTokens(chain = null) {
  const tokens = [];
  
  for (const [key, token] of Object.entries(POPULAR_TOKENS)) {
    if (!chain || token.chain === chain) {
      tokens.push({
        id: `${token.chain}:${key}`,
        symbol: token.symbol,
        name: token.name,
        chain: token.chain,
        address: token.address,
        display: `${token.symbol} (${token.chain.toUpperCase()})`
      });
    }
  }
  
  return tokens;
}

module.exports = {
  getDexPrice,
  getDexChartData,
  getTokens,
  POPULAR_TOKENS
};
