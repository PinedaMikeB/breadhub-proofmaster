# BreadHub Inventory System - Technical Specification
## Phase 1: Manual Production + Real-time Stock Tracking

**Version:** 1.0  
**Date:** January 14, 2026  
**Status:** Planning

---

## 1. System Overview

### Architecture
```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   ProofMaster    │     │  breadhub.shop   │     │ breadhub.shop/pos│
│   (Backend)      │     │  (Website)       │     │ (Point of Sale)  │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ • Production     │     │ • Product Browse │     │ • Walk-in Sales  │
│ • Inventory Mgmt │     │ • Online Orders  │     │ • Process Online │
│ • Reconciliation │     │ • Payment        │     │ • Stock Deduction│
│ • Approval       │     │ • Stock Display  │     │ • Order Fulfill  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         └────────────────────────┴────────────────────────┘
                                  │
                          ┌───────▼───────┐
                          │   Firebase    │
                          │  (Firestore)  │
                          └───────────────┘
```

### Core Principles
1. **POS is the inventory gatekeeper** - All stock deductions happen through POS
2. **Paid = Reserved** - Online orders only reserve stock after payment confirmed
3. **FIFO Enforcement** - System pushes older stock first (carryover before new)
4. **Admin approval required** - Staff cannot modify beginning balance or close day without approval

---

## 2. Firebase Collections

### 2.1 `dailyInventory` - Daily Stock Records
```javascript
// Document ID: {date}_{productId} e.g., "2026-01-14_prod_pandesal"
{
  id: "2026-01-14_prod_pandesal",
  productId: "prod_pandesal",
  productName: "Pandesal",           // denormalized for quick display
  date: "2026-01-14",
  
  // ===== OPENING (set by system + baker) =====
  carryoverQty: 5,                   // auto from yesterday's actualRemaining
  carryoverBatchId: "batch_prev",    // track for FIFO
  newProductionQty: 50,              // baker inputs in ProofMaster
  productionBatchId: "batch_001",    // unique batch for today
  totalAvailable: 55,                // auto: carryover + newProduction
  
  // ===== LOCKED FLAG =====
  openingLocked: true,               // true after admin approves opening
  openingLockedBy: "mike_admin",
  openingLockedAt: Timestamp,
  
  // ===== REAL-TIME TRACKING (updated by POS) =====
  reservedQty: 10,                   // paid online orders not yet fulfilled
  soldQty: 30,                       // completed sales (walk-in + online)
  cancelledQty: 2,                   // returned to stock
  
  // ===== CALCULATED FIELDS =====
  sellableQty: 15,                   // totalAvailable - reservedQty - soldQty
  expectedRemaining: 25,             // totalAvailable - soldQty
  
  // ===== END OF DAY (staff inputs) =====
  actualRemaining: null,             // staff counts and enters
  variance: null,                    // auto: expectedRemaining - actualRemaining
  varianceRemarks: null,             // required if variance != 0
  
  // ===== DAY STATUS =====
  status: "open",                    // open → pending_closure → closed
  closedBy: null,
  closedAt: null,
  approvedBy: null,                  // admin who approved closure
  approvedAt: null,
  
  // ===== AUDIT =====
  createdAt: Timestamp,
  createdBy: "baker_juan",
  updatedAt: Timestamp
}
```

