# Alpaca Momentum Rebalancer

This sample Node.js app illustrates a 15-minute rebalancing loop that leans into assets showing short-term positive momentum. It assumes zero trading fees and uses Alpaca's API to fetch prices, compute momentum, and place market orders to move toward the computed target weights.

## How it works

1. Load your Alpaca credentials from environment variables.
2. Every 15 minutes (configurable), fetch the latest prices and 1-hour momentum for the configured watchlist.
3. Allocate only to assets with positive 1-hour returns, capping any single asset at 30% of the portfolio to avoid over-concentration.
4. Submit market orders to move current holdings toward the target weights calculated from relative momentum.

Because the strategy only allocates to assets that have recently risen, it exploits the observation that "something is usually going up" to keep capital in the strongest symbols while exiting weaker ones.

## Prerequisites

- Node.js 18+
- Alpaca API keys (paper or live). Set these environment variables:
  - `APCA_API_KEY_ID`
  - `APCA_API_SECRET_KEY`
  - Optional: `APCA_API_BASE_URL` (defaults to paper trading), `WATCHLIST` (comma-separated symbols), `REBALANCE_MINUTES` (defaults to 15).

## Run locally

```bash
npm install
npm start
```

The app logs each rebalance cycle and the orders it submits. Use paper trading to validate behavior before deploying anywhere near live funds.
