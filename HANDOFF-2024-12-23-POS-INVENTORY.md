# BreadHub ProofMaster - Handoff Document
## Date: December 23, 2024
## Session: Variant Support Complete → POS & Inventory System

---

## COMPLETED IN THIS SESSION

### 1. Full Variant Support with Recipes ✅
Each product can now have multiple variants (sizes/types), each with its **own complete recipe**:

**For BREADS (mainCategory: 'bread'):**
- 🥖 Dough Recipe + Weight
- 🥥 Fillings + Weights  
- 🧈 Toppings + Weights
- Packaging, Labor, Markup costs

**For DRINKS (mainCategory: 'drinks'):**
- 🧪 Individual Ingredients (from Ingredients collection with cost/gram)
- 🧈 Toppings (whip cream, etc.)
- Cup Size, Packaging, Labor, Markup costs

### 2. Real-time Cost Calculation per Variant ✅
- Each variant shows live cost breakdown
- Auto-calculates when ingredients/amounts change
- Shows: Total Cost, Suggested SRP, Actual Margin
- Margin color-coded (green ≥30%, yellow ≥20%, red <20%)

### 3. Product Cards & View Modal ✅
- Cards show variant count and price range
- View modal displays all variants with their recipes

### 4. Website Sync ✅
- Variants save to `shop.hasVariants` and `shop.variants`
- Website displays variant selector dropdown
- Price updates when variant selected

---

## CURRENT SCHEMA

### Product Document (Firebase: `products` collection)
```javascript
{
  name: "Avocado Shake",
  category: "non-coffee",
  mainCategory: "drinks",  // 'bread' | 'drinks'
  
  // Base recipe (used when hasVariants=false, or first variant's recipe)
  doughRecipeId: "",
  fillings: [],
  toppings: [],
  portioning: { doughWeight: 40, finalWeight: 38 },
  
  // Variants
  hasVariants: true,
  variants: [
    {
      name: "Tall",
      size: "12oz",
      price: 140,
      recipe: {
        // For drinks:
        ingredients: [{ ingredientId: "xxx", amount: 50 }],
        toppings: [{ recipeId: "xxx", weight: 10 }],
        cupSize: 12,
        // For breads:
        doughRecipeId: "xxx",
        doughWeight: 40,
        fillings: [{ recipeId: "xxx", weight: 15 }],
        finalWeight: 38,
        // Common:
        packagingCost: 5,
        laborCost: 1,
        markupPercent: 40
      }
    }
  ],
  
  // Shop settings (synced to website)
  shop: {
    isPublished: true,
    hasVariants: true,
    variants: [{ name: "Tall", size: "12oz", price: 140 }],
    imageUrl: "...",
    description: "..."
  },
  
  finalSRP: 140,  // Base price
  costs: { packaging: 5, labor: 1 },
  pricing: { markupPercent: 40 }
}
```

---

## NEXT SESSION: POS & INVENTORY SYSTEM

### User Requirements:
1. **Add Packaging Materials** - Similar to Ingredients but separate category
   - Paper bags, Pouches, Cups (12oz, 16oz, 22oz), Straws, etc.
   - Track stock levels
   - Include in product cost calculations

2. **Simple POS System** - Like Loyverse
   - Select products/variants to sell
   - Auto-deduct from inventory on sale
   - Track daily sales

### Suggested Implementation:

#### 1. New Collection: `packagingMaterials`
```javascript
{
  name: "Paper Cup 12oz",
  category: "cups",  // cups, bags, pouches, straws, lids, other
  unit: "pcs",
  currentStock: 500,
  reorderLevel: 100,
  costPerUnit: 3.50,  // ₱3.50 per cup
  supplierId: "xxx"
}
```

**Suggested Categories:**
- `cups` - Paper cups (12oz, 16oz, 22oz)
- `lids` - Cup lids
- `straws` - Straws
- `bags` - Paper bags, plastic bags
- `pouches` - Bread pouches, pastry bags
- `boxes` - Cake boxes, pastry boxes
- `containers` - Plastic containers
- `other` - Misc packaging

#### 2. New Collection: `sales` (for POS)
```javascript
{
  date: Timestamp,
  items: [
    {
      productId: "xxx",
      productName: "Avocado Shake",
      variantName: "Tall",
      variantIndex: 0,
      quantity: 2,
      unitPrice: 140,
      total: 280
    }
  ],
  subtotal: 280,
  discount: 0,
  total: 280,
  paymentMethod: "cash",
  cashReceived: 300,
  change: 20,
  createdBy: "user_id",
  createdAt: Timestamp
}
```

#### 3. Inventory Deduction on Sale
When a sale is completed:
1. For each item sold, look up the product's recipe
2. Deduct ingredients from `ingredients` collection (currentStock)
3. Deduct packaging from `packagingMaterials` collection
4. Record the sale in `sales` collection

#### 4. Link Packaging to Products
Update variant recipe to include packaging:
```javascript
recipe: {
  ingredients: [...],
  packaging: [
    { materialId: "cup_12oz", quantity: 1 },
    { materialId: "lid_12oz", quantity: 1 },
    { materialId: "straw", quantity: 1 }
  ]
}
```

---

## FILE LOCATIONS

### ProofMaster
- **Main App**: `/Volumes/Wotg Drive Mike/GitHub/BreadHub ProofMaster/`
- **Products JS**: `js/products.js` (1860 lines - contains all variant logic)
- **Ingredients JS**: `js/ingredients.js` (handles ingredient CRUD)
- **Ingredient Prices**: `js/ingredient-prices.js` (cost per gram)

### Website
- **Main Site**: `/Volumes/Wotg Drive Mike/GitHub/Breadhub-website/`
- **Products Page**: `products.html` (already supports variants)
- **Product Template**: `products/template.html`

### Firebase Collections
- `products` - Product catalog with variants
- `ingredients` - Raw ingredients (flour, milk, sugar)
- `ingredientPrices` - Price per gram from suppliers
- `doughs` - Dough recipes
- `fillings` - Filling recipes
- `toppings` - Topping recipes
- `suppliers` - Supplier info

---

## GIT STATUS

### ProofMaster
- **Latest Commit**: `b0da6de` - Add full variant support with recipes and cost calculations
- **Branch**: main
- **Remote**: https://github.com/PinedaMikeB/breadhub-proofmaster.git

### Website
- **Latest Commit**: `0ba5c41` - Fix: Remove composite index requirement
- **Branch**: main  
- **Remote**: https://github.com/BreadHub-Shop/breadhub-website.git
- **Live URL**: https://breadhub.shop

---

## RECOMMENDED APPROACH FOR NEXT SESSION

1. **Create Packaging Materials module** (`js/packaging-materials.js`)
   - CRUD for packaging items
   - Stock tracking
   - Reorder alerts

2. **Add Packaging to variant recipes**
   - Update variant UI to include packaging selection
   - Update cost calculation to include packaging materials

3. **Create Simple POS module** (`js/pos.js`)
   - Product selector with search
   - Variant selector
   - Cart management
   - Checkout with inventory deduction

4. **Create Sales History** (`js/sales.js`)
   - Daily sales report
   - Product performance
   - Inventory alerts

---

## NOTES

- The Ingredients module already has stock tracking (`currentStock` field)
- IngredientPrices has `getCheapest()` for cost calculation
- Products.updateVariantCost() can be extended to include packaging
- Consider using the same pattern as Ingredients for PackagingMaterials

---

*Generated: December 23, 2024*
*Session Duration: Variant implementation complete*
