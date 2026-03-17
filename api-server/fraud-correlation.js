import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DEFAULTS = {
  shinobiContainer: process.env.SHINOBI_CONTAINER || 'shinobi',
  shinobiBaseUrl: process.env.SHINOBI_BASE_URL || 'http://192.168.51.226:8080',
  eventLookbackHours: Math.max(parseInt(process.env.FRAUD_EVENT_LOOKBACK_HOURS || '12', 10), 1),
  eventLimit: Math.max(parseInt(process.env.FRAUD_EVENT_LIMIT || '1000', 10), 50),
  saleMatchWindowSeconds: Math.max(parseInt(process.env.FRAUD_SALE_MATCH_WINDOW_SECONDS || '120', 10), 30),
  clusterGapSeconds: Math.max(parseInt(process.env.FRAUD_CLUSTER_GAP_SECONDS || '20', 10), 5),
  customerInteractionSeconds: Math.max(parseInt(process.env.FRAUD_CUSTOMER_INTERACTION_SECONDS || '45', 10), 10)
};

const escapeSqlInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIso = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
};

const toFirestoreDate = (value) => {
  const parsed = toDate(value);
  return parsed || null;
};

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const buildDateKeys = (hours) => {
  const keys = new Set();
  const now = new Date();
  for (let i = 0; i <= Math.ceil(hours / 24) + 1; i += 1) {
    const point = new Date(now);
    point.setDate(point.getDate() - i);
    keys.add(point.toISOString().split('T')[0]);
  }
  return Array.from(keys);
};

const normalizeSale = (doc) => {
  const row = doc.data();
  const timestamp = toDate(row.timestamp || row.createdAt || row.completedAt);
  if (!timestamp) return null;

  return {
    id: doc.id,
    saleId: row.saleId || doc.id,
    timestamp,
    timestampIso: timestamp.toISOString(),
    total: Number(row.total ?? row.netSales ?? row.amount ?? 0),
    paymentMethod: row.paymentMethod || row.payment_method || null,
    source: row.source || 'pos',
    cashierId: row.cashierId || row.createdBy || row.userId || null,
    cashierName: row.cashierName || row.createdByName || row.staffName || row.staff || null,
    items: Array.isArray(row.items) ? row.items : [],
    raw: row
  };
};

const parseMysqlTsv = (stdout) => {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('\t'));
};

const parseEventRow = (columns) => {
  const [time, ke, mid, detailsRaw] = columns;
  const timestamp = toDate(time);
  if (!timestamp || !detailsRaw) return null;

  let details;
  try {
    details = JSON.parse(detailsRaw);
  } catch (error) {
    return null;
  }

  const matrices = Array.isArray(details.matrices) ? details.matrices : [];
  const regionTags = unique(matrices.map((matrix) => matrix.tag));

  return {
    id: `${mid || 'monitor'}-${timestamp.toISOString()}`,
    timestamp,
    timestampIso: timestamp.toISOString(),
    ke,
    mid,
    regionTags,
    confidence: Number(details.confidence || 0),
    details,
    matrices
  };
};

const formatShinobiVideoFilename = (timestamp, extension = 'mp4') => {
  const date = toDate(timestamp);
  if (!date) return null;

  const [isoDate, isoTime] = date.toISOString().split('T');
  const timePart = (isoTime || '').split('.')[0].replace(/:/g, '-');
  return `${isoDate}T${timePart}.${extension}`;
};

const parseVideoRow = (columns, baseUrl = DEFAULTS.shinobiBaseUrl) => {
  const [mid, ke, time, end, ext, detailsRaw] = columns;
  const start = toDate(time);
  const finish = toDate(end);
  if (!start || !finish || !ke || !mid) return null;

  let details = {};
  try {
    details = detailsRaw ? JSON.parse(detailsRaw) : {};
  } catch (error) {
    details = {};
  }

  const filename = formatShinobiVideoFilename(start, ext || 'mp4');
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  const clipPath = filename ? `/videos/${ke}/${mid}/${filename}` : null;

  return {
    id: `${mid}-${start.toISOString()}`,
    ke,
    mid,
    start,
    end: finish,
    startIso: start.toISOString(),
    endIso: finish.toISOString(),
    filename,
    extension: ext || 'mp4',
    clipPath,
    clipUrl: clipPath ? `${normalizedBaseUrl}${clipPath}` : null,
    details
  };
};

