// backend/strategyCore.js
// Strategy core returns an object { status:'ok'|'hold', confidence, direction, entry, notes, ... }

function sma(arr, period){
  if(!arr || arr.length < period) return null;
  const s = arr.slice(-period).reduce((a,b)=>a+b,0);
  return s / period;
}
function rsiFromCloses(closes, period = 14){
  if(!closes || closes.length < period+1) return 50;
  let gains = 0, losses = 0;
  for(let i = closes.length - period; i < closes.length; i++){
    const d = closes[i] - closes[i-1];
    if(d > 0) gains += d; else losses += Math.abs(d);
  }
  const avgG = gains / period, avgL = (losses / period) || 1e-8;
  const rs = avgG/avgL;
  return 100 - (100/(1+rs));
}

function computeFromCandles(pair, candles, opts = {}){
  // candles: array of {time, open, high, low, close, volume}
  if(!candles || candles.length < 60) return { status:'hold', reason:'insufficient candles' };

  const closes = candles.map(c => c.close);
  const sma5 = sma(closes, 5), sma20 = sma(closes, 20), sma50 = sma(closes, 50);
  const rsi = rsiFromCloses(closes, 14);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const priceDelta = last.close - prev.close;

  // volume spike detection
  const vols = candles.slice(-30).map(c=>c.volume||0);
  const avgVol = vols.reduce((a,b)=>a+b,0) / vols.length;
  const volSpike = (last.volume || 0) > (avgVol * (parseFloat(process.env.VOL_SPIKE_MULT||'2.0')));

  // Order block / big candle detection (simple)
  const body = Math.abs(prev.close - prev.open);
  const avgBody = candles.slice(-20).reduce((a,b)=>a+Math.abs(b.close-b.open),0) / 20;
  const bigCandle = body > avgBody * 1.8;

  // scoring
  let score = 50;
  const bullish = (sma5 > sma20) && (priceDelta > 0);
  const bearish = (sma5 < sma20) && (priceDelta < 0);

  if(bullish) score += 12;
  if(bearish) score -= 12;
  if(rsi < 35) score += 8;
  if(rsi > 65) score -= 8;
  if(volSpike) score += 6;
  if(bigCandle) score += 4;

  // Candle size classification (optional)
  let candleSize = 'Normal';
  if(Math.abs(last.close - last.open) > avgBody * 2.5) candleSize = 'Large';

  // require at least 1 momentum layer + either volSpike or bigCandle for higher confidence
  const layers = [bullish||bearish ? 1 : 0, volSpike ? 1 : 0, bigCandle ? 1 : 0].reduce((a,b)=>a+b,0);
  if(layers < 1) return { status:'hold', reason:'insufficient signal layers' };

  score = Math.max(10, Math.min(99, Math.round(score)));

  const direction = score >= (parseInt(process.env.CONF_THRESHOLD_CALL||'60',10)) ? 'CALL'
                   : (score <= (parseInt(process.env.CONF_THRESHOLD_PUT||'40',10)) ? 'PUT' : (bullish ? 'CALL' : 'PUT'));

  // final conservative pass: only accept when score >= MIN_BROADCAST_CONF env or mode boosts it later
  return {
    status: 'ok',
    pair,
    direction,
    confidence: score,
    entry: last.close,
    entry_ts: Math.floor(Date.now()/1000),
    entry_time_iso: new Date().toISOString(),
    candleSize,
    notes: `rsi:${Math.round(rsi)}|volSpike:${volSpike}|bigCandle:${bigCandle}|sma5:${sma5?.toFixed?.(5)||sma5}|sma20:${sma20?.toFixed?.(5)||sma20}`
  };
}

module.exports = { computeFromCandles };
