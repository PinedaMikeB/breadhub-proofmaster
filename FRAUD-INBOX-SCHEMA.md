# Fraud Inbox Schema

Starter target for ProofMaster's read-only `/admin/fraud` inbox.

## Collection

Use Firestore collection `fraudIncidents`.

Each document should represent one reviewable incident window, not one raw motion event.

## Recommended document shape

```js
{
  type: "drawer_without_sale",
  title: "Drawer Opened Without Matching Sale",
  severity: "high", // low | medium | high | critical
  status: "open", // open | reviewing | resolved | dismissed

  incidentAt: Timestamp,
  incidentWindowStart: Timestamp,
  incidentWindowEnd: Timestamp,

  cashierId: "cashier-001",
  cashierName: "Cashier A",

  matchedSaleId: null,
  saleAmount: null,
  posRegistered: false,

  regionTags: ["Drawer", "Cashier"],
  evidenceSummary: "Drawer motion detected with cashier presence but no sale.",

  cameraName: "Cashier Camera",
  shinobiMonitorId: "x0UNTvt8KV",
  source: "correlation-engine",

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Initial incident types

- `drawer_without_sale`
- `handoff_without_sale`
- `drawer_without_customer`
- `customer_sale_mismatch`
- `extended_customer_interaction_without_sale`

## Correlation guidance

POS remains the source of truth. CCTV regions provide context:

- `Customer`
- `Handoff`
- `Drawer`
- `Cashier`

The inbox should focus on suspicious time windows such as:

- drawer opened without nearby sale
- customer and handoff activity without nearby sale
- drawer activity with no customer region
- unusually long cashier and customer interaction with no transaction

## Current UI target

The starter read-only inbox should show:

- incident time
- incident title
- severity
- status
- cashier
- matched POS sale or `No sale found`
- region tags
- evidence summary
