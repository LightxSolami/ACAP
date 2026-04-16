const { getMarketDataMultichain } = require('./binance');
const claudeService = require('./claude');
const logger = require('./logger');

function calculateIndicators(klines) {
  if (!klines || klines.length === 0) return {};

  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const volumes = klines.map(k => k.volume);
  const currentPrice = closes[closes.length - 1];

  function calculateSMA(data, period) {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  function calculateRSI(data, period = 14) {
    if (data.length < period + 1) return null;
    let gains = [], losses = [];
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  function calculateEMA(data, period) {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  function calculateLinearRegression(data, period = 50) {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const n = slice.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += slice[i];
      sumXY += i * slice[i];
      sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope: slope, intercept: intercept, currentValue: slope * (n - 1) + intercept };
  }

  function calculateATR(klines, period = 14) {
    if (klines.length < period + 1) return null;
    let trValues = [];
    for (let i = 1; i < klines.length; i++) {
      const high = klines[i].high, low = klines[i].low;
      const prevClose = klines[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trValues.push(tr);
    }
    return trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  function calculateVWAP(klines, period = 20) {
    if (klines.length < period) return null;
    const slice = klines.slice(-period);
    let totalPV = 0, totalV = 0;
    for (const k of slice) {
      const typicalPrice = (k.high + k.low + k.close) / 3;
      totalPV += typicalPrice * k.volume;
      totalV += k.volume;
    }
    return totalV > 0 ? totalPV / totalV : null;
  }

  function calculateADX(klines, period = 14) {
    if (klines.length < period + 1) return null;
    let plusDM = [], minusDM = [], trValues = [];
    for (let i = 1; i < klines.length; i++) {
      const high = klines[i].high, low = klines[i].low;
      const prevHigh = klines[i - 1].high, prevLow = klines[i - 1].low;
      const prevClose = klines[i - 1].close;
      const dmPlus = high > prevHigh ? Math.max(high - prevHigh, 0) : 0;
      const dmMinus = prevLow > low ? Math.max(prevLow - low, 0) : 0;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      plusDM.push(dmPlus);
      minusDM.push(dmMinus);
      trValues.push(tr);
    }
    const plusDI = (plusDM.slice(-period).reduce((a, b) => a + b, 0) / period) / (trValues.slice(-period).reduce((a, b) => a + b, 0) / period) * 100;
    const minusDI = (minusDM.slice(-period).reduce((a, b) => a + b, 0) / period) / (trValues.slice(-period).reduce((a, b) => a + b, 0) / period) * 100;
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    return { adx: dx, plusDI: plusDI, minusDI: minusDI };
  }

  function calculateSupportResistance(klines, period = 20) {
    const recentKlines = klines.slice(-period);
    const highs = recentKlines.map(k => k.high);
    const lows = recentKlines.map(k => k.low);
    const resistance = Math.max(...highs);
    const support = Math.min(...lows);
    return { resistance: resistance.toFixed(2), support: support.toFixed(2) };
  }

  function calculateBollingerBands(prices, period = 20) {
    const slice = prices.slice(-period);
    if (slice.length < period) return null;
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
      upper: (avg + stdDev * 2),
      middle: avg,
      lower: (avg - stdDev * 2)
    };
  }

  function calculateStochastic(klines, period = 14) {
    const recentKlines = klines.slice(-period);
    const highs = recentKlines.map(k => k.high);
    const lows = recentKlines.map(k => k.low);
    const closes = recentKlines.map(k => k.close);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const currentClose = closes[closes.length - 1];
    if (maxHigh === minLow) return 50;
    return ((currentClose - minLow) / (maxHigh - minLow)) * 100;
  }

  function calculateMACD(data) {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    if (!ema12 || !ema26) return null;
    const signal = calculateEMA([ema12 - ema26], 9);
    return {
      macd: ema12 - ema26,
      signal: signal,
      histogram: (ema12 - ema26) - signal
    };
  }

  function calculateMomentum(data, period = 10) {
    if (data.length < period + 1) return null;
    return data[data.length - 1] - data[data.length - 1 - period];
  }

  function calculateMoneyFlowIndex(klines, period = 14) {
    if (klines.length < period + 1) return null;
    let positiveMF = 0, negativeMF = 0;
    
    for (let i = 1; i < klines.length; i++) {
      const typicalPrice = (klines[i].high + klines[i].low + klines[i].close) / 3;
      const prevTypicalPrice = (klines[i - 1].high + klines[i - 1].low + klines[i - 1].close) / 3;
      const moneyFlow = typicalPrice * klines[i].volume;
      
      if (typicalPrice > prevTypicalPrice) {
        positiveMF += moneyFlow;
      } else {
        negativeMF += moneyFlow;
      }
    }
    
    const moneyFlowRatio = positiveMF / negativeMF;
    const mfi = 100 - (100 / (1 + moneyFlowRatio));
    return mfi;
  }

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const linearReg = calculateLinearRegression(closes, 50);

  let trend = 'NEUTRAL';
  if (ema9 && ema21) {
    if (ema9 > ema21) trend = 'BULLISH';
    else if (ema9 < ema21) trend = 'BEARISH';
  }

  let signal = 'NEUTRAL';
  const rsi = calculateRSI(closes);
  if (rsi) {
    if (rsi < 30) signal = 'BUY (OVERSOLD)';
    else if (rsi > 70) signal = 'SELL (OVERBOUGHT)';
  }

  if (ema9 && ema21 && ema50) {
    if (ema9 > ema21 && ema21 > ema50) signal = 'STRONG BUY';
    else if (ema9 < ema21 && ema21 < ema50) signal = 'STRONG SELL';
  }

  return {
    rsi: rsi ? rsi.toFixed(2) : null,
    rsiStatus: rsi ? (rsi < 30 ? 'OVERSOLD ⬇' : rsi > 70 ? 'OVERBOUGHT ⬆' : 'NEUTRAL →') : 'N/A',
    ema9: ema9 ? ema9.toFixed(2) : null,
    ema21: ema21 ? ema21.toFixed(2) : null,
    ema50: ema50 ? ema50.toFixed(2) : null,
    ema200: ema200 ? ema200.toFixed(2) : null,
    linearRegression: linearReg ? {
      slope: linearReg.slope.toFixed(4),
      intercept: linearReg.intercept.toFixed(2),
      currentValue: linearReg.currentValue.toFixed(2),
      trend: linearReg.slope > 0 ? 'UPTREND ↗' : 'DOWNTREND ↘'
    } : null,
    atr: calculateATR(klines) ? calculateATR(klines).toFixed(2) : null,
    vwap: calculateVWAP(klines) ? calculateVWAP(klines).toFixed(2) : null,
    mfi: calculateMoneyFlowIndex(klines) ? calculateMoneyFlowIndex(klines).toFixed(2) : null,
    mfiStatus: calculateMoneyFlowIndex(klines) ? (calculateMoneyFlowIndex(klines) > 80 ? 'OVERBOUGHT' : calculateMoneyFlowIndex(klines) < 20 ? 'OVERSOLD' : 'NEUTRAL') : 'N/A',
    adx: calculateADX(klines) ? {
      adx: calculateADX(klines).adx.toFixed(2),
      plusDI: calculateADX(klines).plusDI.toFixed(2),
      minusDI: calculateADX(klines).minusDI.toFixed(2),
      trend: calculateADX(klines).plusDI > calculateADX(klines).minusDI ? 'BULLISH ↗' : 'BEARISH ↘'
    } : null,
    bollingerBands: calculateBollingerBands(closes),
    stochastic: calculateStochastic(klines).toFixed(2),
    macd: calculateMACD(closes),
    momentum: calculateMomentum(closes) ? calculateMomentum(closes).toFixed(2) : null,
    supportResistance: calculateSupportResistance(klines),
    trend: trend,
    signal: signal,
    currentPrice: currentPrice,
    highestHigh: Math.max(...highs).toFixed(2),
    lowestLow: Math.min(...lows).toFixed(2),
    averageVolume: (volumes.reduce((a, b) => a + b, 0) / volumes.length).toFixed(2),
    gap: klines.length > 1 ? ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2] * 100).toFixed(2) : '0.00',
    totalKlines: klines.length
  };
}

async function askClaudeAboutMarket(question, symbol = 'BTCUSDT') {
  try {
    const marketData = await getMarketDataMultichain(symbol);
    const indicators = calculateIndicators(marketData.klines);

    // Check if user is asking about entry points
    const isEntryQuestion = /entry|long|short|buy|sell|position|trade entry|best price|when to/i.test(question);
    
    const entryAnalysisSection = isEntryQuestion ? `
IMPORTANT - ENTRY POINT ANALYSIS:
When providing entry points, format them clearly as: "ENTRY at $PRICE" or "Entry point: $PRICE"
Include these specific price levels:
• Best entry for near-term: [specific price]
• Second entry if first misses: [specific price]  
• Stop loss below: [specific price]
• Take profit targets: [list specific prices]
Make sure all prices are realistic based on current market data and support/resistance levels.` : '';

    const prompt = `You are an expert crypto trader analyzing ${symbol}. Provide PRO-level technical analysis.

CURRENT PRICE DATA:
• Price: $${marketData.currentPrice}
• 24h Change: ${marketData.stats.priceChangePercent}%
• 24h Range: $${marketData.stats.low24h} - $${marketData.stats.high24h}
• Volume: ${marketData.stats.volume}

TECHNICAL INDICATORS (Comprehensive):
• RSI(14): ${indicators.rsi} - ${indicators.rsiStatus}
• EMA Levels: 9=${indicators.ema9}, 21=${indicators.ema21}, 50=${indicators.ema50}, 200=${indicators.ema200}
• Linear Regression: Slope=${indicators.linearRegression?.slope}, Trend=${indicators.linearRegression?.trend}
• ATR: ${indicators.atr}
• VWAP: ${indicators.vwap}
• ADX: ${indicators.adx?.adx} (PlusDI: ${indicators.adx?.plusDI}, MinusDI: ${indicators.adx?.minusDI}) - ${indicators.adx?.trend}
• Bollinger Bands: Upper $${indicators.bollingerBands?.upper.toFixed(2)}, Middle $${indicators.bollingerBands?.middle.toFixed(2)}, Lower $${indicators.bollingerBands?.lower.toFixed(2)}
• Stochastic: ${indicators.stochastic}
• MACD: ${indicators.macd?.macd.toFixed(2)} (Signal: ${indicators.macd?.signal?.toFixed(2)}, Histogram: ${indicators.macd?.histogram?.toFixed(2)})
• Momentum: ${indicators.momentum}
• Trend: ${indicators.trend}
• Signal: ${indicators.signal}
• Support: $${indicators.supportResistance?.support}
• Resistance: $${indicators.supportResistance?.resistance}
• Highest: ${indicators.highestHigh}
• Lowest: ${indicators.lowestLow}
• Avg Volume: ${indicators.averageVolume}

ORDER BOOK:
Bids: ${marketData.orderBook.bids.map(b => `$${b.price}(${b.quantity})`).join(', ')}
Asks: ${marketData.orderBook.asks.map(a => `$${a.price}(${a.quantity})`).join(', ')}

TRADES: ${marketData.recentTrades.slice(0, 5).map(t => `${t.isBuyerMaker ? 'SELL' : 'BUY'} $${t.price} x${t.quantity}`).join(' | ')}

${entryAnalysisSection}

QUESTION: ${question}

Provide BRIEF professional analysis (2-3 sentences max):
- Current trend (BULLISH/BEARISH/NEUTRAL) with 1 key indicator
- Support/Resistance levels
- Specific action (BUY/SELL/WAIT) with entry price and stop-loss only
- Keep it concise and actionable.`;

    const response = await claudeService.analyzeWithCustomPrompt(prompt);

    logger.info('Market analysis request', {
      question,
      symbol,
      responseLength: response.length,
      payloadSize: prompt.length,
      totalKlines: indicators.totalKlines
    });

    return {
      question,
      symbol,
      marketData,
      indicators,
      analysis: response,
      timestamp: new Date(),
      analysisLength: response.length
    };

  } catch (error) {
    logger.error('Market analysis error', { question, symbol, error: error.message });
    throw error;
  }
}

module.exports = {
  askClaudeAboutMarket,
  calculateIndicators
};