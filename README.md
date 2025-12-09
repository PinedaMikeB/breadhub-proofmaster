# BreadHub ProofMaster

A complete bakery production management and quality control system for BreadHub, Taytay, Rizal.

## 🍞 Features

- **Recipe Management**: Master ingredients, dough recipes, toppings, fillings
- **Product Assembly**: Combine dough + toppings + fillings with cost tracking
- **Production Planning**: Plan production runs with auto-calculated ingredients
- **Time-Critical Division**: Track dough age and manage division queue
- **Multi-Timer System**: Simultaneous proofing and baking timers with alerts
- **Cost Analysis**: Full cost breakdown per product with margin tracking
- **Quality Control**: QA checkpoints at mixing, proofing, and baking stages

## 🚀 Quick Start

### 1. Setup Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Go to **Project Settings → General → Your apps**
4. Click **Add app → Web**
5. Copy the config values

### 2. Configure the App

Edit `js/config.js` and replace the placeholder values:

```javascript
const CONFIG = {
    firebase: {
        apiKey: "YOUR_API_KEY",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abcdef"
    },
    // ... rest of config
};
```

### 3. Setup Firestore

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select a region (asia-southeast1 recommended for PH)

### 4. Run the App

Simply double-click `index.html` to open in your browser!

No server required - works directly from the file system.

## 📁 File Structure

```
BreadHub ProofMaster/
├── index.html          # Main application
├── css/
│   └── styles.css      # All styling
├── js/
│   ├── config.js       # Firebase & app configuration
│   ├── firebase-init.js # Firebase initialization
│   ├── utils.js        # Utility functions
│   ├── modal.js        # Modal & toast notifications
│   ├── ingredients.js  # Master ingredients management
│   ├── doughs.js       # Dough recipes management
│   ├── toppings.js     # Topping recipes management
│   ├── fillings.js     # Filling recipes management
│   ├── products.js     # Product assembly management
│   ├── production.js   # Production workflow
│   ├── timers.js       # Timer management
│   └── app.js          # Main application controller
└── README.md           # This file
```

## 📋 Getting Started Workflow

### Step 1: Add Ingredients
Go to **Ingredients** → Add your master ingredients with costs:
- Bread Flour (₱45/kg)
- Butter (₱380/kg)
- Sugar, yeast, salt, eggs, etc.

### Step 2: Create Dough Recipes
Go to **Dough Recipes** → Create your standard doughs:
- Sweet Dough (for pandecoco, ensaymada)
- Lean Dough (for pandesal)
- Each with mixing times, proof settings, and ingredients

### Step 3: Create Toppings & Fillings
- **Toppings**: Ensaymada icing, tiramisu cream, sugar glaze
- **Fillings**: Coconut filling, cinnamon sugar, cheese

### Step 4: Create Products
Go to **Products** → Combine dough + topping + filling:
- Pandecoco: Sweet Dough + Coconut Filling
- Ensaymada: Sweet Dough + Butter Icing
- Set portions, proof times, baking settings, and pricing

### Step 5: Start Production!
Go to **New Production** → Select products and quantities
- System calculates total dough and ingredients needed
- Follow step-by-step guidance for mixing, division, proofing, baking
- All timers and QA checkpoints built-in

## 💰 Cost Tracking

The system automatically calculates:
- **Material costs**: Based on ingredient prices and portions
- **Packaging costs**: Per piece
- **Labor costs**: Based on ₱39/hour minimum wage
- **Overhead costs**: Utilities, rent allocation
- **Profit margins**: Wholesale and retail

## ⚙️ Configuration

Edit `js/config.js` to customize:
- Currency symbol (default: ₱)
- Dough buffer percentage (default: 10%)
- Maximum dough age (default: 90 minutes)
- Labor cost per hour
- Timer alert thresholds

## 🔧 Development Notes

- Uses Firebase Compat SDK for file:// protocol support
- No build process required
- Works offline with Firestore persistence
- Mobile-responsive design

## 📱 Future Enhancements

- [ ] Photo capture for QA
- [ ] Multi-device sync
- [ ] Report generation
- [ ] Inventory management
- [ ] Staff management

---

Made with ❤️ for BreadHub, Taytay, Rizal