### 2.2 `orders` - All Orders (Online + Walk-in)
```javascript
{
  id: "order_20260114_001",
  orderNumber: 1001,                 // human-readable, daily reset
  source: "website" | "pos",
  type: "delivery" | "pickup" | "walkin",
  
  // ===== CUSTOMER =====
  customer: {
    name: "Maria Santos",
    phone: "09171234567",
    email: "maria@email.com",
    address: "123 Rizal St, Taytay",  // for delivery only
  },
  
  // ===== ITEMS =====
  items: [
    {
      productId: "prod_pandesal",
      productName: "Pandesal",
      qty: 10,
      unitPrice: 5.00,
      subtotal: 50.00,
      // FIFO tracking
      fromCarryover: 5,              // how many from yesterday's stock
      fromNewProduction: 5,          // how many from today's batch
    }
  ],
  
  // ===== TOTALS =====
  subtotal: 50.00,
  deliveryFee: 0,
  discount: 0,
  total: 50.00,
  
  // ===== PAYMENT =====
  paymentMethod: "gcash" | "maya" | "card" | "cod" | "cash",
  paymentStatus: "pending" | "paid" | "refunded",
  paymentReference: "GCASH-123456",  // from payment gateway
  paidAt: Timestamp,
  
  // ===== ORDER STATUS =====
  status: "pending_payment" | "paid_reserved" | "preparing" | "ready" | "completed" | "cancelled",
  
  // Status Flow for ONLINE PICKUP:
  // pending_payment → paid_reserved (stock reserved) → preparing → ready → completed (stock deducted)
  
  // Status Flow for ONLINE DELIVERY:
  // pending_payment → paid_reserved → preparing → out_for_delivery → completed
  
  // Status Flow for WALK-IN:
  // (created as) completed (stock deducted immediately)
  
  // ===== STOCK EFFECT TRACKING =====
  stockReserved: true,               // true when payment confirmed
  stockReservedAt: Timestamp,
  stockDeducted: false,              // true when order completed
  stockDeductedAt: null,
  
  // ===== POS PROCESSING =====
  processedBy: "staff_ana",          // POS staff who handled
  processedAt: Timestamp,
  preparedBy: "staff_ana",
  preparedAt: Timestamp,
  completedBy: "staff_ana",
  completedAt: Timestamp,
  
  // ===== CANCELLATION =====
  cancelledBy: null,
  cancelledAt: null,
  cancelReason: null,
  stockRestored: false,              // true if reserved stock was returned
  
  // ===== AUDIT =====
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 2.3 `stockMovements` - Audit Trail
```javascript
{
  id: "mov_20260114_001",
  date: "2026-01-14",
  productId: "prod_pandesal",
  
  type: "production" | "sale" | "reserve" | "unreserve" | "cancel_return" | "adjustment" | "carryover",
  
  qty: 10,                           // positive for in, negative for out
  
  // Reference
  orderId: "order_001",              // if sale/reserve related
  batchId: "batch_001",              // if production related
  
  // Before/After for audit
  stockBefore: 55,
  stockAfter: 45,
  reservedBefore: 0,
  reservedAfter: 10,
  
  reason: "Walk-in sale",
  performedBy: "staff_ana",
  performedAt: Timestamp,
  
  // For adjustments requiring approval
  requiresApproval: false,
  approvedBy: null,
  approvedAt: null
}
```

### 2.4 `productionBatches` - Track Batches for FIFO
```javascript
{
  id: "batch_20260114_001",
  date: "2026-01-14",
  productId: "prod_pandesal",
  
  initialQty: 50,
  remainingQty: 20,
  
  isCarryover: false,                // true if this is yesterday's leftover
  carryoverFromDate: null,           // "2026-01-13" if carryover
  
  producedBy: "baker_juan",
  producedAt: Timestamp,
  
  // FIFO priority (lower = sell first)
  priority: 1,                       // carryover = 0, today's production = 1
  
  status: "active" | "depleted",
  depletedAt: null
}
```

---

## 3. Stock Calculation Logic

### Real-time Stock Formula
```javascript
// Per product, per day
sellableQty = totalAvailable - reservedQty - soldQty + cancelledQty

// What website shows
displayStock = sellableQty

// What POS shows for walk-in
availableForWalkin = sellableQty

