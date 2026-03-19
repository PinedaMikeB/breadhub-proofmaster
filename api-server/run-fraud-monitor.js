import { persistCorrelatedIncidents } from './fraud-correlation.js';
import { FirestoreRestAdapter } from './firestore-rest.js';

const DEFAULTS = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'breadhub-proofmaster',
  hours: Math.max(parseInt(process.env.FRAUD_EVENT_LOOKBACK_HOURS || '12', 10), 1),
  eventLimit: Math.max(parseInt(process.env.FRAUD_EVENT_LIMIT || '2000', 10), 50),
  videoLimit: Math.max(parseInt(process.env.FRAUD_VIDEO_LIMIT || process.env.FRAUD_EVENT_LIMIT || '2000', 10), 50),
  saleMatchWindowSeconds: Math.max(parseInt(process.env.FRAUD_SALE_MATCH_WINDOW_SECONDS || '120', 10), 30),
  clusterGapSeconds: Math.max(parseInt(process.env.FRAUD_CLUSTER_GAP_SECONDS || '20', 10), 5),
  customerInteractionSeconds: Math.max(parseInt(process.env.FRAUD_CUSTOMER_INTERACTION_SECONDS || '45', 10), 10),
  intervalMinutes: Math.max(parseInt(process.env.FRAUD_MONITOR_INTERVAL_MINUTES || '5', 10), 1),
  stateDocId: process.env.FRAUD_MONITOR_STATE_DOC_ID || 'primary'
};

const parseArgs = (argv) => {
  const parsed = {};
  argv.forEach((arg) => {
    if (!arg.startsWith('--')) return;
    const [key, rawValue] = arg.slice(2).split('=');
    parsed[key] = rawValue === undefined ? true : rawValue;
  });
  return parsed;
};

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const computeNewestIncidentAt = (incidents = []) => {
  const newest = incidents.reduce((best, incident) => {
    const value = incident.incidentAt ? new Date(incident.incidentAt) : null;
    if (!value || Number.isNaN(value.getTime())) return best;
    return !best || value > best ? value : best;
  }, null);
  return newest ? newest.toISOString() : null;
};

const writeMonitorState = async (db, stateDocId, payload) => {
  const batch = db.batch();
  batch.set(db.collection('fraudMonitorState').doc(stateDocId), payload, { merge: true });
  await batch.commit();
};

const buildOptions = (args) => ({
  hours: toInt(args.hours, DEFAULTS.hours),
  eventLimit: toInt(args['event-limit'], DEFAULTS.eventLimit),
  videoLimit: toInt(args['video-limit'], DEFAULTS.videoLimit),
  saleMatchWindowSeconds: toInt(args['sale-window-seconds'], DEFAULTS.saleMatchWindowSeconds),
  clusterGapSeconds: toInt(args['cluster-gap-seconds'], DEFAULTS.clusterGapSeconds),
  customerInteractionSeconds: toInt(args['customer-interaction-seconds'], DEFAULTS.customerInteractionSeconds)
});

const runOnce = async (db, stateDocId, options) => {
  const startedAt = new Date();

  await writeMonitorState(db, stateDocId, {
    status: 'running',
    lastRunAt: startedAt,
    hours: options.hours,
    updatedAt: new Date()
  });

  try {
    const result = await persistCorrelatedIncidents(db, options);
    const completedAt = new Date();

    await writeMonitorState(db, stateDocId, {
      status: 'healthy',
      lastRunAt: completedAt,
      hours: options.hours,
      persistedCount: result.persisted || 0,
      generatedCount: result.incidents?.length || 0,
      latestIncidentAt: computeNewestIncidentAt(result.incidents),
      sourceCounts: result.sourceCounts || {},
      clusterCount: result.clusterCount || 0,
      updatedAt: completedAt,
      lastError: null
    });

    console.log(JSON.stringify({
      ok: true,
      at: completedAt.toISOString(),
      hours: options.hours,
      persisted: result.persisted || 0,
      generated: result.incidents?.length || 0,
      sourceCounts: result.sourceCounts || {},
      clusterCount: result.clusterCount || 0
    }));

    return result;
  } catch (error) {
    const failedAt = new Date();
    await writeMonitorState(db, stateDocId, {
      status: 'error',
      lastRunAt: failedAt,
      hours: options.hours,
      updatedAt: failedAt,
      lastError: error.message
    });
    throw error;
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const db = FirestoreRestAdapter.fromFirebaseCliConfig({
    projectId: args['project-id'] || DEFAULTS.projectId,
    configPath: args['cli-config'] || process.env.FIREBASE_CLI_CONFIG_PATH
  });
  const stateDocId = args['state-doc-id'] || DEFAULTS.stateDocId;
  const options = buildOptions(args);
  const runContinuously = Boolean(args.continuous) && !args.once;
  const intervalMinutes = toInt(args['interval-minutes'], DEFAULTS.intervalMinutes);

  do {
    await runOnce(db, stateDocId, options);
    if (!runContinuously) break;
    await sleep(intervalMinutes * 60 * 1000);
  } while (true);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
