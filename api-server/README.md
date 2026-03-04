# Breadhub Proofmaster API

Read-only analytics API for production, runouts, wastage, and recommendation signals.

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

All endpoints require `x-api-key`.
