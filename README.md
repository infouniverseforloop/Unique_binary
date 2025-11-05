# Binary Sniper — Full Final (modular)

## Summary
This is a modular, real-market oriented binary signal system:
- backend/ (server, adapters, strategy)
- frontend/ (UI)
- .env for config

Start the server and open UI → press Start to request a real signal for the selected pair.
By default the adapter uses a realistic fallback (simulation). Replace `backend/quotexAdapter.js` with your broker API/WS integration to get real live candles.

## Quick start (GitHub -> Replit)
1. Push this repo to GitHub.
2. Open Replit, import the GitHub repo.
3. Create a Replit secret or `.env` file with values from `.env.example`.
4. Install deps:
