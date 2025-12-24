/**
 * BreadHub ProofMaster - Packaging Materials Management
 * Track cups, bags, pouches, straws, lids, boxes, etc.
 * All costs are per unit (pcs)
 */

const PackagingMaterials = {
    data: [],
    categories: [
        'cups',      // Paper cups (12oz, 16oz, 22oz)
        'lids',      // Cup lids
        'straws',    // Straws
        'bags',      // Paper bags, plastic bags
        'pouches',   // Bread pouches, pastry bags
        'boxes',     // Cake boxes, pastry boxes
        'containers', // Plastic containers
        'labels',    // Stickers, labels
        'other'      // Misc packaging
    ],
    
    categoryIcons: {
        cups: '🥤',
        lids: '⭕',
        straws: '🥢',
        bags: '🛍️',
        pouches: '📦',
        boxes: '📦',
        containers: '🥡',
        labels: '🏷️',
        other: '📋'
    },
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('packagingMaterials');
            this.data.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error loading packaging materials:', error);
            Toast.error('Failed to load packaging materials');
        }
    },
    
    render() {
        const tbody = document.getElementById('packagingTableBody');
        if (!tbody) return;
        
        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        No packaging materials yet. Click "Add Packaging" to get started.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.data.map(pkg => {
            const stock = pkg.currentStock || 0;
            const reorderLevel = pkg.reorderLevel || 0;
            const isLowStock = stock > 0 && stock <= reorderLevel;
            const isOutOfStock = stock === 0;
            
            let stockColor = 'var(--success)';
            let stockLabel = '';
            if (isOutOfStock) {
                stockColor = 'var(--danger)';
                stockLabel = '<br><small style="color: var(--danger);">Out of stock</small>';
            } else if (isLowStock) {
                stockColor = 'var(--warning)';
                stockLabel = '<br><small style="color: var(--warning);">Low stock</small>';
            }
            
            const supplier = pkg.supplierId ? Suppliers.getById(pkg.supplierId) : null;
            const icon = this.categoryIcons[pkg.category] || '📋';
            
            return `
                <tr data-id="${pkg.id}">
                    <td>
                        <strong>${icon} ${pkg.name}</strong>
                        ${pkg.size ? `<br><small style="color: var(--text-secondary);">${pkg.size}</small>` : ''}
                    </td>
                    <td>${this.formatCategory(pkg.category)}</td>
                    <td style="text-align: right;">
                        <strong style="color: var(--primary);">
                            ${Utils.formatCurrency(pkg.costPerUnit)}
                        </strong>
                        <br><small style="color: var(--text-secondary);">per ${pkg.unit || 'pc'}</small>
                    </td>
                    <td style="text-align: right;">
                        <strong style="color: ${stockColor};">${stock.toLocaleString()}</strong>
                        <br><small style="color: var(--text-secondary);">${pkg.unit || 'pcs'}</small>
                        ${stockLabel}
                    </td>
                    <td style="text-align: right; color: var(--text-secondary);">
                        ${reorderLevel > 0 ? reorderLevel.toLocaleString() : '-'}
                    </td>
                    <td>${supplier?.companyName || '-'}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="PackagingMaterials.adjustStock('${pkg.id}')">
                            📦 Stock
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="PackagingMaterials.edit('${pkg.id}')">
                            Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="PackagingMaterials.delete('${pkg.id}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Update low stock alerts
        this.updateAlerts();
    },

    // Update low stock alerts on dashboard
    updateAlerts() {
        const lowStockItems = this.data.filter(pkg => {
            const stock = pkg.currentStock || 0;
            const reorderLevel = pkg.reorderLevel || 0;
            return stock <= reorderLevel && reorderLevel > 0;
        });
        
        // This will be integrated with dashboard alerts later
        if (lowStockItems.length > 0) {
            console.log(`⚠️ ${lowStockItems.length} packaging items low/out of stock`);
        }
    },
    
    formatCategory(cat) {
        const icon = this.categoryIcons[cat] || '';
        const name = cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '-';
        return `${icon} ${name}`;
    },
    
    showAddModal() {
        Modal.open({
            title: '📦 Add Packaging Material',
            content: this.getFormHTML(),
            saveText: 'Add Packaging',
            onSave: () => this.save()
        });
    },
    
    async edit(id) {
        const pkg = this.data.find(p => p.id === id);
        if (!pkg) return;
        
        Modal.open({
            title: '📦 Edit Packaging Material',
            content: this.getFormHTML(pkg),
            saveText: 'Update',
            onSave: () => this.save(id)
        });
    },
    
    getFormHTML(pkg = {}) {
        const supplierOptions = Suppliers.data.map(s => 
            `<option value="${s.id}" ${pkg.supplierId === s.id ? 'selected' : ''}>${s.companyName}</option>`
        ).join('');
        
        return `
            <form id="packagingForm">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" class="form-input" 
                           value="${pkg.name || ''}" required
                           placeholder="e.g., Paper Cup 12oz">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Category *</label>
                        <select name="category" class="form-select" required>
                            <option value="">Select category...</option>
                            ${this.categories.map(cat => `
                                <option value="${cat}" ${pkg.category === cat ? 'selected' : ''}>
                                    ${this.categoryIcons[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Size/Variant</label>
                        <input type="text" name="size" class="form-input" 
                               value="${pkg.size || ''}"
                               placeholder="e.g., 12oz, Small, 6x8 inches">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Cost per Unit (₱) *</label>
                        <input type="number" name="costPerUnit" class="form-input" 
                               step="0.01" min="0" required
                               value="${pkg.costPerUnit || ''}"
                               placeholder="e.g., 3.50">
                    </div>
                    <div class="form-group">
                        <label>Unit</label>
                        <select name="unit" class="form-select">
                            <option value="pcs" ${(pkg.unit || 'pcs') === 'pcs' ? 'selected' : ''}>Pieces (pcs)</option>
                            <option value="pack" ${pkg.unit === 'pack' ? 'selected' : ''}>Pack</option>
                            <option value="roll" ${pkg.unit === 'roll' ? 'selected' : ''}>Roll</option>
                            <option value="sheet" ${pkg.unit === 'sheet' ? 'selected' : ''}>Sheet</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Current Stock</label>
                        <input type="number" name="currentStock" class="form-input" 
                               min="0" value="${pkg.currentStock || 0}"
                               placeholder="e.g., 500">
                    </div>
                    <div class="form-group">
                        <label>Reorder Level</label>
                        <input type="number" name="reorderLevel" class="form-input" 
                               min="0" value="${pkg.reorderLevel || 0}"
                               placeholder="e.g., 100">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Supplier</label>
                    <select name="supplierId" class="form-select">
                        <option value="">-- No supplier --</option>
                        ${supplierOptions}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea" 
                              placeholder="Brand, quality notes, etc.">${pkg.notes || ''}</textarea>
                </div>
            </form>
        `;
    },
    
    async save(id = null) {
        const data = Modal.getFormData();
        
        if (!data.name || !data.category) {
            Toast.error('Please fill name and category');
            return;
        }
        
        if (!data.costPerUnit || data.costPerUnit <= 0) {
            Toast.error('Please enter a valid cost per unit');
            return;
        }
        
        // Parse numbers
        data.costPerUnit = parseFloat(data.costPerUnit);
        data.currentStock = parseInt(data.currentStock) || 0;
        data.reorderLevel = parseInt(data.reorderLevel) || 0;
        
        try {
            if (id) {
                await DB.update('packagingMaterials', id, data);
                Toast.success('Packaging material updated');
            } else {
                data.createdAt = new Date().toISOString();
                await DB.add('packagingMaterials', data);
                Toast.success('Packaging material added');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving packaging material:', error);
            Toast.error('Failed to save packaging material');
        }
    },
    
    // Stock adjustment modal
    adjustStock(id) {
        const pkg = this.data.find(p => p.id === id);
        if (!pkg) return;
        
        const icon = this.categoryIcons[pkg.category] || '📦';
        
        Modal.open({
            title: `${icon} Adjust Stock: ${pkg.name}`,
            content: `
                <form id="stockForm">
                    <div style="background: var(--bg-input); padding: 16px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
                        <span style="color: var(--text-secondary);">Current Stock:</span>
                        <span style="font-size: 2rem; font-weight: bold; color: var(--primary); margin-left: 8px;">
                            ${(pkg.currentStock || 0).toLocaleString()}
                        </span>
                        <span style="color: var(--text-secondary);">${pkg.unit || 'pcs'}</span>
                    </div>

                    <div class="form-group">
                        <label>Adjustment Type</label>
                        <select name="adjustType" id="stockAdjustType" class="form-select" 
                                onchange="PackagingMaterials.toggleAdjustFields()">
                            <option value="add">➕ Add Stock (Purchase/Delivery)</option>
                            <option value="subtract">➖ Remove Stock (Usage/Damage)</option>
                            <option value="set">🔢 Set Exact Amount (Inventory Count)</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label id="stockAmountLabel">Quantity to Add</label>
                        <input type="number" name="amount" id="stockAmount" class="form-input" 
                               min="0" required placeholder="Enter quantity">
                    </div>
                    
                    <div class="form-group">
                        <label>Reason (Optional)</label>
                        <input type="text" name="reason" class="form-input" 
                               placeholder="e.g., Weekly delivery, damaged items, inventory count">
                    </div>
                    
                    <div id="stockPreview" style="background: #E8F5E9; padding: 12px; border-radius: 8px; text-align: center;">
                        <span style="color: var(--text-secondary);">New Stock:</span>
                        <span id="newStockPreview" style="font-size: 1.5rem; font-weight: bold; color: var(--success); margin-left: 8px;">
                            ${(pkg.currentStock || 0).toLocaleString()}
                        </span>
                    </div>
                </form>
                
                <script>
                    // Auto-update preview
                    document.getElementById('stockAmount').addEventListener('input', function() {
                        PackagingMaterials.updateStockPreview(${pkg.currentStock || 0});
                    });
                    document.getElementById('stockAdjustType').addEventListener('change', function() {
                        PackagingMaterials.updateStockPreview(${pkg.currentStock || 0});
                    });
                </script>
            `,
            saveText: 'Update Stock',
            onSave: () => this.saveStockAdjustment(id, pkg.currentStock || 0)
        });
    },
    
    toggleAdjustFields() {
        const type = document.getElementById('stockAdjustType')?.value;
        const label = document.getElementById('stockAmountLabel');
        if (!label) return;
        
        switch(type) {
            case 'add':
                label.textContent = 'Quantity to Add';
                break;
            case 'subtract':
                label.textContent = 'Quantity to Remove';
                break;
            case 'set':
                label.textContent = 'New Stock Amount';
                break;
        }
    },
    
    updateStockPreview(currentStock) {
        const type = document.getElementById('stockAdjustType')?.value;
        const amount = parseInt(document.getElementById('stockAmount')?.value) || 0;
        const preview = document.getElementById('newStockPreview');
        const previewBox = document.getElementById('stockPreview');
        if (!preview) return;
        
        let newStock = currentStock;
        switch(type) {
            case 'add':
                newStock = currentStock + amount;
                break;
            case 'subtract':
                newStock = Math.max(0, currentStock - amount);
                break;
            case 'set':
                newStock = amount;
                break;
        }
        
        preview.textContent = newStock.toLocaleString();
        
        // Color coding
        if (newStock > currentStock) {
            previewBox.style.background = '#E8F5E9';
            preview.style.color = 'var(--success)';
        } else if (newStock < currentStock) {
            previewBox.style.background = '#FDEDEC';
            preview.style.color = 'var(--danger)';
        } else {
            previewBox.style.background = 'var(--bg-input)';
            preview.style.color = 'var(--primary)';
        }
    },

    async saveStockAdjustment(id, currentStock) {
        const data = Modal.getFormData();
        const amount = parseInt(data.amount) || 0;
        
        if (amount < 0) {
            Toast.error('Please enter a valid quantity');
            return;
        }
        
        let newStock = currentStock;
        let actionText = '';
        
        switch(data.adjustType) {
            case 'add':
                newStock = currentStock + amount;
                actionText = `Added ${amount}`;
                break;
            case 'subtract':
                newStock = Math.max(0, currentStock - amount);
                actionText = `Removed ${amount}`;
                break;
            case 'set':
                newStock = amount;
                actionText = `Set to ${amount}`;
                break;
        }
        
        try {
            await DB.update('packagingMaterials', id, {
                currentStock: newStock,
                lastStockUpdate: new Date().toISOString(),
                lastStockReason: data.reason || actionText
            });
            
            Toast.success(`Stock updated: ${actionText}`);
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error updating stock:', error);
            Toast.error('Failed to update stock');
        }
    },
    
    async delete(id) {
        const pkg = this.data.find(p => p.id === id);
        if (!pkg) return;
        
        if (!confirm(`Delete "${pkg.name}"? This cannot be undone.`)) return;
        
        try {
            await DB.delete('packagingMaterials', id);
            Toast.success('Packaging material deleted');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting packaging material:', error);
            Toast.error('Failed to delete');
        }
    },
    
    // Helper methods for other modules
    getById(id) {
        return this.data.find(p => p.id === id);
    },
    
    getCost(id) {
        const pkg = this.data.find(p => p.id === id);
        return pkg?.costPerUnit || 0;
    },
    
    // Get select options for use in product forms
    getSelectOptions(selectedId = null) {
        return this.data.map(p => {
            const icon = this.categoryIcons[p.category] || '📦';
            return `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>
                ${icon} ${p.name} ${p.size ? `(${p.size})` : ''} - ${Utils.formatCurrency(p.costPerUnit)}
            </option>`;
        }).join('');
    },
    
    // Get by category for filtering
    getByCategory(category) {
        return this.data.filter(p => p.category === category);
    },
    
    // Deduct stock when used in sales
    async deductStock(id, quantity) {
        const pkg = this.data.find(p => p.id === id);
        if (!pkg) return false;
        
        const newStock = Math.max(0, (pkg.currentStock || 0) - quantity);
        
        try {
            await DB.update('packagingMaterials', id, {
                currentStock: newStock,
                lastStockUpdate: new Date().toISOString(),
                lastStockReason: `Sale deduction: -${quantity}`
            });
            
            // Update local data
            pkg.currentStock = newStock;
            return true;
        } catch (error) {
            console.error('Error deducting stock:', error);
            return false;
        }
    },

    // Bulk import common packaging items
    showImportModal() {
        Modal.open({
            title: '📥 Import Common Packaging Items',
            content: `
                <div style="padding: 10px 0;">
                    <p style="margin-bottom: 15px;">This will import common bakery/café packaging items with estimated costs.</p>
                    <div style="background: #FFF3CD; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                        <strong>⚠️ Note:</strong> Existing items (same name) will be skipped. Adjust costs after import to match your actual prices.
                    </div>
                    <div id="pkgImportLog" style="background: #1a1a2e; color: #0f0; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 0.8rem; max-height: 300px; overflow-y: auto; white-space: pre-wrap;">Ready to import...</div>
                </div>
            `,
            saveText: '🚀 Start Import',
            onSave: () => this.runBulkImport()
        });
    },
    
    async runBulkImport() {
        const logEl = document.getElementById('pkgImportLog');
        const log = (msg, type = 'info') => {
            const color = type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#74c0fc';
            logEl.innerHTML += `<span style="color:${color}">${msg}</span>\n`;
            logEl.scrollTop = logEl.scrollHeight;
        };
        
        logEl.innerHTML = '';
        
        const importData = this.getImportData();
        const existingNames = this.data.map(p => p.name.toLowerCase());
        
        let added = 0, skipped = 0;
        
        for (const item of importData) {
            if (existingNames.includes(item.name.toLowerCase())) {
                log(`⏭ Skip: ${item.name}`);
                skipped++;
            } else {
                try {
                    await DB.add('packagingMaterials', {
                        ...item,
                        currentStock: 0,
                        reorderLevel: item.reorderLevel || 50,
                        createdAt: new Date().toISOString()
                    });
                    log(`✓ Added: ${item.name}`, 'success');
                    added++;
                } catch (e) {
                    log(`✗ Error: ${item.name} - ${e.message}`, 'error');
                }
            }
        }
        
        log(`\n=== IMPORT COMPLETE ===`, 'success');
        log(`Added: ${added}, Skipped: ${skipped}`, 'info');
        
        await this.load();
        this.render();
        
        Toast.success(`Import complete! Added ${added} items.`);
        return false; // Keep modal open
    },
    
    getImportData() {
        return [
            // Cups
            { name: "Paper Cup 12oz", category: "cups", size: "12oz", costPerUnit: 3.50, unit: "pcs", reorderLevel: 100 },
            { name: "Paper Cup 16oz", category: "cups", size: "16oz", costPerUnit: 4.50, unit: "pcs", reorderLevel: 100 },
            { name: "Paper Cup 22oz", category: "cups", size: "22oz", costPerUnit: 5.50, unit: "pcs", reorderLevel: 100 },
            { name: "Plastic Cup 12oz", category: "cups", size: "12oz", costPerUnit: 2.50, unit: "pcs", reorderLevel: 100 },
            { name: "Plastic Cup 16oz", category: "cups", size: "16oz", costPerUnit: 3.00, unit: "pcs", reorderLevel: 100 },
            { name: "Plastic Cup 22oz", category: "cups", size: "22oz", costPerUnit: 3.50, unit: "pcs", reorderLevel: 100 },
            
            // Lids
            { name: "Flat Lid 12oz", category: "lids", size: "12oz", costPerUnit: 1.50, unit: "pcs", reorderLevel: 100 },
            { name: "Flat Lid 16oz", category: "lids", size: "16oz", costPerUnit: 1.75, unit: "pcs", reorderLevel: 100 },
            { name: "Flat Lid 22oz", category: "lids", size: "22oz", costPerUnit: 2.00, unit: "pcs", reorderLevel: 100 },
            { name: "Dome Lid 12oz", category: "lids", size: "12oz", costPerUnit: 2.00, unit: "pcs", reorderLevel: 50 },
            { name: "Dome Lid 16oz", category: "lids", size: "16oz", costPerUnit: 2.25, unit: "pcs", reorderLevel: 50 },
            { name: "Dome Lid 22oz", category: "lids", size: "22oz", costPerUnit: 2.50, unit: "pcs", reorderLevel: 50 },

            // Straws
            { name: "Regular Straw", category: "straws", size: "Standard", costPerUnit: 0.50, unit: "pcs", reorderLevel: 200 },
            { name: "Boba Straw", category: "straws", size: "12mm", costPerUnit: 1.00, unit: "pcs", reorderLevel: 100 },
            { name: "Paper Straw", category: "straws", size: "Standard", costPerUnit: 1.50, unit: "pcs", reorderLevel: 100 },
            
            // Bags
            { name: "Paper Bag Small", category: "bags", size: "Small", costPerUnit: 2.00, unit: "pcs", reorderLevel: 100 },
            { name: "Paper Bag Medium", category: "bags", size: "Medium", costPerUnit: 3.00, unit: "pcs", reorderLevel: 100 },
            { name: "Paper Bag Large", category: "bags", size: "Large", costPerUnit: 4.00, unit: "pcs", reorderLevel: 100 },
            { name: "Plastic Carrier Bag", category: "bags", size: "Standard", costPerUnit: 1.50, unit: "pcs", reorderLevel: 200 },
            
            // Pouches
            { name: "Bread Pouch Clear", category: "pouches", size: "Standard", costPerUnit: 1.00, unit: "pcs", reorderLevel: 200 },
            { name: "Bread Pouch Printed", category: "pouches", size: "Standard", costPerUnit: 1.50, unit: "pcs", reorderLevel: 200 },
            { name: "Pastry Pouch", category: "pouches", size: "Small", costPerUnit: 0.75, unit: "pcs", reorderLevel: 200 },
            { name: "Cookie Pouch", category: "pouches", size: "Small", costPerUnit: 0.50, unit: "pcs", reorderLevel: 200 },
            
            // Boxes
            { name: "Pastry Box 6x6", category: "boxes", size: "6x6 inches", costPerUnit: 8.00, unit: "pcs", reorderLevel: 50 },
            { name: "Pastry Box 8x8", category: "boxes", size: "8x8 inches", costPerUnit: 10.00, unit: "pcs", reorderLevel: 50 },
            { name: "Cake Box 10x10", category: "boxes", size: "10x10 inches", costPerUnit: 15.00, unit: "pcs", reorderLevel: 30 },
            { name: "Cake Box 12x12", category: "boxes", size: "12x12 inches", costPerUnit: 20.00, unit: "pcs", reorderLevel: 30 },
            { name: "Donut Box 6pcs", category: "boxes", size: "6 donuts", costPerUnit: 12.00, unit: "pcs", reorderLevel: 50 },
            
            // Containers
            { name: "Sauce Cup 2oz", category: "containers", size: "2oz", costPerUnit: 1.00, unit: "pcs", reorderLevel: 100 },
            { name: "Deli Container 8oz", category: "containers", size: "8oz", costPerUnit: 3.00, unit: "pcs", reorderLevel: 50 },
            { name: "Clamshell Container", category: "containers", size: "Standard", costPerUnit: 5.00, unit: "pcs", reorderLevel: 50 },
            
            // Labels
            { name: "Brand Sticker", category: "labels", size: "2 inch", costPerUnit: 0.25, unit: "pcs", reorderLevel: 500 },
            { name: "Seal Sticker", category: "labels", size: "Circle", costPerUnit: 0.15, unit: "pcs", reorderLevel: 500 },
            { name: "Price Tag Sticker", category: "labels", size: "Small", costPerUnit: 0.10, unit: "pcs", reorderLevel: 500 },
            
            // Other
            { name: "Napkin", category: "other", size: "Standard", costPerUnit: 0.25, unit: "pcs", reorderLevel: 500 },
            { name: "Wooden Stirrer", category: "other", size: "Standard", costPerUnit: 0.25, unit: "pcs", reorderLevel: 200 },
            { name: "Tissue Pack", category: "other", size: "Travel", costPerUnit: 2.00, unit: "pcs", reorderLevel: 100 },
            { name: "Takeout Tray", category: "other", size: "4 cup holder", costPerUnit: 3.00, unit: "pcs", reorderLevel: 100 }
        ];
    },
    
    // Reset all stock to zero
    showResetStockModal() {
        const itemsWithStock = this.data.filter(p => (p.currentStock || 0) > 0);
        
        Modal.open({
            title: '🔄 Reset All Packaging Stock',
            content: `
                <div style="padding: 8px 0;">
                    <div style="background: #FDEDEC; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--danger);">
                        <strong>⚠️ Warning:</strong> This will reset ALL packaging stock to zero.
                    </div>
                    <div style="background: var(--bg-input); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                        <strong>Items with stock:</strong> ${itemsWithStock.length}
                    </div>
                    <div class="form-group">
                        <label><strong>Enter Password to Confirm:</strong></label>
                        <input type="password" id="resetPkgPassword" class="form-input" placeholder="Enter password">
                    </div>
                </div>
            `,
            saveText: '🔄 Reset All Stock',
            saveClass: 'btn-danger',
            onSave: () => this.executeResetStock()
        });
    },

    async executeResetStock() {
        const password = document.getElementById('resetPkgPassword')?.value;
        
        if (password !== '1234') {
            Toast.error('Incorrect password');
            return false;
        }
        
        const itemsWithStock = this.data.filter(p => (p.currentStock || 0) > 0);
        
        if (itemsWithStock.length === 0) {
            Toast.info('All items already have zero stock');
            Modal.close();
            return;
        }
        
        try {
            for (const pkg of itemsWithStock) {
                await DB.update('packagingMaterials', pkg.id, { currentStock: 0 });
                pkg.currentStock = 0;
            }
            
            Toast.success(`Reset stock for ${itemsWithStock.length} items`);
            Modal.close();
            this.render();
        } catch (error) {
            console.error('Error resetting stock:', error);
            Toast.error('Failed to reset stock');
        }
    }
};