// What POS shows total (including reserved they need to fulfill)
totalInStore = sellableQty + reservedQty
```

### FIFO Deduction Logic
```javascript
async function deductStock(productId, qty, orderId) {
  // Get batches ordered by priority (carryover first)
  const batches = await getBatches(productId, 'active', orderBy: 'priority');
  
  let remaining = qty;
  const deductions = [];
  
  for (const batch of batches) {
    if (remaining <= 0) break;
    
    const deductFromBatch = Math.min(batch.remainingQty, remaining);
    deductions.push({
      batchId: batch.id,
      qty: deductFromBatch,
      isCarryover: batch.isCarryover
    });
    
    remaining -= deductFromBatch;
    
    // Update batch
    batch.remainingQty -= deductFromBatch;
    if (batch.remainingQty === 0) {
      batch.status = 'depleted';
    }
  }
  
  return deductions; // Track which batches fulfilled this order
}
```

---

## 4. API Endpoints / Functions

### 4.1 ProofMaster APIs

#### `recordProduction(productId, qty, bakerId)`
- Creates/updates dailyInventory for today
- Creates productionBatch record
- Creates stockMovement (type: production)
- **Requires:** Baker role

#### `getInventoryDashboard(date)`
- Returns all products with stock status for the day
- Includes: carryover, production, reserved, sold, sellable
- Real-time listener for live updates

#### `submitEndOfDay(productId, actualCount, remarks)`
- Staff submits physical count
- Calculates variance
- Sets status to "pending_closure"
- **Requires:** Staff role

#### `approveDay(date)`
- Admin reviews and approves all products for the day
- Locks the day
- Triggers carryover creation for next day
- **Requires:** Admin role

#### `adjustStock(productId, adjustment, reason)`
- For corrections (breakage, staff meals, etc.)
- Creates stockMovement with requiresApproval: true
- **Requires:** Admin approval

### 4.2 Website APIs

#### `getProductStock(productId)`
- Returns current sellableQty
- Used for "In Stock" / "X left" display

#### `getAllProductsWithStock()`
- Returns products with stock status
- For product listing page

#### `createOrder(orderData)`
- Creates order with status: "pending_payment"
- NO stock reservation yet

#### `confirmPayment(orderId, paymentRef)`
- Called by payment gateway webhook
- Reserves stock (deduct from sellable, add to reserved)
- Updates order status to "paid_reserved"
- Creates stockMovement (type: reserve)

### 4.3 POS APIs

#### `getOnlineOrders(status)`
- Returns online orders for POS queue
- Filters: paid_reserved, preparing, ready

#### `getPOSDashboard()`
- Returns all products with:
  - sellableQty (for walk-in)
  - reservedQty (pending online orders)
  - alerts (low stock, carryover to push)

#### `createWalkinSale(items, payment)`
- Creates order with status: "completed"
- Immediately deducts stock (FIFO)
- Creates stockMovement (type: sale)

#### `updateOrderStatus(orderId, newStatus)`
- Moves order through workflow
- On "completed": converts reserved → sold
- On "cancelled": restores reserved → sellable

#### `processOnlineOrder(orderId)`
- Marks as preparing
- Shows FIFO info (e.g., "Use 5 from yesterday's batch first!")

#### `completeOrder(orderId)`
- Final step - customer received product
- Converts reservedQty to soldQty
- Creates stockMovement (type: sale)

---

## 5. User Roles & Permissions

| Action | Baker | Staff | Admin |
|--------|-------|-------|-------|
| Record production | ✅ | ❌ | ✅ |
| View inventory | ✅ | ✅ | ✅ |
| Process POS sales | ❌ | ✅ | ✅ |
| Process online orders | ❌ | ✅ | ✅ |
| Submit end-of-day count | ❌ | ✅ | ✅ |
| Approve day closure | ❌ | ❌ | ✅ |
| Adjust stock | ❌ | ❌ | ✅ |
| Edit beginning balance | ❌ | ❌ | ✅ |
| View reports | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ |

---

## 6. UI Screens

### 6.1 ProofMaster Screens

#### Inventory Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│  📦 INVENTORY - January 14, 2026                    [Lock Day]  │
├─────────────────────────────────────────────────────────────────┤
│  🔍 Search products...                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🥯 PANDESAL                                    [Edit]   │   │
│  │                                                         │   │
│  │  Carryover:  5  │  Production: 50  │  Total: 55       │   │
│  │  ─────────────────────────────────────────────────     │   │
│  │  Reserved: 10   │  Sold: 30        │  Sellable: 15    │   │
│  │                                                         │   │
│  │  ⚠️ Push 5 carryover first!                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🧀 CHEESE BREAD                                [Edit]   │   │
│  │                                                         │   │
│  │  Carryover:  0  │  Production: 30  │  Total: 30       │   │
│  │  ─────────────────────────────────────────────────     │   │
│  │  Reserved: 5    │  Sold: 20        │  Sellable: 5     │   │
│  │                                                         │   │
│  │  🔴 Low stock!                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Production Entry (Baker)
```
┌─────────────────────────────────────────────────────────────────┐
│  🍞 RECORD PRODUCTION - January 14, 2026                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Product:    [Pandesal ▼]                                      │
│                                                                 │
│  Carryover from yesterday:  5 pcs (auto-filled, locked)        │
│                                                                 │
│  New Production:  [ 50 ] pcs                                   │
│                                                                 │
│  Total Available: 55 pcs                                       │
│                                                                 │
│  Notes: [Morning batch, ready by 6am          ]                │
│                                                                 │
│                              [Cancel]  [Save Production]        │
└─────────────────────────────────────────────────────────────────┘
```

#### End of Day Reconciliation
```
┌─────────────────────────────────────────────────────────────────┐
│  📋 END OF DAY - January 14, 2026              Status: OPEN     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Product        Expected    Actual    Variance    Remarks       │
│  ─────────────────────────────────────────────────────────────  │
│  Pandesal          15      [ 14 ]       -1       [Breakage ▼]  │
│  Cheese Bread       5      [  5 ]        0       [         ]   │
│  Ensaymada          8      [  6 ]       -2       [Staff meal]  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Total Variance: -3 pcs (₱45.00 value)                         │
│                                                                 │
│                    [Save Draft]  [Submit for Approval]          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 POS Screens

