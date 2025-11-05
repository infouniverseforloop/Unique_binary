// backend/signalEngine.js
const { getCandles } = require('./quotexAdapter');
const { computeFromCandles } = require('./strategyCore');
const { log } = require('./utils');

const MIN_BROADCAST = parseInt(process.env.MIN_BROADCAST_CONF || '60', 10);

async function computeSignalForPair(pair, opts = {}){
  // opts: { mode: 'normal'|'god' }
  try{
    const candles = await getCandles(pair, 200);
    if(!candles || candles.length < 60) return { status:'hold', reason:'not-enough-candles' };
    const base = computeFromCandles(pair, candles, opts);
    if(!base || base.status !== 'ok') return { status:'hold', reason: base && base.reason ? base.reason : 'no-signal' };

    let conf = base.confidence;
    if(opts.mode === 'god') conf = Math.min(99, conf + (parseInt(process.env.GOD_MODE_BOOST||'6',10)));
    const pass = conf >= MIN_BROADCAST;

    if(!pass) return { status:'hold', reason:`confidence too low:${conf}` };
    return {
      status:'ok',
      id: Date.now(),
      pair,
      direction: base.direction,
      confidence: conf,
      entry: base.entry,
      entry_ts: base.entry_ts,
      entry_time_iso: base.entry_time_iso,
      expiry_ts: Math.floor(Date.now()/1000) + parseInt(process.env.BINARY_EXPIRY_SECONDS || '60',10),
      notes: base.notes,
      candleSize: base.candleSize
    };
  }catch(err){
    log('computeSignalForPair err: ' + err.message);
    return { status:'hold', reason:'adapter-error' };
  }
}

// optional background scanner that calls a callback when a new signal found
function startScanLoop(onSignal){
  const interval = parseInt(process.env.SCAN_INTERVAL_MS || '5000', 10);
  setInterval(async () => {
    try{
      // iterate watch list
      const watch = (process.env.WATCH_SYMBOLS || 'EUR/USD,GBP/USD,USD/JPY').split(',').map(s=>s.trim());
      for(const p of watch){
        const sig = await computeSignalForPair(p, { mode: 'normal' });
        if(sig && sig.status === 'ok') {
          onSignal && onSignal(sig);
        }
      }
    }catch(e){ log('scan err ' + e.message); }
  }, interval);
}

async function forceSignal(pair, opts = {}){
  // create a best-effort signal even if below MIN_BROADCAST (for testing)
  try{
    const candles = await getCandles(pair, 200);
    const base = computeFromCandles(pair, candles, opts);
    if(!base || base.status !== 'ok') return null;
    let conf = base.confidence;
    if(opts.mode === 'god') conf = Math.min(99, conf + (parseInt(process.env.GOD_MODE_BOOST||'6',10)));
    return {
      status:'ok',
      id: Date.now(),
      pair,
      direction: base.direction,
      confidence: conf,
      entry: base.entry,
      entry_ts: base.entry_ts,
      entry_time_iso: base.entry_time_iso,
      expiry_ts: Math.floor(Date.now()/1000) + parseInt(process.env.BINARY_EXPIRY_SECONDS || '60',10),
      notes: base.notes,
      candleSize: base.candleSize
    };
  }catch(e){ log('forceSignal err ' + e.message); return null; }
}

module.exports = { computeSignalForPair, startScanLoop, forceSignal };
