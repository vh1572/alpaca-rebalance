import Alpaca from '@alpacahq/alpaca-trade-api';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function buildClient({ apiKey, secretKey, baseUrl }) {
  return new Alpaca({
    keyId: apiKey,
    secretKey,
    baseUrl,
    paper: true
  });
}

async function fetchLatestPrices(client, symbols) {
  const bars = await client.getLatestBars(symbols);
  return symbols.map((symbol) => ({
    symbol,
    price: bars[symbol]?.ClosePrice ?? null
  })).filter(({ price }) => price !== null);
}

async function fetchOneHourMomentum(client, symbols) {
  const start = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const end = new Date().toISOString();
  const bars = await client.getBarsV2(symbols, {
    start,
    end,
    timeframe: '1Min'
  });

  const momentum = [];
  for await (const bar of bars) {
    const first = bar[0];
    const last = bar[bar.length - 1];
    if (first && last) {
      momentum.push({
        symbol: bar.Symbol,
        returnPct: (last.ClosePrice - first.OpenPrice) / first.OpenPrice
      });
    }
  }
  return momentum;
}

function computeTargetWeights(momentumList, maxPerAsset = 0.3) {
  const positive = momentumList.filter(({ returnPct }) => returnPct > 0);
  if (!positive.length) {
    return [];
  }
  const total = positive.reduce((sum, item) => sum + item.returnPct, 0);
  return positive.map((item) => ({
    symbol: item.symbol,
    weight: Math.min(maxPerAsset, item.returnPct / total)
  }));
}

async function getAccountBalances(client) {
  const account = await client.getAccount();
  const portfolio = await client.getPositions();
  return {
    cash: Number(account.cash),
    positions: portfolio.map((position) => ({
      symbol: position.symbol,
      marketValue: Number(position.market_value)
    }))
  };
}

function buildOrders({ currentValueBySymbol, targetWeights, totalEquity, prices }) {
  const priceMap = new Map(prices.map(({ symbol, price }) => [symbol, price]));

  return targetWeights.map(({ symbol, weight }) => {
    const targetValue = totalEquity * weight;
    const currentValue = currentValueBySymbol.get(symbol) ?? 0;
    const price = priceMap.get(symbol);
    if (!price) return null;

    const delta = targetValue - currentValue;
    const qty = Math.floor(Math.abs(delta) / price);

    if (qty === 0) return null;

    return {
      symbol,
      side: delta >= 0 ? 'buy' : 'sell',
      qty,
      type: 'market',
      time_in_force: 'day'
    };
  }).filter(Boolean);
}

function humanWeights(weights) {
  return weights.map(({ symbol, weight }) => `${symbol}:${(weight * 100).toFixed(1)}%`).join(', ');
}

export function configureBot({ apiKey, secretKey, baseUrl, rebalanceMinutes, symbols }) {
  const client = buildClient({ apiKey, secretKey, baseUrl });
  const rebalanceInterval = (rebalanceMinutes || 15) * 60 * 1000;

  return {
    async start() {
      console.log(`Starting momentum-tilted rebalancer on ${symbols.join(', ')} with ${rebalanceMinutes}-minute cadence.`);
      await this.rebalance();
      setInterval(() => this.rebalance().catch((err) => console.error('rebalance failed', err)), Math.max(rebalanceInterval, FIFTEEN_MINUTES));
    },

    async rebalance() {
      console.log(`[${new Date().toISOString()}] Beginning rebalance cycle...`);
      const [prices, momentum, balance] = await Promise.all([
        fetchLatestPrices(client, symbols),
        fetchOneHourMomentum(client, symbols),
        getAccountBalances(client)
      ]);

      const targetWeights = computeTargetWeights(momentum);
      if (!targetWeights.length) {
        console.log('No assets with positive momentum; holding cash.');
        return;
      }

      console.log(`Momentum tilt weights: ${humanWeights(targetWeights)}`);

      const currentValueBySymbol = new Map(balance.positions.map((pos) => [pos.symbol, pos.marketValue]));
      const totalEquity = balance.cash + [...currentValueBySymbol.values()].reduce((a, b) => a + b, 0);

      const orders = buildOrders({ currentValueBySymbol, targetWeights, totalEquity, prices });
      if (!orders.length) {
        console.log('Portfolio already aligned with targets.');
        return;
      }

      console.log(`Submitting ${orders.length} orders...`);
      for (const order of orders) {
        await client.createOrder(order);
        console.log(`  ${order.side.toUpperCase()} ${order.qty} ${order.symbol}`);
      }
    }
  };
}
