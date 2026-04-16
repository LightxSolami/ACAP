const Anthropic = require('@anthropic-ai/sdk');
const logger = require('./logger');

let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'sk-dummy',
  });
} catch (e) {
  logger.warn('Anthropic SDK initialization issue', { error: e.message });
}

// Retry with exponential backoff
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function groqRequest(model, messages, maxTokens, temperature) {
  const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY2].filter(Boolean);
  
  if (keys.length === 0) {
    throw new Error('No Groq API keys configured');
  }

  const errors = [];
  let lastRateLimitTime = 0;

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const key = keys[keyIndex];
    let retryCount = 0;
    const maxRetries = 2;
    let success = false;

    while (retryCount <= maxRetries && !success) {
      try {
        logger.info(`Groq request attempt`, { 
          keyIndex: keyIndex + 1, 
          attempt: retryCount + 1,
          model 
        });

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          logger.info('Groq request successful', { keyIndex: keyIndex + 1, model });
          return data.choices[0].message.content.trim();
        }

        const errorData = await response.json().catch(() => ({}));
        const errorMessage = `${response.status} ${response.statusText}`;

        // Handle authentication errors - try next key immediately
        if (response.status === 401) {
          logger.warn(`Groq API key ${keyIndex + 1} invalid (401)`, { status: response.status });
          errors.push(`Key ${keyIndex + 1}: Invalid API key (401)`);
          break; // Move to next key
        }

        // Handle rate limiting - if multiple keys available, try next key
        if (response.status === 429) {
          if (keyIndex < keys.length - 1) {
            // Switch to next key instead of retrying
            logger.warn(`Groq rate limit on Key ${keyIndex + 1}, switching to next key`, { status: response.status });
            errors.push(`Key ${keyIndex + 1}: Rate limited (429)`);
            break; // Move to next key
          } else {
            // Last key - retry with backoff
            if (retryCount < maxRetries) {
              retryCount++;
              const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
              logger.warn(`Groq rate limit on last key (Key ${keyIndex + 1}), retrying in ${waitTime}ms`, { 
                attempt: retryCount,
                totalAttempts: maxRetries + 1
              });
              lastRateLimitTime = Date.now();
              await sleep(waitTime);
              continue;
            } else {
              errors.push(`Key ${keyIndex + 1}: Rate limited after ${maxRetries} retries (429)`);
              break;
            }
          }
        }

        // Other server errors - try next key if this is not the last one
        if (response.status >= 500) {
          logger.warn(`Groq server error on Key ${keyIndex + 1}`, { status: response.status, error: errorMessage });
          errors.push(`Key ${keyIndex + 1}: Server error ${response.status}`);
          break; // Move to next key
        }

        // Other errors
        logger.warn(`Groq API error on Key ${keyIndex + 1}`, { status: response.status, error: errorMessage });
        errors.push(`Key ${keyIndex + 1}: ${errorMessage}`);
        break;

      } catch (error) {
        logger.warn(`Groq request error on Key ${keyIndex + 1}`, { 
          error: error.message,
          attempt: retryCount + 1
        });

        if (retryCount < maxRetries) {
          retryCount++;
          const waitTime = Math.pow(2, retryCount) * 500; // 1s, 2s, 4s
          logger.info(`Retrying Key ${keyIndex + 1} in ${waitTime}ms`, { attempt: retryCount });
          await sleep(waitTime);
        } else {
          errors.push(`Key ${keyIndex + 1}: Network error - ${error.message}`);
          break; // Move to next key
        }
      }
    }
  }

  // All keys failed
  const errorSummary = errors.join(' | ');
  logger.error('All Groq API keys exhausted', { errors: errorSummary, totalKeys: keys.length });
  throw new Error(`Groq API failed with all ${keys.length} key(s): ${errorSummary}`);
}

async function groqAnalyzeSignal(signal) {
  const prompt = `You are a professional crypto trader.

Analyze the following signal:
Symbol: ${signal.symbol}
Price: ${signal.price}
RSI: ${signal.rsi}
Signal: ${signal.signal}
Timeframe: ${signal.timeframe}

Rules:
* Only BUY if RSI < 30 and trend is bullish
* Only SELL if RSI > 70
* Otherwise return SKIP

Respond ONLY with:
BUY, SELL, or SKIP`;

  const messages = [
    { role: 'system', content: 'You are a trading decision AI. Always respond with exactly one word: BUY, SELL, or SKIP.' },
    { role: 'user', content: prompt }
  ];

  try {
    const decision = await groqRequest('llama-3.3-70b-versatile', messages, 10, 0.0);
    logger.info('Groq signal analysis success', { symbol: signal.symbol, decision: decision.toUpperCase() });
    return decision.toUpperCase();
  } catch (error) {
    logger.error('Groq signal analysis error', { error: error.message });
    // Return SKIP as safe default if all APIs fail
    logger.warn('Returning SKIP as safe fallback for signal analysis');
    return 'SKIP';
  }
}

async function analyzeSignal(signal) {
  const prompt = `You are a professional crypto trader.

Analyze the following signal:
Symbol: ${signal.symbol}
Price: ${signal.price}
RSI: ${signal.rsi}
Signal: ${signal.signal}
Timeframe: ${signal.timeframe}

Rules:
* Only BUY if RSI < 30 and trend is bullish
* Only SELL if RSI > 70
* Otherwise return SKIP

Respond ONLY with:
BUY, SELL, or SKIP`;

  try {
    // Try Claude first if API key is valid
    if (anthropic && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-dummy') {
      const message = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 10,
        temperature: 0.0,
        system: "You are a trading decision AI. Always respond with exactly one word: BUY, SELL, or SKIP.",
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const decision = message.content[0].text.trim().toUpperCase();
      logger.info('Claude signal analysis success', { symbol: signal.symbol, decision });
      return decision;
    } else {
      logger.warn('Claude API key not set, trying Groq', { hasKey: !!process.env.ANTHROPIC_API_KEY });
    }
  } catch (error) {
    logger.warn('Claude API error, falling back to Groq', { error: error.message });
  }

  // Fallback to Groq
  return groqAnalyzeSignal(signal);
}

async function groqAnalyzeWithCustomPrompt(prompt) {
  const messages = [
    { role: 'user', content: prompt }
  ];

  try {
    const response = await groqRequest('llama-3.3-70b-versatile', messages, 300, 0.7);
    logger.info('Groq custom analysis success', { promptLength: prompt.length, responseLength: response.length });
    return response;
  } catch (error) {
    logger.error('Groq custom prompt error', { error: error.message });
    throw error;
  }
}

async function analyzeWithCustomPrompt(prompt) {
  try {
    // Try Claude first if API key is valid
    if (anthropic && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-dummy') {
      const message = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const response = message.content[0].text.trim();
      logger.info('Claude custom analysis success', { promptLength: prompt.length, responseLength: response.length });
      return response;
    } else {
      logger.warn('Claude API key not set, trying Groq', { hasKey: !!process.env.ANTHROPIC_API_KEY });
    }
  } catch (error) {
    logger.warn('Claude API error, falling back to Groq', { error: error.message });
  }

  // Fallback to Groq - this will handle retries and both API keys
  logger.info('Using Groq for custom prompt analysis');
  return groqAnalyzeWithCustomPrompt(prompt);
}

module.exports = {
  analyzeSignal,
  analyzeWithCustomPrompt
};