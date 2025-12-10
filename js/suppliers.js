/**
 * BreadHub ProofMaster - Suppliers Management
 * With location-based delivery and service area support
 */

const Suppliers = {
    data: [],
    
    // Service areas (for filtering/sorting)
    serviceAreas: [
        'Taytay',
        'Antipolo', 
        'Binangonan',
        'Cainta',
        'Angono',
        'Pasig',
        'Marikina',
        'Other'
    ],
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('suppliers');
            this.data.sort((a, b) => a.companyName.localeCompare(b.companyName));
        } catch (error) {
            console.error('Error loading suppliers:', error);
            Toast.error('Failed to load suppliers');
        }
    },
    
    render() {
        const grid = document.getElementById('suppliersGrid');
        if (!grid) return;
        
        if (this.data.length === 0) {
            grid.innerHTML = `
                <p class="empty-state">
                    No suppliers yet. Click "Add Supplier" to get started.
                </p>
            `;
            return;
        }
        
        grid.innerHTML = this.data.map(supplier => {
            const inServiceArea = this.isInServiceArea(supplier.location);
            return `
            <div class="recipe-card" data-id="${supplier.id}">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, ${inServiceArea ? '#3498DB' : '#95A5A6'} 0%, ${inServiceArea ? '#2980B9' : '#7F8C8D'} 100%);">
                    <h3>${supplier.companyName}</h3>
                    <span class="version">${supplier.location || 'No location'}</span>
                </div>
                <div class="recipe-card-body">
                    ${supplier.contactName ? `
                        <div class="recipe-stat">
                            <span>👤 Contact:</span>
                            <span>${supplier.contactName}</span>
                        </div>
                    ` : ''}
                    ${supplier.mobile ? `
                        <div class="recipe-stat">
                            <span>📱 Mobile:</span>
                            <span><a href="tel:${supplier.mobile}">${supplier.mobile}</a></span>
                        </div>
                    ` : ''}
                    <div class="recipe-stat">
                        <span>📍 Location:</span>
                        <span>${supplier.location || '-'} ${inServiceArea ? '✓' : '(Outside area)'}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>🚚 Delivery Fee:</span>
                        <span>${supplier.deliveryFee > 0 ? Utils.formatCurrency(supplier.deliveryFee) : 'FREE'}</span>
                    </div>
                    ${supplier.freeDeliveryMin > 0 ? `
                        <div class="recipe-stat">
                            <span>🎁 Free Delivery:</span>
                            <span>Orders ${Utils.formatCurrency(supplier.freeDeliveryMin)}+</span>
                        </div>
                    ` : ''}
                    <div class="recipe-stat">
                        <span>📦 Products:</span>
                        <span>${this.getIngredientPriceCount(supplier.id)} ingredients</span>
                    </div>
                </div>
                <div class="recipe-card-actions">
                    <button class="btn btn-secondary" onclick="Suppliers.view('${supplier.id}')">View</button>
                    <button class="btn btn-secondary" onclick="Suppliers.edit('${supplier.id}')">Edit</button>
                    <button class="btn btn-danger" onclick="Suppliers.delete('${supplier.id}')">Delete</button>
                </div>
            </div>
        `}).join('');
    },
    
    isInServiceArea(location) {
        if (!location) return false;
        const loc = location.toLowerCase();
        return this.serviceAreas.some(area => 
            area.toLowerCase() !== 'other' && loc.includes(area.toLowerCase())
        );
    },
    
    getIngredientCount(supplierId) {
        return Ingredients.data.filter(i => i.supplierId === supplierId).length;
    },
    
    getIngredientPriceCount(supplierId) {
        // Count from IngredientPrices if available, fallback to Ingredients
        if (typeof IngredientPrices !== 'undefined' && IngredientPrices.data) {
            return IngredientPrices.data.filter(p => p.supplierId === supplierId).length;
        }
        return this.getIngredientCount(supplierId);
    },
    
    showAddModal() {
        Modal.open({
            title: 'Add Supplier',
            content: this.getFormHTML(),
            saveText: 'Add Supplier',
            onSave: () => this.save()
        });
    },
    
    async edit(id) {
        const supplier = this.data.find(s => s.id === id);
        if (!supplier) return;
        
        Modal.open({
            title: 'Edit Supplier',
            content: this.getFormHTML(supplier),
            saveText: 'Update',
            onSave: () => this.save(id)
        });
    },

    async view(id) {
        const supplier = this.data.find(s => s.id === id);
        if (!supplier) return;
        
        // Get ingredients/prices from this supplier
        let ingredients = [];
        if (typeof IngredientPrices !== 'undefined' && IngredientPrices.data) {
            ingredients = IngredientPrices.getBySupplier(id);
        } else {
            ingredients = Ingredients.data.filter(i => i.supplierId === id);
        }
        
        const inServiceArea = this.isInServiceArea(supplier.location);
        
        Modal.open({
            title: supplier.companyName,
            content: `
                <div style="padding: 16px 0;">
                    ${!inServiceArea ? `
                        <div style="background: #FEF9E7; padding: 12px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--warning);">
                            ⚠️ This supplier is outside your service area
                        </div>
                    ` : ''}
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${supplier.contactName ? `
                            <div class="recipe-stat">
                                <span>👤 Contact:</span>
                                <span>${supplier.contactName}</span>
                            </div>
                        ` : ''}
                        ${supplier.mobile ? `
                            <div class="recipe-stat">
                                <span>📱 Mobile:</span>
                                <span><a href="tel:${supplier.mobile}">${supplier.mobile}</a></span>
                            </div>
                        ` : ''}
                        ${supplier.email ? `
                            <div class="recipe-stat">
                                <span>📧 Email:</span>
                                <span><a href="mailto:${supplier.email}">${supplier.email}</a></span>
                            </div>
                        ` : ''}
                        ${supplier.facebook ? `
                            <div class="recipe-stat">
                                <span>📘 Facebook:</span>
                                <span><a href="${supplier.facebook}" target="_blank">View Page</a></span>
                            </div>
                        ` : ''}
                        ${supplier.website ? `
                            <div class="recipe-stat">
                                <span>🌐 Website:</span>
                                <span><a href="${supplier.website}" target="_blank">Visit</a></span>
                            </div>
                        ` : ''}
                        <div class="recipe-stat">
                            <span>📍 Location:</span>
                            <span>${supplier.location || '-'}</span>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-input); padding: 16px; border-radius: 10px; margin: 16px 0;">
                        <h4 style="margin: 0 0 12px; color: var(--primary);">🚚 Delivery Information</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="recipe-stat">
                                <span>Delivery Fee:</span>
                                <span><strong>${supplier.deliveryFee > 0 ? Utils.formatCurrency(supplier.deliveryFee) : 'FREE'}</strong></span>
                            </div>
                            <div class="recipe-stat">
                                <span>Free Delivery Min:</span>
                                <span>${supplier.freeDeliveryMin > 0 ? Utils.formatCurrency(supplier.freeDeliveryMin) : '-'}</span>
                            </div>
                            ${supplier.deliveryNotes ? `
                                <div class="recipe-stat" style="grid-column: span 2;">
                                    <span>Notes:</span>
                                    <span>${supplier.deliveryNotes}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${supplier.address ? `
                        <div class="recipe-stat">
                            <span>📍 Full Address:</span>
                            <span>${supplier.address}</span>
                        </div>
                    ` : ''}
                    
                    ${supplier.notes ? `
                        <div style="margin-top: 16px; padding: 12px; background: var(--bg-input); border-radius: 8px;">
                            <strong>Notes:</strong><br>
                            ${supplier.notes}
                        </div>
                    ` : ''}
                    
                    <h4 style="margin: 20px 0 12px;">📦 Ingredients from this Supplier (${ingredients.length}):</h4>
                    ${ingredients.length > 0 ? `
                        <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--bg-input); border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead style="background: var(--bg-input); position: sticky; top: 0;">
                                    <tr>
                                        <th style="padding: 10px; text-align: left;">Ingredient</th>
                                        <th style="padding: 10px; text-align: right;">Price</th>
                                        <th style="padding: 10px; text-align: right;">Size</th>
                                        <th style="padding: 10px; text-align: right;">Cost/g</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ingredients.map(ing => `
                                        <tr style="border-bottom: 1px solid var(--bg-input);">
                                            <td style="padding: 10px;">${ing.ingredientName || ing.name}</td>
                                            <td style="padding: 10px; text-align: right;">${Utils.formatCurrency(ing.purchasePrice || 0)}</td>
                                            <td style="padding: 10px; text-align: right;">${ing.packageSize || 0}g</td>
                                            <td style="padding: 10px; text-align: right; font-weight: bold; color: var(--primary);">
                                                ${Utils.formatCurrency(ing.costPerGram || 0)}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="empty-state">No ingredients yet. Add prices for this supplier in Ingredients.</p>'}
                </div>
            `,
            showFooter: false,
            width: '700px'
        });
    },

    getFormHTML(supplier = {}) {
        return `
            <form id="supplierForm">
                <div class="form-group">
                    <label>Company Name *</label>
                    <input type="text" name="companyName" class="form-input" 
                           value="${supplier.companyName || ''}" required
                           placeholder="e.g., Champion Flour Mills">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Contact Person</label>
                        <input type="text" name="contactName" class="form-input" 
                               value="${supplier.contactName || ''}"
                               placeholder="e.g., Juan Dela Cruz">
                    </div>
                    <div class="form-group">
                        <label>Mobile Number</label>
                        <input type="tel" name="mobile" class="form-input" 
                               value="${supplier.mobile || ''}"
                               placeholder="e.g., 09171234567">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" class="form-input" 
                               value="${supplier.email || ''}"
                               placeholder="supplier@email.com">
                    </div>
                    <div class="form-group">
                        <label>Location/Area *</label>
                        <select name="location" class="form-select" required>
                            <option value="">Select area...</option>
                            ${this.serviceAreas.map(area => `
                                <option value="${area}" ${supplier.location === area ? 'selected' : ''}>${area}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Full Address</label>
                    <input type="text" name="address" class="form-input" 
                           value="${supplier.address || ''}"
                           placeholder="e.g., 123 Main St, Brgy. Dolores, Taytay, Rizal">
                </div>
                
                <div style="background: var(--bg-input); padding: 16px; border-radius: 10px; margin: 16px 0;">
                    <h4 style="margin: 0 0 12px; color: var(--primary);">🚚 Delivery Settings</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Delivery Fee (₱)</label>
                            <input type="number" name="deliveryFee" class="form-input" step="1" min="0"
                                   value="${supplier.deliveryFee || 0}"
                                   placeholder="0 for free delivery">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Free Delivery Minimum (₱)</label>
                            <input type="number" name="freeDeliveryMin" class="form-input" step="1" min="0"
                                   value="${supplier.freeDeliveryMin || 0}"
                                   placeholder="Min order for free delivery">
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 12px; margin-bottom: 0;">
                        <label>Delivery Notes</label>
                        <input type="text" name="deliveryNotes" class="form-input" 
                               value="${supplier.deliveryNotes || ''}"
                               placeholder="e.g., Mon/Thu only, Same day if before 10am">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Facebook Page</label>
                        <input type="url" name="facebook" class="form-input" 
                               value="${supplier.facebook || ''}"
                               placeholder="https://facebook.com/...">
                    </div>
                    <div class="form-group">
                        <label>Website</label>
                        <input type="url" name="website" class="form-input" 
                               value="${supplier.website || ''}"
                               placeholder="https://...">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea" 
                              placeholder="Payment terms, special instructions, etc.">${supplier.notes || ''}</textarea>
                </div>
            </form>
        `;
    },
    
    async save(id = null) {
        const data = Modal.getFormData();
        
        if (!data.companyName) {
            Toast.error('Please enter company name');
            return;
        }
        
        if (!data.location) {
            Toast.error('Please select a location');
            return;
        }
        
        // Convert numeric fields
        data.deliveryFee = parseFloat(data.deliveryFee) || 0;
        data.freeDeliveryMin = parseFloat(data.freeDeliveryMin) || 0;
        
        try {
            if (id) {
                await DB.update('suppliers', id, data);
                Toast.success('Supplier updated');
            } else {
                await DB.add('suppliers', data);
                Toast.success('Supplier added');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving supplier:', error);
            Toast.error('Failed to save supplier');
        }
    },
    
    async delete(id) {
        const priceCount = this.getIngredientPriceCount(id);
        if (priceCount > 0) {
            Toast.warning(`Cannot delete: ${priceCount} ingredient prices linked to this supplier`);
            return;
        }
        
        if (!confirm('Delete this supplier?')) return;
        
        try {
            await DB.delete('suppliers', id);
            Toast.success('Supplier deleted');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            Toast.error('Failed to delete supplier');
        }
    },
    
    getById(id) {
        return this.data.find(s => s.id === id);
    },
    
    // Get suppliers in service area, sorted by delivery fee
    getInServiceArea() {
        return this.data
            .filter(s => this.isInServiceArea(s.location))
            .sort((a, b) => (a.deliveryFee || 0) - (b.deliveryFee || 0));
    },
    
    // Get select options (optionally filter by service area)
    getSelectOptions(selectedId = null, serviceAreaOnly = false) {
        let suppliers = serviceAreaOnly ? this.getInServiceArea() : this.data;
        return suppliers.map(s => 
            `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>
                ${s.companyName} (${s.location || 'No location'})
            </option>`
        ).join('');
    },
    
    // Calculate delivery fee based on order amount
    calculateDeliveryFee(supplierId, orderAmount) {
        const supplier = this.getById(supplierId);
        if (!supplier) return 0;
        
        // Free delivery if order meets minimum
        if (supplier.freeDeliveryMin > 0 && orderAmount >= supplier.freeDeliveryMin) {
            return 0;
        }
        
        return supplier.deliveryFee || 0;
    }
};