const createCluster = (event) => ({
  ke: event.ke,
  mid: event.mid,
  start: event.timestamp,
  end: event.timestamp,
  events: [event],
  regionTags: [...event.regionTags],
  confidences: [event.confidence]
});

const finalizeCluster = (cluster) => {
  const incidentAt = new Date((cluster.start.getTime() + cluster.end.getTime()) / 2);
  return {
    ...cluster,
    incidentAt,
    incidentAtIso: incidentAt.toISOString(),
    incidentWindowStart: cluster.start.toISOString(),
    incidentWindowEnd: cluster.end.toISOString(),
    regionTags: unique(cluster.regionTags),
    durationSeconds: Math.max(Math.round((cluster.end.getTime() - cluster.start.getTime()) / 1000), 0),
    peakConfidence: Math.max(...cluster.confidences, 0)
  };
};

const clusterEvents = (events, clusterGapSeconds) => {
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const clusters = [];
  let current = null;

  for (const event of ordered) {
    if (
      current &&
      current.mid === event.mid &&
      (event.timestamp.getTime() - current.end.getTime()) <= (clusterGapSeconds * 1000)
    ) {
      current.end = event.timestamp;
      current.events.push(event);
      current.regionTags.push(...event.regionTags);
      current.confidences.push(event.confidence);
    } else {
      if (current) clusters.push(finalizeCluster(current));
      current = createCluster(event);
    }
  }

  if (current) clusters.push(finalizeCluster(current));
  return clusters;
};

const findClosestSale = (cluster, sales, saleMatchWindowSeconds) => {
  const windowMs = saleMatchWindowSeconds * 1000;
  let bestMatch = null;

  for (const sale of sales) {
    const diff = Math.abs(sale.timestamp.getTime() - cluster.incidentAt.getTime());
    if (diff > windowMs) continue;
    if (!bestMatch || diff < bestMatch.diff) {
      bestMatch = { sale, diff };
    }
  }

  return bestMatch ? bestMatch.sale : null;
};

const findBestVideo = (cluster, videos) => {
  const incidentAt = cluster.incidentAt.getTime();
  const sameMonitorVideos = videos.filter((video) => video.mid === cluster.mid && video.ke === cluster.ke);
  const containingVideo = sameMonitorVideos.find((video) => (
    video.start.getTime() <= incidentAt && incidentAt <= video.end.getTime()
  ));

  if (containingVideo) return containingVideo;

  let nearestVideo = null;
  for (const video of sameMonitorVideos) {
    const diff = Math.abs(video.start.getTime() - incidentAt);
    if (!nearestVideo || diff < nearestVideo.diff) {
      nearestVideo = { video, diff };
    }
  }

  return nearestVideo ? nearestVideo.video : null;
};

const classifyCluster = (cluster, matchedSale, customerInteractionSeconds) => {
  const tags = new Set(cluster.regionTags);
  const has = (tag) => tags.has(tag);

  if (has('Customer') && has('Handoff') && !matchedSale) {
    return {
      type: 'handoff_without_sale',
      title: 'Customer Handoff Without POS Registration',
      severity: 'critical',
      evidenceSummary: 'Customer and handoff regions fired in the review window, but no sale was matched nearby.'
    };
  }

  if (has('Drawer') && !has('Customer') && !matchedSale) {
    return {
      type: 'drawer_without_customer',
      title: 'Drawer Opened Without Customer Presence',
      severity: 'high',
      evidenceSummary: 'Drawer activity was detected without customer presence and no sale was matched nearby.'
    };
  }

  if (has('Drawer') && !matchedSale) {
    return {
      type: 'drawer_without_sale',
      title: 'Drawer Opened Without Matching Sale',
      severity: 'high',
      evidenceSummary: 'Drawer activity was detected in the cashier zone, but no POS sale was found in the configured matching window.'
    };
  }

  if (has('Customer') && has('Cashier') && cluster.durationSeconds >= customerInteractionSeconds && !matchedSale) {
    return {
      type: 'extended_customer_interaction_without_sale',
      title: 'Extended Customer Interaction Without Sale',
      severity: 'medium',
      evidenceSummary: 'Customer and cashier activity persisted beyond the interaction threshold with no matched POS sale.'
    };
  }

  return null;
};

