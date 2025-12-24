# BreadHub - Handoff Document
## Date: December 23, 2024
## Session: POS System + Loyverse Import Created

---

## PROJECT STRUCTURE

```
BreadHub Ecosystem (Shared Firebase Database)
├── ProofMaster (Production & Inventory)
│   └── /Volumes/Wotg Drive Mike/GitHub/BreadHub ProofMaster/
│
├── POS System (NEW - Sales & Import)
│   └── /Volumes/Wotg Drive Mike/GitHub/Breadhub-POS/
│
└── Website (E-commerce)
    └── /Volumes/Wotg Drive Mike/GitHub/Breadhub-website/

All apps share: breadhub-proofmaster Firebase project
```

---

## COMPLETED THIS SESSION

### 1. Packaging Materials Module ✅ (ProofMaster)
- Full CRUD for cups, bags, pouches, boxes, straws, lids, etc.
- Stock tracking with reorder alerts
- Bulk import of 38 common items
- Location: `js/packaging-materials.js`

### 2. BreadHub POS System ✅ (NEW PROJECT)
Complete POS system in `/Volumes/Wotg Drive Mike/GitHub/Breadhub-POS/`

**Files Created:**
```
Breadhub-POS/
├── index.html          # Main POS interface
├── css/
│   └── pos-styles.css  # Complete styling (971 lines)
└── js/
    ├── config.js       # Firebase config (shared with ProofMaster)
    ├── firebase-init.js # Database connection
    ├── utils.js        # Utility functions
    ├── modal.js        # Modal component
    ├── auth.js         # Authentication (shared users)
    ├── pos.js          # Main POS functionality
    ├── sales-import.js # Loyverse import system
    ├── reports.js      # Sales reports
    └── app.js          # App controller
```

**Features:**
- 🛒 Product grid with category filtering
- 🔍 Search products
- 🛍️ Cart management with quantity controls
- 💳 Checkout with Cash/GCash/Card
- 🏷️ Discount support (fixed/percent)
- 🧾 Receipt preview
- 📥 Loyverse CSV import
- 📊 Reports (Daily/Monthly/Products/Categories)

### 3. Loyverse Import System ✅

**Import Rules (As Requested):**
1. ✅ ProofMaster product names = **FINAL** (never overwritten)
2. ✅ ProofMaster costs = **TRUE** (Loyverse COGS ignored)
3. ✅ Only sales data imported: quantity, amounts, dates

**How It Works:**
```
Loyverse CSV → Parse → Map to ProofMaster Products → Import
                         ↓
               Uses TRUE costs from ProofMaster
               (Loyverse costs are ignored!)
```

**Mapping System:**
- First import requires mapping Loyverse names to ProofMaster products
- Mappings saved to `productMapping` collection
- Auto-map feature for similar names
- Skip option for items not in ProofMaster

---

## FIREBASE COLLECTIONS

### Shared Database: breadhub-proofmaster

```
Collections:
├── users                  # Shared authentication
├── products               # ProofMaster products (source of truth)
├── ingredients            # Raw ingredients
├── ingredientPrices       # Supplier pricing
├── packagingMaterials     # NEW: Cups, bags, etc.
├── doughs                 # Dough recipes
├── fillings               # Filling recipes
├── toppings               # Topping recipes
├── suppliers              # Supplier info
│
├── sales                  # POS transactions (NEW)
├── salesImports           # Loyverse import batches (NEW)
├── productMapping         # Loyverse → ProofMaster mapping (NEW)
│
└── productionRuns         # Production history
```

### Sales Record Schema
```javascript
{
  saleId: "S-20241223-001",
  dateKey: "2024-12-23",
  timestamp: "ISO string",
  
  items: [{
    productId: "xxx",
    productName: "Malunggay Pandesal",
    category: "pandesal",
    variantIndex: null,
    variantName: null,
    quantity: 5,
    unitPrice: 5,
    lineTotal: 25
  }],
  
  subtotal: 25,
  discount: 0,
  total: 25,
  
  paymentMethod: "cash",
  cashReceived: 30,
  change: 5,
  
  source: "pos",  // or "loyverse-import"
  createdBy: "user_id"
}
```

### Import Record Schema
```javascript
{
  label: "Oct-Dec 2025",
  importedAt: "ISO string",
  source: "loyverse",
  
  summary: {
    totalItems: 160,
    importedItems: 150,
    skippedItems: 10,
    totalQuantity: 35000,
    totalNetSales: 632317
  },
  
  items: [{
    loyverseName: "Malunggay Cheese Pandesal",
    productId: "xxx",           // ProofMaster ID
    productName: "Malunggay Pandesal",  // ProofMaster name
    quantity: 20191,
    netSales: 100435,
    trueCostPerUnit: 2.71,      // FROM PROOFMASTER!
    trueTotalCost: 54717.61,    // Calculated with TRUE cost
    trueProfit: 45717.39,       // TRUE profit
    trueMargin: 45.52           // TRUE margin
  }],
  
  dailySummaries: [{...}]
}
```

---

## LOYVERSE DATA ANALYSIS

Your Oct 13 - Dec 22, 2025 data:

| Month | Gross Sales | Daily Avg | Margin |
|-------|-------------|-----------|--------|
| October | ₱130,232 | ₱8,140 | 55.9% |
| November | ₱281,670 | ₱11,736 | 56.0% |
| December | ₱223,690 | ₱11,773 | 55.8% |
| **TOTAL** | **₱635,592** | **₱10,773** | **55.9%** |

**Top Products:**
1. Malunggay Cheese Pandesal - 20,191 sold
2. Spanish Bread - 1,850 sold (77.7% margin!)
3. Coffee Bun - 664 sold
4. Pan De Coco - 1,481 sold (79.5% margin!)

---

## HOW TO USE

### Running POS:
1. Open `/Volumes/Wotg Drive Mike/GitHub/Breadhub-POS/index.html`
2. Login with ProofMaster credentials
3. Start selling!

### Importing Loyverse Data:
1. Click "📥 Import" in POS header
2. Upload Item Sales CSV from Loyverse
3. (Optional) Upload Daily Sales CSV
4. Map unmapped products to ProofMaster
5. Click Import

### Hybrid Mode (Run Both):
```
Daily Workflow:
1. Use Loyverse during the day
2. Export CSVs at end of day
3. Import into BreadHub POS
4. View unified reports

OR

1. Use BreadHub POS directly
2. Sales recorded in real-time
3. View reports anytime
```

---

## NEXT STEPS

### Immediate:
1. **Test POS** - Open and verify it connects to Firebase
2. **Import Loyverse Data** - Use the 3 CSV files you uploaded
3. **Map Products** - First import will require mapping

### Soon:
1. **Inventory Deduction** - Auto-deduct ingredients/packaging on sale
2. **Link Packaging to Products** - Add packaging to variant recipes
3. **Receipt Printing** - Add print support

### Future:
1. **Employee Management** - Shifts, access levels
2. **Cash Drawer** - Opening/closing counts
3. **Inventory Alerts** - Low stock notifications

---

## GIT STATUS

### ProofMaster (to commit):
- `js/packaging-materials.js` (NEW)
- `js/app.js` (updated)
- `index.html` (updated)

### POS (new repo to initialize):
```bash
cd "/Volumes/Wotg Drive Mike/GitHub/Breadhub-POS"
git init
git add .
git commit -m "Initial BreadHub POS with Loyverse import"
```

---

*Generated: December 23, 2024*
*Session: POS System + Loyverse Import Complete*
