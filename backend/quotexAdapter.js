// backend/quotexAdapter.js
// getCandles(pair, count) -> returns array of {time, open, high, low, close, volume}
// IMPORTANT: Do NOT put credentials in code. Use process.env and Replit Secrets.

const axios = require('axios');

/* ======= PLACEHOLDER: real implementation =======
  You should replace getCandlesWithBroker with actual Quotex API/WS calls.
  Example: open a websocket to QUOTEX_WS_URL using QUOTEX_USERNAME/PASSWORD tokens,
  then on each tick call appendTick(pair, price, qty, tsSec) in server-side in-memory store.
=============================================== */

async function getCandles(pair, count = 120){
  // If you have a broker API -> implement it here.
  // For now: fallback simulation that looks realistic.
  const now = Math.floor(Date.now()/1000);
  const res = [];
  let base = 1.0;
  if(pair.startsWith('EUR')) base = 1.09;
  if(pair.startsWith('GBP')) base = 1.28;
  if(pair.startsWith('USD/JPY')) base = 154.5;
  // create `count` candles (1s resolution or 1m if you prefer; strategy expects many)
  for(let i = count; i >= 1; i--){
    const t = now - i;
    const noise = (Math.random()-0.5) * (pair.includes('BTC') ? 200 : 0.0012);
    const close = +(base + noise).toFixed(pair.includes('JPY') ? 2 : 5);
    const open = +(close + ((Math.random()-0.5) * 0.0008)).toFixed(5);
    const high = Math.max(open, close) + Math.random()*0.0007;
    const low = Math.min(open, close) - Math.random()*0.0007;
    const vol = Math.floor(100 + Math.random()*900);
    res.push({ time: t, open, high, low, close, volume: vol });
  }
  return res;
}

module.exports = { getCandles };
