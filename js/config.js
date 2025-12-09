/**
 * BreadHub ProofMaster - Configuration
 * 
 * IMPORTANT: Replace these values with your Firebase project credentials
 * Get these from: Firebase Console → Project Settings → General → Your apps
 */

const CONFIG = {
    firebase: {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_SENDER_ID",
        appId: "YOUR_APP_ID"
    },
    
    // Application settings
    app: {
        name: "BreadHub ProofMaster",
        version: "1.0.0",
        currency: "₱",
        locale: "en-PH"
    },
    
    // Default values
    defaults: {
        doughBuffer: 0.10,          // 10% extra dough
        maxDoughAge: 90,            // minutes
        laborCostPerHour: 39,       // ₱39/hour minimum wage
        overheadPerPiece: 0.80      // ₱0.80 per piece
    },
    
    // Timer alert thresholds (in minutes remaining)
    alerts: {
        warning: 10,                // Yellow warning
        critical: 5,                // Red critical
        urgent: 2                   // Urgent alarm
    }
};
