// backend/server.js
// Full modular backend: WebSocket server, REST debug endpoints, signal engine glue.
// Run: node backend/server.js

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const { startScanLoop, computeSignalForPair, forceSignal } = require('./signalEngine');
const { log } = require('./utils');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = parseInt(process.env.PORT || '3000', 10);
const OWNER = process.env.OWNER_NAME || 'David Mamun William';
const WATCH = (process.env.WATCH_SYMBOLS || 'EUR/USD,GBP/USD,USD/JPY,AUD/USD,USD/CAD,USD/CHF,NZD/USD').split(',').map(s=>s.trim()).filter(Boolean);

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use(express.json());

// WebSocket clients
wss.on('connection', ws => {
  log('client connected');
  ws.send(JSON.stringify({ type:'hello', server_time: new Date().toISOString(), pairs: WATCH, owner: OWNER }));

  ws.on('message', async (raw) => {
    try{
      const m = JSON.parse(raw.toString());
      if(m.type === 'start' || m.type === 'next'){
        const mode = (m.mode || 'normal').toString().toLowerCase();
        let pair = (m.pair || '').toString().trim();
        if(!pair){
          // Auto-pick: choose first watch pair by default
          pair = WATCH[0];
        }
        // compute a live signal (this will call adapter internally)
        const res = await computeSignalForPair(pair, { mode });
        if(!res || res.status === 'hold'){
          ws.send(JSON.stringify({ type:'hold', data: { pair, reason: res && res.reason ? res.reason : 'No confirmed opportunity now — hold' } }));
        } else {
          ws.send(JSON.stringify({ type:'signal', data: res }));
        }
      } else if(m.type === 'autoPick'){
        // auto-pick best across WATCH list
        let best = null;
        for(const p of WATCH){
          try{
            const r = await computeSignalForPair(p, { mode: m.mode || 'normal' });
            if(r && r.status === 'ok'){
              if(!best || (r.confidence > best.confidence)) best = r;
            }
          }catch(e){}
        }
        if(!best) ws.send(JSON.stringify({ type:'hold', data: { reason: 'No suitable market now' } }));
        else ws.send(JSON.stringify({ type:'signal', data: best }));
      } else if(m.type === 'reqDebug'){
        const info = { watch: WATCH, server_time: new Date().toISOString() };
        ws.send(JSON.stringify({ type:'debug', data: info }));
      } else if(m.type === 'force' && m.pair){
        const forced = await forceSignal(m.pair, { mode: m.mode || 'normal' });
        if(forced) broadcast({ type:'signal', data: forced });
      }
    }catch(err){
      log('ws msg parse err: ' + err.message);
    }
  });
});

// broadcast helper
function broadcast(obj){
  const raw = JSON.stringify(obj);
  wss.clients.forEach(c => { if(c.readyState === WebSocket.OPEN) c.send(raw); });
}

/* REST debug endpoints */
app.get('/debug/status', (req,res) => {
  res.json({ ok:true, server_time: new Date().toISOString(), watch: WATCH });
});
app.get('/debug/force/:pair', async (req,res) => {
  try{
    const pair = req.params.pair;
    const forced = await forceSignal(pair, { mode: req.query.mode || 'normal' });
    if(!forced) return res.json({ ok:false, err:'no-signal' });
    broadcast({ type:'signal', data: forced });
    res.json({ ok:true, forced });
  }catch(e){ res.json({ ok:false, err: e.message }); }
});

/* Start background scan (optional) */
if(process.env.ENABLE_BACKGROUND_SCAN === 'true'){
  startScanLoop((sig) => {
    // push to all clients when new signal found
    broadcast({ type:'signal', data: sig });
  });
}

server.listen(PORT, ()=> {
  log(`Server listening on port ${PORT} — owner: ${OWNER}`);
});
