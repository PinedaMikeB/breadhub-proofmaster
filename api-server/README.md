# Breadhub Proofmaster API

Read-only analytics API for production, runouts, wastage, recommendation signals, starter fraud-review inbox data, and the first POS + Shinobi correlation writer.

## Setup
1. Copy `.env.example` to `.env`
2. Add Firebase service account JSON as `firebase-service-account.json`
3. Set `API_KEY`
4. Install deps and run:

```bash
npm install
npm run dev
```

## Endpoints
- `GET /api/health`
- `GET /api/production/daily?date=YYYY-MM-DD`
- `GET /api/waste/summary?period=today|week|month`
- `GET /api/runouts?date=YYYY-MM-DD`
- `GET /api/analysis/recommendations?period=today|week|month`
- `GET /api/fraud/incidents?limit=50&status=open&severity=high&from=2026-03-18&to=2026-03-19`
- `GET /api/fraud/summary?window_days=7`
- `GET /api/fraud/monitor-state`
- `GET /api/fraud/correlation/preview?hours=12&event_limit=1000&sale_window_seconds=120&drawer_cash_sale_window_seconds=300&cluster_gap_seconds=20&customer_interaction_seconds=45`
- `POST /api/fraud/correlation/run`

All endpoints require `x-api-key`.

## Fraud Correlation Writer

The first correlation pass reads:

- Firestore `sales` documents as the POS source of truth
- Shinobi `Events` rows from the local Docker container

Assumptions for the current starter writer:

- the local Shinobi container is named `shinobi` unless `SHINOBI_CONTAINER` is set
- clip links use `SHINOBI_BASE_URL` and default to `http://192.168.51.226:8080`
- POS sales live in Firestore collection `sales`
- Shinobi event region tags come from `details.matrices[].tag`

It then clusters nearby Shinobi events and emits `fraudIncidents` for these initial patterns:

- `handoff_without_sale`
- `drawer_without_customer`
- `drawer_without_sale`
- `extended_customer_interaction_without_sale`

`GET /api/fraud/correlation/preview` is read-only and returns the candidate incidents without writing anything.

`POST /api/fraud/correlation/run` persists the generated incidents into Firestore `fraudIncidents` using deterministic document IDs, so reruns update the same incident windows instead of creating duplicates.

## 24/7 Fraud Monitor

For the CCTV PC, use the local correlation runner instead of relying on a permanently running API process. The runner can use the Firebase CLI login already present on the machine and writes health into `fraudMonitorState/primary`.

One-off run:

```bash
node run-fraud-monitor.js --once --hours=48 --event-limit=3000 --drawer-cash-sale-window-seconds=300
```

Continuous loop in one terminal:

```bash
node run-fraud-monitor.js --continuous --interval-minutes=5 --hours=12 --drawer-cash-sale-window-seconds=300
```

Windows scheduled task registration:

```powershell
powershell -ExecutionPolicy Bypass -File .\register-fraud-monitor-task.ps1 -IntervalMinutes 5 -LookbackHours 12
```