const buildIncidentDoc = (cluster, matchedSale, matchedVideo, classification) => {
  const saleAmount = matchedSale ? Number(matchedSale.total || 0) : null;
  const cashierName = matchedSale?.cashierName || matchedSale?.cashierId || 'Unknown';
  return {
    type: classification.type,
    title: classification.title,
    severity: classification.severity,
    status: 'open',
    incidentAt: cluster.incidentAtIso,
    incidentWindowStart: cluster.incidentWindowStart,
    incidentWindowEnd: cluster.incidentWindowEnd,
    cashierId: matchedSale?.cashierId || null,
    cashierName,
    matchedSaleId: matchedSale?.saleId || null,
    saleAmount,
    posRegistered: Boolean(matchedSale),
    regionTags: cluster.regionTags,
    evidenceSummary: classification.evidenceSummary,
    cameraName: 'Cashier Camera',
    shinobiMonitorId: cluster.mid,
    clipLabel: matchedVideo ? `Open clip ${matchedVideo.filename}` : 'Shinobi clip pending',
    clipUrl: matchedVideo?.clipUrl || null,
    clipPath: matchedVideo?.clipPath || null,
    clipStart: matchedVideo?.startIso || null,
    clipEnd: matchedVideo?.endIso || null,
    source: 'pos-shinobi-correlation',
    correlationMeta: {
      eventCount: cluster.events.length,
      peakConfidence: cluster.peakConfidence,
      matchedSaleTimestamp: matchedSale?.timestampIso || null,
      matchedSalePaymentMethod: matchedSale?.paymentMethod || null,
      matchedSaleItemCount: matchedSale?.items?.length || 0,
      clipFilename: matchedVideo?.filename || null
    },
    updatedAt: new Date().toISOString()
  };
};

const buildIncidentId = (incident) => {
  return slugify([
    incident.type,
    incident.shinobiMonitorId,
    incident.incidentWindowStart
  ].join('-'));
};

