/**
 * BreadHub ProofMaster - Ingredients Management
 * Supports multiple suppliers per ingredient
 * All measurements standardized to GRAMS
 */

const Ingredients = {
    data: [],
    categories: [
        'flour', 'dairy', 'fat', 'leavening', 'sugar', 
        'egg', 'flavoring', 'filling', 'topping', 'other'
    ],
    
    costingMethods: {
        lastPurchase: 'Last Purchase Price',
        cheapest: 'Cheapest Supplier',
        preferred: 'Preferred Supplier'
    },
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('ingredients');
            this.data.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error loading ingredients:', error);
            Toast.error('Failed to load ingredients');
        }
    },
    
    render() {
        const tbody = document.getElementById('ingredientsTableBody');
        if (!tbody) return;
        
        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        No ingredients yet. Click "Add Ingredient" to get started.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.data.map(ing => {
            // Get costing price
            const costPrice = IngredientPrices.getPriceForCosting(ing.id);
            const supplierCount = IngredientPrices.getByIngredient(ing.id).length;
            const supplier = costPrice ? Suppliers.getById(costPrice.supplierId) : null;
            
            return `
                <tr data-id="${ing.id}">
                    <td><strong>${ing.name}</strong></td>
                    <td>${this.formatCategory(ing.category)}</td>
                    <td>
                        <span class="badge">${supplierCount} supplier${supplierCount !== 1 ? 's' : ''}</span>
                    </td>
                    <td>
                        <strong style="color: var(--primary);">
                            ${costPrice ? Utils.formatCurrency(costPrice.costPerGram) + '/g' : '-'}
                        </strong>
                        <br><small style="color: var(--text-secondary);">${this.costingMethods[ing.costingMethod || 'lastPurchase']}</small>
                    </td>
                    <td>${supplier?.companyName || '-'}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="Ingredients.viewPrices('${ing.id}')">
                            Prices
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="Ingredients.edit('${ing.id}')">
                            Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="Ingredients.delete('${ing.id}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    formatCategory(cat) {
        return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '-';
    },
    
    showAddModal() {
        Modal.open({
            title: 'Add Ingredient',
            content: this.getFormHTML(),
            saveText: 'Add Ingredient',
            onSave: () => this.save()
        });
    },
    
    async edit(id) {
        const ing = this.data.find(i => i.id === id);
        if (!ing) return;
        
        Modal.open({
            title: 'Edit Ingredient',
            content: this.getFormHTML(ing),
            saveText: 'Update',
            onSave: () => this.save(id)
        });
    },
    
    getFormHTML(ing = {}) {
        return `
            <form id="ingredientForm">
                <div class="form-group">
                    <label>Ingredient Name *</label>
                    <input type="text" name="name" class="form-input" 
                           value="${ing.name || ''}" required
                           placeholder="e.g., Bread Flour">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Category *</label>
                        <select name="category" class="form-select" required>
                            <option value="">Select category...</option>
                            ${this.categories.map(cat => `
                                <option value="${cat}" ${ing.category === cat ? 'selected' : ''}>
                                    ${this.formatCategory(cat)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Costing Method</label>
                        <select name="costingMethod" class="form-select">
                            ${Object.entries(this.costingMethods).map(([key, label]) => `
                                <option value="${key}" ${(ing.costingMethod || 'lastPurchase') === key ? 'selected' : ''}>
                                    ${label}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea" 
                              placeholder="Quality notes, brand preferences, etc.">${ing.notes || ''}</textarea>
                </div>
                
                <div style="background: #E8F5E9; padding: 12px; border-radius: 8px; border-left: 4px solid var(--success);">
                    <strong>💡 Tip:</strong> After saving, click "Prices" to add supplier prices for this ingredient.
                </div>
            </form>
        `;
    },
    
    async save(id = null) {
        const data = Modal.getFormData();
        
        if (!data.name || !data.category) {
            Toast.error('Please fill ingredient name and category');
            return;
        }
        
        try {
            if (id) {
                await DB.update('ingredients', id, data);
                Toast.success('Ingredient updated');
            } else {
                await DB.add('ingredients', data);
                Toast.success('Ingredient added. Now add supplier prices!');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving ingredient:', error);
            Toast.error('Failed to save ingredient');
        }
    },

    // View/Manage prices for an ingredient
    async viewPrices(ingredientId) {
        const ing = this.data.find(i => i.id === ingredientId);
        if (!ing) return;
        
        const prices = IngredientPrices.getByIngredient(ingredientId);
        
        Modal.open({
            title: `${ing.name} - Supplier Prices`,
            content: `
                <div style="padding: 8px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <span style="color: var(--text-secondary);">
                            ${prices.length} supplier${prices.length !== 1 ? 's' : ''} • Costing: ${this.costingMethods[ing.costingMethod || 'lastPurchase']}
                        </span>
                        <button class="btn btn-primary btn-sm" onclick="Ingredients.showAddPriceModal('${ingredientId}')">
                            + Add Supplier Price
                        </button>
                    </div>
                    
                    ${prices.length > 0 ? `
                        <div style="border: 1px solid var(--bg-input); border-radius: 8px; overflow: hidden;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead style="background: var(--bg-input);">
                                    <tr>
                                        <th style="padding: 12px; text-align: left;">Supplier</th>
                                        <th style="padding: 12px; text-align: left;">Location</th>
                                        <th style="padding: 12px; text-align: right;">Price</th>
                                        <th style="padding: 12px; text-align: right;">Size</th>
                                        <th style="padding: 12px; text-align: right;">Cost/g</th>
                                        <th style="padding: 12px; text-align: center;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="pricesTableBody">
                                    ${prices.map((price, idx) => {
                                        const supplier = Suppliers.getById(price.supplierId);
                                        const inServiceArea = supplier ? Suppliers.isInServiceArea(supplier.location) : false;
                                        const isCheapest = idx === 0;
                                        return `
                                            <tr style="border-bottom: 1px solid var(--bg-input); ${!inServiceArea ? 'opacity: 0.6;' : ''}">
                                                <td style="padding: 12px;">
                                                    ${isCheapest ? '⭐ ' : ''}${supplier?.companyName || 'Unknown'}
                                                    ${price.lastPurchaseDate ? '<br><small style="color: var(--text-secondary);">Last: ' + Utils.formatDate(price.lastPurchaseDate) + '</small>' : ''}
                                                </td>
                                                <td style="padding: 12px;">
                                                    ${supplier?.location || '-'}
                                                    ${!inServiceArea ? '<br><small style="color: var(--warning);">Outside area</small>' : ''}
                                                </td>
                                                <td style="padding: 12px; text-align: right;">${Utils.formatCurrency(price.purchasePrice)}</td>
                                                <td style="padding: 12px; text-align: right;">${price.packageSize}g</td>
                                                <td style="padding: 12px; text-align: right; font-weight: bold; color: var(--primary);">
                                                    ${Utils.formatCurrency(price.costPerGram)}
                                                </td>
                                                <td style="padding: 12px; text-align: center;">
                                                    <button class="btn btn-secondary btn-sm" onclick="Ingredients.editPrice('${price.id}')">Edit</button>
                                                    <button class="btn btn-danger btn-sm" onclick="Ingredients.deletePrice('${price.id}', '${ingredientId}')">×</button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="empty-state" style="padding: 40px; text-align: center;">
                            <p>No supplier prices yet.</p>
                            <p style="color: var(--text-secondary);">Add prices from different suppliers to compare costs.</p>
                        </div>
                    `}
                </div>
            `,
            showFooter: false,
            width: '800px'
        });
    },
    
    showAddPriceModal(ingredientId) {
        const ing = this.data.find(i => i.id === ingredientId);
        if (!ing) return;
        
        // Get suppliers not yet added for this ingredient
        const existingSupplierIds = IngredientPrices.getByIngredient(ingredientId).map(p => p.supplierId);
        const availableSuppliers = Suppliers.data.filter(s => !existingSupplierIds.includes(s.id));
        
        if (availableSuppliers.length === 0) {
            Toast.warning('All suppliers already have prices for this ingredient');
            return;
        }
        
        Modal.open({
            title: `Add Price: ${ing.name}`,
            content: `
                <form id="priceForm">
                    <input type="hidden" name="ingredientId" value="${ingredientId}">
                    
                    <div class="form-group">
                        <label>Supplier *</label>
                        <select name="supplierId" class="form-select" required>
                            <option value="">Select supplier...</option>
                            ${availableSuppliers.map(s => {
                                const inArea = Suppliers.isInServiceArea(s.location);
                                return `<option value="${s.id}" ${!inArea ? 'style="color: var(--text-secondary);"' : ''}>
                                    ${s.companyName} (${s.location || 'No location'}) ${!inArea ? '- Outside area' : ''}
                                </option>`;
                            }).join('')}
                        </select>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label>Purchase Price (₱) *</label>
                            <input type="number" name="purchasePrice" id="newPurchasePrice" class="form-input" 
                                   step="0.01" min="0" required placeholder="e.g., 45.00">
                        </div>
                        <div class="form-group">
                            <label>Package Size (grams) *</label>
                            <input type="number" name="packageSize" id="newPackageSize" class="form-input" 
                                   step="1" min="1" required placeholder="e.g., 1000">
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-input); padding: 16px; border-radius: 8px; text-align: center;">
                        <span style="color: var(--text-secondary);">Cost per gram:</span>
                        <span id="newCostPerGram" style="font-size: 1.5rem; font-weight: bold; color: var(--primary); margin-left: 8px;">₱0.0000</span>
                    </div>
                </form>
            `,
            saveText: 'Add Price',
            onSave: () => this.savePrice(ingredientId)
        });
        
        // Setup calculation
        setTimeout(() => {
            const priceInput = document.getElementById('newPurchasePrice');
            const sizeInput = document.getElementById('newPackageSize');
            const display = document.getElementById('newCostPerGram');
            
            const calc = () => {
                const price = parseFloat(priceInput.value) || 0;
                const size = parseFloat(sizeInput.value) || 0;
                const costPerGram = size > 0 ? price / size : 0;
                display.textContent = Utils.formatCurrency(costPerGram);
            };
            
            priceInput?.addEventListener('input', calc);
            sizeInput?.addEventListener('input', calc);
        }, 100);
    },

    async savePrice(ingredientId) {
        const data = Modal.getFormData();
        
        if (!data.supplierId || !data.purchasePrice || !data.packageSize) {
            Toast.error('Please fill all required fields');
            return;
        }
        
        data.purchasePrice = parseFloat(data.purchasePrice);
        data.packageSize = parseFloat(data.packageSize);
        data.ingredientId = ingredientId;
        
        const success = await IngredientPrices.savePrice(data);
        
        if (success) {
            Toast.success('Price added');
            Modal.close();
            this.render();
            // Reopen prices modal
            setTimeout(() => this.viewPrices(ingredientId), 300);
        } else {
            Toast.error('Failed to save price');
        }
    },
    
    async editPrice(priceId) {
        const price = IngredientPrices.data.find(p => p.id === priceId);
        if (!price) return;
        
        const supplier = Suppliers.getById(price.supplierId);
        const ing = this.data.find(i => i.id === price.ingredientId);
        
        Modal.open({
            title: `Edit Price: ${ing?.name || 'Unknown'}`,
            content: `
                <form id="priceForm">
                    <input type="hidden" name="ingredientId" value="${price.ingredientId}">
                    <input type="hidden" name="supplierId" value="${price.supplierId}">
                    
                    <div class="form-group">
                        <label>Supplier</label>
                        <input type="text" class="form-input" value="${supplier?.companyName || 'Unknown'}" disabled>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label>Purchase Price (₱) *</label>
                            <input type="number" name="purchasePrice" id="editPurchasePrice" class="form-input" 
                                   step="0.01" min="0" required value="${price.purchasePrice}">
                        </div>
                        <div class="form-group">
                            <label>Package Size (grams) *</label>
                            <input type="number" name="packageSize" id="editPackageSize" class="form-input" 
                                   step="1" min="1" required value="${price.packageSize}">
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-input); padding: 16px; border-radius: 8px; text-align: center;">
                        <span style="color: var(--text-secondary);">Cost per gram:</span>
                        <span id="editCostPerGram" style="font-size: 1.5rem; font-weight: bold; color: var(--primary); margin-left: 8px;">
                            ${Utils.formatCurrency(price.costPerGram)}
                        </span>
                    </div>
                </form>
            `,
            saveText: 'Update Price',
            onSave: () => this.updatePrice(priceId)
        });
        
        // Setup calculation
        setTimeout(() => {
            const priceInput = document.getElementById('editPurchasePrice');
            const sizeInput = document.getElementById('editPackageSize');
            const display = document.getElementById('editCostPerGram');
            
            const calc = () => {
                const priceVal = parseFloat(priceInput.value) || 0;
                const size = parseFloat(sizeInput.value) || 0;
                const costPerGram = size > 0 ? priceVal / size : 0;
                display.textContent = Utils.formatCurrency(costPerGram);
            };
            
            priceInput?.addEventListener('input', calc);
            sizeInput?.addEventListener('input', calc);
        }, 100);
    },
    
    async updatePrice(priceId) {
        const data = Modal.getFormData();
        const price = IngredientPrices.data.find(p => p.id === priceId);
        
        if (!data.purchasePrice || !data.packageSize) {
            Toast.error('Please fill all required fields');
            return;
        }
        
        data.purchasePrice = parseFloat(data.purchasePrice);
        data.packageSize = parseFloat(data.packageSize);
        
        const success = await IngredientPrices.savePrice(data);
        
        if (success) {
            Toast.success('Price updated');
            Modal.close();
            this.render();
            setTimeout(() => this.viewPrices(price.ingredientId), 300);
        } else {
            Toast.error('Failed to update price');
        }
    },
    
    async deletePrice(priceId, ingredientId) {
        if (!confirm('Delete this supplier price?')) return;
        
        const success = await IngredientPrices.deletePrice(priceId);
        
        if (success) {
            Toast.success('Price deleted');
            this.render();
            setTimeout(() => this.viewPrices(ingredientId), 300);
        } else {
            Toast.error('Failed to delete price');
        }
    },
    
    async delete(id) {
        // Check if ingredient has prices
        const priceCount = IngredientPrices.getByIngredient(id).length;
        if (priceCount > 0) {
            Toast.warning(`Please delete ${priceCount} supplier price(s) first`);
            return;
        }
        
        if (!confirm('Delete this ingredient?')) return;
        
        try {
            await DB.delete('ingredients', id);
            Toast.success('Ingredient deleted');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting ingredient:', error);
            Toast.error('Failed to delete ingredient');
        }
    },
    
    // Helper methods
    getById(id) {
        return this.data.find(i => i.id === id);
    },
    
    getCostPerGram(id) {
        const price = IngredientPrices.getPriceForCosting(id);
        return price?.costPerGram || 0;
    },
    
    getSelectOptions(selectedId = null) {
        return this.data.map(i => 
            `<option value="${i.id}" ${selectedId === i.id ? 'selected' : ''}>${i.name}</option>`
        ).join('');
    }
};
