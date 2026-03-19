import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { buildCorrelatedIncidents, persistCorrelatedIncidents } from './fraud-correlation.js';

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

const toIso = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const incidentSortTime = (incident) => {
  return new Date(
    incident.incidentAt ||
    incident.createdAt ||
    incident.incidentWindowStart ||
    0
  ).getTime();
};

const serializeIncident = (doc) => {
  const row = doc.data();
  return {
    id: doc.id,
    type: row.type || 'incident',
    title: row.title || 'Suspicious Cashier Incident',
    severity: row.severity || 'medium',
    status: row.status || 'open',
    incidentAt: toIso(row.incidentAt || row.createdAt),
    incidentWindowStart: toIso(row.incidentWindowStart),
    incidentWindowEnd: toIso(row.incidentWindowEnd),
    cashierId: row.cashierId || null,
    cashierName: row.cashierName || row.cashierId || 'Unassigned',
    matchedSaleId: row.matchedSaleId || null,
    saleAmount: row.saleAmount ?? null,
    posRegistered: row.posRegistered === true,
    regionTags: Array.isArray(row.regionTags) ? row.regionTags : [],
    evidenceSummary: row.evidenceSummary || '',
    cameraName: row.cameraName || 'Cashier Camera',
    shinobiMonitorId: row.shinobiMonitorId || row.monitorId || null,
    clipLabel: row.clipLabel || null,
    clipUrl: row.clipUrl || null,
    clipPath: row.clipPath || null,
    clipStart: toIso(row.clipStart),
    clipEnd: toIso(row.clipEnd),
    source: row.source || 'correlation-engine',
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
};

const parsePositiveInt = (value, fallback, max) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return typeof max === 'number' ? Math.min(parsed, max) : parsed;
};

const getCorrelationOptions = (source = {}) => ({
  hours: parsePositiveInt(source.hours, 12, 72),
  eventLimit: parsePositiveInt(source.event_limit || source.eventLimit, 1000, 5000),
  saleMatchWindowSeconds: parsePositiveInt(source.sale_window_seconds || source.saleMatchWindowSeconds, 120, 900),
  drawerCashSaleWindowSeconds: parsePositiveInt(source.drawer_cash_sale_window_seconds || source.drawerCashSaleWindowSeconds, 300, 1200),
  clusterGapSeconds: parsePositiveInt(source.cluster_gap_seconds || source.clusterGapSeconds, 20, 180),
  customerInteractionSeconds: parsePositiveInt(source.customer_interaction_seconds || source.customerInteractionSeconds, 45, 600)
});

const parseDateBoundary = (value, boundary = 'start') => {
  if (!value) return null;
  const suffix = boundary === 'end' ? 'T23:59:59.999' : 'T00:00:00.000';
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

app.get('/api/fraud/incidents', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const status = req.query.status || null;
    const severity = req.query.severity || null;
    const cashierId = req.query.cashierId || null;
    const fromDate = parseDateBoundary(req.query.from, 'start');
    const toDate = parseDateBoundary(req.query.to, 'end');

    let query = db.collection('fraudIncidents');
    if (fromDate) query = query.where('incidentAt', '>=', fromDate);
    if (toDate) query = query.where('incidentAt', '<=', toDate);

    const snapshot = await query.orderBy('incidentAt', 'desc').limit(200).get();
    let incidents = snapshot.docs.map(serializeIncident);

    incidents.sort((a, b) => incidentSortTime(b) - incidentSortTime(a));

    if (status) incidents = incidents.filter((incident) => incident.status === status);
    if (severity) incidents = incidents.filter((incident) => incident.severity === severity);
    if (cashierId) incidents = incidents.filter((incident) => incident.cashierId === cashierId);

    incidents = incidents.slice(0, limit);

    res.json({
      success: true,
      data: {
        count: incidents.length,
        incidents
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch fraud incidents', message: error.message });
  }
});

app.get('/api/fraud/summary', async (req, res) => {
  try {
    const windowDays = Math.min(parseInt(req.query.window_days || '7', 10), 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);

    const snapshot = await db.collection('fraudIncidents').limit(500).get();
    const incidents = snapshot.docs
      .map(serializeIncident)
      .filter((incident) => {
        const incidentAt = incident.incidentAt ? new Date(incident.incidentAt) : null;
        return incidentAt && incidentAt >= cutoff;
      });

    const summary = {
      windowDays,
      total: incidents.length,
      open: incidents.filter((incident) => incident.status === 'open').length,
      reviewing: incidents.filter((incident) => incident.status === 'reviewing').length,
      critical: incidents.filter((incident) => incident.severity === 'critical').length,
      high: incidents.filter((incident) => incident.severity === 'high').length,
      noSaleFound: incidents.filter((incident) => !incident.matchedSaleId).length,
      customerInvolved: incidents.filter((incident) => incident.regionTags.includes('Customer')).length
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch fraud summary', message: error.message });
  }
});

app.get('/api/fraud/monitor-state', async (req, res) => {
  try {
    const snapshot = await db.collection('fraudMonitorState').doc('primary').get();
    res.json({
      success: true,
      data: snapshot.exists ? snapshot.data() : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch fraud monitor state', message: error.message });
  }
});

app.get('/api/fraud/correlation/preview', async (req, res) => {
  try {
    const options = getCorrelationOptions(req.query);
    const result = await buildCorrelatedIncidents(db, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to build fraud correlation preview',
      message: error.message
    });
  }
});

app.post('/api/fraud/correlation/run', async (req, res) => {
  try {
    const options = getCorrelationOptions({ ...(req.query || {}), ...(req.body || {}) });
    const result = await persistCorrelatedIncidents(db, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to persist correlated fraud incidents',
      message: error.message
    });
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
      'GET /api/analysis/recommendations',
      'GET /api/fraud/incidents',
      'GET /api/fraud/summary',
      'GET /api/fraud/monitor-state',
      'GET /api/fraud/correlation/preview',
      'POST /api/fraud/correlation/run'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Proofmaster API running on http://localhost:${PORT}`);
});
