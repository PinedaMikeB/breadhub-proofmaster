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
            
            // Format stock display
            const stock = ing.currentStock || 0;
            const stockDisplay = this.formatStock(stock);
            const stockColor = stock === 0 ? 'var(--danger)' : stock < 5000 ? 'var(--warning)' : 'var(--success)';
            
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
                    <td>
                        <strong style="color: ${stockColor};">${stockDisplay}</strong>
                        ${stock === 0 ? '<br><small style="color: var(--danger);">Out of stock</small>' : ''}
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
    
    // Format stock for display (convert grams to kg if >= 1000)
    formatStock(grams) {
        if (grams >= 1000) {
            return (grams / 1000).toFixed(2) + ' kg';
        }
        return grams.toFixed(0) + ' g';
    },
    
    formatCategory(cat) {
        return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '-';
    },
    
    // Get cost per gram for an ingredient (used in production calculations)
    // Does NOT filter by service area to include all supplier prices
    getCostPerGram(ingredientId) {
        // First try to get price based on costing method
        const costPrice = IngredientPrices.getPriceForCosting(ingredientId);
        if (costPrice && costPrice.costPerGram > 0) {
            return costPrice.costPerGram;
        }
        
        // Fallback: get cheapest from ANY supplier (not just service area)
        const cheapest = IngredientPrices.getCheapest(ingredientId, false);
        if (cheapest && cheapest.costPerGram > 0) {
            return cheapest.costPerGram;
        }
        
        return 0;
    },
    
    getById(id) {
        return this.data.find(i => i.id === id);
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
                    
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-primary);">🏪 Supplier *</label>
                        <select name="supplierId" id="newSupplierId" class="form-select" required style="width: 100%; padding: 10px; font-size: 1rem;">
                            <option value="">-- Select a supplier --</option>
                            ${availableSuppliers.map(s => {
                                const inArea = Suppliers.isInServiceArea(s.location);
                                return `<option value="${s.id}">
                                    ${s.companyName} (${s.location || 'No location'}) ${!inArea ? '⚠️ Outside area' : ''}
                                </option>`;
                            }).join('')}
                        </select>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500;">💰 Purchase Price (₱) *</label>
                            <input type="number" name="purchasePrice" id="newPurchasePrice" class="form-input" 
                                   step="0.01" min="0" required placeholder="e.g., 45.00"
                                   oninput="Ingredients.calculateCostPerGram()">
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500;">📦 Package Size (grams) *</label>
                            <input type="number" name="packageSize" id="newPackageSize" class="form-input" 
                                   step="1" min="1" required placeholder="e.g., 1000"
                                   oninput="Ingredients.calculateCostPerGram()">
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
    },
    
    // Calculate cost per gram (called via oninput)
    calculateCostPerGram() {
        const priceInput = document.getElementById('newPurchasePrice');
        const sizeInput = document.getElementById('newPackageSize');
        const display = document.getElementById('newCostPerGram');
        
        if (!priceInput || !sizeInput || !display) return;
        
        const price = parseFloat(priceInput.value) || 0;
        const size = parseFloat(sizeInput.value) || 0;
        const costPerGram = size > 0 ? price / size : 0;
        display.textContent = Utils.formatCurrency(costPerGram);
    },

    async savePrice(ingredientId) {
        const data = Modal.getFormData();
        
        // Better validation with specific error messages
        if (!data.supplierId) {
            Toast.error('Please select a supplier');
            return;
        }
        if (!data.purchasePrice || data.purchasePrice <= 0) {
            Toast.error('Please enter a valid purchase price');
            return;
        }
        if (!data.packageSize || data.packageSize <= 0) {
            Toast.error('Please enter a valid package size');
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
                    
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 500;">🏪 Supplier</label>
                        <input type="text" class="form-input" value="${supplier?.companyName || 'Unknown'}" disabled 
                               style="background: var(--bg-input); color: var(--text-secondary);">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500;">💰 Purchase Price (₱) *</label>
                            <input type="number" name="purchasePrice" id="editPurchasePrice" class="form-input" 
                                   step="0.01" min="0" required value="${price.purchasePrice}"
                                   oninput="Ingredients.calculateEditCostPerGram()">
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500;">📦 Package Size (grams) *</label>
                            <input type="number" name="packageSize" id="editPackageSize" class="form-input" 
                                   step="1" min="1" required value="${price.packageSize}"
                                   oninput="Ingredients.calculateEditCostPerGram()">
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
    },
    
    // Calculate cost per gram for edit modal
    calculateEditCostPerGram() {
        const priceInput = document.getElementById('editPurchasePrice');
        const sizeInput = document.getElementById('editPackageSize');
        const display = document.getElementById('editCostPerGram');
        
        if (!priceInput || !sizeInput || !display) return;
        
        const price = parseFloat(priceInput.value) || 0;
        const size = parseFloat(sizeInput.value) || 0;
        const costPerGram = size > 0 ? price / size : 0;
        display.textContent = Utils.formatCurrency(costPerGram);
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
    },

    // ========== BULK IMPORT ==========
    showImportModal() {
        Modal.open({
            title: '📥 Import Ingredients Data',
            content: `
                <div style="padding: 10px 0;">
                    <p style="margin-bottom: 15px;">This will import <strong>145 ingredients</strong> with <strong>158 price entries</strong> from <strong>7 suppliers</strong>.</p>
                    <div style="background: #FFF3CD; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                        <strong>⚠️ Note:</strong> Existing items will be skipped. Only new ingredients and prices will be added.
                    </div>
                    <div id="importLog" style="background: #1a1a2e; color: #0f0; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 0.8rem; max-height: 300px; overflow-y: auto; white-space: pre-wrap;">Ready to import...</div>
                    <div id="importProgress" style="display: none; margin-top: 15px;">
                        <div style="height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden;">
                            <div id="importProgressBar" style="height: 100%; background: linear-gradient(90deg, #D4894A, #e9a066); width: 0%; transition: width 0.3s;"></div>
                        </div>
                    </div>
                </div>
            `,
            saveText: '🚀 Start Import',
            onSave: () => this.runBulkImport()
        });
    },

    async runBulkImport() {
        const logEl = document.getElementById('importLog');
        const progressEl = document.getElementById('importProgress');
        const progressBar = document.getElementById('importProgressBar');
        
        const log = (msg, type = 'info') => {
            const color = type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#74c0fc';
            logEl.innerHTML += `<span style="color:${color}">${msg}</span>\n`;
            logEl.scrollTop = logEl.scrollHeight;
        };
        
        progressEl.style.display = 'block';
        logEl.innerHTML = '';
        
        // Import data
        const importData = this.getImportData();
        const total = importData.suppliers.length + importData.ingredients.length;
        let current = 0;
        
        // Get existing data
        const existingSuppliers = {};
        Suppliers.data.forEach(s => { existingSuppliers[s.companyName] = s.id; });
        
        const existingIngredients = {};
        this.data.forEach(i => { existingIngredients[i.name] = i.id; });
        
        let stats = { suppliersAdded: 0, suppliersSkipped: 0, ingredientsAdded: 0, ingredientsSkipped: 0, pricesAdded: 0, pricesSkipped: 0 };

        // Import suppliers
        log('=== IMPORTING SUPPLIERS ===', 'info');
        for (const supplier of importData.suppliers) {
            current++;
            progressBar.style.width = `${Math.round((current / total) * 100)}%`;
            
            if (existingSuppliers[supplier.companyName]) {
                log(`⏭ Skip: ${supplier.companyName}`);
                stats.suppliersSkipped++;
            } else {
                try {
                    const docRef = await DB.add('suppliers', { ...supplier, createdAt: new Date().toISOString() });
                    existingSuppliers[supplier.companyName] = docRef;
                    log(`✓ Added: ${supplier.companyName}`, 'success');
                    stats.suppliersAdded++;
                } catch (e) {
                    log(`✗ Error: ${supplier.companyName} - ${e.message}`, 'error');
                }
            }
        }

        // Import ingredients
        log('\n=== IMPORTING INGREDIENTS ===', 'info');
        for (const ing of importData.ingredients) {
            current++;
            progressBar.style.width = `${Math.round((current / total) * 100)}%`;
            
            let ingredientId = existingIngredients[ing.name];
            
            if (!ingredientId) {
                try {
                    ingredientId = await DB.add('ingredients', {
                        name: ing.name,
                        category: ing.category,
                        costingMethod: 'lastPurchase',
                        createdAt: new Date().toISOString()
                    });
                    existingIngredients[ing.name] = ingredientId;
                    log(`✓ Added: ${ing.name}`, 'success');
                    stats.ingredientsAdded++;
                } catch (e) {
                    log(`✗ Error: ${ing.name} - ${e.message}`, 'error');
                    continue;
                }
            } else {
                log(`⏭ Exists: ${ing.name}`);
                stats.ingredientsSkipped++;
            }

            // Add prices
            for (const price of ing.prices) {
                const supplierId = existingSuppliers[price.supplierName];
                if (!supplierId) continue;

                // Check if price exists
                const existingPrices = IngredientPrices.data.filter(p => 
                    p.ingredientId === ingredientId && 
                    p.supplierId === supplierId && 
                    p.packageSize === price.packageSize
                );

                if (existingPrices.length === 0) {
                    try {
                        await DB.add('ingredientPrices', {
                            ingredientId,
                            ingredientName: ing.name,
                            supplierId,
                            supplierName: price.supplierName,
                            purchasePrice: price.purchasePrice,
                            packageSize: price.packageSize,
                            costPerGram: price.costPerGram,
                            lastPurchaseDate: new Date().toISOString(),
                            createdAt: new Date().toISOString()
                        });
                        log(`  💰 ${price.supplierName} @ ₱${price.purchasePrice}/${price.packageSize}g`, 'success');
                        stats.pricesAdded++;
                    } catch (e) {
                        log(`  ✗ Price error: ${e.message}`, 'error');
                    }
                } else {
                    stats.pricesSkipped++;
                }
            }
        }

        log('\n=== IMPORT COMPLETE ===', 'success');
        log(`Suppliers: ${stats.suppliersAdded} added, ${stats.suppliersSkipped} skipped`, 'info');
        log(`Ingredients: ${stats.ingredientsAdded} added, ${stats.ingredientsSkipped} skipped`, 'info');
        log(`Prices: ${stats.pricesAdded} added, ${stats.pricesSkipped} skipped`, 'info');
        
        // Reload data
        await Suppliers.load();
        await this.load();
        await IngredientPrices.load();
        this.render();
        
        Toast.success(`Import complete! Added ${stats.ingredientsAdded} ingredients and ${stats.pricesAdded} prices.`);
        return false; // Keep modal open to see results
    },

    getImportData() {
        return {
            suppliers: [
                {companyName: "Highlander Grains Trading", location: "Antipolo", deliveryFee: 0, freeDeliveryMin: 0},
                {companyName: "All About Baking SM Taytay", location: "Taytay", deliveryFee: 0, freeDeliveryMin: 0},
                {companyName: "SM Hypermarket Antipolo", location: "Antipolo", deliveryFee: 0, freeDeliveryMin: 0},
                {companyName: "Baking And Home Depot", location: "Other", deliveryFee: 0, freeDeliveryMin: 0},
                {companyName: "Palengke Transfiguration", location: "Antipolo", deliveryFee: 0, freeDeliveryMin: 0},
                {companyName: "Lazada", location: "Other", deliveryFee: 0, freeDeliveryMin: 0},
                {companyName: "Easy", location: "Taytay", deliveryFee: 0, freeDeliveryMin: 0}
            ],
            ingredients: [
                {name: "Margarine", category: "fat", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 110, packageSize: 1000, costPerGram: 0.11}]},
                {name: "Bread Crumbs", category: "topping", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 45, packageSize: 1000, costPerGram: 0.045}]},
                {name: "Baking Powder", category: "leavening", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 70, packageSize: 1000, costPerGram: 0.07}]},
                {name: "Lard", category: "fat", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 104, packageSize: 1000, costPerGram: 0.104}]},
                {name: "Washed Sugar", category: "sugar", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 66, packageSize: 1000, costPerGram: 0.066}]},
                {name: "Cinnamon Powder", category: "flavoring", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 200, packageSize: 1000, costPerGram: 0.2}]},
                {name: "3rd Class Powder", category: "flour", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 38, packageSize: 1000, costPerGram: 0.038}]},
                {name: "1st Class Flour Globe", category: "flour", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 905, packageSize: 25000, costPerGram: 0.0362}]},
                {name: "Milk Boy", category: "dairy", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 255, packageSize: 1000, costPerGram: 0.255}]},
                {name: "Cake Flour", category: "flour", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 50, packageSize: 1000, costPerGram: 0.05}]},
                {name: "Vanilla", category: "flavoring", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 51, packageSize: 350, costPerGram: 0.145714}]},
                {name: "Yeast", category: "leavening", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 125, packageSize: 500, costPerGram: 0.25}]},
                {name: "Cornstarch", category: "other", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 42, packageSize: 1000, costPerGram: 0.042}]},
                {name: "Oil", category: "fat", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 117, packageSize: 1500, costPerGram: 0.078}]},
                {name: "Salt", category: "flavoring", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 20, packageSize: 1000, costPerGram: 0.02}]},
                {name: "Bread Improver", category: "other", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 130, packageSize: 1000, costPerGram: 0.13}]},
                {name: "White Sugar", category: "sugar", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 76, packageSize: 1000, costPerGram: 0.076}]},
                {name: "Choco Powder", category: "flavoring", prices: [{supplierName: "Highlander Grains Trading", purchasePrice: 140, packageSize: 1000, costPerGram: 0.14}]},
                {name: "Chicken Floss Seaweed", category: "topping", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 1000, packageSize: 660, costPerGram: 1.515152}]},
                {name: "Spicy Pork Floss", category: "topping", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 1000, packageSize: 693, costPerGram: 1.443001}]},
                {name: "Semisweet Choco Sweet", category: "flavoring", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 1000, packageSize: 290, costPerGram: 3.448276}]},
                {name: "Crispy Chicken Floss", category: "topping", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 1000, packageSize: 595, costPerGram: 1.680672}]},
                {name: "Queensland Butter", category: "topping", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 1000, packageSize: 150, costPerGram: 6.666667}, {supplierName: "Baking And Home Depot", purchasePrice: 225, packageSize: 126, costPerGram: 1.785714}]},
                {name: "Beryls White Chocolate Bar", category: "flavoring", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 1000, packageSize: 360, costPerGram: 2.777778}]},
                {name: "Powder Sugar", category: "topping", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 1000, packageSize: 142, costPerGram: 7.042254}]},
                {name: "Jersey All purpose Cream", category: "topping", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 1000, packageSize: 264, costPerGram: 3.787879}]},
                {name: "Vizyon Pistachio", category: "flavoring", prices: [{supplierName: "All About Baking SM Taytay", purchasePrice: 750, packageSize: 2480, costPerGram: 0.302419}]},
                {name: "Nescafe Instant Coffee", category: "topping", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 180, packageSize: 104, costPerGram: 1.722488}]},
                {name: "Great Taste", category: "topping", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 50, packageSize: 51, costPerGram: 0.970874}]},
                {name: "Blend 45", category: "topping", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 25, packageSize: 22, costPerGram: 1.111111}]},
                {name: "Century Tuna", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 420, packageSize: 102, costPerGram: 4.097561}, {supplierName: "SM Hypermarket Antipolo", purchasePrice: 155, packageSize: 34, costPerGram: 4.532164}]},
                {name: "Chevital Quickmelt", category: "topping", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 1000, packageSize: 410, costPerGram: 2.439024}]},
                {name: "Lotte Spam", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 470, packageSize: 239, costPerGram: 1.962422}, {supplierName: "Baking And Home Depot", purchasePrice: 340, packageSize: 98, costPerGram: 3.469388}]},
                {name: "Ladies Choice Mayo", category: "topping", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 470, packageSize: 196, costPerGram: 2.391858}, {supplierName: "SM Hypermarket Antipolo", purchasePrice: 470, packageSize: 198, costPerGram: 2.367758}, {supplierName: "SM Hypermarket Antipolo", purchasePrice: 3500, packageSize: 1168, costPerGram: 2.995293}]},
                {name: "Kewpie", category: "topping", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 500, packageSize: 206, costPerGram: 2.421308}]},
                {name: "Eden Regular", category: "topping", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 430, packageSize: 145, costPerGram: 2.965517}]},
                {name: "Vida Bacon", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 250, packageSize: 152, costPerGram: 1.644737}, {supplierName: "Palengke Transfiguration", purchasePrice: 250, packageSize: 100, costPerGram: 2.5}]},
                {name: "Vida Sweet Ham", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 250, packageSize: 73, costPerGram: 3.401361}, {supplierName: "Palengke Transfiguration", purchasePrice: 250, packageSize: 55, costPerGram: 4.545455}]},
                {name: "CDO Idol Cheesedog", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 250, packageSize: 64, costPerGram: 3.90625}]},
                {name: "CDO Chicken Frank", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 250, packageSize: 64, costPerGram: 3.875969}]},
                {name: "Egg", category: "egg", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 30, packageSize: 275, costPerGram: 0.109091}]},
                {name: "CDO Cheesedog", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 1000, packageSize: 185, costPerGram: 5.390836}]},
                {name: "PF TJ Hotdog", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 1000, packageSize: 200, costPerGram: 5.0}]},
                {name: "Alaska Evaporated", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 1000, packageSize: 94, costPerGram: 10.582011}]},
                {name: "Alaska Condensed", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 1200, packageSize: 165, costPerGram: 7.237636}]},
                {name: "Angel Creamer", category: "filling", prices: [{supplierName: "SM Hypermarket Antipolo", purchasePrice: 250, packageSize: 84, costPerGram: 2.97619}]},
                {name: "Prochiz Cheddar", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 568, costPerGram: 3.521127}]},
                {name: "Blueberry Donut Filling", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 275, costPerGram: 7.272727}]},
                {name: "Strawberry Donut Filling", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 295, costPerGram: 6.779661}]},
                {name: "Dulce De Leche Donut Filling", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 270, costPerGram: 7.407407}]},
                {name: "Bavarian Donut Filling", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 270, costPerGram: 7.407407}]},
                {name: "Chocolate Donut Filling", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 390, costPerGram: 5.128205}]},
                {name: "Kewpie Mayo", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 295, costPerGram: 3.389831}]},
                {name: "Oleo Butter", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 225, packageSize: 62, costPerGram: 3.629032}]},
                {name: "Coffee Emulco", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 100, packageSize: 158, costPerGram: 0.632911}]},
                {name: "Chocolate Emulco", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 100, packageSize: 158, costPerGram: 0.632911}]},
                {name: "Pastry Pouch", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 100, packageSize: 78, costPerGram: 1.282051}]},
                {name: "Xanthan Gum", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 50, packageSize: 120, costPerGram: 0.416667}]},
                {name: "Eazy Caramel Drizzle", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1400, packageSize: 345, costPerGram: 4.057971}]},
                {name: "Easzy Salted Caramel Syrup", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 345, costPerGram: 7.246377}]},
                {name: "Eazy Vanilla Syrup", category: "filling", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 345, costPerGram: 7.246377}]},
                {name: "Bakersfield Whipit", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 260, costPerGram: 3.846154}]},
                {name: "Beryls Semisweet Choco Bar", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 335, costPerGram: 2.985075}]},
                {name: "Eazy Hazelnut Syrup", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 345, costPerGram: 7.246377}]},
                {name: "Susu Master Barista Milk", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 82, costPerGram: 12.195122}]},
                {name: "Conaprole Full Cream Milk", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 85, costPerGram: 11.764706}]},
                {name: "Blueberry Jam", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 3000, packageSize: 340, costPerGram: 8.823529}]},
                {name: "Brown Sugar 100pcs Pack", category: "sugar", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 100, packageSize: 110, costPerGram: 0.909091}]},
                {name: "White Sugar 100pcs Pack", category: "sugar", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 100, packageSize: 110, costPerGram: 0.909091}]},
                {name: "Peotraco Corn Syrup", category: "sugar", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 110, costPerGram: 9.090909}]},
                {name: "Maraschino Cherry Clara Ole", category: "other", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 280, packageSize: 149, costPerGram: 1.879195}]},
                {name: "Peotraco Confectioners Sugar", category: "sugar", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2272, packageSize: 210, costPerGram: 10.819048}]},
                {name: "Burgundy Food Color", category: "other", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 28, packageSize: 75, costPerGram: 0.373333}]},
                {name: "Peach Food Color", category: "other", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 28, packageSize: 75, costPerGram: 0.373333}]},
                {name: "Fuschia Pink Food Color", category: "other", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 28, packageSize: 75, costPerGram: 0.373333}]},
                {name: "Boba", category: "other", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 60, costPerGram: 16.666667}]},
                {name: "Cream Cheese Walling", category: "other", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 500, packageSize: 280, costPerGram: 1.785714}]},
                {name: "Casa Jasmine Greentea", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 335, costPerGram: 2.985075}]},
                {name: "Easy Creamer Pro", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 225, costPerGram: 4.444444}]},
                {name: "Mleko UHT Milk", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 76, costPerGram: 13.157895}]},
                {name: "Vana Blanca", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 195, costPerGram: 5.128205}]},
                {name: "Easy Brown Sugar Syrup", category: "sugar", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 345, costPerGram: 7.246377}]},
                {name: "Easy Sugarfree Sweetener", category: "sugar", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 145, costPerGram: 13.793103}]},
                {name: "Wintermelon Syrup", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2300, packageSize: 330, costPerGram: 6.969697}]},
                {name: "Mango Puree", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 195, costPerGram: 5.128205}]},
                {name: "Ersao Tapioca", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 85, costPerGram: 11.764706}]},
                {name: "Millin Blueberry Syrup", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 240, costPerGram: 10.416667}]},
                {name: "Cremidor", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 380, costPerGram: 2.631579}, {supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 398, costPerGram: 2.512563}]},
                {name: "Mung Bean Paste", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 178, costPerGram: 5.617978}]},
                {name: "Graham Crackers", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 200, packageSize: 46, costPerGram: 4.347826}]},
                {name: "Beryls Choco Chip", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 350, costPerGram: 2.857143}]},
                {name: "Lotte Luncheon Meat", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 340, packageSize: 98, costPerGram: 3.469388}, {supplierName: "Baking And Home Depot", purchasePrice: 340, packageSize: 93, costPerGram: 3.655914}]},
                {name: "Sesame Seed", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 250, packageSize: 75, costPerGram: 3.333333}]},
                {name: "Almond Flour", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 650, costPerGram: 1.538462}]},
                {name: "Ube Paste", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 178, costPerGram: 5.617978}]},
                {name: "Tapioca", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 88, costPerGram: 11.363636}]},
                {name: "Jolly Cow Fresh Milk", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 92, costPerGram: 10.869565}]},
                {name: "Oat Milk", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 155, costPerGram: 6.451613}]},
                {name: "Biscoff Smooth", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 400, packageSize: 379, costPerGram: 1.055409}]},
                {name: "Biscoff Biscuit", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 124, packageSize: 144, costPerGram: 0.861111}, {supplierName: "Baking And Home Depot", purchasePrice: 250, packageSize: 165, costPerGram: 1.515152}]},
                {name: "Biscoff Crumbs", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 750, packageSize: 440, costPerGram: 1.704545}, {supplierName: "Baking And Home Depot", purchasePrice: 750, packageSize: 420, costPerGram: 1.785714}]},
                {name: "Oreo Crushed", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 454, packageSize: 180, costPerGram: 2.522222}]},
                {name: "Pork Floss", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 400, costPerGram: 2.5}]},
                {name: "Diced Pistachio", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 250, packageSize: 590, costPerGram: 0.423729}]},
                {name: "Pistachio Cream", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 750, packageSize: 1890, costPerGram: 0.396825}]},
                {name: "Yarra Barista Milk", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 82, costPerGram: 12.195122}]},
                {name: "Lotus Biscoff Spread", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 3000, packageSize: 2450, costPerGram: 1.22449}]},
                {name: "Oleo Butter 2.5kg", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 640, costPerGram: 3.90625}]},
                {name: "White Color Food", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 30, packageSize: 75, costPerGram: 0.4}]},
                {name: "Frappe Base", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 230, costPerGram: 4.347826}, {supplierName: "Easy", purchasePrice: 1000, packageSize: 235, costPerGram: 4.255319}]},
                {name: "Easy Whip", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 210, costPerGram: 4.761905}]},
                {name: "Almond Sliced", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 690, costPerGram: 1.449275}]},
                {name: "Magnolia Mayo", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 3500, packageSize: 668, costPerGram: 5.239521}]},
                {name: "Crushed Graham", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 200, packageSize: 50, costPerGram: 4.0}]},
                {name: "Yogurt Syrup", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2200, packageSize: 300, costPerGram: 7.333333}]},
                {name: "Crushed Oreo", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 454, packageSize: 180, costPerGram: 2.522222}]},
                {name: "Magnola Cheese", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 485, costPerGram: 4.123711}]},
                {name: "Nuttella", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 900, packageSize: 605, costPerGram: 1.487603}]},
                {name: "Magnolia All Purpose Cream", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 130, costPerGram: 7.692308}]},
                {name: "Holiday White Sugar", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 50, packageSize: 55, costPerGram: 0.909091}]},
                {name: "Beryls Gourmet White Chocolate Compound", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 370, costPerGram: 2.702703}]},
                {name: "Beryls Gourmet Semisweet Chocolate Compound", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 335, costPerGram: 2.985075}]},
                {name: "Milin Blueberry Syrup", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 240, costPerGram: 10.416667}]},
                {name: "Milin Green Apple", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 240, costPerGram: 8.333333}]},
                {name: "Buenas Macapuno String", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 907, packageSize: 340, costPerGram: 2.667647}]},
                {name: "Easy Caramel Flavoured Syrup", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 345, costPerGram: 7.246377}]},
                {name: "Easy Vanilla Syrup", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 345, costPerGram: 7.246377}]},
                {name: "Easy Caramel Drizzle", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1400, packageSize: 345, costPerGram: 4.057971}]},
                {name: "Easy Sweetener", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 145, costPerGram: 13.793103}]},
                {name: "Quaker Quick Cook Oatmeal", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 260, costPerGram: 3.846154}]},
                {name: "Peotraco Confectioner", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2000, packageSize: 185, costPerGram: 10.810811}]},
                {name: "Milin Honey Peach Pieces", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 240, costPerGram: 4.166667}]},
                {name: "Anchor Cream Cheese", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 1000, packageSize: 560, costPerGram: 1.785714}]},
                {name: "Oleo Butter Unsalted", category: "topping", prices: [{supplierName: "Baking And Home Depot", purchasePrice: 2500, packageSize: 640, costPerGram: 3.90625}]},
                {name: "CDO Idol Chesedog", category: "filling", prices: [{supplierName: "Palengke Transfiguration", purchasePrice: 250, packageSize: 55, costPerGram: 4.545455}]},
                {name: "Magic Whizk Whipping Cream", category: "other", prices: [{supplierName: "Lazada", purchasePrice: 1000, packageSize: 405, costPerGram: 2.469136}]},
                {name: "Fermipan 2 In 1", category: "other", prices: [{supplierName: "Lazada", purchasePrice: 500, packageSize: 190, costPerGram: 2.631579}]},
                {name: "Chiffon Aide Hicaps", category: "other", prices: [{supplierName: "Lazada", purchasePrice: 1000, packageSize: 233, costPerGram: 4.291845}]},
                {name: "Hicaps Vanilla Emulco", category: "other", prices: [{supplierName: "Lazada", purchasePrice: 1000, packageSize: 1250, costPerGram: 0.8}]},
                {name: "OK Cheese", category: "other", prices: [{supplierName: "Lazada", purchasePrice: 2000, packageSize: 605, costPerGram: 3.305785}]},
                {name: "Ceremonial Grade Matcha", category: "other", prices: [{supplierName: "Lazada", purchasePrice: 100, packageSize: 456, costPerGram: 0.219298}]},
                {name: "Cooking Grade Matcha", category: "other", prices: [{supplierName: "Lazada", purchasePrice: 100, packageSize: 329, costPerGram: 0.303951}]},
                {name: "Sugarfree", category: "other", prices: [{supplierName: "Easy", purchasePrice: 20000, packageSize: 1050, costPerGram: 19.047619}]},
                {name: "Dark Choco Powder", category: "other", prices: [{supplierName: "Easy", purchasePrice: 1000, packageSize: 365, costPerGram: 2.739726}]},
                {name: "Choco Sauce", category: "other", prices: [{supplierName: "Easy", purchasePrice: 2000, packageSize: 450, costPerGram: 4.444444}]}
            ]
        };
    }
};
