import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

dotenv.config();

const serviceAccount = JSON.parse(
  readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3011;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json());
app.use('/api/', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP'
}));

app.use('/api/', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

const todayKey = () => new Date().toISOString().split('T')[0];

const dateRange = (period = 'today') => {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  if (period === 'today') return { start: end, end };
  const d = new Date(now);
  if (period === 'week') d.setDate(d.getDate() - 7);
  else if (period === 'month') d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 1);
  return { start: d.toISOString().split('T')[0], end };
};

app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'Breadhub Proofmaster API', timestamp: new Date().toISOString() });
});

app.get('/api/production/daily', async (req, res) => {
  try {
    const date = req.query.date || todayKey();
    const snap = await db.collection('dailyInventory').where('date', '==', date).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const perProduct = rows.map((r) => {
      const carryover = r.carryoverQty || 0;
      const production = r.newProductionQty || 0;
      const sold = r.soldQty || 0;
      const totalAvailable = carryover + production;
      const remaining = totalAvailable - sold + (r.cancelledQty || 0);
      const stockoutRisk = remaining <= 0;
      return {
        productId: r.productId,
        productName: r.productName,
        carryover,
        production,
        sold,
        remaining,
        stockoutRisk
      };
    });

    const summary = {
      date,
      skuCount: perProduct.length,
      totalProduction: perProduct.reduce((s, x) => s + x.production, 0),
      totalSold: perProduct.reduce((s, x) => s + x.sold, 0),
      totalRemaining: perProduct.reduce((s, x) => s + x.remaining, 0),
      runoutItems: perProduct.filter(x => x.stockoutRisk).length
    };

    res.json({ success: true, data: { summary, products: perProduct } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch production daily', message: error.message });
  }
});

app.get('/api/waste/summary', async (req, res) => {
  try {
    const { start, end } = dateRange(req.query.period || 'week');
    const snap = await db.collection('dailyWastage')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();

    const rows = snap.docs.map(d => d.data());
    const byProduct = {};
    let totalQty = 0;
    let totalValue = 0;

    rows.forEach((r) => {
      const key = r.productId || r.productName || 'unknown';
      if (!byProduct[key]) byProduct[key] = { productId: r.productId || null, productName: r.productName || 'Unknown', qty: 0, value: 0 };
      byProduct[key].qty += r.qty || 0;
      byProduct[key].value += r.lossValue || r.amount || 0;
      totalQty += r.qty || 0;
      totalValue += r.lossValue || r.amount || 0;
    });

    const topWaste = Object.values(byProduct).sort((a, b) => b.value - a.value).slice(0, 10);
    res.json({ success: true, data: { range: { start, end }, totalQty, totalValue, topWaste } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch waste summary', message: error.message });
  }
});

app.get('/api/runouts', async (req, res) => {
  try {
    const date = req.query.date || todayKey();
    const snap = await db.collection('dailyInventory').where('date', '==', date).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const runouts = rows
      .map((r) => {
        const totalAvailable = (r.carryoverQty || 0) + (r.newProductionQty || 0);
        const remaining = totalAvailable - (r.soldQty || 0) + (r.cancelledQty || 0);
        return {
          productId: r.productId,
          productName: r.productName,
          remaining,
          sold: r.soldQty || 0,
          produced: r.newProductionQty || 0,
          date,
          likelyRunout: remaining <= 0
        };
      })
      .filter(x => x.likelyRunout)
      .sort((a, b) => a.remaining - b.remaining);

    res.json({ success: true, data: { date, count: runouts.length, runouts } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch runout report', message: error.message });
  }
});

app.get('/api/analysis/recommendations', async (req, res) => {
  try {
    const period = req.query.period || 'week';
    const { start, end } = dateRange(period);

    const [inventorySnap, wasteSnap] = await Promise.all([
      db.collection('dailyInventory').where('date', '>=', start).where('date', '<=', end).get(),
      db.collection('dailyWastage').where('date', '>=', start).where('date', '<=', end).get()
    ]);

    const invRows = inventorySnap.docs.map(d => d.data());
    const wasteRows = wasteSnap.docs.map(d => d.data());

    const demandMap = {};
    invRows.forEach((r) => {
      const key = r.productId || r.productName || 'unknown';
      if (!demandMap[key]) {
        demandMap[key] = {
          productId: r.productId || null,
          productName: r.productName || 'Unknown',
          produced: 0,
          sold: 0,
          days: 0
        };
      }
      demandMap[key].produced += r.newProductionQty || 0;
      demandMap[key].sold += r.soldQty || 0;
      demandMap[key].days += 1;
    });

    const wasteByProduct = {};
    wasteRows.forEach((w) => {
      const key = w.productId || w.productName || 'unknown';
      wasteByProduct[key] = (wasteByProduct[key] || 0) + (w.qty || 0);
    });

    const recommendations = Object.entries(demandMap).map(([key, row]) => {
      const waste = wasteByProduct[key] || 0;
      const sellThrough = row.produced > 0 ? row.sold / row.produced : 0;
      const action = sellThrough > 0.9
        ? 'Increase production 10-15% on high-demand windows.'
        : sellThrough < 0.6
          ? 'Reduce production and test bundle/promo to move volume.'
          : 'Maintain baseline production and monitor daily.';

      return {
        productId: row.productId,
        productName: row.productName,
        produced: row.produced,
        sold: row.sold,
        waste,
        sellThrough,
        action
      };
    }).sort((a, b) => b.sold - a.sold).slice(0, 20);

    const costingSignals = {
      highWasteItems: recommendations.filter(r => r.waste > 10).length,
      lowSellThroughItems: recommendations.filter(r => r.sellThrough < 0.6).length,
      note: 'Validate COGS using POS price and recipe costs for precise margin diagnostics.'
    };

    res.json({ success: true, data: { period, range: { start, end }, recommendations, costingSignals } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to build recommendations', message: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/production/daily',
      'GET /api/waste/summary',
      'GET /api/runouts',
      'GET /api/analysis/recommendations'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Proofmaster API running on http://localhost:${PORT}`);
});
