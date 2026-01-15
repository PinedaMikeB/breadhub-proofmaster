/**
 * BreadHub ProofMaster - Finishing Station Module
 * 
 * JIT (Just-In-Time) Finishing System
 * - Track base bread inventory (pre-baked, stored in cabinet)
 * - Quick tap to convert base → finished product
 * - Auto-updates both base inventory and finished product inventory
 * - Logs all conversions for analytics
 */

const FinishingStation = {
    baseInventory: {},  // { baseBreedId: { qty, lastUpdated } }
    selectedDate: null,
    
    async init() {
        this.selectedDate = this.getTodayString();
        await this.loadBaseInventory();
    },
    
    getTodayString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    
    // ===== DATA LOADING =====
    async loadBaseInventory() {
        try {
            const snapshot = await db.collection('dailyBaseInventory')
                .where('date', '==', this.selectedDate)
                .get();
            
            this.baseInventory = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                this.baseInventory[data.baseBreadId] = {
                    id: doc.id,
                    qty: data.qty || 0,
                    produced: data.produced || 0,
                    finished: data.finished || 0,
                    carryover: data.carryover || 0,
                    lastUpdated: data.updatedAt
                };
            });
        } catch (error) {
            console.error('Error loading base inventory:', error);
        }
    },
    
    getBaseQty(baseBreadId) {
        const inv = this.baseInventory[baseBreadId];
        if (!inv) return 0;
        return inv.carryover + inv.produced - inv.finished;
    },
    
    // ===== BASE BREAD PRODUCTION =====
    async addBaseProduction(baseBreadId, qty) {
        try {
            const docId = `${this.selectedDate}_${baseBreadId}`;
            const existing = this.baseInventory[baseBreadId];
            
            if (existing) {
                await db.collection('dailyBaseInventory').doc(existing.id).update({
                    produced: firebase.firestore.FieldValue.increment(qty),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await db.collection('dailyBaseInventory').doc(docId).set({
                    baseBreadId,
                    date: this.selectedDate,
                    carryover: 0,
                    produced: qty,
                    finished: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Log the production
            await db.collection('finishingLogs').add({
                type: 'base_production',
                baseBreadId,
                qty,
                date: this.selectedDate,
                performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                performedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await this.loadBaseInventory();
            Toast.success(`Added ${qty} base breads`);
            this.render();
        } catch (error) {
            console.error('Error adding base production:', error);
            Toast.error('Failed to add production');
        }
    },
    
    // ===== FINISHING (Convert Base → Finished Product) =====
    async finishProduct(baseBreadId, productId, qty) {
        const available = this.getBaseQty(baseBreadId);
        
        if (qty > available) {
            Toast.error(`Only ${available} base breads available`);
            return false;
        }
        
        try {
            // 1. Deduct from base inventory
            const baseInv = this.baseInventory[baseBreadId];
            await db.collection('dailyBaseInventory').doc(baseInv.id).update({
                finished: firebase.firestore.FieldValue.increment(qty),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // 2. Add to finished product inventory (dailyInventory)
            const product = Products.data.find(p => p.id === productId);
            const dailyInvId = `${this.selectedDate}_${productId}`;
            
            const dailyInvDoc = await db.collection('dailyInventory').doc(dailyInvId).get();
            
            if (dailyInvDoc.exists) {
                // Update existing
                await db.collection('dailyInventory').doc(dailyInvId).update({
                    newProductionQty: firebase.firestore.FieldValue.increment(qty),
                    totalAvailable: firebase.firestore.FieldValue.increment(qty),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Create new
                await db.collection('dailyInventory').doc(dailyInvId).set({
                    productId,
                    productName: product?.name || 'Unknown',
                    category: product?.category || '',
                    date: this.selectedDate,
                    carryoverQty: 0,
                    newProductionQty: qty,
                    totalAvailable: qty,
                    soldQty: 0,
                    reservedQty: 0,
                    actualRemaining: null,
                    variance: null,
                    status: 'active',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // 3. Log the finishing
            await db.collection('finishingLogs').add({
                type: 'finish',
                baseBreadId,
                productId,
                productName: product?.name,
                qty,
                date: this.selectedDate,
                performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                performedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // 4. Create stock movement
            await db.collection('stockMovements').add({
                productId,
                type: 'finishing',
                qty,
                date: this.selectedDate,
                notes: `Finished from base: ${BaseBreads.getById(baseBreadId)?.name}`,
                performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                performedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await this.loadBaseInventory();
            Toast.success(`Finished ${qty}x ${product?.name}`);
            this.render();
            return true;
            
        } catch (error) {
            console.error('Error finishing product:', error);
            Toast.error('Failed to finish product');
            return false;
        }
    },

    // ===== RENDER UI =====
    async render() {
        const container = document.getElementById('finishingStationContent');
        if (!container) return;
        
        await this.loadBaseInventory();
        const activeBases = BaseBreads.getActive();
        const products = Products.data || [];
        
        // Get current time for header
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div>
                    <span style="font-size:1.5rem;font-weight:600;">${timeStr}</span>
                    <span style="color:#666;margin-left:12px;">${this.formatDate(this.selectedDate)}</span>
                </div>
                <button class="btn btn-primary" onclick="FinishingStation.showAddBaseProductionModal()">
                    + Add Base Production
                </button>
            </div>
        `;
        
        if (activeBases.length === 0) {
            html += `
                <div class="empty-state">
                    <p>No base breads configured.</p>
                    <p>Go to <strong>Base Breads</strong> to add some first.</p>
                </div>
            `;
            container.innerHTML = html;
            return;
        }
        
        // Render each base bread section
        for (const base of activeBases) {
            const available = this.getBaseQty(base.id);
            const inv = this.baseInventory[base.id] || { carryover: 0, produced: 0, finished: 0 };
            
            // Get products linked to this base
            const linkedProducts = products.filter(p => p.baseBreadId === base.id);
            
            const stockColor = available <= 0 ? '#C62828' : available <= 5 ? '#F57C00' : '#2E7D32';
            
            html += `
                <div style="background:white;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span style="font-size:2.5rem;">${base.icon || '🍞'}</span>
                            <div>
                                <h3 style="margin:0;">${base.name}</h3>
                                <div style="font-size:0.85rem;color:#666;">
                                    Carryover: ${inv.carryover} | Produced: ${inv.produced} | Finished: ${inv.finished}
                                </div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:2.5rem;font-weight:bold;color:${stockColor};">${available}</div>
                            <div style="font-size:0.85rem;color:#666;">in cabinet</div>
                        </div>
                    </div>
                    
                    ${available <= 0 ? `
                        <div style="background:#FFEBEE;padding:12px;border-radius:8px;text-align:center;color:#C62828;">
                            ⚠️ No base bread available. Add production first.
                        </div>
                    ` : linkedProducts.length === 0 ? `
                        <div style="background:#FFF3E0;padding:12px;border-radius:8px;text-align:center;color:#E65100;">
                            No products linked to this base. Go to Products → Edit → Set Base Bread.
                        </div>
                    ` : `
                        <div style="display:flex;flex-wrap:wrap;gap:12px;">
                            ${linkedProducts.map(p => `
                                <button class="btn btn-secondary" 
                                        onclick="FinishingStation.showFinishModal('${base.id}', '${p.id}')"
                                        style="padding:16px 20px;min-width:120px;text-align:center;">
                                    <div style="font-size:1rem;font-weight:600;">${this.getShortName(p.name, base.name)}</div>
                                    <div style="font-size:0.8rem;color:#666;">₱${p.finalSRP || 0}</div>
                                </button>
                            `).join('')}
                        </div>
                    `}
                </div>
            `;
        }
        
        container.innerHTML = html;
    },

    // Get short name (remove base name from product name)
    getShortName(productName, baseName) {
        // Remove common base words from product name
        const baseWords = baseName.toLowerCase().replace('base', '').trim().split(' ');
        let shortName = productName;
        
        baseWords.forEach(word => {
            if (word.length > 2) {
                const regex = new RegExp(word, 'gi');
                shortName = shortName.replace(regex, '').trim();
            }
        });
        
        return shortName || productName;
    },
    
    formatDate(dateStr) {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'short', day: 'numeric'
        });
    },
    
    // ===== MODALS =====
    showAddBaseProductionModal() {
        const activeBases = BaseBreads.getActive();
        
        const content = `
            <div class="form-group">
                <label>Base Bread *</label>
                <select id="baseSelect" class="form-input">
                    <option value="">-- Select Base Bread --</option>
                    ${activeBases.map(b => `
                        <option value="${b.id}">${b.icon} ${b.name}</option>
                    `).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label>Quantity Produced *</label>
                <input type="number" id="baseQty" class="form-input" min="1" value="10" 
                       style="font-size:1.5rem;text-align:center;">
            </div>
            
            <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('baseQty').value=10">10</button>
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('baseQty').value=20">20</button>
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('baseQty').value=30">30</button>
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('baseQty').value=50">50</button>
            </div>
        `;
        
        Modal.open({
            title: '🍞 Add Base Bread Production',
            content,
            saveText: 'Add Production',
            onSave: () => this.saveBaseProduction()
        });
    },
    
    async saveBaseProduction() {
        const baseBreadId = document.getElementById('baseSelect').value;
        const qty = parseInt(document.getElementById('baseQty').value) || 0;
        
        if (!baseBreadId) {
            Toast.error('Please select a base bread');
            return;
        }
        if (qty <= 0) {
            Toast.error('Quantity must be greater than 0');
            return;
        }
        
        Modal.close();
        await this.addBaseProduction(baseBreadId, qty);
    },

    showFinishModal(baseBreadId, productId) {
        const base = BaseBreads.getById(baseBreadId);
        const product = Products.data.find(p => p.id === productId);
        const available = this.getBaseQty(baseBreadId);
        
        if (!base || !product) return;
        
        const content = `
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:3rem;">${base.icon}</div>
                <div style="font-size:1.2rem;font-weight:600;margin:8px 0;">${product.name}</div>
                <div style="color:#666;">Available base: <strong>${available}</strong></div>
            </div>
            
            <div class="form-group">
                <label>Quantity to Finish</label>
                <input type="number" id="finishQty" class="form-input" min="1" max="${available}" value="1" 
                       style="font-size:2rem;text-align:center;font-weight:bold;">
            </div>
            
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('finishQty').value=1">1</button>
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('finishQty').value=2">2</button>
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('finishQty').value=3">3</button>
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('finishQty').value=5">5</button>
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('finishQty').value=10">10</button>
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('finishQty').value=${available}">All (${available})</button>
            </div>
        `;
        
        Modal.open({
            title: `🎨 Finish: ${this.getShortName(product.name, base.name)}`,
            content,
            saveText: '✓ Finish & Add to Inventory',
            onSave: () => this.saveFinish(baseBreadId, productId)
        });
    },
    
    async saveFinish(baseBreadId, productId) {
        const qty = parseInt(document.getElementById('finishQty').value) || 0;
        const available = this.getBaseQty(baseBreadId);
        
        if (qty <= 0) {
            Toast.error('Quantity must be greater than 0');
            return;
        }
        if (qty > available) {
            Toast.error(`Only ${available} base breads available`);
            return;
        }
        
        Modal.close();
        await this.finishProduct(baseBreadId, productId, qty);
    }
};

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FinishingStation.init());
} else {
    FinishingStation.init();
}
