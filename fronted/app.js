// frontend/app.js
const ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws');

const pairSelect = document.getElementById('pairSelect');
const modeSelect = document.getElementById('modeSelect');
const startBtn = document.getElementById('startBtn');
const nextBtn = document.getElementById('nextBtn');
const autoBtn = document.getElementById('autoBtn');
const debugBtn = document.getElementById('debugBtn');
const signalTitle = document.getElementById('signalTitle');
const signalMeta = document.getElementById('signalMeta');
const signalBody = document.getElementById('signalBody');
const countdownEl = document.getElementById('countdown');
const logBox = document.getElementById('logBox');
const stat_conf = document.getElementById('stat_conf');
const stat_mode = document.getElementById('stat_mode');
const stat_entry = document.getElementById('stat_entry');

let countdownTimer = null;

function pushLog(t){ const d=new Date().toLocaleTimeString(); logBox.innerHTML = `<div>[${d}] ${t}</div>` + logBox.innerHTML; }

ws.onopen = () => { pushLog('WS connected'); };
ws.onmessage = (evt) => {
  try{
    const msg = JSON.parse(evt.data);
    if(msg.type === 'hello'){
      document.getElementById('serverTime').innerText = `Server: ${msg.server_time}`;
      if(Array.isArray(msg.pairs)){
        pairSelect.innerHTML = '';
        msg.pairs.forEach(p => { const o = document.createElement('option'); o.value = p; o.text = p; pairSelect.appendChild(o); });
      }
    } else if(msg.type === 'signal'){
      showSignal(msg.data);
    } else if(msg.type === 'hold'){
      pushLog(`[HOLD] ${msg.data.pair||''} -> ${msg.data.reason || msg.data}`);
    } else if(msg.type === 'debug'){
      pushLog('DEBUG: ' + JSON.stringify(msg.data));
    } else if(msg.type === 'log'){
      pushLog(msg.data);
    }
  }catch(e){}
};

function showSignal(rec){
  clearInterval(countdownTimer);
  signalTitle.innerText = `${rec.pair || rec.symbol} — ${rec.direction} (conf ${rec.confidence}%)`;
  signalMeta.innerText = `Notes: ${rec.notes || '-'} • CandleSize: ${rec.candleSize || '-'}`;
  stat_conf.innerText = `Confidence: ${rec.confidence}%`;
  stat_mode.innerText = `Mode: ${modeSelect.value.toUpperCase()}`;
  stat_entry.innerText = `Entry: ${rec.entry || '-'}`;
  let now = Math.floor(Date.now()/1000);
  let secs = Math.max(0, (rec.expiry_ts || Math.floor(new Date(rec.expiry_at||rec.expiry).getTime()/1000)) - now);
  countdownEl.textContent = `Countdown: ${secs}s`;
  countdownTimer = setInterval(()=> {
    secs--;
    if(secs <= 0){ clearInterval(countdownTimer); countdownEl.textContent = 'Signal closed — awaiting result'; }
    else countdownEl.textContent = `Countdown: ${secs}s`;
  }, 1000);
  pushLog(`Signal: ${rec.pair || rec.symbol} ${rec.direction} conf:${rec.confidence}% entry:${rec.entry}`);
  // optional TTS
  try{
    const u = new SpeechSynthesisUtterance(`Signal ${rec.pair || rec.symbol} ${rec.direction} confidence ${rec.confidence} percent`);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch(e){}
}

startBtn.onclick = () => {
  ws.send(JSON.stringify({ type:'start', pair: pairSelect.value, mode: modeSelect.value }));
  pushLog('Requested start for ' + pairSelect.value + ' mode:' + modeSelect.value);
};
nextBtn.onclick = () => {
  ws.send(JSON.stringify({ type:'next', pair: pairSelect.value, mode: modeSelect.value }));
  pushLog('Requested next for ' + pairSelect.value + ' mode:' + modeSelect.value);
};
autoBtn.onclick = () => {
  ws.send(JSON.stringify({ type:'autoPick', mode: modeSelect.value }));
  pushLog('Requested Auto-Pick Best');
};
debugBtn.onclick = () => {
  fetch(`/debug/force/${encodeURIComponent(pairSelect.value)}?mode=${encodeURIComponent(modeSelect.value)}`)
    .then(r=>r.json()).then(j => pushLog('force result: ' + (j.ok ? 'ok' : JSON.stringify(j))));
};
