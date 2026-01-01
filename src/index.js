import dotenv from 'dotenv';
import { configureBot } from './strategy.js';

dotenv.config();

const {
  APCA_API_KEY_ID,
  APCA_API_SECRET_KEY,
  APCA_API_BASE_URL = 'https://paper-api.alpaca.markets',
  WATCHLIST = 'SPY,QQQ,TLT,GLD,BTCUSD,ETHUSD'
} = process.env;

if (!APCA_API_KEY_ID || !APCA_API_SECRET_KEY) {
  throw new Error('Missing Alpaca credentials. Set APCA_API_KEY_ID and APCA_API_SECRET_KEY.');
}

const symbols = WATCHLIST.split(',').map((ticker) => ticker.trim().toUpperCase()).filter(Boolean);
const rebalanceMinutes = Number.parseInt(process.env.REBALANCE_MINUTES ?? '15', 10);

const bot = configureBot({
  apiKey: APCA_API_KEY_ID,
  secretKey: APCA_API_SECRET_KEY,
  baseUrl: APCA_API_BASE_URL,
  rebalanceMinutes,
  symbols
});

await bot.start();
