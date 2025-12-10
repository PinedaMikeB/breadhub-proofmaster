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
        approved: { label: 'Approved', color: '#3498DB', icon: '✓' },
        purchased: { label: 'Purchased', color: '#27AE60', icon: '✅' },
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
            
            <!-- Approved (Ready to Purchase) -->
            ${approvedRequests.length > 0 ? `
                <h3 style="margin-bottom: 12px;">✓ Ready to Purchase (${approvedRequests.length})</h3>
                <div class="cards-grid" style="margin-bottom: 24px;">
                    ${approvedRequests.map(req => this.renderRequestCard(req)).join('')}
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
                            <th>Requested By</th>
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
                                <td>${req.requestedByName || '-'}</td>
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
                                    ` : ''}
                                    ${req.status === 'approved' ? `
                                        <button class="btn btn-primary btn-sm" onclick="PurchaseRequests.showPurchaseOrder('${req.id}')">Purchase</button>
                                    ` : ''}
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
                    ` : req.status === 'approved' ? `
                        <button class="btn btn-primary" onclick="PurchaseRequests.showPurchaseOrder('${req.id}')">View PO</button>
                    ` : `
                        <button class="btn btn-secondary" onclick="PurchaseRequests.view('${req.id}')">View</button>
                    `}
                </div>
            </div>
        `;
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
                                ${Ingredients.data.map(ing => `
                                    <tr style="border-bottom: 1px solid var(--bg-input);">
                                        <td style="padding: 12px;">
                                            <input type="checkbox" name="ingredient_${ing.id}" data-ingredient-id="${ing.id}">
                                        </td>
                                        <td style="padding: 12px;">
                                            <strong>${ing.name}</strong>
                                            <br><small style="color: var(--text-secondary);">${Ingredients.formatCategory(ing.category)}</small>
                                        </td>
                                        <td style="padding: 12px; text-align: right;">
                                            <input type="number" name="qty_${ing.id}" class="form-input" 
                                                   style="width: 100px; text-align: right;" min="0" step="100"
                                                   placeholder="0">
                                        </td>
                                        <td style="padding: 12px; text-align: center;">
                                            <select name="unit_${ing.id}" class="form-select" style="width: 80px;">
                                                <option value="g">g</option>
                                                <option value="kg" selected>kg</option>
                                            </select>
                                        </td>
                                    </tr>
                                `).join('')}
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
        
        Modal.open({
            title: `📋 Review: ${req.requestNumber}`,
            content: this.getReviewContent(req),
            saveText: '✓ Approve & Generate PO',
            width: '900px',
            onSave: () => this.approveRequest(requestId)
        });
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
            </div>
        `;
    },
    
    renderItemReview(item, idx) {
        // Get comparison table for this ingredient
        const comparison = IngredientPrices.getComparisonTable(item.ingredientId, item.qtyNeeded);
        
        return `
            <div style="border: 1px solid var(--bg-input); border-radius: 10px; margin-bottom: 16px; overflow: hidden;">
                <div style="background: var(--bg-input); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${item.ingredientName}</strong>
                        <span style="color: var(--text-secondary); margin-left: 12px;">
                            Need: ${item.qtyNeeded >= 1000 ? (item.qtyNeeded/1000).toFixed(1) + 'kg' : item.qtyNeeded + 'g'}
                            (${item.packagesNeeded} package${item.packagesNeeded > 1 ? 's' : ''})
                        </span>
                    </div>
                    <div>
                        <strong style="color: var(--primary);">${Utils.formatCurrency(item.totalPrice)}</strong>
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
                                    <th style="padding: 8px; text-align: right;">Delivery</th>
                                    <th style="padding: 8px; text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${comparison.map((row, rowIdx) => `
                                    <tr style="border-bottom: 1px solid var(--bg-input); ${!row.inServiceArea ? 'opacity: 0.5;' : ''}">
                                        <td style="padding: 8px;">
                                            <input type="radio" name="supplier_${idx}" value="${row.supplierId}"
                                                   ${item.selectedSupplierId === row.supplierId ? 'checked' : ''}
                                                   onchange="PurchaseRequests.changeSupplier(${idx}, '${row.supplierId}')"
                                                   ${!row.inServiceArea ? 'disabled' : ''}>
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
                                        <td style="padding: 8px; text-align: right;">${Utils.formatCurrency(row.itemTotal)}</td>
                                        <td style="padding: 8px; text-align: right;">
                                            ${row.deliveryFee > 0 ? '+' + Utils.formatCurrency(row.deliveryFee) : 'FREE'}
                                        </td>
                                        <td style="padding: 8px; text-align: right; font-weight: bold;">
                                            ${Utils.formatCurrency(row.grandTotal)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
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
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${group.supplierName}</strong>
                        <span style="color: var(--text-secondary); margin-left: 8px;">(${group.location})</span>
                    </div>
                    <div style="text-align: right;">
                        <div>Items: ${Utils.formatCurrency(group.subtotal)}</div>
                        <div style="color: ${group.deliveryFee > 0 ? 'var(--warning)' : 'var(--success)'};">
                            Delivery: ${group.deliveryFee > 0 ? Utils.formatCurrency(group.deliveryFee) : 'FREE'}
                        </div>
                        <div style="font-weight: bold; color: var(--primary);">${Utils.formatCurrency(group.groupTotal)}</div>
                    </div>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                    ${group.items.map(i => i.ingredientName).join(', ')}
                </div>
            </div>
        `).join('');
    },
    
    changeSupplier(itemIdx, newSupplierId) {
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

    async approveRequest(requestId) {
        if (!this.currentRequest) return;
        
        try {
            await DB.update('purchaseRequests', requestId, {
                status: 'approved',
                items: this.currentRequest.items,
                supplierGroups: this.currentRequest.supplierGroups,
                grandTotal: this.currentRequest.grandTotal,
                approvedBy: Auth.currentUser?.uid,
                approvedByName: Auth.userProfile?.displayName || 'Unknown',
                approvedAt: new Date().toISOString()
            });
            
            Toast.success('Request approved! Purchase order ready.');
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
    }
};
