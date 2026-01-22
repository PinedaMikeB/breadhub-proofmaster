/**
 * BreadHub ProofMaster - Inventory Management
 * Phase 1A: Manual Production Entry + Real-time Stock Tracking
 * 
 * Collections:
 * - dailyInventory: Per product per day stock records
 * - stockMovements: Audit trail of all stock changes
 * - productionBatches: FIFO batch tracking
 */

const Inventory = {
    // Current data
    dailyRecords: [],
    stockMovements: [],
    selectedDate: null,
    pendingCarryover: [], // Products that need carryover
    
    // Real-time listeners
    unsubscribe: null,
    
    async init() {
        this.selectedDate = this.getTodayString();
        await this.load();
        await this.checkPendingCarryover();
        this.setupRealtimeListener();
    },
    
    // ===== DATE HELPERS =====
    getTodayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`; // "2026-01-15" in local time
    },
    
    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    },
    
    formatDateShort(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    },
    
    // Check if there are products from yesterday that need carryover
    async checkPendingCarryover() {
        const todayStr = this.getTodayString();
        
        // Get yesterday's date in local time
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${year}-${month}-${day}`;
        
        try {
            const snapshot = await db.collection('dailyInventory')
                .where('date', '==', yesterdayStr)
                .get();
            
            const yesterdayRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Filter to only those with remaining stock
            const withRemaining = yesterdayRecords.filter(r => {
                const stock = this.calculateStock(r);
                return stock.expectedRemaining > 0;
            });
            
            // Check which already have today's record
            const todayProductIds = this.dailyRecords.map(r => r.productId);
            this.pendingCarryover = withRemaining.filter(r => !todayProductIds.includes(r.productId));
            
            console.log('Pending carryover:', this.pendingCarryover.length, 'products');
        } catch (error) {
            console.error('Error checking carryover:', error);
            this.pendingCarryover = [];
        }
    },

    // ===== DATA LOADING =====
    async load() {
        try {
            await this.loadDailyRecords(this.selectedDate);
        } catch (error) {
            console.error('Error loading inventory:', error);
            Toast.error('Failed to load inventory data');
        }
    },
    
    async loadDailyRecords(date) {
        try {
            // Query dailyInventory for the selected date
            const snapshot = await db.collection('dailyInventory')
                .where('date', '==', date)
                .get();
            
            this.dailyRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Sort by product name
            this.dailyRecords.sort((a, b) => 
                (a.productName || '').localeCompare(b.productName || '')
            );
            
            console.log(`Loaded ${this.dailyRecords.length} inventory records for ${date}`);
            
        } catch (error) {
            console.error('Error loading daily records:', error);
            throw error;
        }
    },
    
    setupRealtimeListener() {
        // Unsubscribe from previous listener
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        
        // Listen for changes to today's inventory
        this.unsubscribe = db.collection('dailyInventory')
            .where('date', '==', this.selectedDate)
            .onSnapshot(snapshot => {
                this.dailyRecords = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.dailyRecords.sort((a, b) => 
                    (a.productName || '').localeCompare(b.productName || '')
                );
                this.render();
            }, error => {
                console.error('Realtime listener error:', error);
            });
    },

    // ===== STOCK CALCULATIONS =====
    calculateStock(record) {
        const carryover = record.carryoverQty || 0;
        const production = record.newProductionQty || 0;
        const reserved = record.reservedQty || 0;
        const sold = record.soldQty || 0;
        const cancelled = record.cancelledQty || 0;
        
        const totalAvailable = carryover + production;
        const sellable = totalAvailable - reserved - sold + cancelled;
        const expectedRemaining = totalAvailable - sold + cancelled;
        
        return {
            carryover,
            production,
            totalAvailable,
            reserved,
            sold,
            cancelled,
            sellable: Math.max(0, sellable),
            expectedRemaining: Math.max(0, expectedRemaining)
        };
    },
    
    // ===== RENDER MAIN VIEW =====
    render() {
        console.log('Inventory.render() called, selectedDate:', this.selectedDate);
        const container = document.getElementById('inventoryGrid');
        if (!container) {
            console.error('inventoryGrid container not found!');
            return;
        }
        
        const isToday = this.selectedDate === this.getTodayString();
        console.log('isToday:', isToday, 'getTodayString:', this.getTodayString());
        
        // Date selector and action buttons
        let html = `
            <div class="inventory-controls" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="btn btn-secondary" onclick="Inventory.previousDay()" style="padding: 8px 12px;">
                        ◀
                    </button>
                    <input type="date" 
                           id="inventoryDatePicker" 
                           value="${this.selectedDate}" 
                           onchange="Inventory.changeDate(this.value)"
                           class="form-input"
                           style="width: auto;">
                    <button class="btn btn-secondary" onclick="Inventory.nextDay()" style="padding: 8px 12px;">
                        ▶
                    </button>
                    ${!isToday ? `<button class="btn btn-secondary" onclick="Inventory.goToToday()">Today</button>` : ''}
                </div>

                ${isToday ? `
                    <button class="btn btn-primary" onclick="Inventory.showProductionModal()">
                        + Add Stock
                    </button>
                    ${this.pendingCarryover.length > 0 ? `
                        <button class="btn btn-primary" onclick="Inventory.showCarryoverModal()" style="background:#FF9800;border-color:#F57C00;">
                            📦 Process Carryover (${this.pendingCarryover.length})
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="Inventory.showCarryoverModal()">
                            📦 Process Carryover
                        </button>
                    `}
                ` : ''}
                ${isToday && this.dailyRecords.length > 0 ? `
                    <button class="btn btn-secondary" onclick="Inventory.showEndOfDayModal()" style="background:#FFF3E0;border-color:#FF9800;color:#E65100;">
                        🌙 End of Day Count
                    </button>
                    <button class="btn btn-secondary" onclick="Inventory.reconcileWithPOS()" style="background:#E3F2FD;border-color:#1976D2;color:#1565C0;">
                        🔄 Reconcile with POS
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="Inventory.showWastageReport()" style="background:#FFEBEE;border-color:#C62828;color:#C62828;">
                    🗑️ Wastage
                </button>
            </div>
        `;
        
        // Summary stats
        const stats = this.calculateDayStats();
        html += `
            <div class="inventory-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div class="stat-card" style="background: #E3F2FD; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.8rem; font-weight: bold; color: #1565C0;">${stats.totalProducts}</div>
                    <div style="color: #666; font-size: 0.9rem;">Products</div>
                </div>
                <div class="stat-card" style="background: #E8F5E9; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.8rem; font-weight: bold; color: #2E7D32;">${stats.totalAvailable}</div>
                    <div style="color: #666; font-size: 0.9rem;">Total Available</div>
                </div>
                <div class="stat-card" style="background: #FFF3E0; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.8rem; font-weight: bold; color: #E65100;">${stats.totalReserved}</div>
                    <div style="color: #666; font-size: 0.9rem;">Reserved</div>
                </div>
                <div class="stat-card" style="background: #FCE4EC; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.8rem; font-weight: bold; color: #C2185B;">${stats.totalSold}</div>
                    <div style="color: #666; font-size: 0.9rem;">Sold</div>
                </div>
                <div class="stat-card" style="background: #F3E5F5; padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.8rem; font-weight: bold; color: #7B1FA2;">${stats.totalSellable}</div>
                    <div style="color: #666; font-size: 0.9rem;">Sellable</div>
                </div>
            </div>
        `;

        // Product cards
        if (this.dailyRecords.length === 0) {
            html += `
                <div class="empty-state" style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📦</div>
                    <h3>No Inventory Records</h3>
                    <p>No stock has been recorded for ${this.formatDate(this.selectedDate)}.</p>
                    ${isToday ? `
                        <button class="btn btn-primary" onclick="Inventory.showProductionModal()" style="margin-top: 16px;">
                            + Add First Stock
                        </button>
                        ${this.pendingCarryover.length > 0 ? `
                            <div style="background:#FFF3E0;padding:12px;border-radius:8px;margin:16px 0;color:#E65100;">
                                💡 <strong>${this.pendingCarryover.length} products</strong> have leftover from yesterday that can be carried over.
                            </div>
                            <button class="btn btn-secondary" onclick="Inventory.showCarryoverModal()" style="margin-top: 8px;background:#FF9800;border-color:#F57C00;">
                                📦 Process Carryover
                            </button>
                        ` : ''}
                    ` : ''}
                </div>
            `;
        } else {
            html += `<div class="inventory-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">`;
            
            for (const record of this.dailyRecords) {
                html += this.renderProductCard(record);
            }
            
            html += `</div>`;
        }
        
        container.innerHTML = html;
    },
    
    renderProductCard(record) {
        const stock = this.calculateStock(record);
        const isToday = this.selectedDate === this.getTodayString();
        
        // Check if product requires finishing
        const product = Products.data.find(p => p.id === record.productId);
        const requiresFinishing = product && product.baseBreadId;
        const baseBread = requiresFinishing ? BaseBreads.getById(product.baseBreadId) : null;
        
        // Status indicators
        let statusBadge = '';
        let stockColor = '#2E7D32'; // green
        
        if (stock.sellable <= 0) {
            statusBadge = '<span style="background:#FFEBEE;color:#C62828;padding:4px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;">SOLD OUT</span>';
            stockColor = '#C62828';
        } else if (stock.sellable <= 5) {
            statusBadge = '<span style="background:#FFF3E0;color:#E65100;padding:4px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;">LOW STOCK</span>';
            stockColor = '#E65100';
        }
        
        // Finishing badge
        const finishingBadge = requiresFinishing ? `
            <span style="background:#FFF8E1;color:#F57C00;padding:4px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;margin-right:4px;" title="Requires finishing from ${baseBread?.name || 'base bread'}">
                🎨 ${baseBread?.icon || '🍞'}
            </span>
        ` : '';
        
        // Carryover warning
        let carryoverWarning = '';
        if (stock.carryover > 0 && stock.carryover <= stock.sellable) {
            carryoverWarning = `
                <div style="background:#FFF8E1;border-left:3px solid #FFA000;padding:8px;margin-top:8px;border-radius:4px;font-size:0.85rem;">
                    ⚠️ Push ${stock.carryover} carryover first!
                </div>
            `;
        }

        return `
            <div class="inventory-card" style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow:hidden;">
                <div style="background:linear-gradient(135deg,#8E44AD,#9B59B6);padding:16px;color:white;">
                    <div style="display:flex;justify-content:space-between;align-items:start;">
                        <div>
                            <h3 style="margin:0;font-size:1.1rem;">${record.productName || 'Unknown Product'}</h3>
                            <span style="opacity:0.8;font-size:0.85rem;">${Products.formatCategoryWithEmoji(record.category) || ''}</span>
                        </div>
                        <div>${finishingBadge}${statusBadge}</div>
                    </div>
                </div>
                <div style="padding:16px;">
                    <!-- Stock Breakdown -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                        <div style="background:#F5F5F5;padding:8px;border-radius:6px;">
                            <div style="font-size:0.75rem;color:#666;">Carryover</div>
                            <div style="font-size:1.2rem;font-weight:600;color:#666;">${stock.carryover}</div>
                        </div>
                        <div style="background:#E8F5E9;padding:8px;border-radius:6px;">
                            <div style="font-size:0.75rem;color:#666;">New Production</div>
                            <div style="font-size:1.2rem;font-weight:600;color:#2E7D32;">${stock.production}</div>
                        </div>
                    </div>
                    
                    <div style="border-top:1px solid #eee;padding-top:12px;margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#666;">Total Available:</span>
                            <strong>${stock.totalAvailable}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#666;">Reserved (online):</span>
                            <span style="color:#1565C0;font-weight:500;">${stock.reserved}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#666;">Sold:</span>
                            <span style="color:#C2185B;font-weight:500;">${stock.sold}</span>
                        </div>
                    </div>
                    
                    <!-- Sellable Highlight -->
                    <div style="background:#F3E5F5;padding:12px;border-radius:8px;text-align:center;">
                        <div style="font-size:0.85rem;color:#666;">Available to Sell</div>
                        <div style="font-size:2rem;font-weight:bold;color:${stockColor};">${stock.sellable}</div>
                    </div>
                    
                    ${carryoverWarning}
                    
                    <!-- End of Day Status -->
                    ${record.actualRemaining !== null ? `
                        <div style="background:${record.variance === 0 ? '#E8F5E9' : '#FFEBEE'};padding:10px;border-radius:8px;margin-top:8px;">
                            <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
                                <span>End Count:</span>
                                <strong>${record.actualRemaining}</strong>
                            </div>
                            <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
                                <span>Variance:</span>
                                <span style="color:${record.variance === 0 ? '#2E7D32' : '#C62828'};font-weight:600;">
                                    ${record.variance > 0 ? '+' : ''}${record.variance}
                                </span>
                            </div>
                            ${record.varianceRemarks ? `<div style="font-size:0.8rem;color:#666;margin-top:4px;">📝 ${record.varianceRemarks}</div>` : ''}
                            <div style="font-size:0.75rem;color:#999;margin-top:4px;">
                                ${record.status === 'pending_approval' ? '⏳ Pending Approval' : record.status === 'closed' ? '✅ Approved' : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Actions -->
                    ${isToday ? `
                        <div style="display:flex;gap:8px;margin-top:12px;">
                            ${Auth.hasRole('baker') ? `
                                <button class="btn btn-secondary btn-sm" onclick="Inventory.showAddProductionModal('${record.productId}')" style="flex:1;${requiresFinishing ? 'background:#FFF8E1;border-color:#F57C00;' : ''}">
                                    ${requiresFinishing ? '🎨 Finish' : '+ Add'}
                                </button>
                            ` : ''}
                            ${Auth.hasRole('admin') ? `
                                <button class="btn btn-secondary btn-sm" onclick="Inventory.showAdjustModal('${record.productId}')" style="flex:1;background:#FFF3E0;border-color:#FF9800;">
                                    ✏️
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="Inventory.syncSingleProduct('${record.productId}')" style="flex:1;background:#E3F2FD;border-color:#1976D2;">
                                    🔄
                                </button>
                            ` : ''}
                            <button class="btn btn-secondary btn-sm" onclick="Inventory.showSingleEndCount('${record.productId}')" style="flex:1;">
                                🌙
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="Inventory.showMovements('${record.productId}')" style="flex:1;">
                                📋
                            </button>
                        </div>
                    ` : `
                        <!-- Past day - show edit button for admin -->
                        ${Auth.hasRole('admin') ? `
                            <div style="display:flex;gap:8px;margin-top:12px;">
                                <button class="btn btn-secondary btn-sm" onclick="Inventory.showHistoricalEdit('${record.productId}')" style="flex:1;background:#FFEBEE;border-color:#C62828;">
                                    🔓 Edit Historical Record
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="Inventory.showMovements('${record.productId}')" style="flex:1;">
                                    📋
                                </button>
                            </div>
                        ` : ''}
                    `}
                </div>
            </div>
        `;
    },
    
    calculateDayStats() {
        let totalProducts = this.dailyRecords.length;
        let totalAvailable = 0;
        let totalReserved = 0;
        let totalSold = 0;
        let totalSellable = 0;
        
        for (const record of this.dailyRecords) {
            const stock = this.calculateStock(record);
            totalAvailable += stock.totalAvailable;
            totalReserved += stock.reserved;
            totalSold += stock.sold;
            totalSellable += stock.sellable;
        }
        
        return { totalProducts, totalAvailable, totalReserved, totalSold, totalSellable };
    },

    // ===== DATE NAVIGATION =====
    changeDate(dateStr) {
        this.selectedDate = dateStr;
        this.setupRealtimeListener();
        this.load().then(() => this.render());
    },
    
    previousDay() {
        const date = new Date(this.selectedDate + 'T00:00:00');
        date.setDate(date.getDate() - 1);
        this.changeDate(date.toISOString().split('T')[0]);
    },
    
    nextDay() {
        const date = new Date(this.selectedDate + 'T00:00:00');
        date.setDate(date.getDate() + 1);
        const today = this.getTodayString();
        const newDate = date.toISOString().split('T')[0];
        // Don't go beyond today
        if (newDate <= today) {
            this.changeDate(newDate);
        }
    },
    
    goToToday() {
        this.changeDate(this.getTodayString());
    },

    // ===== PRODUCTION ENTRY MODAL (Manual Entry) =====
    showProductionModal() {
        // Get products that don't have a record yet today
        const existingProductIds = this.dailyRecords.map(r => r.productId);
        this.availableProducts = Products.data.filter(p => !existingProductIds.includes(p.id));
        
        if (this.availableProducts.length === 0 && this.dailyRecords.length === 0) {
            Toast.warning('No products found. Please create products first.');
            return;
        }
        
        // If all products have records, show message
        if (this.availableProducts.length === 0) {
            Toast.info('All products already have inventory records for today. Use "Add More" on individual cards.');
            return;
        }
        
        Modal.open({
            title: '🍞 Record Beginning Inventory',
            content: `
                <p style="color:#666;margin-bottom:16px;">
                    Manually enter the stock count for today. Type to search products.
                </p>
                
                <div class="form-group">
                    <label>Product <span style="color:#999;font-weight:normal;">(${this.availableProducts.length} available)</span></label>
                    <div style="position:relative;">
                        <input type="text" 
                               id="prodProductSearch" 
                               class="form-input" 
                               placeholder="Type to search products..."
                               autocomplete="off"
                               oninput="Inventory.filterProductDropdown(this.value)"
                               onfocus="Inventory.showProductDropdown()">
                        <input type="hidden" id="prodProductSelect" value="">
                        <div id="prodProductDropdown" 
                             style="display:none;position:absolute;top:100%;left:0;right:0;max-height:250px;overflow-y:auto;background:white;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;margin-top:4px;">
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Beginning Stock Quantity</label>
                    <input type="number" id="prodQuantity" class="form-input" min="0" placeholder="Total stock available now">
                    <small style="color:#666;">Enter the actual count of items ready to sell</small>
                </div>
                
                <div class="form-group">
                    <label>Notes (optional)</label>
                    <input type="text" id="prodNotes" class="form-input" placeholder="e.g., Morning count, includes yesterday's leftover">
                </div>
            `,
            saveText: 'Save Inventory',
            onSave: () => this.saveManualInventory()
        });
        
        // Initialize dropdown after modal opens
        setTimeout(() => {
            this.renderProductDropdown(this.availableProducts);
            
            // Close dropdown when clicking outside
            document.addEventListener('click', this.handleDropdownClickOutside);
        }, 100);
    },
    
    handleDropdownClickOutside(e) {
        const dropdown = document.getElementById('prodProductDropdown');
        const searchInput = document.getElementById('prodProductSearch');
        if (dropdown && searchInput && !dropdown.contains(e.target) && e.target !== searchInput) {
            dropdown.style.display = 'none';
        }
    },
    
    showProductDropdown() {
        const dropdown = document.getElementById('prodProductDropdown');
        if (dropdown) {
            dropdown.style.display = 'block';
        }
    },
    
    filterProductDropdown(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        let filtered;
        if (!term) {
            filtered = this.availableProducts;
        } else {
            filtered = this.availableProducts.filter(p => {
                const name = (p.name || '').toLowerCase();
                const category = (p.category || '').toLowerCase();
                return name.includes(term) || category.includes(term);
            });
        }
        
        this.renderProductDropdown(filtered, term);
        this.showProductDropdown();
    },
    
    renderProductDropdown(products, searchTerm = '') {
        const dropdown = document.getElementById('prodProductDropdown');
        if (!dropdown) return;
        
        if (products.length === 0) {
            dropdown.innerHTML = `
                <div style="padding:16px;text-align:center;color:#999;">
                    No products found matching "${searchTerm}"
                </div>
            `;
            dropdown.style.display = 'block';
            return;
        }
        
        // Group by category for easier viewing
        const grouped = {};
        products.forEach(p => {
            const cat = p.category || 'uncategorized';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
        });
        
        let html = '';
        for (const [category, prods] of Object.entries(grouped)) {
            html += `
                <div style="padding:8px 12px;background:#F5F5F5;font-size:0.8rem;font-weight:600;color:#666;position:sticky;top:0;">
                    ${Products.formatCategoryWithEmoji(category)}
                </div>
            `;
            prods.forEach(p => {
                // Highlight matching text
                let displayName = p.name;
                if (searchTerm) {
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    displayName = p.name.replace(regex, '<mark style="background:#FFF59D;padding:0 2px;">$1</mark>');
                }
                
                html += `
                    <div class="product-dropdown-item" 
                         style="padding:12px;cursor:pointer;border-bottom:1px solid #f0f0f0;transition:background 0.15s;"
                         onmouseover="this.style.background='#E3F2FD'"
                         onmouseout="this.style.background='white'"
                         onclick="Inventory.selectProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')">
                        <div style="font-weight:500;">${displayName}</div>
                        ${p.finalSRP ? `<div style="font-size:0.85rem;color:#666;">₱${p.finalSRP}</div>` : ''}
                    </div>
                `;
            });
        }
        
        dropdown.innerHTML = html;
        dropdown.style.display = 'block';
    },
    
    selectProduct(productId, productName) {
        document.getElementById('prodProductSelect').value = productId;
        document.getElementById('prodProductSearch').value = productName;
        document.getElementById('prodProductDropdown').style.display = 'none';
        
        // Focus on quantity field
        document.getElementById('prodQuantity').focus();
    },
    
    async saveManualInventory() {
        const productId = document.getElementById('prodProductSelect').value;
        const qty = parseInt(document.getElementById('prodQuantity').value) || 0;
        const notes = document.getElementById('prodNotes').value.trim();
        
        if (!productId) {
            Toast.error('Please select a product');
            return;
        }
        
        if (qty <= 0) {
            Toast.error('Please enter a quantity greater than 0');
            return;
        }
        
        try {
            const product = Products.data.find(p => p.id === productId);
            const date = this.getTodayString();
            const docId = `${date}_${productId}`;
            
            // Create daily inventory record (manual entry)
            const record = {
                productId: productId,
                productName: product.name,
                category: product.category,
                date: date,
                
                // For manual entry, we put everything in newProductionQty
                carryoverQty: 0,
                newProductionQty: qty,
                totalAvailable: qty,
                
                // Real-time tracking (starts at 0)
                reservedQty: 0,
                soldQty: 0,
                cancelledQty: 0,
                
                // Status
                openingLocked: false,
                status: 'open',
                
                // End of day (null until filled)
                actualRemaining: null,
                variance: null,
                varianceRemarks: null,
                
                // Audit
                entryType: 'manual', // Flag this as manual entry
                notes: notes || 'Manual inventory entry',
                createdBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Save to Firestore
            await db.collection('dailyInventory').doc(docId).set(record);
            
            // Create stock movement record
            await this.createStockMovement({
                productId: productId,
                type: 'manual_entry',
                qty: qty,
                date: date,
                notes: notes || 'Manual beginning inventory',
                performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
            });
            
            Modal.close();
            Toast.success(`Inventory recorded: ${qty} ${product.name}`);
            
        } catch (error) {
            console.error('Error saving inventory:', error);
            Toast.error('Failed to save inventory');
        }
    },

    // ===== ADD MORE STOCK (for existing record) =====
    showAddProductionModal(productId) {
        const record = this.dailyRecords.find(r => r.productId === productId);
        if (!record) return;
        
        // Check if product has a base bread - block direct addition
        const product = Products.data.find(p => p.id === productId);
        if (product && product.baseBreadId) {
            const baseBread = BaseBreads.getById(product.baseBreadId);
            Modal.open({
                title: `🚫 Cannot Add Directly`,
                content: `
                    <div style="text-align:center;padding:20px;">
                        <div style="font-size:3rem;margin-bottom:16px;">🎨</div>
                        <p style="font-size:1.1rem;margin-bottom:16px;">
                            <strong>${record.productName}</strong> requires finishing from a base bread.
                        </p>
                        <div style="background:#FFF3E0;padding:16px;border-radius:8px;margin-bottom:16px;">
                            <p style="margin:0;color:#E65100;">
                                This product uses <strong>${baseBread?.icon || '🍞'} ${baseBread?.name || 'a base bread'}</strong>
                            </p>
                        </div>
                        <p style="color:#666;">
                            Go to <strong>Finishing Station</strong> to convert base bread into this product.
                        </p>
                    </div>
                `,
                saveText: 'Go to Finishing Station',
                onSave: () => {
                    Modal.close();
                    // Navigate to Finishing Station and open the finish modal for this product
                    App.showView('finishingStation');
                    // Small delay to let the view render, then open finish modal
                    setTimeout(() => {
                        FinishingStation.showFinishModal(product.baseBreadId, productId);
                    }, 300);
                }
            });
            return;
        }
        
        Modal.open({
            title: `➕ Add Production - ${record.productName}`,
            content: `
                <div style="background:#F5F5F5;padding:12px;border-radius:8px;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span>Current Production:</span>
                        <strong>${record.newProductionQty || 0}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span>Total Available:</span>
                        <strong>${record.totalAvailable || 0}</strong>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Additional Quantity</label>
                    <input type="number" id="addProdQty" class="form-input" min="1" placeholder="How many more?">
                </div>
                
                <div class="form-group">
                    <label>Notes (optional)</label>
                    <input type="text" id="addProdNotes" class="form-input" placeholder="e.g., Afternoon batch">
                </div>
            `,
            saveText: 'Add Stock',
            onSave: () => this.addProduction(productId)
        });
    },
    
    async addProduction(productId) {
        const qty = parseInt(document.getElementById('addProdQty').value) || 0;
        const notes = document.getElementById('addProdNotes').value.trim();
        
        if (qty <= 0) {
            Toast.error('Please enter a quantity');
            return;
        }
        
        // Double-check: Block base bread products
        const product = Products.data.find(p => p.id === productId);
        if (product && product.baseBreadId) {
            Toast.error('This product requires finishing. Use Finishing Station.');
            Modal.close();
            return;
        }
        
        try {
            const date = this.getTodayString();
            const docId = `${date}_${productId}`;
            const record = this.dailyRecords.find(r => r.productId === productId);

            const newProductionQty = (record.newProductionQty || 0) + qty;
            const newTotalAvailable = (record.carryoverQty || 0) + newProductionQty;
            
            await db.collection('dailyInventory').doc(docId).update({
                newProductionQty: newProductionQty,
                totalAvailable: newTotalAvailable,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Log stock movement
            await this.createStockMovement({
                productId: productId,
                type: 'production',
                qty: qty,
                date: date,
                notes: notes || 'Additional production',
                performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
            });
            
            Modal.close();
            Toast.success(`Added ${qty} more ${record.productName}`);
            
        } catch (error) {
            console.error('Error adding production:', error);
            Toast.error('Failed to add production');
        }
    },

    // ===== ADJUST BEGINNING/SOLD (Admin Only) =====
    showAdjustModal(productId) {
        // Password prompt
        const password = prompt('Enter admin password to adjust:');
        if (password === null) {
            // User clicked Cancel
            return;
        }
        if (password !== '1185') {
            Toast.error('Invalid password');
            return;
        }
        
        const record = this.dailyRecords.find(r => r.productId === productId);
        if (!record) return;
        
        const stock = this.calculateStock(record);
        
        Modal.open({
            title: `✏️ Adjust - ${record.productName}`,
            content: `
                <p style="color:#666;margin-bottom:16px;">
                    Correct the beginning stock or sold quantity.
                </p>
                
                <div style="background:#F5F5F5;padding:12px;border-radius:8px;margin-bottom:16px;">
                    <div style="font-size:0.85rem;color:#666;margin-bottom:4px;">Current Values:</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div>Beginning: <strong>${stock.totalAvailable}</strong></div>
                        <div>Sold: <strong>${stock.sold}</strong></div>
                        <div>Sellable: <strong>${stock.sellable}</strong></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Beginning Stock</label>
                    <input type="number" id="adjBeginning" class="form-input" min="0" 
                           value="${stock.totalAvailable}" placeholder="Total morning count">
                    <small style="color:#666;">The original count at start of day</small>
                </div>
                
                <div class="form-group">
                    <label>Sold Quantity</label>
                    <input type="number" id="adjSold" class="form-input" min="0" 
                           value="${record.soldQty || 0}" placeholder="Items sold so far">
                    <small style="color:#666;">Total sold (will be auto-updated by POS going forward)</small>
                </div>
                
                <div class="form-group">
                    <label>Reason for Adjustment</label>
                    <select id="adjReason" class="form-input">
                        <option value="">-- Select reason --</option>
                        <optgroup label="📊 Corrections">
                            <option value="Corrected miscount">Corrected miscount</option>
                            <option value="Initial setup">📋 Initial setup</option>
                        </optgroup>
                        <optgroup label="🗑️ Wastage">
                            <option value="Stale/Expired - discarded">🗑️ Stale/Expired - discarded</option>
                            <option value="Breakage/damaged">💔 Breakage/damaged</option>
                        </optgroup>
                        <optgroup label="♻️ Recycled">
                            <option value="Recycled - Bread Pudding">♻️ Recycled - Bread Pudding</option>
                            <option value="Recycled - Toasted Bread">♻️ Recycled - Toasted Bread</option>
                            <option value="Recycled - Croutons">♻️ Recycled - Croutons</option>
                            <option value="Recycled - Other">♻️ Recycled - Other use</option>
                        </optgroup>
                        <optgroup label="🎁 Giveaways">
                            <option value="Employee meal">🍽️ Employee meal</option>
                            <option value="Taste test/sample">🧪 Taste test/sample</option>
                            <option value="Given to customer (free)">🎁 Given to customer (free)</option>
                            <option value="Donation">❤️ Donation</option>
                        </optgroup>
                        <option value="Other">Other</option>
                    </select>
                </div>
                
                <div class="form-group" id="adjOtherReasonGroup" style="display:none;">
                    <label>Specify Other Reason</label>
                    <input type="text" id="adjOtherReason" class="form-input" placeholder="Enter reason...">
                </div>
            `,
            saveText: 'Save Adjustment',
            onSave: () => this.saveAdjustment(productId)
        });
        
        // Show/hide "Other" text field
        document.getElementById('adjReason').addEventListener('change', (e) => {
            const otherGroup = document.getElementById('adjOtherReasonGroup');
            otherGroup.style.display = e.target.value === 'Other' ? 'block' : 'none';
        });
    },
    
    async saveAdjustment(productId) {
        let reason = document.getElementById('adjReason').value;
        if (reason === 'Other') {
            reason = document.getElementById('adjOtherReason').value.trim();
        }
        
        const newBeginning = parseInt(document.getElementById('adjBeginning').value) || 0;
        const newSold = parseInt(document.getElementById('adjSold').value) || 0;
        
        if (!reason) {
            Toast.error('Please select a reason for the adjustment');
            return;
        }
        
        try {
            const date = this.getTodayString();
            const docId = `${date}_${productId}`;
            const record = this.dailyRecords.find(r => r.productId === productId);
            
            // Calculate what changed - use calculateStock for accurate old values
            const oldStockCalc = this.calculateStock(record);
            const begDiff = newBeginning - oldStockCalc.totalAvailable;
            const soldDiff = newSold - (record.soldQty || 0);
            
            // Update the record
            // IMPORTANT: When adjusting beginning balance, we need to reset carryover to 0
            // and put the full beginning balance in newProductionQty so calculateStock works correctly
            await db.collection('dailyInventory').doc(docId).update({
                carryoverQty: 0,  // Reset carryover - it's now accounted for in the adjustment
                newProductionQty: newBeginning, // Full beginning balance goes here
                totalAvailable: newBeginning,
                soldQty: newSold,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Log the adjustment
            if (begDiff !== 0) {
                await this.createStockMovement({
                    productId: productId,
                    type: 'adjustment',
                    qty: begDiff,
                    date: date,
                    notes: `Beginning adjusted: ${oldStockCalc.totalAvailable} → ${newBeginning}. ${reason}`,
                    performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
                });
                
                // If beginning decreased and reason is wastage-related, create wastage record
                if (begDiff < 0) {
                    const wastageQty = Math.abs(begDiff);
                    const wastageReasonMap = {
                        'Stale/Expired - discarded': 'stale_discarded',
                        'Breakage/damaged': 'damaged',
                        'Recycled - Bread Pudding': 'recycled_bread_pudding',
                        'Recycled - Toasted Bread': 'recycled_toasted',
                        'Recycled - Croutons': 'recycled_croutons',
                        'Recycled - Other': 'recycled_other',
                        'Employee meal': 'employee_meal',
                        'Taste test/sample': 'sample',
                        'Given to customer (free)': 'given_free',
                        'Donation': 'donation'
                    };
                    
                    const wastageReason = wastageReasonMap[reason];
                    if (wastageReason) {
                        await this.createWastageRecord({
                            productId: productId,
                            productName: record.productName,
                            category: record.category,
                            qty: wastageQty,
                            reason: wastageReason,
                            sourceAction: 'adjustment',
                            notes: `Adjusted from ${oldStockCalc.totalAvailable} to ${newBeginning}`
                        });
                    }
                }
            }
            
            if (soldDiff !== 0) {
                await this.createStockMovement({
                    productId: productId,
                    type: 'adjustment',
                    qty: -soldDiff,
                    date: date,
                    notes: `Sold adjusted: ${oldStockCalc.sold} → ${newSold}. ${reason}`,
                    performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
                });
            }
            
            Modal.close();
            Toast.success('Adjustment saved');
            
        } catch (error) {
            console.error('Error saving adjustment:', error);
            Toast.error('Failed to save adjustment');
        }
    },

    // ===== HISTORICAL RECORD EDIT (Admin Only) =====
    showHistoricalEdit(productId) {
        // Password prompt
        const password = prompt('⚠️ ADMIN: Enter password to edit historical record:');
        if (password === null) return;
        if (password !== '1185') {
            Toast.error('Invalid password');
            return;
        }
        
        const record = this.dailyRecords.find(r => r.productId === productId);
        if (!record) return;
        
        const stock = this.calculateStock(record);
        
        Modal.open({
            title: `🔓 Edit Historical - ${record.productName}`,
            content: `
                <div style="background:#FFEBEE;padding:12px;border-radius:8px;margin-bottom:16px;">
                    <strong>⚠️ Warning:</strong> You are editing a historical record from <strong>${this.formatDate(this.selectedDate)}</strong>. 
                    This should only be done to correct data entry errors.
                </div>
                
                <div style="background:#F5F5F5;padding:12px;border-radius:8px;margin-bottom:16px;">
                    <div style="font-size:0.85rem;color:#666;margin-bottom:4px;">Current Values:</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div>Carryover: <strong>${record.carryoverQty || 0}</strong></div>
                        <div>New Production: <strong>${record.newProductionQty || 0}</strong></div>
                        <div>Total Available: <strong>${stock.totalAvailable}</strong></div>
                        <div>Sold: <strong>${stock.sold}</strong></div>
                        <div>End Count: <strong>${record.actualRemaining !== null ? record.actualRemaining : 'Not set'}</strong></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Carryover Quantity</label>
                    <input type="number" id="histCarryover" class="form-input" min="0" 
                           value="${record.carryoverQty || 0}">
                </div>
                
                <div class="form-group">
                    <label>New Production Quantity</label>
                    <input type="number" id="histProduction" class="form-input" min="0" 
                           value="${record.newProductionQty || 0}">
                </div>
                
                <div class="form-group">
                    <label>Sold Quantity</label>
                    <input type="number" id="histSold" class="form-input" min="0" 
                           value="${record.soldQty || 0}">
                </div>
                
                <div class="form-group">
                    <label>End Count (Actual Remaining)</label>
                    <input type="number" id="histEndCount" class="form-input" min="0" 
                           value="${record.actualRemaining !== null ? record.actualRemaining : ''}"
                           placeholder="Leave blank to clear">
                </div>
                
                <div class="form-group">
                    <label>Reason for Historical Edit</label>
                    <select id="histReason" class="form-input">
                        <option value="">-- Select reason --</option>
                        <option value="Data entry error - missed production">Data entry error - missed production</option>
                        <option value="Data entry error - wrong quantity">Data entry error - wrong quantity</option>
                        <option value="POS sync issue">POS sync issue</option>
                        <option value="System error correction">System error correction</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                
                <div class="form-group" id="histOtherReasonGroup" style="display:none;">
                    <label>Specify Reason</label>
                    <input type="text" id="histOtherReason" class="form-input" placeholder="Enter reason...">
                </div>
            `,
            saveText: '💾 Save Historical Edit',
            onSave: () => this.saveHistoricalEdit(productId)
        });
        
        // Show/hide "Other" text field
        document.getElementById('histReason').addEventListener('change', (e) => {
            const otherGroup = document.getElementById('histOtherReasonGroup');
            otherGroup.style.display = e.target.value === 'Other' ? 'block' : 'none';
        });
    },
    
    async saveHistoricalEdit(productId) {
        let reason = document.getElementById('histReason').value;
        if (reason === 'Other') {
            reason = document.getElementById('histOtherReason').value.trim();
        }
        
        if (!reason) {
            Toast.error('Please select a reason for the edit');
            return;
        }
        
        const carryover = parseInt(document.getElementById('histCarryover').value) || 0;
        const production = parseInt(document.getElementById('histProduction').value) || 0;
        const sold = parseInt(document.getElementById('histSold').value) || 0;
        const endCountVal = document.getElementById('histEndCount').value;
        const endCount = endCountVal !== '' ? parseInt(endCountVal) : null;
        
        const totalAvailable = carryover + production;
        
        try {
            const docId = `${this.selectedDate}_${productId}`;
            const record = this.dailyRecords.find(r => r.productId === productId);
            
            // Calculate variance if end count is set
            let variance = null;
            let status = record.status;
            if (endCount !== null) {
                const expectedRemaining = totalAvailable - sold;
                variance = endCount - expectedRemaining;
                status = 'pending_approval';
            }
            
            await db.collection('dailyInventory').doc(docId).update({
                carryoverQty: carryover,
                newProductionQty: production,
                totalAvailable: totalAvailable,
                soldQty: sold,
                actualRemaining: endCount,
                variance: variance,
                status: status,
                historicalEdit: true,
                historicalEditReason: reason,
                historicalEditBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                historicalEditAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Log the historical edit
            await this.createStockMovement({
                productId: productId,
                type: 'historical_edit',
                qty: 0,
                date: this.selectedDate,
                notes: `Historical edit: ${reason}. Carryover: ${carryover}, Production: ${production}, Sold: ${sold}, End Count: ${endCount !== null ? endCount : 'N/A'}`,
                performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
            });
            
            Modal.close();
            Toast.success('Historical record updated');
            
            // Reload to show changes
            await this.load();
            this.render();
            
        } catch (error) {
            console.error('Error saving historical edit:', error);
            Toast.error('Failed to save historical edit');
        }
    },

    // ===== SYNC SINGLE PRODUCT WITH POS =====
    async syncSingleProduct(productId) {
        // Password prompt
        const password = prompt('Enter admin password to sync:');
        if (password === null) {
            return;
        }
        if (password !== '1185') {
            Toast.error('Invalid password');
            return;
        }
        
        const record = this.dailyRecords.find(r => r.productId === productId);
        if (!record) return;
        
        const today = this.getTodayString();
        
        try {
            Toast.info(`Syncing ${record.productName}...`);
            
            // Get all sales for today containing this product
            const salesSnapshot = await db.collection('sales')
                .where('dateKey', '==', today)
                .get();
            
            // Count sold for this product
            let soldQty = 0;
            salesSnapshot.forEach(doc => {
                const sale = doc.data();
                if (sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach(item => {
                        if (item.productId === productId) {
                            soldQty += (item.quantity || 1);
                        }
                    });
                }
            });
            
            const oldSold = record.soldQty || 0;
            
            // Update the record
            const docId = `${today}_${productId}`;
            await db.collection('dailyInventory').doc(docId).update({
                soldQty: soldQty,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Log if changed
            if (soldQty !== oldSold) {
                await this.createStockMovement({
                    productId: productId,
                    type: 'sync',
                    qty: -(soldQty - oldSold),
                    date: today,
                    notes: `Synced with POS: ${oldSold} → ${soldQty} sold`,
                    performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
                });
            }
            
            Toast.success(`${record.productName}: ${soldQty} sold (was ${oldSold})`);
            
        } catch (error) {
            console.error('Error syncing product:', error);
            Toast.error('Failed to sync: ' + error.message);
        }
    },

    // ===== STOCK MOVEMENTS =====
    async createStockMovement(data) {
        const movement = {
            productId: data.productId,
            date: data.date,
            type: data.type, // production, carryover, sale, reserve, unreserve, adjustment
            qty: data.qty,
            notes: data.notes || '',
            orderId: data.orderId || null,
            performedBy: data.performedBy,
            performedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('stockMovements').add(movement);
    },
    
    async showMovements(productId) {
        try {
            const record = this.dailyRecords.find(r => r.productId === productId);
            
            // Get movements for this product today
            const snapshot = await db.collection('stockMovements')
                .where('productId', '==', productId)
                .where('date', '==', this.selectedDate)
                .orderBy('performedAt', 'desc')
                .get();
            
            const movements = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const typeLabels = {
                production: '🍞 Production',
                carryover: '📦 Carryover',
                sale: '💰 Sale',
                reserve: '🔒 Reserved',
                unreserve: '🔓 Unreserved',
                adjustment: '✏️ Adjustment'
            };
            
            const typeColors = {
                production: '#2E7D32',
                carryover: '#F57C00',
                sale: '#C2185B',
                reserve: '#1565C0',
                unreserve: '#7B1FA2',
                adjustment: '#616161'
            };

            let movementsList = movements.length > 0 
                ? movements.map(m => `
                    <div style="display:flex;gap:12px;padding:12px;border-bottom:1px solid #eee;">
                        <div style="color:${typeColors[m.type] || '#666'};font-weight:600;min-width:120px;">
                            ${typeLabels[m.type] || m.type}
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:500;">${m.qty > 0 ? '+' : ''}${m.qty}</div>
                            ${m.notes ? `<div style="font-size:0.85rem;color:#666;">${m.notes}</div>` : ''}
                        </div>
                        <div style="font-size:0.85rem;color:#999;">
                            ${m.performedBy || 'Unknown'}
                        </div>
                    </div>
                `).join('')
                : '<p style="color:#666;text-align:center;padding:20px;">No movements recorded yet</p>';
            
            Modal.open({
                title: `📋 Stock Movements - ${record?.productName || 'Product'}`,
                content: `
                    <div style="max-height:400px;overflow-y:auto;border:1px solid #eee;border-radius:8px;">
                        ${movementsList}
                    </div>
                `,
                showFooter: false,
                width: '500px'
            });
            
        } catch (error) {
            console.error('Error loading movements:', error);
            Toast.error('Failed to load movements');
        }
    },

    // ===== CARRYOVER PROCESSING =====
    async showCarryoverModal() {
        // Get yesterday's records that haven't been carried over yet
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${year}-${month}-${day}`;
        const todayStr = this.getTodayString();
        
        try {
            const snapshot = await db.collection('dailyInventory')
                .where('date', '==', yesterdayStr)
                .get();
            
            const yesterdayRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Filter to only those with remaining stock
            const withRemaining = yesterdayRecords.filter(r => {
                const stock = this.calculateStock(r);
                return stock.expectedRemaining > 0;
            });
            
            // Check which already have today's record
            const todayProductIds = this.dailyRecords.map(r => r.productId);
            const needsCarryover = withRemaining.filter(r => !todayProductIds.includes(r.productId));
            
            if (needsCarryover.length === 0) {
                Toast.info('No carryover to process. All products with remaining stock already have today\'s record.');
                return;
            }
            
            let carryoverList = needsCarryover.map(r => {
                const stock = this.calculateStock(r);
                return `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #eee;">
                        <div>
                            <strong>${r.productName}</strong>
                            <div style="font-size:0.85rem;color:#666;">Yesterday's remaining: ${stock.expectedRemaining}</div>
                        </div>
                        <input type="checkbox" checked data-product-id="${r.productId}" data-qty="${stock.expectedRemaining}" data-product-name="${r.productName}" data-category="${r.category || ''}">
                    </div>
                `;
            }).join('');

            Modal.open({
                title: '📦 Process Carryover from Yesterday',
                content: `
                    <p style="color:#666;margin-bottom:16px;">
                        The following products have remaining stock from ${this.formatDateShort(yesterdayStr)}. 
                        Select which ones to carry over to today:
                    </p>
                    <div style="max-height:250px;overflow-y:auto;border:1px solid #eee;border-radius:8px;">
                        ${carryoverList}
                    </div>
                    
                    <div style="margin-top:16px;padding:12px;background:#FFF3E0;border-radius:8px;border-left:4px solid #FF9800;">
                        <div style="font-weight:600;margin-bottom:8px;color:#E65100;">
                            🗑️ Unchecked items will be recorded as:
                        </div>
                        <select id="wastageReason" class="form-input" style="width:100%;">
                            <option value="stale_discarded">🗑️ Stale/Expired - discarded</option>
                            <option value="damaged">💔 Damaged/Breakage</option>
                            <option value="recycled_bread_pudding">♻️ Recycled - Bread Pudding</option>
                            <option value="recycled_toasted">♻️ Recycled - Toasted Bread</option>
                            <option value="recycled_croutons">♻️ Recycled - Croutons</option>
                            <option value="recycled_other">♻️ Recycled - Other</option>
                            <option value="employee_meal">🍽️ Employee meal</option>
                            <option value="sample">🧪 Taste test/sample</option>
                            <option value="donation">❤️ Donation</option>
                        </select>
                    </div>
                `,
                saveText: 'Process Carryover',
                onSave: () => this.processCarryover(needsCarryover)
            });
            
        } catch (error) {
            console.error('Error loading carryover data:', error);
            Toast.error('Failed to load carryover data');
        }
    },
    
    async processCarryover(records) {
        const allCheckboxes = document.querySelectorAll('input[data-product-id]');
        const checkedBoxes = document.querySelectorAll('input[data-product-id]:checked');
        const uncheckedBoxes = document.querySelectorAll('input[data-product-id]:not(:checked)');
        const wastageReason = document.getElementById('wastageReason')?.value || 'stale_discarded';
        
        const toCarryover = Array.from(checkedBoxes).map(cb => ({
            productId: cb.dataset.productId,
            qty: parseInt(cb.dataset.qty)
        }));
        
        const toWastage = Array.from(uncheckedBoxes).map(cb => ({
            productId: cb.dataset.productId,
            productName: cb.dataset.productName,
            category: cb.dataset.category,
            qty: parseInt(cb.dataset.qty)
        }));
        
        if (toCarryover.length === 0 && toWastage.length === 0) {
            Toast.warning('No products to process');
            return;
        }
        
        try {
            const date = this.getTodayString();
            
            // Process carryover items
            for (const item of toCarryover) {
                const record = records.find(r => r.productId === item.productId);
                if (!record) continue;
                
                const docId = `${date}_${item.productId}`;
                
                // Check if today's record already exists
                const existingRecord = this.dailyRecords.find(r => r.productId === item.productId);
                
                if (existingRecord) {
                    // UPDATE existing record - add carryover to existing quantities
                    const newCarryover = (existingRecord.carryoverQty || 0) + item.qty;
                    const newTotal = newCarryover + (existingRecord.newProductionQty || 0);
                    
                    await db.collection('dailyInventory').doc(docId).update({
                        carryoverQty: newCarryover,
                        totalAvailable: newTotal,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Log movement
                    await this.createStockMovement({
                        productId: item.productId,
                        type: 'carryover',
                        qty: item.qty,
                        date: date,
                        notes: 'Carryover added to existing record',
                        performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
                    });
                } else {
                    // CREATE new record with carryover only
                    const newRecord = {
                        productId: item.productId,
                        productName: record.productName,
                        category: record.category,
                        date: date,
                        
                        carryoverQty: item.qty,
                        newProductionQty: 0,
                        totalAvailable: item.qty,
                        
                        reservedQty: 0,
                        soldQty: 0,
                        cancelledQty: 0,
                        
                        openingLocked: false,
                        status: 'open',
                        actualRemaining: null,
                        variance: null,
                        varianceRemarks: null,
                        
                        notes: 'Carryover only - no new production yet',
                        createdBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    await db.collection('dailyInventory').doc(docId).set(newRecord);
                    
                    // Log movement
                    await this.createStockMovement({
                        productId: item.productId,
                        type: 'carryover',
                        qty: item.qty,
                        date: date,
                        notes: 'Carryover from previous day',
                        performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
                    });
                }
            }
            
            // Process wastage items (unchecked)
            for (const item of toWastage) {
                await this.createWastageRecord({
                    productId: item.productId,
                    productName: item.productName,
                    category: item.category,
                    qty: item.qty,
                    reason: wastageReason,
                    sourceAction: 'carryover_skip',
                    notes: 'Not carried over from previous day'
                });
            }
            
            Modal.close();
            
            let message = '';
            if (toCarryover.length > 0) {
                message += `Carried over ${toCarryover.length} products. `;
            }
            if (toWastage.length > 0) {
                message += `Recorded ${toWastage.length} as wastage.`;
            }
            Toast.success(message);
            
            // Refresh carryover status
            await this.checkPendingCarryover();
            
        } catch (error) {
            console.error('Error processing carryover:', error);
            Toast.error('Failed to process carryover');
        }
    },

    // ===== END OF DAY RECONCILIATION =====
    showEndOfDayModal() {
        if (this.dailyRecords.length === 0) {
            Toast.warning('No inventory records to reconcile');
            return;
        }
        
        // Build the list of products for counting
        let productRows = this.dailyRecords.map(record => {
            const stock = this.calculateStock(record);
            const hasExistingCount = record.actualRemaining !== null;
            
            return `
                <div style="display:grid;grid-template-columns:1fr 80px 80px 100px;gap:8px;padding:12px;border-bottom:1px solid #eee;align-items:center;"
                     data-product-id="${record.productId}">
                    <div>
                        <strong>${record.productName}</strong>
                        <div style="font-size:0.8rem;color:#666;">Expected: ${stock.expectedRemaining}</div>
                    </div>
                    <div style="text-align:center;font-size:0.9rem;color:#666;">
                        ${stock.expectedRemaining}
                    </div>
                    <input type="number" 
                           class="form-input eod-actual-input" 
                           min="0" 
                           value="${hasExistingCount ? record.actualRemaining : ''}"
                           placeholder="Count"
                           data-expected="${stock.expectedRemaining}"
                           style="padding:8px;text-align:center;">
                    <select class="form-select eod-remarks-select" style="padding:6px;font-size:0.85rem;">
                        <option value="">-- Remarks --</option>
                        <option value="Accurate">✓ Accurate</option>
                        <option value="Breakage">Breakage</option>
                        <option value="Staff meal">Staff meal</option>
                        <option value="Free taste">Free taste</option>
                        <option value="Stale/Expired">Stale/Expired</option>
                        <option value="Miscount">Miscount</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            `;
        }).join('');
        
        Modal.open({
            title: '🌙 End of Day Inventory Count',
            content: `
                <p style="color:#666;margin-bottom:16px;">
                    Enter the actual remaining count for each product. Variance will be calculated automatically.
                </p>
                <div style="display:grid;grid-template-columns:1fr 80px 80px 100px;gap:8px;padding:8px 12px;background:#F5F5F5;border-radius:8px 8px 0 0;font-weight:600;font-size:0.85rem;">
                    <div>Product</div>
                    <div style="text-align:center;">Expected</div>
                    <div style="text-align:center;">Actual</div>
                    <div>Remarks</div>
                </div>
                <div style="max-height:400px;overflow-y:auto;border:1px solid #eee;border-radius:0 0 8px 8px;">
                    ${productRows}
                </div>
            `,
            saveText: 'Save End of Day',
            width: '600px',
            onSave: () => this.saveEndOfDay()
        });
    },
    
    async saveEndOfDay() {
        const rows = document.querySelectorAll('[data-product-id]');
        const updates = [];
        let hasError = false;
        
        rows.forEach(row => {
            const productId = row.dataset.productId;
            const actualInput = row.querySelector('.eod-actual-input');
            const remarksSelect = row.querySelector('.eod-remarks-select');
            
            const actualValue = actualInput.value.trim();
            const expected = parseInt(actualInput.dataset.expected) || 0;
            const remarks = remarksSelect.value;
            
            if (actualValue === '') {
                // Skip if no value entered
                return;
            }
            
            const actual = parseInt(actualValue) || 0;
            const variance = actual - expected;
            
            // If there's variance, require remarks
            if (variance !== 0 && !remarks) {
                actualInput.style.borderColor = '#C62828';
                hasError = true;
                return;
            }
            
            updates.push({
                productId,
                actual,
                variance,
                remarks: remarks || 'Accurate'
            });
        });
        
        if (hasError) {
            Toast.error('Please add remarks for items with variance');
            return;
        }
        
        if (updates.length === 0) {
            Toast.warning('No counts entered');
            return;
        }
        
        try {
            const date = this.getTodayString();
            
            for (const update of updates) {
                const docId = `${date}_${update.productId}`;
                
                await db.collection('dailyInventory').doc(docId).update({
                    actualRemaining: update.actual,
                    variance: update.variance,
                    varianceRemarks: update.remarks,
                    status: 'pending_approval',
                    countedBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                    countedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Log if there's variance
                if (update.variance !== 0) {
                    await this.createStockMovement({
                        productId: update.productId,
                        type: 'adjustment',
                        qty: update.variance,
                        date: date,
                        notes: `End of day variance: ${update.remarks}`,
                        performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
                    });
                }
            }
            
            Modal.close();
            Toast.success(`End of day count saved for ${updates.length} products`);
            
        } catch (error) {
            console.error('Error saving end of day:', error);
            Toast.error('Failed to save end of day count');
        }
    },
    
    // Single product end count
    showSingleEndCount(productId) {
        const record = this.dailyRecords.find(r => r.productId === productId);
        if (!record) return;
        
        const stock = this.calculateStock(record);
        
        Modal.open({
            title: `🌙 End Count - ${record.productName}`,
            content: `
                <div style="background:#F5F5F5;padding:12px;border-radius:8px;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span>Beginning:</span>
                        <strong>${stock.totalAvailable}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span>Sold:</span>
                        <strong>${stock.sold}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #ddd;">
                        <span>Expected Remaining:</span>
                        <strong style="color:#1565C0;">${stock.expectedRemaining}</strong>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Actual Count</label>
                    <input type="number" id="singleEndCount" class="form-input" min="0" 
                           value="${record.actualRemaining !== null ? record.actualRemaining : ''}"
                           placeholder="Enter actual remaining count">
                </div>
                
                <div class="form-group">
                    <label>Remarks (required if variance)</label>
                    <select id="singleEndRemarks" class="form-select">
                        <option value="">-- Select remarks --</option>
                        <option value="Accurate" ${record.varianceRemarks === 'Accurate' ? 'selected' : ''}>✓ Accurate</option>
                        <option value="Breakage" ${record.varianceRemarks === 'Breakage' ? 'selected' : ''}>Breakage</option>
                        <option value="Staff meal" ${record.varianceRemarks === 'Staff meal' ? 'selected' : ''}>Staff meal</option>
                        <option value="Free taste" ${record.varianceRemarks === 'Free taste' ? 'selected' : ''}>Free taste/sample</option>
                        <option value="Stale/Expired" ${record.varianceRemarks === 'Stale/Expired' ? 'selected' : ''}>Stale/Expired</option>
                        <option value="Miscount" ${record.varianceRemarks === 'Miscount' ? 'selected' : ''}>Morning miscount</option>
                        <option value="Other" ${record.varianceRemarks === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                
                <div id="singleVarianceDisplay" style="display:none;background:#FFEBEE;padding:12px;border-radius:8px;margin-top:12px;">
                    <div style="display:flex;justify-content:space-between;">
                        <span>Variance:</span>
                        <strong id="singleVarianceValue" style="color:#C62828;">0</strong>
                    </div>
                </div>
            `,
            saveText: 'Save Count',
            onSave: () => this.saveSingleEndCount(productId, stock.expectedRemaining)
        });
        
        // Add variance calculation listener
        setTimeout(() => {
            const countInput = document.getElementById('singleEndCount');
            if (countInput) {
                countInput.addEventListener('input', () => {
                    const actual = parseInt(countInput.value) || 0;
                    const variance = actual - stock.expectedRemaining;
                    const display = document.getElementById('singleVarianceDisplay');
                    const value = document.getElementById('singleVarianceValue');
                    
                    if (countInput.value && variance !== 0) {
                        display.style.display = 'block';
                        display.style.background = variance > 0 ? '#E8F5E9' : '#FFEBEE';
                        value.style.color = variance > 0 ? '#2E7D32' : '#C62828';
                        value.textContent = (variance > 0 ? '+' : '') + variance;
                    } else {
                        display.style.display = 'none';
                    }
                });
            }
        }, 100);
    },
    
    async saveSingleEndCount(productId, expected) {
        const actual = parseInt(document.getElementById('singleEndCount').value);
        const remarks = document.getElementById('singleEndRemarks').value;
        
        if (isNaN(actual)) {
            Toast.error('Please enter a count');
            return;
        }
        
        const variance = actual - expected;
        
        if (variance !== 0 && !remarks) {
            Toast.error('Please select remarks for variance');
            return;
        }
        
        try {
            const date = this.getTodayString();
            const docId = `${date}_${productId}`;
            
            await db.collection('dailyInventory').doc(docId).update({
                actualRemaining: actual,
                variance: variance,
                varianceRemarks: remarks || 'Accurate',
                status: 'pending_approval',
                countedBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                countedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (variance !== 0) {
                await this.createStockMovement({
                    productId: productId,
                    type: 'adjustment',
                    qty: variance,
                    date: date,
                    notes: `End of day variance: ${remarks}`,
                    performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
                });
            }
            
            Modal.close();
            Toast.success('End count saved');
            
        } catch (error) {
            console.error('Error saving single end count:', error);
            Toast.error('Failed to save count');
        }
    },

    // ===== API METHODS (for POS/Website to call) =====
    
    /**
     * Get current sellable stock for a product
     * Called by POS and Website
     */
    async getProductStock(productId) {
        const date = this.getTodayString();
        const docId = `${date}_${productId}`;
        
        try {
            const doc = await db.collection('dailyInventory').doc(docId).get();
            
            if (!doc.exists) {
                return { productId, sellable: 0, reserved: 0, totalAvailable: 0 };
            }
            
            const record = doc.data();
            const stock = this.calculateStock(record);
            
            return {
                productId: productId,
                productName: record.productName,
                sellable: stock.sellable,
                reserved: stock.reserved,
                totalAvailable: stock.totalAvailable,
                hasCarryover: stock.carryover > 0,
                carryoverQty: stock.carryover
            };
        } catch (error) {
            console.error('Error getting product stock:', error);
            throw error;
        }
    },
    
    /**
     * Get all products with stock for today
     * Called by POS and Website for product listings
     */
    async getAllProductStock() {
        const date = this.getTodayString();
        
        try {
            const snapshot = await db.collection('dailyInventory')
                .where('date', '==', date)
                .get();
            
            return snapshot.docs.map(doc => {
                const record = doc.data();
                const stock = this.calculateStock(record);
                
                return {
                    productId: record.productId,
                    productName: record.productName,
                    category: record.category,
                    sellable: stock.sellable,
                    reserved: stock.reserved,
                    totalAvailable: stock.totalAvailable,
                    hasCarryover: stock.carryover > 0,
                    carryoverQty: stock.carryover
                };
            });
        } catch (error) {
            console.error('Error getting all product stock:', error);
            throw error;
        }
    },

    /**
     * Reserve stock for a paid online order
     * Called when payment is confirmed
     */
    async reserveStock(productId, qty, orderId) {
        const date = this.getTodayString();
        const docId = `${date}_${productId}`;
        
        try {
            const docRef = db.collection('dailyInventory').doc(docId);
            
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                
                if (!doc.exists) {
                    throw new Error('No inventory record for this product today');
                }
                
                const record = doc.data();
                const stock = this.calculateStock(record);
                
                if (stock.sellable < qty) {
                    throw new Error(`Insufficient stock. Available: ${stock.sellable}, Requested: ${qty}`);
                }
                
                transaction.update(docRef, {
                    reservedQty: (record.reservedQty || 0) + qty,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            // Log movement
            await this.createStockMovement({
                productId: productId,
                type: 'reserve',
                qty: qty,
                date: date,
                orderId: orderId,
                notes: `Reserved for order ${orderId}`,
                performedBy: 'System'
            });
            
            return { success: true };
            
        } catch (error) {
            console.error('Error reserving stock:', error);
            throw error;
        }
    },

    /**
     * Complete a sale (deduct from stock)
     * For walk-in: immediate deduction
     * For online: converts reserved to sold
     */
    async completeSale(productId, qty, orderId, isOnlineOrder = false) {
        const date = this.getTodayString();
        const docId = `${date}_${productId}`;
        
        try {
            const docRef = db.collection('dailyInventory').doc(docId);
            
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                
                if (!doc.exists) {
                    throw new Error('No inventory record for this product today');
                }
                
                const record = doc.data();
                
                if (isOnlineOrder) {
                    // Online order: move from reserved to sold
                    if ((record.reservedQty || 0) < qty) {
                        throw new Error('Reserved quantity mismatch');
                    }
                    
                    transaction.update(docRef, {
                        reservedQty: (record.reservedQty || 0) - qty,
                        soldQty: (record.soldQty || 0) + qty,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    // Walk-in: direct deduction from sellable
                    const stock = this.calculateStock(record);
                    
                    if (stock.sellable < qty) {
                        throw new Error(`Insufficient stock. Available: ${stock.sellable}, Requested: ${qty}`);
                    }
                    
                    transaction.update(docRef, {
                        soldQty: (record.soldQty || 0) + qty,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
            
            // Log movement
            await this.createStockMovement({
                productId: productId,
                type: 'sale',
                qty: -qty,
                date: date,
                orderId: orderId,
                notes: isOnlineOrder ? `Online order ${orderId} completed` : `Walk-in sale`,
                performedBy: Auth.currentUser?.displayName || 'POS'
            });
            
            return { success: true };
            
        } catch (error) {
            console.error('Error completing sale:', error);
            throw error;
        }
    },

    /**
     * Cancel an order - restore reserved stock
     */
    async cancelReservation(productId, qty, orderId) {
        const date = this.getTodayString();
        const docId = `${date}_${productId}`;
        
        try {
            const docRef = db.collection('dailyInventory').doc(docId);
            
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                
                if (!doc.exists) {
                    throw new Error('No inventory record for this product today');
                }
                
                const record = doc.data();
                
                transaction.update(docRef, {
                    reservedQty: Math.max(0, (record.reservedQty || 0) - qty),
                    cancelledQty: (record.cancelledQty || 0) + qty,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            // Log movement
            await this.createStockMovement({
                productId: productId,
                type: 'unreserve',
                qty: qty,
                date: date,
                orderId: orderId,
                notes: `Order ${orderId} cancelled - stock restored`,
                performedBy: Auth.currentUser?.displayName || 'System'
            });
            
            return { success: true };
            
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            throw error;
        }
    },
    
    // ===== ONE-TIME RECONCILE WITH POS SALES =====
    async reconcileWithPOS() {
        // Password prompt
        const password = prompt('Enter admin password to reconcile:');
        if (password === null) {
            return;
        }
        if (password !== '1185') {
            Toast.error('Invalid password');
            return;
        }
        
        const today = this.getTodayString();
        
        try {
            Toast.info('Fetching POS sales data...');
            
            // Get all sales for today from POS
            const salesSnapshot = await db.collection('sales')
                .where('dateKey', '==', today)
                .get();
            
            // Aggregate sold quantities by productId
            const soldByProduct = {};
            let totalSales = 0;
            
            salesSnapshot.forEach(doc => {
                const sale = doc.data();
                totalSales++;
                
                if (sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach(item => {
                        if (item.productId) {
                            soldByProduct[item.productId] = (soldByProduct[item.productId] || 0) + (item.quantity || 1);
                        }
                    });
                }
            });
            
            console.log('Sales aggregated:', soldByProduct);
            
            // Build comparison table
            let tableRows = '';
            let totalBeg = 0;
            let totalSold = 0;
            let totalBalance = 0;
            
            for (const record of this.dailyRecords) {
                const beg = record.totalAvailable || 0;
                const sold = soldByProduct[record.productId] || 0;
                const balance = beg - sold;
                
                totalBeg += beg;
                totalSold += sold;
                totalBalance += balance;
                
                const balanceColor = balance < 0 ? '#C62828' : balance <= 5 ? '#E65100' : '#2E7D32';
                
                tableRows += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:8px;text-align:left;">${record.productName}</td>
                        <td style="padding:8px;text-align:center;font-weight:600;">${beg}</td>
                        <td style="padding:8px;text-align:center;font-weight:600;color:#C62828;">${sold > 0 ? sold : '-'}</td>
                        <td style="padding:8px;text-align:center;font-weight:600;color:${balanceColor};">${balance}</td>
                    </tr>
                `;
            }
            
            // Show modal with comparison
            Modal.open({
                title: '🔄 Reconcile with POS Sales',
                content: `
                    <div style="margin-bottom:12px;padding:12px;background:#E3F2FD;border-radius:8px;">
                        <strong>POS Data:</strong> ${totalSales} transactions found for today
                    </div>
                    
                    <div style="max-height:400px;overflow-y:auto;border:1px solid #ddd;border-radius:8px;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                            <thead style="background:#F5F5F5;position:sticky;top:0;">
                                <tr>
                                    <th style="padding:10px;text-align:left;">Product</th>
                                    <th style="padding:10px;text-align:center;">Beginning</th>
                                    <th style="padding:10px;text-align:center;">Sold</th>
                                    <th style="padding:10px;text-align:center;">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                            <tfoot style="background:#FFF8E1;font-weight:bold;">
                                <tr>
                                    <td style="padding:10px;">TOTAL</td>
                                    <td style="padding:10px;text-align:center;">${totalBeg}</td>
                                    <td style="padding:10px;text-align:center;color:#C62828;">${totalSold}</td>
                                    <td style="padding:10px;text-align:center;">${totalBalance}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    
                    <div style="margin-top:12px;padding:12px;background:#FFF3E0;border-radius:8px;font-size:0.9rem;">
                        ⚠️ Clicking "Apply" will update the <strong>Sold</strong> quantity for all products based on POS data.
                    </div>
                `,
                width: '600px',
                saveText: '✅ Apply Reconciliation',
                onSave: () => this.applyReconciliation(soldByProduct, totalSales)
            });
            
        } catch (error) {
            console.error('Error fetching POS sales:', error);
            Toast.error('Failed to fetch sales: ' + error.message);
        }
    },
    
    async applyReconciliation(soldByProduct, totalSales) {
        const today = this.getTodayString();
        
        try {
            let updatedCount = 0;
            
            for (const record of this.dailyRecords) {
                const soldQty = soldByProduct[record.productId] || 0;
                const docId = `${today}_${record.productId}`;
                
                await db.collection('dailyInventory').doc(docId).update({
                    soldQty: soldQty,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Log the reconciliation
                if (soldQty > 0) {
                    await this.createStockMovement({
                        productId: record.productId,
                        type: 'reconcile',
                        qty: -soldQty,
                        date: today,
                        notes: `Reconciled with POS: ${soldQty} sold`,
                        performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
                    });
                }
                
                updatedCount++;
            }
            
            Modal.close();
            Toast.success(`Reconciliation complete! Updated ${updatedCount} products from ${totalSales} POS transactions`);
            
        } catch (error) {
            console.error('Error applying reconciliation:', error);
            Toast.error('Failed to apply: ' + error.message);
        }
    },

    // ===== WASTAGE TRACKING =====
    
    // Wastage reason labels for display
    wastageReasonLabels: {
        'stale_discarded': '🗑️ Stale/Expired - discarded',
        'damaged': '💔 Damaged/Breakage',
        'expired': '📅 Expired',
        'recycled_bread_pudding': '♻️ Recycled - Bread Pudding',
        'recycled_toasted': '♻️ Recycled - Toasted Bread',
        'recycled_croutons': '♻️ Recycled - Croutons',
        'recycled_other': '♻️ Recycled - Other',
        'employee_meal': '🍽️ Employee meal',
        'sample': '🧪 Taste test/sample',
        'donation': '❤️ Donation',
        'given_free': '🎁 Given to customer (free)'
    },
    
    // Get category from reason
    getWastageCategory(reason) {
        if (reason.startsWith('recycled')) return 'recycled';
        if (['employee_meal', 'sample', 'donation', 'given_free'].includes(reason)) return 'giveaway';
        return 'wastage';
    },
    
    // Create a wastage record
    async createWastageRecord(data) {
        const date = this.getTodayString();
        const docId = `${date}_${data.productId}_${Date.now()}`;
        
        // Try to get unit cost from Products (recipe costing)
        let unitCost = 0;
        const product = Products.data.find(p => p.id === data.productId);
        if (product && product.costPerUnit) {
            unitCost = product.costPerUnit;
        }
        
        const wastageRecord = {
            date: date,
            productId: data.productId,
            productName: data.productName,
            category: data.category || '',
            qty: data.qty,
            reason: data.reason,
            reasonLabel: this.wastageReasonLabels[data.reason] || data.reason,
            reasonCategory: this.getWastageCategory(data.reason),
            unitCost: unitCost,
            totalCost: unitCost * data.qty,
            sourceAction: data.sourceAction || 'manual',
            notes: data.notes || '',
            recordedBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('dailyWastage').doc(docId).set(wastageRecord);
        
        // Also log as stock movement for audit trail
        await this.createStockMovement({
            productId: data.productId,
            type: 'wastage',
            qty: -data.qty,
            date: date,
            notes: `${this.wastageReasonLabels[data.reason] || data.reason}: ${data.qty} units (₱${(unitCost * data.qty).toFixed(2)})`,
            performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
        });
        
        console.log('Created wastage record:', wastageRecord);
        return docId;
    },
    
    // Show wastage report/view
    async showWastageReport() {
        const date = this.selectedDate;
        
        try {
            const snapshot = await db.collection('dailyWastage')
                .where('date', '==', date)
                .get();
            
            const wastageRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Sort by creation time
            wastageRecords.sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });
            
            // Calculate totals by category
            let totalWastage = 0, totalRecycled = 0, totalGiveaway = 0;
            let wastageCount = 0, recycledCount = 0, giveawayCount = 0;
            
            wastageRecords.forEach(r => {
                if (r.reasonCategory === 'wastage') {
                    totalWastage += r.totalCost || 0;
                    wastageCount += r.qty || 0;
                } else if (r.reasonCategory === 'recycled') {
                    totalRecycled += r.totalCost || 0;
                    recycledCount += r.qty || 0;
                } else if (r.reasonCategory === 'giveaway') {
                    totalGiveaway += r.totalCost || 0;
                    giveawayCount += r.qty || 0;
                }
            });
            
            const isToday = date === this.getTodayString();
            
            let tableRows = '';
            if (wastageRecords.length === 0) {
                tableRows = `
                    <tr>
                        <td colspan="5" style="padding:24px;text-align:center;color:#666;">
                            No wastage recorded for ${this.formatDateShort(date)}
                        </td>
                    </tr>
                `;
            } else {
                wastageRecords.forEach(r => {
                    const categoryColor = r.reasonCategory === 'wastage' ? '#C62828' : 
                                         r.reasonCategory === 'recycled' ? '#2E7D32' : '#1565C0';
                    tableRows += `
                        <tr style="border-bottom:1px solid #eee;">
                            <td style="padding:10px;">${r.productName}</td>
                            <td style="padding:10px;text-align:center;">${r.qty}</td>
                            <td style="padding:10px;font-size:0.85rem;">${r.reasonLabel || r.reason}</td>
                            <td style="padding:10px;text-align:right;color:${categoryColor};font-weight:500;">
                                ₱${(r.totalCost || 0).toFixed(2)}
                            </td>
                            <td style="padding:10px;text-align:center;">
                                ${isToday ? `
                                    <button class="btn btn-sm" onclick="Inventory.restoreFromWastage('${r.id}')" 
                                            style="background:#E8F5E9;border:1px solid #4CAF50;color:#2E7D32;padding:4px 8px;font-size:0.8rem;">
                                        ↩️ Restore
                                    </button>
                                ` : '-'}
                            </td>
                        </tr>
                    `;
                });
            }
            
            Modal.open({
                title: `🗑️ Wastage Report - ${this.formatDateShort(date)}`,
                content: `
                    <!-- Summary Cards -->
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
                        <div style="background:#FFEBEE;padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:0.8rem;color:#C62828;">Pure Wastage</div>
                            <div style="font-size:1.3rem;font-weight:bold;color:#C62828;">₱${totalWastage.toFixed(2)}</div>
                            <div style="font-size:0.75rem;color:#666;">${wastageCount} items</div>
                        </div>
                        <div style="background:#E8F5E9;padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:0.8rem;color:#2E7D32;">Recycled</div>
                            <div style="font-size:1.3rem;font-weight:bold;color:#2E7D32;">₱${totalRecycled.toFixed(2)}</div>
                            <div style="font-size:0.75rem;color:#666;">${recycledCount} items</div>
                        </div>
                        <div style="background:#E3F2FD;padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:0.8rem;color:#1565C0;">Giveaways</div>
                            <div style="font-size:1.3rem;font-weight:bold;color:#1565C0;">₱${totalGiveaway.toFixed(2)}</div>
                            <div style="font-size:0.75rem;color:#666;">${giveawayCount} items</div>
                        </div>
                    </div>
                    
                    <!-- Wastage Table -->
                    <div style="max-height:350px;overflow-y:auto;border:1px solid #ddd;border-radius:8px;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                            <thead style="background:#F5F5F5;position:sticky;top:0;">
                                <tr>
                                    <th style="padding:10px;text-align:left;">Product</th>
                                    <th style="padding:10px;text-align:center;">Qty</th>
                                    <th style="padding:10px;text-align:left;">Reason</th>
                                    <th style="padding:10px;text-align:right;">Cost</th>
                                    <th style="padding:10px;text-align:center;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Total -->
                    <div style="margin-top:12px;padding:12px;background:#FFF3E0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-weight:600;">Total Loss Value:</span>
                        <span style="font-size:1.3rem;font-weight:bold;color:#E65100;">
                            ₱${(totalWastage + totalRecycled + totalGiveaway).toFixed(2)}
                        </span>
                    </div>
                    
                    ${isToday ? `
                        <div style="margin-top:8px;font-size:0.8rem;color:#666;text-align:center;">
                            💡 Click "Restore" to put items back into today's inventory if marked by mistake
                        </div>
                    ` : ''}
                `,
                width: '650px',
                showCancel: false,
                saveText: 'Close'
            });
            
        } catch (error) {
            console.error('Error loading wastage report:', error);
            Toast.error('Failed to load wastage report');
        }
    },
    
    // Restore item from wastage back to inventory
    async restoreFromWastage(wastageId) {
        try {
            // Get the wastage record
            const doc = await db.collection('dailyWastage').doc(wastageId).get();
            if (!doc.exists) {
                Toast.error('Wastage record not found');
                return;
            }
            
            const wastage = doc.data();
            const today = this.getTodayString();
            
            // Only allow restore for today's wastage
            if (wastage.date !== today) {
                Toast.error('Can only restore today\'s wastage items');
                return;
            }
            
            // Confirm restore
            if (!confirm(`Restore ${wastage.qty} x ${wastage.productName} back to inventory?`)) {
                return;
            }
            
            const docId = `${today}_${wastage.productId}`;
            
            // Check if there's already a daily inventory record for this product
            const existingRecord = this.dailyRecords.find(r => r.productId === wastage.productId);
            
            if (existingRecord) {
                // Add to existing carryover
                await db.collection('dailyInventory').doc(docId).update({
                    carryoverQty: firebase.firestore.FieldValue.increment(wastage.qty),
                    totalAvailable: firebase.firestore.FieldValue.increment(wastage.qty),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Create new record
                const newRecord = {
                    productId: wastage.productId,
                    productName: wastage.productName,
                    category: wastage.category || '',
                    date: today,
                    
                    carryoverQty: wastage.qty,
                    newProductionQty: 0,
                    totalAvailable: wastage.qty,
                    
                    reservedQty: 0,
                    soldQty: 0,
                    cancelledQty: 0,
                    
                    openingLocked: false,
                    status: 'open',
                    actualRemaining: null,
                    variance: null,
                    varianceRemarks: null,
                    
                    notes: 'Restored from wastage',
                    createdBy: Auth.currentUser?.displayName || Auth.currentUser?.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('dailyInventory').doc(docId).set(newRecord);
            }
            
            // Log stock movement
            await this.createStockMovement({
                productId: wastage.productId,
                type: 'restore',
                qty: wastage.qty,
                date: today,
                notes: `Restored from wastage - was marked as ${wastage.reasonLabel || wastage.reason} by mistake`,
                performedBy: Auth.currentUser?.displayName || Auth.currentUser?.email
            });
            
            // Delete the wastage record
            await db.collection('dailyWastage').doc(wastageId).delete();
            
            Toast.success(`Restored ${wastage.qty} x ${wastage.productName} to inventory`);
            
            // Refresh the wastage report
            Modal.close();
            await this.load();
            this.render();
            
        } catch (error) {
            console.error('Error restoring from wastage:', error);
            Toast.error('Failed to restore: ' + error.message);
        }
    },

    // Quick fix to zero out a product's inventory (for stale items)
    async zeroOutProduct(productId) {
        const today = this.getTodayString();
        const docId = `${today}_${productId}`;
        const record = this.dailyRecords.find(r => r.productId === productId);
        
        if (!record) {
            Toast.error('Product not found');
            return;
        }
        
        const stock = this.calculateStock(record);
        if (stock.totalAvailable === 0) {
            Toast.info('Already at zero');
            return;
        }
        
        try {
            // Create wastage record first
            await this.createWastageRecord({
                productId: productId,
                productName: record.productName,
                category: record.category,
                qty: stock.totalAvailable,
                reason: 'stale_discarded',
                sourceAction: 'adjustment',
                notes: 'Zeroed out via quick fix'
            });
            
            // Update inventory to zero
            await db.collection('dailyInventory').doc(docId).update({
                carryoverQty: 0,
                newProductionQty: 0,
                totalAvailable: 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            Toast.success(`Zeroed out ${record.productName} (${stock.totalAvailable} marked as stale)`);
        } catch (error) {
            console.error('Error zeroing out product:', error);
            Toast.error('Failed: ' + error.message);
        }
    }
    
};
