/**
 * BreadHub ProofMaster - Firebase Initialization
 * Uses Firebase compat SDK for file:// protocol support
 */

// Firebase App instance
let app = null;
let db = null;
let auth = null;
let storage = null;

// Initialize Firebase
function initFirebase() {
    try {
        // Check if Firebase SDK loaded
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded');
            updateConnectionStatus(false, 'SDK not loaded');
            return false;
        }
        
        // Check if already initialized
        if (firebase.apps.length > 0) {
            app = firebase.apps[0];
        } else {
            // Initialize with config
            app = firebase.initializeApp(CONFIG.firebase);
        }
        
        // Get service instances
        db = firebase.firestore();
        auth = firebase.auth();
        storage = firebase.storage();
        
        // Enable offline persistence
        db.enablePersistence({ synchronizeTabs: true })
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('Persistence failed: Multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('Persistence not supported in this browser');
                }
            });
        
        // Monitor connection
        monitorConnection();
        
        console.log('Firebase initialized successfully');
        return true;
        
    } catch (error) {
        console.error('Firebase init error:', error);
        updateConnectionStatus(false, error.message);
        return false;
    }
}


// Monitor Firebase connection status
function monitorConnection() {
    // For Firestore, we'll ping periodically
    setInterval(async () => {
        try {
            // Try to read a small doc
            await db.collection('_health').doc('ping').get();
            updateConnectionStatus(true, 'Connected');
        } catch (error) {
            // Check if it's a network error or just missing doc
            if (error.code === 'unavailable') {
                updateConnectionStatus(false, 'Offline');
            } else {
                // Document doesn't exist but connection works
                updateConnectionStatus(true, 'Connected');
            }
        }
    }, 30000); // Check every 30 seconds
    
    // Initial check
    setTimeout(async () => {
        try {
            await db.collection('_health').doc('ping').get();
            updateConnectionStatus(true, 'Connected');
        } catch (error) {
            if (error.code === 'unavailable') {
                updateConnectionStatus(false, 'Offline');
            } else {
                updateConnectionStatus(true, 'Connected');
            }
        }
    }, 1000);
}

// Update UI connection status
function updateConnectionStatus(online, message) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;
    
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');
    
    if (online) {
        dot.classList.add('online');
        dot.classList.remove('offline');
    } else {
        dot.classList.add('offline');
        dot.classList.remove('online');
    }
    
    text.textContent = message;
}

// Firestore helper functions
const DB = {
    // Get a collection reference
    collection: (name) => db.collection(name),
    
    // Get all documents from a collection
    async getAll(collectionName) {
        const snapshot = await db.collection(collectionName).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    
    // Get a single document
    async get(collectionName, docId) {
        const doc = await db.collection(collectionName).doc(docId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    
    // Add a document
    async add(collectionName, data) {
        const docRef = await db.collection(collectionName).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    },
    
    // Update a document
    async update(collectionName, docId, data) {
        await db.collection(collectionName).doc(docId).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },
    
    // Delete a document
    async delete(collectionName, docId) {
        await db.collection(collectionName).doc(docId).delete();
    },
    
    // Query documents
    async query(collectionName, field, operator, value) {
        const snapshot = await db.collection(collectionName)
            .where(field, operator, value)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
};
