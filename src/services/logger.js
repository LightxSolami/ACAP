const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logFile = path.join(__dirname, '../../logs/trading.log');
    // Ensure logs directory exists
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };

    const logString = JSON.stringify(logEntry) + '\n';

    // Console output
    console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`, data);

    // File output
    fs.appendFileSync(this.logFile, logString);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  signal(signal) {
    this.info('Signal received', signal);
  }

  decision(decision) {
    this.info('AI decision', decision);
  }

  trade(trade) {
    this.info('Trade executed', trade);
  }
}

module.exports = new Logger();