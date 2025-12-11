/**
 * BreadHub ProofMaster - Purchase Requests
 * Handles the complete procurement workflow
 */

const PurchaseRequests = {
    data: [],
    currentRequest: null,
    
    statuses: {
        draft: { label: 'Draft', color: '#95A5A6', icon: '📝' },
        pending: { label: 'Pending Review', color: '#F39C12', icon: '🟡' },
        processed: { label: 'Processed', color: '#9B59B6', icon: '✔️' },
        approved: { label: 'Approved', color: '#3498DB', icon: '📋' },
        ordered: { label: 'Ordered', color: '#9B59B6', icon: '🚚' },
        received: { label: 'Received', color: '#27AE60', icon: '✅' },
        cancelled: { label: 'Cancelled', color: '#E74C3C', icon: '❌' }
    },
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('purchaseRequests');
            this.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('Error loading purchase requests:', error);
        }
    },
    
    render() {
        const container = document.getElementById('purchaseRequestsContent');
        if (!container) return;
        
        const pendingRequests = this.data.filter(r => r.status === 'pending');
        const approvedRequests = this.data.filter(r => r.status === 'approved');
        const orderedRequests = this.data.filter(r => r.status === 'ordered');
        
        container.innerHTML = `
            <!-- Action Buttons -->
            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                <button class="btn btn-primary" onclick="PurchaseRequests.showCreateModal()">
                    + New Purchase Request
                </button>
            </div>
            
            <!-- Pending Requests -->
            ${pendingRequests.length > 0 ? `
                <h3 style="margin-bottom: 12px;">🟡 Pending Review (${pendingRequests.length})</h3>
                <div class="cards-grid" style="margin-bottom: 24px;">
                    ${pendingRequests.map(req => this.renderRequestCard(req)).join('')}
                </div>
            ` : ''}
            
            <!-- Approved (Ready to Order) - These are now supplier-specific POs -->
            ${approvedRequests.length > 0 ? `
                <h3 style="margin-bottom: 12px;">📋 Ready to Order (${approvedRequests.length} PO${approvedRequests.length > 1 ? 's' : ''})</h3>
                <div class="cards-grid" style="margin-bottom: 24px;">
                    ${approvedRequests.map(req => this.renderPurchaseOrderCard(req)).join('')}
                </div>
            ` : ''}
            
            <!-- Ordered (Waiting for Delivery) -->
            ${orderedRequests.length > 0 ? `
                <h3 style="margin-bottom: 12px;">🚚 Ordered - Awaiting Delivery (${orderedRequests.length})</h3>
                <div class="cards-grid" style="margin-bottom: 24px;">
                    ${orderedRequests.map(req => this.renderPurchaseOrderCard(req)).join('')}
                </div>
            ` : ''}
            
            <!-- All Requests Table -->
            <h3 style="margin: 24px 0 12px;">📋 All Requests</h3>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Request #</th>
                            <th>Date</th>
                            <th>Supplier</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.data.length > 0 ? this.data.map(req => `
                            <tr>
                                <td><strong>${req.requestNumber}</strong></td>
                                <td>${Utils.formatDate(req.createdAt)}</td>
                                <td>${req.supplierName || req.requestedByName || '-'}</td>
                                <td>${req.items?.length || 0} items</td>
                                <td>${Utils.formatCurrency(req.grandTotal || 0)}</td>
                                <td>
                                    <span class="badge" style="background: ${this.statuses[req.status]?.color || '#95A5A6'}; color: white;">
                                        ${this.statuses[req.status]?.label || req.status}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-secondary btn-sm" onclick="PurchaseRequests.view('${req.id}')">View</button>
                                    ${req.status === 'pending' ? `
                                        <button class="btn btn-primary btn-sm" onclick="PurchaseRequests.review('${req.id}')">Review</button>
                                        <button class="btn btn-secondary btn-sm" onclick="PurchaseRequests.edit('${req.id}')">Edit</button>
                                    ` : ''}
                                    ${req.status === 'approved' ? `
                                        <button class="btn btn-primary btn-sm" onclick="PurchaseRequests.markAsOrdered('${req.id}')">Mark Ordered</button>
                                    ` : ''}
                                    ${req.status === 'ordered' ? `
                                        <button class="btn btn-primary btn-sm" onclick="PurchaseRequests.markAsReceived('${req.id}')">Mark Received</button>
                                    ` : ''}
                                    <button class="btn btn-danger btn-sm" onclick="PurchaseRequests.confirmDelete('${req.id}')" title="Delete">🗑</button>
                                </td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="7" class="empty-state">No purchase requests yet</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;
    },
    
    renderRequestCard(req) {
        const status = this.statuses[req.status];
        return `
            <div class="recipe-card">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, ${status.color} 0%, ${status.color}CC 100%);">
                    <h3>${req.requestNumber}</h3>
                    <span class="version">${status.label}</span>
                </div>
                <div class="recipe-card-body">
                    <div class="recipe-stat">
                        <span>📅 Date:</span>
                        <span>${Utils.formatDate(req.createdAt)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>👤 By:</span>
                        <span>${req.requestedByName || '-'}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>📦 Items:</span>
                        <span>${req.items?.length || 0} ingredients</span>
                    </div>
                    <div class="recipe-stat">
                        <span>💰 Total:</span>
                        <span><strong>${Utils.formatCurrency(req.grandTotal || 0)}</strong></span>
                    </div>
                    ${req.notes ? `
                        <div style="margin-top: 8px; padding: 8px; background: var(--bg-input); border-radius: 6px; font-size: 0.85rem;">
                            "${req.notes}"
                        </div>
                    ` : ''}
                </div>
                <div class="recipe-card-actions">
                    ${req.status === 'pending' ? `
                        <button class="btn btn-primary" onclick="PurchaseRequests.review('${req.id}')">Review & Approve</button>
                        <button class="btn btn-secondary" onclick="PurchaseRequests.edit('${req.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="PurchaseRequests.confirmDelete('${req.id}')" title="Delete">🗑</button>
                    ` : req.status === 'approved' ? `
                        <button class="btn btn-primary" onclick="PurchaseRequests.showPurchaseOrder('${req.id}')">View PO</button>
                        <button class="btn btn-danger btn-sm" onclick="PurchaseRequests.confirmDelete('${req.id}')" title="Delete">🗑</button>
                    ` : `
                        <button class="btn btn-secondary" onclick="PurchaseRequests.view('${req.id}')">View</button>
                        <button class="btn btn-danger btn-sm" onclick="PurchaseRequests.confirmDelete('${req.id}')" title="Delete">🗑</button>
                    `}
                </div>
            </div>
        `;
    },

    // Render a supplier-specific Purchase Order card (approved status)
    renderPurchaseOrderCard(req) {
        const status = this.statuses[req.status];
        const supplier = Suppliers.getById(req.supplierId);
        
        return `
            <div class="recipe-card">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, ${status.color} 0%, ${status.color}CC 100%);">
                    <h3>${req.requestNumber}</h3>
                    <span class="version">${status.label}</span>
                </div>
                <div class="recipe-card-body">
                    <div class="recipe-stat">
                        <span>🏪 Supplier:</span>
                        <span><strong>${req.supplierName || '-'}</strong></span>
                    </div>
                    <div class="recipe-stat">
                        <span>📍 Location:</span>
                        <span>${req.supplierLocation || supplier?.location || '-'}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>📦 Items:</span>
                        <span>${req.items?.length || 0} ingredients</span>
                    </div>
                    <div class="recipe-stat">
                        <span>📦 Subtotal:</span>
                        <span>${Utils.formatCurrency(req.subtotal || 0)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>🚚 Delivery:</span>
                        <span>${Utils.formatCurrency(req.deliveryFee || 0)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>💰 Total:</span>
                        <span><strong style="color: var(--primary);">${Utils.formatCurrency(req.grandTotal || 0)}</strong></span>
                    </div>
                    ${req.supplierMobile ? `
                        <div class="recipe-stat">
                            <span>📱 Mobile:</span>
                            <span><a href="tel:${req.supplierMobile}">${req.supplierMobile}</a></span>
                        </div>
                    ` : ''}
                    ${req.supplierFacebook ? `
                        <div class="recipe-stat">
                            <span>📘 FB:</span>
                            <span><a href="${req.supplierFacebook}" target="_blank">Message</a></span>
                        </div>
                    ` : ''}
                </div>
                <div class="recipe-card-actions">
                    <button class="btn btn-secondary" onclick="PurchaseRequests.showPurchaseOrder('${req.id}')">View PO</button>
                    ${req.status === 'approved' ? `
                        <button class="btn btn-primary" onclick="PurchaseRequests.markAsOrdered('${req.id}')">📦 Mark Ordered</button>
                    ` : ''}
                    ${req.status === 'ordered' ? `
                        <button class="btn btn-primary" style="background: var(--success);" onclick="PurchaseRequests.markAsReceived('${req.id}')">✅ Mark Received</button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm" onclick="PurchaseRequests.confirmDelete('${req.id}')" title="Delete">🗑</button>
                </div>
            </div>
        `;
    },

    // Mark PO as ordered (paid/sent to supplier)
    async markAsOrdered(requestId) {
        if (!confirm('Mark this PO as ordered? (You have paid and arranged pickup/delivery)')) return;
        
        try {
            await DB.update('purchaseRequests', requestId, {
                status: 'ordered',
                orderedAt: new Date().toISOString(),
                orderedBy: Auth.currentUser?.uid,
                orderedByName: Auth.userProfile?.displayName || 'Unknown'
            });
            
            Toast.success('PO marked as ordered! Waiting for delivery.');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error marking as ordered:', error);
            Toast.error('Failed to update');
        }
    },

    // Mark PO as received and update inventory
    async markAsReceived(requestId) {
        const req = this.data.find(r => r.id === requestId);
        if (!req) return;
        
        // Show confirmation with items list
        const itemsList = req.items.map(item => 
            `• ${item.ingredientName}: ${item.packagesNeeded} × ${item.packageSize}g = ${(item.packagesNeeded * item.packageSize / 1000).toFixed(2)}kg`
        ).join('\n');
        
        if (!confirm(`Mark as received and add to inventory?\n\nItems:\n${itemsList}\n\nThis will update stock levels.`)) return;
        
        try {
            // Update inventory for each item
            for (const item of req.items) {
                const ingredient = Ingredients.data.find(i => i.id === item.ingredientId);
                if (ingredient) {
                    const addedStock = item.packagesNeeded * item.packageSize; // in grams
                    const newStock = (ingredient.currentStock || 0) + addedStock;
                    
                    await DB.update('ingredients', item.ingredientId, {
                        currentStock: newStock,
                        lastRestockedAt: new Date().toISOString()
                    });
                    
                    // Update local data
                    ingredient.currentStock = newStock;
                }
            }
            
            // Update PO status
            await DB.update('purchaseRequests', requestId, {
                status: 'received',
                receivedAt: new Date().toISOString(),
                receivedBy: Auth.currentUser?.uid,
                receivedByName: Auth.userProfile?.displayName || 'Unknown'
            });
            
            Toast.success('Items received! Inventory updated.');
            await this.load();
            await Ingredients.load(); // Refresh ingredients data
            this.render();
            Ingredients.render(); // Refresh ingredients table if visible
        } catch (error) {
            console.error('Error marking as received:', error);
            Toast.error('Failed to update inventory');
        }
    },

    // Baker creates new request
    showCreateModal() {
        Modal.open({
            title: '📝 New Purchase Request',
            content: `
                <form id="purchaseRequestForm">
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">
                        Select ingredients you need to purchase. The system will find the best suppliers.
                    </p>
                    
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--bg-input); border-radius: 8px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead style="background: var(--bg-input); position: sticky; top: 0;">
                                <tr>
                                    <th style="padding: 12px; text-align: left; width: 40px;">
                                        <input type="checkbox" id="selectAllIngredients" onclick="PurchaseRequests.toggleSelectAll()">
                                    </th>
                                    <th style="padding: 12px; text-align: left;">Ingredient</th>
                                    <th style="padding: 12px; text-align: right; width: 120px;">Qty Needed</th>
                                    <th style="padding: 12px; text-align: center; width: 80px;">Unit</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Ingredients.data.map(ing => {
                                    const bestPrice = IngredientPrices.getCheapest(ing.id, true);
                                    const priceInfo = bestPrice 
                                        ? `₱${bestPrice.purchasePrice} / ${bestPrice.packageSize >= 1000 ? (bestPrice.packageSize/1000) + 'kg' : bestPrice.packageSize + 'g'}`
                                        : 'No supplier';
                                    const supplierName = bestPrice ? Suppliers.getById(bestPrice.supplierId)?.companyName : '';
                                    const stock = ing.currentStock || 0;
                                    const stockDisplay = Ingredients.formatStock(stock);
                                    const stockColor = stock === 0 ? 'var(--danger)' : stock < 5000 ? 'var(--warning)' : 'var(--text-secondary)';
                                    
                                    return `
                                    <tr style="border-bottom: 1px solid var(--bg-input);">
                                        <td style="padding: 12px;">
                                            <input type="checkbox" name="ingredient_${ing.id}" data-ingredient-id="${ing.id}" ${!bestPrice ? 'disabled' : ''}>
                                        </td>
                                        <td style="padding: 12px;">
                                            <strong>${ing.name}</strong>
                                            <br><small style="color: var(--text-secondary);">${Ingredients.formatCategory(ing.category)}</small>
                                            <br><small style="color: ${bestPrice ? 'var(--primary)' : 'var(--danger)'}; font-weight: 500;">${priceInfo}</small>
                                            ${supplierName ? `<small style="color: var(--text-secondary);"> • ${supplierName}</small>` : ''}
                                            <br><small style="color: ${stockColor};">📦 Stock: <strong>${stockDisplay}</strong></small>
                                        </td>
                                        <td style="padding: 12px; text-align: right;">
                                            <input type="number" name="qty_${ing.id}" class="form-input" 
                                                   style="width: 100px; text-align: right;" min="0" step="0.1"
                                                   placeholder="0" ${!bestPrice ? 'disabled' : ''}>
                                        </td>
                                        <td style="padding: 12px; text-align: center;">
                                            <select name="unit_${ing.id}" class="form-select" style="width: 80px;" ${!bestPrice ? 'disabled' : ''}>
                                                <option value="g">g</option>
                                                <option value="kg" selected>kg</option>
                                            </select>
                                        </td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="form-group" style="margin-top: 16px;">
                        <label>Notes (optional)</label>
                        <textarea name="notes" class="form-textarea" 
                                  placeholder="e.g., Need by Friday, running low for weekend production"></textarea>
                    </div>
                </form>
            `,
            saveText: 'Submit Request',
            width: '700px',
            onSave: () => this.submitRequest()
        });
    },
    
    toggleSelectAll() {
        const selectAll = document.getElementById('selectAllIngredients');
        const checkboxes = document.querySelectorAll('[data-ingredient-id]');
        checkboxes.forEach(cb => cb.checked = selectAll.checked);
    },
    
    async submitRequest() {
        // Collect selected items
        const items = [];
        
        Ingredients.data.forEach(ing => {
            const checkbox = document.querySelector(`[name="ingredient_${ing.id}"]`);
            const qtyInput = document.querySelector(`[name="qty_${ing.id}"]`);
            const unitSelect = document.querySelector(`[name="unit_${ing.id}"]`);
            
            if (checkbox?.checked && qtyInput?.value > 0) {
                let qtyGrams = parseFloat(qtyInput.value);
                if (unitSelect?.value === 'kg') qtyGrams *= 1000;
                
                // Find best supplier (cheapest in service area)
                const bestPrice = IngredientPrices.getCheapest(ing.id, true);
                const supplier = bestPrice ? Suppliers.getById(bestPrice.supplierId) : null;
                
                // Calculate packages needed
                const packageSize = bestPrice?.packageSize || 1000;
                const packagesNeeded = Math.ceil(qtyGrams / packageSize);
                const unitPrice = bestPrice?.purchasePrice || 0;
                const totalPrice = packagesNeeded * unitPrice;
                
                items.push({
                    ingredientId: ing.id,
                    ingredientName: ing.name,
                    qtyNeeded: qtyGrams,
                    packageSize,
                    packagesNeeded,
                    suggestedSupplierId: bestPrice?.supplierId || null,
                    selectedSupplierId: bestPrice?.supplierId || null,
                    supplierName: supplier?.companyName || 'No supplier',
                    unitPrice,
                    totalPrice,
                    costPerGram: bestPrice?.costPerGram || 0
                });
            }
        });
        
        if (items.length === 0) {
            Toast.error('Please select at least one ingredient with quantity');
            return;
        }
        
        // Calculate supplier groups and totals
        const supplierGroups = this.groupBySupplier(items);
        const grandTotal = supplierGroups.reduce((sum, g) => sum + g.groupTotal, 0);
        
        // Generate request number
        const today = new Date();
        const count = this.data.filter(r => 
            new Date(r.createdAt).toDateString() === today.toDateString()
        ).length + 1;
        const requestNumber = `PR-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${String(count).padStart(3,'0')}`;
        
        const notes = document.querySelector('[name="notes"]')?.value || '';
        
        // Create request
        const request = {
            requestNumber,
            status: 'pending',
            requestedBy: Auth.currentUser?.uid,
            requestedByName: Auth.userProfile?.displayName || 'Unknown',
            createdAt: new Date().toISOString(),
            items,
            supplierGroups,
            grandTotal,
            notes
        };
        
        try {
            await DB.add('purchaseRequests', request);
            Toast.success('Purchase request submitted!');
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error creating request:', error);
            Toast.error('Failed to create request');
        }
    },
    
    groupBySupplier(items) {
        const groups = {};
        
        items.forEach(item => {
            const supplierId = item.selectedSupplierId || 'unknown';
            if (!groups[supplierId]) {
                const supplier = Suppliers.getById(supplierId);
                groups[supplierId] = {
                    supplierId,
                    supplierName: supplier?.companyName || 'Unknown Supplier',
                    location: supplier?.location || '-',
                    mobile: supplier?.mobile || '',
                    facebook: supplier?.facebook || '',
                    items: [],
                    subtotal: 0,
                    deliveryFee: 0,
                    groupTotal: 0
                };
            }
            groups[supplierId].items.push(item);
            groups[supplierId].subtotal += item.totalPrice;
        });
        
        // Calculate delivery fees
        Object.values(groups).forEach(group => {
            group.deliveryFee = Suppliers.calculateDeliveryFee(group.supplierId, group.subtotal);
            group.groupTotal = group.subtotal + group.deliveryFee;
        });
        
        return Object.values(groups).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    },

    // Purchaser reviews and adjusts request
    async review(requestId) {
        const req = this.data.find(r => r.id === requestId);
        if (!req) return;
        
        this.currentRequest = JSON.parse(JSON.stringify(req)); // Deep copy
        
        // Recalculate supplier groups with FRESH supplier data (delivery fees may have changed)
        this.recalculateWithFreshSupplierData();
        
        Modal.open({
            title: `📋 Review: ${req.requestNumber}`,
            content: this.getReviewContent(this.currentRequest),
            saveText: '✓ Generate PO(s) by Supplier',
            width: '900px',
            onSave: () => this.approveRequest(requestId)
        });
    },
    
    // Recalculate all items and groups with fresh supplier data
    recalculateWithFreshSupplierData() {
        if (!this.currentRequest) return;
        
        // Update each item with fresh supplier info
        this.currentRequest.items.forEach(item => {
            const supplier = Suppliers.getById(item.selectedSupplierId);
            if (supplier) {
                item.supplierName = supplier.companyName;
            }
            
            // Get fresh price data
            const priceData = IngredientPrices.data.find(p => 
                p.ingredientId === item.ingredientId && p.supplierId === item.selectedSupplierId
            );
            
            if (priceData) {
                item.unitPrice = priceData.purchasePrice;
                item.packageSize = priceData.packageSize;
                item.packagesNeeded = Math.ceil(item.qtyNeeded / priceData.packageSize);
                item.totalPrice = item.packagesNeeded * priceData.purchasePrice;
                item.costPerGram = priceData.costPerGram;
            }
        });
        
        // Recalculate supplier groups (this will use fresh delivery fees)
        this.currentRequest.supplierGroups = this.groupBySupplier(this.currentRequest.items);
        this.currentRequest.grandTotal = this.currentRequest.supplierGroups.reduce((sum, g) => sum + g.groupTotal, 0);
    },
    
    getReviewContent(req) {
        return `
            <div style="padding: 8px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                    <div>
                        <span style="color: var(--text-secondary);">Requested by:</span>
                        <strong>${req.requestedByName}</strong> on ${Utils.formatDateTime(req.createdAt)}
                    </div>
                    <div>
                        <span class="badge" style="background: ${this.statuses[req.status]?.color}; color: white;">
                            ${this.statuses[req.status]?.label}
                        </span>
                    </div>
                </div>
                
                ${req.notes ? `
                    <div style="background: #FEF9E7; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                        <strong>📝 Note:</strong> ${req.notes}
                    </div>
                ` : ''}
                
                <!-- Items with supplier selection -->
                <div id="reviewItemsContainer">
                    ${req.items.map((item, idx) => this.renderItemReview(item, idx)).join('')}
                </div>
                
                <!-- Summary -->
                <div style="background: var(--bg-input); padding: 16px; border-radius: 10px; margin-top: 20px;">
                    <h4 style="margin: 0 0 12px;">📦 Order Summary (by Supplier)</h4>
                    <div id="supplierGroupsSummary">
                        ${this.renderSupplierGroups(req.supplierGroups)}
                    </div>
                    
                    <div style="border-top: 2px solid var(--primary); margin-top: 16px; padding-top: 16px; text-align: right;">
                        <span style="font-size: 1.2rem;">Grand Total: </span>
                        <span id="grandTotalDisplay" style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">
                            ${Utils.formatCurrency(req.grandTotal)}
                        </span>
                    </div>
                </div>
                
                <!-- Reviewer Notes -->
                <div style="margin-top: 16px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 500;">📝 Reviewer Notes (optional)</label>
                    <textarea id="reviewerNotes" class="form-textarea" rows="2" 
                              placeholder="e.g., Changed supplier for better price, adjusted flour quantity..."
                              style="width: 100%;">${req.reviewerNotes || ''}</textarea>
                </div>
            </div>
        `;
    },
    
    renderItemReview(item, idx) {
        // Get comparison table for this ingredient
        const comparison = IngredientPrices.getComparisonTable(item.ingredientId, item.qtyNeeded);
        const qtyKg = (item.qtyNeeded / 1000).toFixed(2);
        
        // Fix: Make sure we have a selected supplier
        if (!item.selectedSupplierId && comparison.length > 0) {
            const bestOption = comparison.find(c => c.inServiceArea) || comparison[0];
            item.selectedSupplierId = bestOption.supplierId;
            item.supplierName = bestOption.supplierName;
            item.unitPrice = bestOption.purchasePrice;
            item.packageSize = bestOption.packageSize;
            item.packagesNeeded = bestOption.packagesNeeded;
            item.totalPrice = bestOption.itemTotal;
        }
        
        return `
            <div id="reviewItem_${idx}" style="border: 1px solid var(--bg-input); border-radius: 10px; margin-bottom: 16px; overflow: hidden;">
                <div style="background: var(--bg-input); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <strong>${item.ingredientName}</strong>
                        
                        <!-- Quantity Adjustment -->
                        <div style="display: flex; align-items: center; gap: 6px; background: white; padding: 4px 8px; border-radius: 6px; border: 1px solid #ddd;">
                            <label style="font-size: 0.85rem; color: var(--text-secondary);">Qty:</label>
                            <input type="number" id="reviewQty_${idx}" value="${qtyKg}" 
                                   min="0.1" step="0.1" style="width: 70px; padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; text-align: right;"
                                   onchange="PurchaseRequests.updateItemQuantity(${idx})">
                            <select id="reviewUnit_${idx}" style="padding: 4px; border: 1px solid #ddd; border-radius: 4px;" onchange="PurchaseRequests.updateItemQuantity(${idx})">
                                <option value="kg" selected>kg</option>
                                <option value="g">g</option>
                            </select>
                        </div>
                        
                        <span id="reviewPkgInfo_${idx}" style="color: var(--text-secondary); font-size: 0.85rem;">
                            → ${item.packagesNeeded} pkg${item.packagesNeeded > 1 ? 's' : ''} @ ${item.packageSize}g
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <strong style="color: var(--primary);" id="reviewItemTotal_${idx}">${Utils.formatCurrency(item.totalPrice)}</strong>
                        <button type="button" class="btn btn-danger btn-sm" onclick="PurchaseRequests.removeItemFromReview(${idx})" title="Remove item" style="padding: 4px 8px;">
                            ✕
                        </button>
                    </div>
                </div>
                
                <div style="padding: 12px;">
                    ${comparison.length > 0 ? `
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--bg-input);">
                                    <th style="padding: 8px; text-align: left; width: 40px;"></th>
                                    <th style="padding: 8px; text-align: left;">Supplier</th>
                                    <th style="padding: 8px; text-align: left;">Location</th>
                                    <th style="padding: 8px; text-align: right;">Unit Price</th>
                                    <th style="padding: 8px; text-align: right;">Item Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${comparison.map((row, rowIdx) => `
                                    <tr style="border-bottom: 1px solid var(--bg-input); ${!row.inServiceArea ? 'opacity: 0.6;' : ''}" 
                                        onclick="${row.inServiceArea ? `PurchaseRequests.selectSupplier(${idx}, '${row.supplierId}')` : ''}"
                                        style="cursor: ${row.inServiceArea ? 'pointer' : 'not-allowed'};">
                                        <td style="padding: 8px;">
                                            <input type="radio" 
                                                   name="supplierRadio_${idx}" 
                                                   id="radio_${idx}_${row.supplierId}"
                                                   value="${row.supplierId}"
                                                   ${item.selectedSupplierId === row.supplierId ? 'checked' : ''}
                                                   ${!row.inServiceArea ? 'disabled' : ''}
                                                   onclick="event.stopPropagation(); PurchaseRequests.selectSupplier(${idx}, '${row.supplierId}')">
                                        </td>
                                        <td style="padding: 8px;">
                                            ${rowIdx === 0 && row.inServiceArea ? '⭐ ' : ''}${row.supplierName}
                                            ${row.lastPurchaseDate ? '<br><small style="color: var(--text-secondary);">Last: ' + Utils.formatDate(row.lastPurchaseDate) + '</small>' : ''}
                                        </td>
                                        <td style="padding: 8px;">
                                            ${row.location}
                                            ${!row.inServiceArea ? '<br><small style="color: var(--warning);">Outside area</small>' : ''}
                                        </td>
                                        <td style="padding: 8px; text-align: right;">
                                            ${Utils.formatCurrency(row.purchasePrice)}/${row.packageSize}g
                                        </td>
                                        <td style="padding: 8px; text-align: right; font-weight: bold;">${Utils.formatCurrency(row.itemTotal)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 8px 0 0; font-style: italic;">
                            💡 Delivery fee is calculated per supplier in the Order Summary below
                        </p>
                    ` : `
                        <p class="empty-state">No supplier prices available for this ingredient</p>
                    `}
                </div>
            </div>
        `;
    },
    
    renderSupplierGroups(groups) {
        if (!groups || groups.length === 0) return '<p>No items</p>';
        
        return groups.map(group => `
            <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <strong>${group.supplierName}</strong>
                        <span style="color: var(--text-secondary); margin-left: 8px;">(${group.location})</span>
                    </div>
                </div>
                
                <!-- Individual items -->
                <div style="font-size: 0.85rem; border-top: 1px solid var(--bg-input); padding-top: 8px;">
                    ${group.items.map(item => `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                            <span>${item.ingredientName} <span style="color: var(--text-secondary);">(${item.packagesNeeded} × ${item.packageSize}g)</span></span>
                            <span>${Utils.formatCurrency(item.totalPrice)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Subtotal, Delivery, Total -->
                <div style="border-top: 1px solid var(--bg-input); margin-top: 8px; padding-top: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                        <span>Items Subtotal:</span>
                        <span>${Utils.formatCurrency(group.subtotal)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: ${group.deliveryFee > 0 ? 'var(--warning)' : 'var(--success)'};">
                        <span>🚚 Delivery:</span>
                        <span>${group.deliveryFee > 0 ? Utils.formatCurrency(group.deliveryFee) : 'FREE'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--primary); margin-top: 4px; font-size: 1rem;">
                        <span>Supplier Total:</span>
                        <span>${Utils.formatCurrency(group.groupTotal)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    changeSupplier(itemIdx, newSupplierId) {
        this.selectSupplier(itemIdx, newSupplierId);
    },
    
    // New unified supplier selection method
    selectSupplier(itemIdx, newSupplierId) {
        if (!this.currentRequest) return;
        
        const item = this.currentRequest.items[itemIdx];
        if (!item) return;
        
        // Find new price
        const newPrice = IngredientPrices.data.find(p => 
            p.ingredientId === item.ingredientId && p.supplierId === newSupplierId
        );
        
        if (newPrice) {
            const supplier = Suppliers.getById(newSupplierId);
            item.selectedSupplierId = newSupplierId;
            item.supplierName = supplier?.companyName || 'Unknown';
            item.unitPrice = newPrice.purchasePrice;
            item.packageSize = newPrice.packageSize;
            item.packagesNeeded = Math.ceil(item.qtyNeeded / newPrice.packageSize);
            item.totalPrice = item.packagesNeeded * newPrice.purchasePrice;
            item.costPerGram = newPrice.costPerGram;
            
            // Update radio button visually
            const radio = document.getElementById(`radio_${itemIdx}_${newSupplierId}`);
            if (radio) radio.checked = true;
            
            // Update item total display
            const totalEl = document.getElementById(`reviewItemTotal_${itemIdx}`);
            if (totalEl) totalEl.textContent = Utils.formatCurrency(item.totalPrice);
            
            // Update package info
            const pkgInfo = document.getElementById(`reviewPkgInfo_${itemIdx}`);
            if (pkgInfo) pkgInfo.textContent = `→ ${item.packagesNeeded} pkg${item.packagesNeeded > 1 ? 's' : ''} @ ${item.packageSize}g`;
        }
        
        // Recalculate groups
        this.currentRequest.supplierGroups = this.groupBySupplier(this.currentRequest.items);
        this.currentRequest.grandTotal = this.currentRequest.supplierGroups.reduce((sum, g) => sum + g.groupTotal, 0);
        
        // Update displays
        document.getElementById('supplierGroupsSummary').innerHTML = 
            this.renderSupplierGroups(this.currentRequest.supplierGroups);
        document.getElementById('grandTotalDisplay').textContent = 
            Utils.formatCurrency(this.currentRequest.grandTotal);
    },

    // Update item quantity during review
    updateItemQuantity(itemIdx) {
        if (!this.currentRequest) return;
        
        const item = this.currentRequest.items[itemIdx];
        if (!item) return;
        
        const qtyInput = document.getElementById(`reviewQty_${itemIdx}`);
        const unitSelect = document.getElementById(`reviewUnit_${itemIdx}`);
        
        if (!qtyInput || !unitSelect) return;
        
        let newQtyGrams = parseFloat(qtyInput.value) || 0;
        if (unitSelect.value === 'kg') newQtyGrams *= 1000;
        
        if (newQtyGrams <= 0) {
            Toast.error('Quantity must be greater than 0');
            return;
        }
        
        // Update item
        item.qtyNeeded = newQtyGrams;
        item.packagesNeeded = Math.ceil(newQtyGrams / item.packageSize);
        item.totalPrice = item.packagesNeeded * item.unitPrice;
        
        // Recalculate groups
        this.currentRequest.supplierGroups = this.groupBySupplier(this.currentRequest.items);
        this.currentRequest.grandTotal = this.currentRequest.supplierGroups.reduce((sum, g) => sum + g.groupTotal, 0);
        
        // Update displays
        document.getElementById(`reviewItemTotal_${itemIdx}`).textContent = Utils.formatCurrency(item.totalPrice);
        document.getElementById('supplierGroupsSummary').innerHTML = 
            this.renderSupplierGroups(this.currentRequest.supplierGroups);
        document.getElementById('grandTotalDisplay').textContent = 
            Utils.formatCurrency(this.currentRequest.grandTotal);
        
        // Update the packages info text
        const itemDiv = document.getElementById(`reviewItem_${itemIdx}`);
        if (itemDiv) {
            const infoSpan = itemDiv.querySelector('span[style*="text-secondary"]');
            if (infoSpan) {
                infoSpan.textContent = `→ ${item.packagesNeeded} pkg${item.packagesNeeded > 1 ? 's' : ''} @ ${item.packageSize}g`;
            }
        }
    },
    
    // Remove item from review
    removeItemFromReview(itemIdx) {
        if (!this.currentRequest) return;
        
        const item = this.currentRequest.items[itemIdx];
        if (!item) return;
        
        // Confirm removal
        if (!confirm(`Remove "${item.ingredientName}" from this request?`)) return;
        
        // Remove item
        this.currentRequest.items.splice(itemIdx, 1);
        
        // Check if any items left
        if (this.currentRequest.items.length === 0) {
            Toast.error('Cannot remove all items. Delete the request instead.');
            // Re-add the item back
            this.currentRequest.items.splice(itemIdx, 0, item);
            return;
        }
        
        // Recalculate groups
        this.currentRequest.supplierGroups = this.groupBySupplier(this.currentRequest.items);
        this.currentRequest.grandTotal = this.currentRequest.supplierGroups.reduce((sum, g) => sum + g.groupTotal, 0);
        
        // Re-render all items (indices changed)
        this.refreshReviewItemsDisplay();
        
        Toast.success(`Removed "${item.ingredientName}"`);
    },
    
    // Refresh review items display
    refreshReviewItemsDisplay() {
        const container = document.getElementById('reviewItemsContainer');
        if (!container || !this.currentRequest) return;
        
        container.innerHTML = this.currentRequest.items
            .map((item, idx) => this.renderItemReview(item, idx))
            .join('');
        
        document.getElementById('supplierGroupsSummary').innerHTML = 
            this.renderSupplierGroups(this.currentRequest.supplierGroups);
        document.getElementById('grandTotalDisplay').textContent = 
            Utils.formatCurrency(this.currentRequest.grandTotal);
    },

    async approveRequest(requestId) {
        if (!this.currentRequest) return;
        
        // Check if there are items
        if (!this.currentRequest.items || this.currentRequest.items.length === 0) {
            Toast.error('Cannot approve - no items in request');
            return;
        }
        
        const reviewerNotes = document.getElementById('reviewerNotes')?.value || '';
        
        try {
            // Group items by supplier - each supplier gets their own PO
            const supplierGroups = this.groupBySupplier(this.currentRequest.items);
            const results = [];
            
            for (const group of supplierGroups) {
                // Check if there's already an approved (not purchased) PR for this supplier
                const existingPR = this.data.find(pr => 
                    pr.status === 'approved' && 
                    pr.supplierId === group.supplierId
                );
                
                if (existingPR) {
                    // Add items to existing PR
                    const updatedItems = [...existingPR.items];
                    
                    for (const newItem of group.items) {
                        // Check if this ingredient already exists in the PR
                        const existingItemIdx = updatedItems.findIndex(i => 
                            i.ingredientId === newItem.ingredientId && 
                            i.packageSize === newItem.packageSize
                        );
                        
                        if (existingItemIdx >= 0) {
                            // Update quantity of existing item
                            updatedItems[existingItemIdx].qtyNeeded += newItem.qtyNeeded;
                            updatedItems[existingItemIdx].packagesNeeded = Math.ceil(
                                updatedItems[existingItemIdx].qtyNeeded / updatedItems[existingItemIdx].packageSize
                            );
                            updatedItems[existingItemIdx].totalPrice = 
                                updatedItems[existingItemIdx].packagesNeeded * updatedItems[existingItemIdx].unitPrice;
                        } else {
                            // Add new item
                            updatedItems.push(newItem);
                        }
                    }
                    
                    // Recalculate totals for the updated PR
                    const subtotal = updatedItems.reduce((sum, i) => sum + i.totalPrice, 0);
                    const deliveryFee = Suppliers.calculateDeliveryFee(group.supplierId, subtotal);
                    const grandTotal = subtotal + deliveryFee;
                    
                    await DB.update('purchaseRequests', existingPR.id, {
                        items: updatedItems,
                        subtotal,
                        deliveryFee,
                        grandTotal,
                        updatedAt: new Date().toISOString(),
                        lastModifiedBy: Auth.currentUser?.uid,
                        lastModifiedByName: Auth.userProfile?.displayName || 'Unknown'
                    });
                    
                    results.push({
                        type: 'updated',
                        requestNumber: existingPR.requestNumber,
                        supplierName: group.supplierName,
                        itemCount: group.items.length
                    });
                } else {
                    // Create new PR for this supplier
                    const today = new Date();
                    const supplierPRs = this.data.filter(r => 
                        new Date(r.createdAt).toDateString() === today.toDateString()
                    ).length + results.length + 1;
                    
                    const requestNumber = `PO-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${String(supplierPRs).padStart(3,'0')}`;
                    
                    const subtotal = group.subtotal;
                    const deliveryFee = group.deliveryFee;
                    const grandTotal = group.groupTotal;
                    
                    const newPR = {
                        requestNumber,
                        status: 'approved',
                        supplierId: group.supplierId,
                        supplierName: group.supplierName,
                        supplierLocation: group.location,
                        supplierMobile: group.mobile,
                        supplierFacebook: group.facebook,
                        items: group.items,
                        subtotal,
                        deliveryFee,
                        grandTotal,
                        requestedBy: this.currentRequest.requestedBy,
                        requestedByName: this.currentRequest.requestedByName,
                        originalRequestNumber: this.currentRequest.requestNumber,
                        notes: this.currentRequest.notes,
                        reviewerNotes,
                        approvedBy: Auth.currentUser?.uid,
                        approvedByName: Auth.userProfile?.displayName || 'Unknown',
                        approvedAt: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    };
                    
                    await DB.add('purchaseRequests', newPR);
                    
                    results.push({
                        type: 'created',
                        requestNumber,
                        supplierName: group.supplierName,
                        itemCount: group.items.length
                    });
                }
            }
            
            // Mark original request as processed
            await DB.update('purchaseRequests', requestId, {
                status: 'processed',
                processedAt: new Date().toISOString(),
                processedBy: Auth.currentUser?.uid,
                processedByName: Auth.userProfile?.displayName || 'Unknown',
                processedInto: results.map(r => r.requestNumber)
            });
            
            // Show summary
            const created = results.filter(r => r.type === 'created');
            const updated = results.filter(r => r.type === 'updated');
            
            let message = '✅ Purchase Orders generated!\n\n';
            if (created.length > 0) {
                message += `Created ${created.length} new PO(s):\n`;
                created.forEach(r => message += `• ${r.requestNumber} - ${r.supplierName} (${r.itemCount} items)\n`);
            }
            if (updated.length > 0) {
                message += `\nUpdated ${updated.length} existing PO(s):\n`;
                updated.forEach(r => message += `• ${r.requestNumber} - ${r.supplierName} (+${r.itemCount} items)\n`);
            }
            
            Toast.success(`Generated ${results.length} Purchase Order(s)!`);
            alert(message);
            
            Modal.close();
            this.currentRequest = null;
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error approving request:', error);
            Toast.error('Failed to approve request');
        }
    },
    
    async view(requestId) {
        const req = this.data.find(r => r.id === requestId);
        if (!req) return;
        
        Modal.open({
            title: `${req.requestNumber}`,
            content: `
                <div style="padding: 16px 0;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div class="recipe-stat">
                            <span>Status:</span>
                            <span class="badge" style="background: ${this.statuses[req.status]?.color}; color: white;">
                                ${this.statuses[req.status]?.label}
                            </span>
                        </div>
                        <div class="recipe-stat">
                            <span>Created:</span>
                            <span>${Utils.formatDateTime(req.createdAt)}</span>
                        </div>
                        <div class="recipe-stat">
                            <span>Requested By:</span>
                            <span>${req.requestedByName || '-'}</span>
                        </div>
                        <div class="recipe-stat">
                            <span>Grand Total:</span>
                            <span style="font-weight: bold; color: var(--primary);">${Utils.formatCurrency(req.grandTotal)}</span>
                        </div>
                        ${req.approvedByName ? `
                            <div class="recipe-stat">
                                <span>Approved By:</span>
                                <span>${req.approvedByName}</span>
                            </div>
                            <div class="recipe-stat">
                                <span>Approved:</span>
                                <span>${Utils.formatDateTime(req.approvedAt)}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${req.notes ? `
                        <div style="background: #FEF9E7; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                            <strong>📝 Note:</strong> ${req.notes}
                        </div>
                    ` : ''}
                    
                    <h4 style="margin: 16px 0 8px;">Items</h4>
                    <div style="border: 1px solid var(--bg-input); border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead style="background: var(--bg-input);">
                                <tr>
                                    <th style="padding: 10px; text-align: left;">Ingredient</th>
                                    <th style="padding: 10px; text-align: left;">Supplier</th>
                                    <th style="padding: 10px; text-align: right;">Qty</th>
                                    <th style="padding: 10px; text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${req.items.map(item => `
                                    <tr style="border-bottom: 1px solid var(--bg-input);">
                                        <td style="padding: 10px;">${item.ingredientName}</td>
                                        <td style="padding: 10px;">${item.supplierName}</td>
                                        <td style="padding: 10px; text-align: right;">
                                            ${item.packagesNeeded} × ${item.packageSize}g
                                        </td>
                                        <td style="padding: 10px; text-align: right; font-weight: bold;">
                                            ${Utils.formatCurrency(item.totalPrice)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <h4 style="margin: 16px 0 8px;">By Supplier</h4>
                    ${this.renderSupplierGroups(req.supplierGroups)}
                    
                    <!-- Action Buttons -->
                    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--bg-input); display: flex; gap: 12px; justify-content: flex-end;">
                        ${req.status === 'pending' ? `
                            <button class="btn btn-secondary" onclick="Modal.close(); PurchaseRequests.edit('${req.id}');">✏️ Edit</button>
                            <button class="btn btn-primary" onclick="Modal.close(); PurchaseRequests.review('${req.id}');">Review & Approve</button>
                        ` : ''}
                        ${req.status === 'approved' ? `
                            <button class="btn btn-primary" onclick="Modal.close(); PurchaseRequests.showPurchaseOrder('${req.id}');">View PO</button>
                        ` : ''}
                        <button class="btn btn-danger" onclick="Modal.close(); PurchaseRequests.confirmDelete('${req.id}');">🗑 Delete</button>
                    </div>
                </div>
            `,
            showFooter: false,
            width: '700px'
        });
    },
    
    showPurchaseOrder(requestId) {
        const req = this.data.find(r => r.id === requestId);
        if (!req || req.status !== 'approved') return;
        
        // Generate PO content grouped by supplier
        Modal.open({
            title: `🛒 Purchase Order: ${req.requestNumber}`,
            content: `
                <div style="padding: 8px 0;">
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">
                        Contact each supplier below to place orders. Mark as purchased when complete.
                    </p>
                    
                    ${req.supplierGroups.map(group => {
                        const supplier = Suppliers.getById(group.supplierId);
                        return `
                            <div style="border: 2px solid var(--primary-light); border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
                                <div style="background: var(--primary-light); padding: 16px;">
                                    <h3 style="margin: 0;">${group.supplierName}</h3>
                                    <div style="color: var(--text-secondary); margin-top: 4px;">📍 ${group.location}</div>
                                </div>
                                
                                <div style="padding: 16px;">
                                    <!-- Contact Info -->
                                    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
                                        ${supplier?.mobile ? `
                                            <a href="tel:${supplier.mobile}" class="btn btn-secondary btn-sm">
                                                📞 ${supplier.mobile}
                                            </a>
                                        ` : ''}
                                        ${supplier?.facebook ? `
                                            <a href="${supplier.facebook}" target="_blank" class="btn btn-secondary btn-sm">
                                                💬 Messenger
                                            </a>
                                        ` : ''}
                                        ${supplier?.email ? `
                                            <a href="mailto:${supplier.email}" class="btn btn-secondary btn-sm">
                                                📧 Email
                                            </a>
                                        ` : ''}
                                    </div>
                                    
                                    <!-- Items -->
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
                                        ${group.items.map(item => `
                                            <tr style="border-bottom: 1px solid var(--bg-input);">
                                                <td style="padding: 8px 0;">
                                                    <strong>${item.ingredientName}</strong>
                                                </td>
                                                <td style="padding: 8px 0; text-align: right;">
                                                    ${item.packagesNeeded} × ${item.packageSize}g
                                                </td>
                                                <td style="padding: 8px 0; text-align: right; width: 100px;">
                                                    ${Utils.formatCurrency(item.totalPrice)}
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </table>
                                    
                                    <!-- Totals -->
                                    <div style="border-top: 2px solid var(--bg-input); padding-top: 12px;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>Subtotal:</span>
                                            <span>${Utils.formatCurrency(group.subtotal)}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; color: ${group.deliveryFee > 0 ? 'var(--warning)' : 'var(--success)'};">
                                            <span>Delivery:</span>
                                            <span>${group.deliveryFee > 0 ? Utils.formatCurrency(group.deliveryFee) : 'FREE'}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: bold; color: var(--primary); margin-top: 8px;">
                                            <span>Total:</span>
                                            <span>${Utils.formatCurrency(group.groupTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    
                    <div style="background: var(--bg-input); padding: 16px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.1rem; margin-bottom: 8px;">💰 Grand Total</div>
                        <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">
                            ${Utils.formatCurrency(req.grandTotal)}
                        </div>
                    </div>
                </div>
            `,
            saveText: '✅ Mark as Purchased',
            width: '700px',
            onSave: () => this.markPurchased(requestId)
        });
    },
    
    async markPurchased(requestId) {
        const req = this.data.find(r => r.id === requestId);
        if (!req) return;
        
        try {
            // Update request status
            await DB.update('purchaseRequests', requestId, {
                status: 'purchased',
                purchasedBy: Auth.currentUser?.uid,
                purchasedByName: Auth.userProfile?.displayName || 'Unknown',
                purchasedAt: new Date().toISOString()
            });
            
            // Update ingredient prices with last purchase date
            for (const item of req.items) {
                if (item.selectedSupplierId) {
                    await IngredientPrices.recordPurchase(
                        item.ingredientId,
                        item.selectedSupplierId,
                        item.unitPrice,
                        item.packageSize
                    );
                }
            }
            
            Toast.success('Marked as purchased! Prices updated.');
            Modal.close();
            await IngredientPrices.load();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error marking purchased:', error);
            Toast.error('Failed to update');
        }
    },
    
    async cancelRequest(requestId) {
        if (!confirm('Cancel this purchase request?')) return;
        
        try {
            await DB.update('purchaseRequests', requestId, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString()
            });
            Toast.success('Request cancelled');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error cancelling:', error);
            Toast.error('Failed to cancel');
        }
    },

    // ========== EDIT FUNCTIONALITY ==========
    
    async edit(requestId) {
        const req = this.data.find(r => r.id === requestId);
        if (!req) return;
        
        // Only pending requests can be edited
        if (req.status !== 'pending') {
            Toast.error('Only pending requests can be edited');
            return;
        }
        
        this.currentRequest = JSON.parse(JSON.stringify(req)); // Deep copy
        
        Modal.open({
            title: `✏️ Edit: ${req.requestNumber}`,
            content: this.getEditContent(req),
            saveText: 'Save Changes',
            width: '700px',
            onSave: () => this.saveEdit(requestId)
        });
    },
    
    getEditContent(req) {
        // Build ingredient selection with pre-selected items
        const selectedIngredientIds = req.items.map(i => i.ingredientId);
        
        return `
            <form id="editPurchaseRequestForm">
                <p style="color: var(--text-secondary); margin-bottom: 16px;">
                    Modify items and quantities. Save to update the request.
                </p>
                
                <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--bg-input); border-radius: 8px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: var(--bg-input); position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 12px; text-align: left; width: 40px;">
                                    <input type="checkbox" id="editSelectAll" onclick="PurchaseRequests.toggleEditSelectAll()">
                                </th>
                                <th style="padding: 12px; text-align: left;">Ingredient</th>
                                <th style="padding: 12px; text-align: right; width: 120px;">Qty Needed</th>
                                <th style="padding: 12px; text-align: center; width: 80px;">Unit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Ingredients.data.map(ing => {
                                const existingItem = req.items.find(i => i.ingredientId === ing.id);
                                const isSelected = !!existingItem;
                                const qtyKg = existingItem ? (existingItem.qtyNeeded / 1000) : 0;
                                
                                return `
                                    <tr style="border-bottom: 1px solid var(--bg-input);">
                                        <td style="padding: 12px;">
                                            <input type="checkbox" name="edit_ingredient_${ing.id}" 
                                                   data-ingredient-id="${ing.id}" ${isSelected ? 'checked' : ''}>
                                        </td>
                                        <td style="padding: 12px;">
                                            <strong>${ing.name}</strong>
                                            <br><small style="color: var(--text-secondary);">${Ingredients.formatCategory(ing.category)}</small>
                                        </td>
                                        <td style="padding: 12px; text-align: right;">
                                            <input type="number" name="edit_qty_${ing.id}" class="form-input" 
                                                   style="width: 100px; text-align: right;" min="0" step="0.1"
                                                   value="${qtyKg || ''}" placeholder="0">
                                        </td>
                                        <td style="padding: 12px; text-align: center;">
                                            <select name="edit_unit_${ing.id}" class="form-select" style="width: 80px;">
                                                <option value="g">g</option>
                                                <option value="kg" selected>kg</option>
                                            </select>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="form-group" style="margin-top: 16px;">
                    <label>Notes (optional)</label>
                    <textarea name="editNotes" class="form-textarea" 
                              placeholder="e.g., Need by Friday, running low for weekend production">${req.notes || ''}</textarea>
                </div>
            </form>
        `;
    },
    
    toggleEditSelectAll() {
        const selectAll = document.getElementById('editSelectAll');
        const checkboxes = document.querySelectorAll('[name^="edit_ingredient_"]');
        checkboxes.forEach(cb => cb.checked = selectAll.checked);
    },
    
    async saveEdit(requestId) {
        // Collect selected items
        const items = [];
        
        Ingredients.data.forEach(ing => {
            const checkbox = document.querySelector(`[name="edit_ingredient_${ing.id}"]`);
            const qtyInput = document.querySelector(`[name="edit_qty_${ing.id}"]`);
            const unitSelect = document.querySelector(`[name="edit_unit_${ing.id}"]`);
            
            if (checkbox?.checked && qtyInput?.value > 0) {
                let qtyGrams = parseFloat(qtyInput.value);
                if (unitSelect?.value === 'kg') qtyGrams *= 1000;
                
                // Find best supplier (cheapest in service area)
                const bestPrice = IngredientPrices.getCheapest(ing.id, true);
                const supplier = bestPrice ? Suppliers.getById(bestPrice.supplierId) : null;
                
                // Calculate packages needed
                const packageSize = bestPrice?.packageSize || 1000;
                const packagesNeeded = Math.ceil(qtyGrams / packageSize);
                const unitPrice = bestPrice?.purchasePrice || 0;
                const totalPrice = packagesNeeded * unitPrice;
                
                items.push({
                    ingredientId: ing.id,
                    ingredientName: ing.name,
                    qtyNeeded: qtyGrams,
                    packageSize,
                    packagesNeeded,
                    suggestedSupplierId: bestPrice?.supplierId || null,
                    selectedSupplierId: bestPrice?.supplierId || null,
                    supplierName: supplier?.companyName || 'No supplier',
                    unitPrice,
                    totalPrice,
                    costPerGram: bestPrice?.costPerGram || 0
                });
            }
        });
        
        if (items.length === 0) {
            Toast.error('Please select at least one ingredient with quantity');
            return;
        }
        
        // Calculate supplier groups and totals
        const supplierGroups = this.groupBySupplier(items);
        const grandTotal = supplierGroups.reduce((sum, g) => sum + g.groupTotal, 0);
        
        const notes = document.querySelector('[name="editNotes"]')?.value || '';
        
        try {
            await DB.update('purchaseRequests', requestId, {
                items,
                supplierGroups,
                grandTotal,
                notes,
                lastEditedBy: Auth.currentUser?.uid,
                lastEditedByName: Auth.userProfile?.displayName || 'Unknown',
                lastEditedAt: new Date().toISOString()
            });
            
            Toast.success('Purchase request updated!');
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error updating request:', error);
            Toast.error('Failed to update request');
        }
    },

    // ========== DELETE FUNCTIONALITY ==========
    
    confirmDelete(requestId) {
        const req = this.data.find(r => r.id === requestId);
        if (!req) return;
        
        const status = this.statuses[req.status];
        let warningMessage = '';
        let confirmText = 'Delete';
        
        // Different warnings based on status
        switch (req.status) {
            case 'purchased':
                warningMessage = `
                    <div style="background: #FDEDEC; padding: 12px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--danger);">
                        <strong>⚠️ Warning:</strong> This request has been <strong>purchased</strong>. 
                        Deleting it will remove the record but ingredient prices have already been updated. 
                        Consider keeping it for audit purposes.
                    </div>
                `;
                confirmText = 'Delete Permanently';
                break;
            case 'approved':
                warningMessage = `
                    <div style="background: #FEF9E7; padding: 12px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--warning);">
                        <strong>⚠️ Note:</strong> This request has been <strong>approved</strong> and may be in process. 
                        Make sure no one is working on this purchase.
                    </div>
                `;
                break;
            case 'pending':
                warningMessage = `
                    <div style="background: #EBF5FB; padding: 12px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--info);">
                        <strong>ℹ️ Info:</strong> This request is still <strong>pending review</strong>. 
                        You can safely delete it.
                    </div>
                `;
                break;
            default:
                warningMessage = '';
        }
        
        Modal.open({
            title: `🗑️ Delete Request: ${req.requestNumber}`,
            content: `
                <div style="padding: 8px 0;">
                    ${warningMessage}
                    
                    <div style="background: var(--bg-input); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="recipe-stat">
                                <span>Request #:</span>
                                <strong>${req.requestNumber}</strong>
                            </div>
                            <div class="recipe-stat">
                                <span>Status:</span>
                                <span class="badge" style="background: ${status?.color}; color: white;">
                                    ${status?.label || req.status}
                                </span>
                            </div>
                            <div class="recipe-stat">
                                <span>Items:</span>
                                <span>${req.items?.length || 0} ingredients</span>
                            </div>
                            <div class="recipe-stat">
                                <span>Total:</span>
                                <strong style="color: var(--primary);">${Utils.formatCurrency(req.grandTotal || 0)}</strong>
                            </div>
                            <div class="recipe-stat">
                                <span>Created:</span>
                                <span>${Utils.formatDateTime(req.createdAt)}</span>
                            </div>
                            <div class="recipe-stat">
                                <span>By:</span>
                                <span>${req.requestedByName || '-'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <p style="color: var(--danger); font-weight: 500; text-align: center;">
                        Are you sure you want to delete this purchase request?<br>
                        <small style="color: var(--text-secondary);">This action cannot be undone.</small>
                    </p>
                </div>
            `,
            saveText: confirmText,
            saveClass: 'btn-danger',
            width: '500px',
            onSave: () => this.deleteRequest(requestId)
        });
    },
    
    async deleteRequest(requestId) {
        const req = this.data.find(r => r.id === requestId);
        if (!req) return;
        
        try {
            // Delete from Firebase
            await DB.delete('purchaseRequests', requestId);
            
            Toast.success(`Request ${req.requestNumber} deleted successfully`);
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting request:', error);
            Toast.error('Failed to delete request');
        }
    }
};
