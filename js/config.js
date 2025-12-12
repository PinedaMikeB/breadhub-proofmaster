/**
 * BreadHub ProofMaster - Configuration
 * 
 * IMPORTANT: Replace these values with your Firebase project credentials
 * Get these from: Firebase Console → Project Settings → General → Your apps
 */

const CONFIG = {
    firebase: {
        apiKey: "AIzaSyAj2szYv9ynVFrxdH0tpUsOg7JmJn6Wq0g",
        authDomain: "breadhub-proofmaster.firebaseapp.com",
        projectId: "breadhub-proofmaster",
        storageBucket: "breadhub-proofmaster.firebasestorage.app",
        messagingSenderId: "222137689770",
        appId: "1:222137689770:web:645c552afa835732c852d3"
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
        doughBuffer: 0,              // No buffer (was 10% extra dough)
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
