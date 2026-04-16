// Enhanced signal storage with history
let signals = [];
const MAX_SIGNALS = 100;

function storeSignal(signal) {
  const signalWithTimestamp = {
    ...signal,
    timestamp: new Date(),
    id: Date.now(),
    confirmed: false
  };
  
  signals.unshift(signalWithTimestamp);
  
  // Keep only last 100 signals
  if (signals.length > MAX_SIGNALS) {
    signals = signals.slice(0, MAX_SIGNALS);
  }
  
  return signalWithTimestamp;
}

function getLatestSignal() {
  return signals.length > 0 ? signals[0] : null;
}

function getSignalHistory(limit = 50) {
  return signals.slice(0, limit);
}

function getSignalsBySymbol(symbol, limit = 50) {
  return signals.filter(s => s.symbol === symbol).slice(0, limit);
}

function confirmSignal(signalId, decision) {
  const signal = signals.find(s => s.id === signalId);
  if (signal) {
    signal.confirmed = true;
    signal.decision = decision;
    signal.confirmedAt = new Date();
  }
  return signal;
}

function getSignalStats() {
  const totalSignals = signals.length;
  const buySignals = signals.filter(s => s.signal === 'BUY' || s.signal === 'buy').length;
  const sellSignals = signals.filter(s => s.signal === 'SELL' || s.signal === 'sell').length;
  const confirmedSignals = signals.filter(s => s.confirmed).length;
  
  return {
    total: totalSignals,
    buy: buySignals,
    sell: sellSignals,
    confirmed: confirmedSignals,
    winRate: confirmedSignals > 0 ? ((signals.filter(s => s.confirmed && s.decision === 'WIN').length / confirmedSignals) * 100).toFixed(2) : 0
  };
}

module.exports = {
  storeSignal,
  getLatestSignal,
  getSignalHistory,
  getSignalsBySymbol,
  confirmSignal,
  getSignalStats
};