#### Main POS + Online Orders Queue
```
┌────────────────────────────────────────┬────────────────────────┐
│  💰 POINT OF SALE                      │  📦 ONLINE ORDERS (3)  │
├────────────────────────────────────────┼────────────────────────┤
│                                        │                        │
│  🥯 Pandesal         ₱5    [+]        │  🟡 #1042 - PICKUP     │
│      15 available (5 old stock⚠️)     │     Maria Santos       │
│                                        │     5x Pandesal        │
│  🧀 Cheese Bread     ₱12   [+]        │     Paid: GCash ✓      │
│      5 available                       │     [Prepare] [Cancel] │
│                                        │                        │
│  🥐 Ensaymada        ₱15   [+]        │  ─────────────────────  │
│      8 available (3 old stock⚠️)      │                        │
│                                        │  🟢 #1041 - DELIVERY   │
│  ─────────────────────────────────     │     Juan Cruz          │
│                                        │     10x Cheese Bread   │
│  CURRENT ORDER:                        │     Paid: Maya ✓       │
│  2x Pandesal           ₱10            │     [Out for Delivery] │
│  1x Cheese Bread       ₱12            │                        │
│  ────────────────────────             │  ─────────────────────  │
│  TOTAL:                ₱22            │                        │
│                                        │  🔵 #1040 - PREPARING  │
│  [Cash] [GCash] [Maya]                │     Ana Reyes          │
│                                        │     3x Ensaymada       │
│        [Complete Sale]                 │     [Mark Ready]       │
│                                        │                        │
└────────────────────────────────────────┴────────────────────────┘
```

### 6.3 Website Stock Display

#### Product Card
```
┌──────────────────────────┐
│  [    Product Image    ] │
│                          │
│  Pandesal                │
│  ₱5.00                   │
│                          │
│  ✅ In Stock (15)        │  ← or "⚠️ Only 3 left!" or "❌ Sold Out"
│                          │
│  [ Add to Cart ]         │
└──────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1A: Core Inventory (Week 1-2)
- [ ] Firebase collections setup
- [ ] ProofMaster: Production entry screen
- [ ] ProofMaster: Inventory dashboard (view only)
- [ ] Basic stock calculation functions

### Phase 1B: POS Integration (Week 3-4)
- [ ] POS: Walk-in sales with stock deduction
- [ ] POS: View online orders queue
- [ ] Stock real-time sync between POS and ProofMaster
- [ ] FIFO deduction logic

### Phase 1C: Website Integration (Week 5-6)
- [ ] Website: Display stock status on products
- [ ] Website: Stock validation before checkout
- [ ] Payment webhook: Reserve stock on payment
- [ ] Stock reservation system

### Phase 1D: Reconciliation (Week 7-8)
- [ ] End-of-day count entry
- [ ] Variance calculation
- [ ] Admin approval workflow
- [ ] Carryover automation

---

## 8. Future Phases (Out of Scope for Phase 1)

### Phase 2: Smart Features
- Low stock alerts & notifications
- Automatic reorder suggestions
- Sales forecasting based on history
- Waste tracking & analytics

### Phase 3: Advanced Inventory
- Ingredient-level inventory (flour, sugar, etc.)
- Recipe-based auto-deduction
- Supplier order integration
- Batch expiry tracking

---

## 9. Open Questions

1. **Stock display threshold** - At what quantity show "Only X left!" vs "In Stock"?
   - Suggestion: Show count when ≤ 5, otherwise just "In Stock"

2. **Reservation timeout** - How long to hold reserved stock if order not fulfilled?
   - Suggestion: No timeout for paid orders (admin manually cancels if needed)

3. **Multiple production entries** - Can baker add more production mid-day?
   - Suggestion: Yes, creates new batch with same-day priority

4. **Negative stock handling** - What if POS sells more than available?
   - Suggestion: Block sale, show "Insufficient stock" error

---

## Appendix: Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function hasRole(role) {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }
    
    function isAdmin() {
      return hasRole('admin');
    }
    
    function isBaker() {
      return hasRole('baker') || isAdmin();
    }
    
    function isStaff() {
      return hasRole('staff') || isAdmin();
    }
    
    // Daily Inventory
    match /dailyInventory/{docId} {
      allow read: if isAuthenticated();
      allow create: if isBaker();
      allow update: if isStaff() && 
        // Staff can only update certain fields
        (!request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['carryoverQty', 'openingLocked', 'approvedBy'])) 
        || isAdmin();
    }
    
    // Orders
    match /orders/{orderId} {
      allow read: if isAuthenticated();
      allow create: if true; // Website can create orders
      allow update: if isStaff();
    }
    
    // Stock Movements (audit log)
    match /stockMovements/{movId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if false; // Immutable audit log
    }
  }
}
```

---

*Document created: January 14, 2026*  
*Last updated: January 14, 2026*