export async function fetchRecentSales(db, hours = DEFAULTS.eventLookbackHours) {
  const dateKeys = buildDateKeys(hours);
  const snapshots = await Promise.all(
    dateKeys.map((dateKey) => db.collection('sales').where('dateKey', '==', dateKey).get())
  );

  const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
  return snapshots
    .flatMap((snapshot) => snapshot.docs.map(normalizeSale))
    .filter(Boolean)
    .filter((sale) => sale.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchRecentShinobiEvents(options = {}) {
  const hours = escapeSqlInt(options.hours, DEFAULTS.eventLookbackHours);
  const limit = escapeSqlInt(options.limit, DEFAULTS.eventLimit);
  const container = options.shinobiContainer || DEFAULTS.shinobiContainer;

  const sql = [
    'mysql -u root -N -B -e',
    `"SELECT time,ke,mid,details FROM ccio.\\\`Events\\\` WHERE time >= DATE_SUB(NOW(), INTERVAL ${hours} HOUR) ORDER BY time DESC LIMIT ${limit};"`
  ].join(' ');

  const { stdout } = await execFileAsync('docker', ['exec', container, 'sh', '-lc', sql], {
    windowsHide: true,
    maxBuffer: 5 * 1024 * 1024
  });

  return parseMysqlTsv(stdout)
    .map(parseEventRow)
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchRecentShinobiVideos(options = {}) {
  const hours = escapeSqlInt(options.hours, DEFAULTS.eventLookbackHours);
  const limit = escapeSqlInt(options.limit, DEFAULTS.eventLimit);
  const container = options.shinobiContainer || DEFAULTS.shinobiContainer;
  const baseUrl = options.shinobiBaseUrl || DEFAULTS.shinobiBaseUrl;

  const { stdout } = await execFileAsync('docker', [
    'exec',
    container,
    'mysql',
    '-u',
    'root',
    '-N',
    '-B',
    '-e',
    `SELECT mid,ke,time,end,ext,details FROM ccio.Videos WHERE time >= DATE_SUB(NOW(), INTERVAL ${hours} HOUR) ORDER BY time DESC LIMIT ${limit};`
  ], {
    windowsHide: true,
    maxBuffer: 5 * 1024 * 1024
  });

  return parseMysqlTsv(stdout)
    .map((columns) => parseVideoRow(columns, baseUrl))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

export async function buildCorrelatedIncidents(db, options = {}) {
  const hours = escapeSqlInt(options.hours, DEFAULTS.eventLookbackHours);
  const clusterGapSeconds = escapeSqlInt(options.clusterGapSeconds, DEFAULTS.clusterGapSeconds);
  const saleMatchWindowSeconds = escapeSqlInt(options.saleMatchWindowSeconds, DEFAULTS.saleMatchWindowSeconds);
  const customerInteractionSeconds = escapeSqlInt(options.customerInteractionSeconds, DEFAULTS.customerInteractionSeconds);

  const [sales, events, videos] = await Promise.all([
    fetchRecentSales(db, hours),
    fetchRecentShinobiEvents({ hours, limit: options.eventLimit, shinobiContainer: options.shinobiContainer }),
    fetchRecentShinobiVideos({
      hours,
      limit: options.videoLimit || options.eventLimit,
      shinobiContainer: options.shinobiContainer,
      shinobiBaseUrl: options.shinobiBaseUrl
    })
  ]);

  const clusters = clusterEvents(events, clusterGapSeconds);
  const incidents = [];

  for (const cluster of clusters) {
    const matchedSale = findClosestSale(cluster, sales, saleMatchWindowSeconds);
    const matchedVideo = findBestVideo(cluster, videos);
    const classification = classifyCluster(cluster, matchedSale, customerInteractionSeconds);
    if (!classification) continue;
    const incident = buildIncidentDoc(cluster, matchedSale, matchedVideo, classification);
    incidents.push({
      id: buildIncidentId(incident),
      ...incident
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    options: {
      hours,
      clusterGapSeconds,
      saleMatchWindowSeconds,
      customerInteractionSeconds
    },
    sourceCounts: {
      sales: sales.length,
      events: events.length,
      videos: videos.length,
      clusters: clusters.length
    },
    incidents
  };
}

export async function persistCorrelatedIncidents(db, options = {}) {
  const result = await buildCorrelatedIncidents(db, options);
  if (result.incidents.length === 0) {
    return {
      ...result,
      persisted: 0
    };
  }

  const batch = db.batch();
  const refs = result.incidents.map((incident) => db.collection('fraudIncidents').doc(incident.id));
  const existingSnapshots = await db.getAll(...refs);
  const existingById = new Map(existingSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data()]));

  result.incidents.forEach((incident, index) => {
    const ref = refs[index];
    const existing = existingById.get(incident.id) || {};
    const createdAt = existing.createdAt || toFirestoreDate(incident.createdAt) || toFirestoreDate(incident.updatedAt) || new Date();

    batch.set(ref, {
      ...incident,
      incidentAt: toFirestoreDate(incident.incidentAt),
      incidentWindowStart: toFirestoreDate(incident.incidentWindowStart),
      incidentWindowEnd: toFirestoreDate(incident.incidentWindowEnd),
      createdAt,
      updatedAt: toFirestoreDate(incident.updatedAt) || new Date()
    }, { merge: true });
  });

  await batch.commit();

  return {
    ...result,
    persisted: result.incidents.length
  };
}
