/**
 * BreadHub ProofMaster - Ingredients Management
 * All measurements standardized to GRAMS - no teaspoons/tablespoons allowed!
 * Baker must use weighing scale for accuracy.
 */

const Ingredients = {
    data: [],
    categories: [
        'flour', 'dairy', 'fat', 'leavening', 'sugar', 
        'egg', 'flavoring', 'filling', 'topping', 'other'
    ],
    
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
                    <td colspan="8" class="empty-state">
                        No ingredients yet. Add suppliers first, then add ingredients.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.data.map(ing => {
            const supplier = Suppliers.getById(ing.supplierId);
            return `
                <tr data-id="${ing.id}">
                    <td><strong>${ing.name}</strong></td>
                    <td>${this.formatCategory(ing.category)}</td>
                    <td>${Utils.formatCurrency(ing.purchasePrice)}</td>
                    <td>${ing.packageSize}g</td>
                    <td><strong>${Utils.formatCurrency(ing.costPerGram)}</strong></td>
                    <td>${supplier?.companyName || '-'}</td>
                    <td>${Utils.formatDate(ing.updatedAt)}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="Ingredients.edit('${ing.id}')">
                            Edit
                        </button>
                        <button class="btn btn-danger" onclick="Ingredients.delete('${ing.id}')">
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
        if (Suppliers.data.length === 0) {
            Toast.warning('Please add a supplier first before adding ingredients');
            App.showView('suppliers');
            return;
        }
        
        Modal.open({
            title: 'Add Ingredient',
            content: this.getFormHTML(),
            saveText: 'Add Ingredient',
            onSave: () => this.save()
        });
        
        this.setupCostCalculation();
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
        
        this.setupCostCalculation();
    },

    getFormHTML(ing = {}) {
        return `
            <form id="ingredientForm">
                <div class="form-group">
                    <label>Ingredient Name *</label>
                    <input type="text" name="name" class="form-input" 
                           value="${ing.name || ''}" required
                           placeholder="e.g., Bread Flour (Champion)">
                </div>
                
                <div class="form-group">
                    <label>Supplier *</label>
                    <select name="supplierId" class="form-select" required>
                        <option value="">Select supplier...</option>
                        ${Suppliers.getSelectOptions(ing.supplierId)}
                    </select>
                </div>
                
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
                
                <div style="background: var(--bg-input); padding: 16px; border-radius: 10px; margin: 16px 0;">
                    <h4 style="margin-bottom: 12px; color: var(--primary);">💰 Cost Calculation</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
                        Enter the price you paid and the package weight. Cost per gram will be calculated automatically.
                    </p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Purchase Price (₱) *</label>
                            <input type="number" name="purchasePrice" id="purchasePrice" 
                                   class="form-input" step="0.01" min="0"
                                   value="${ing.purchasePrice || ''}" required
                                   placeholder="e.g., 45.00">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Package Size (grams) *</label>
                            <input type="number" name="packageSize" id="packageSize" 
                                   class="form-input" step="1" min="1"
                                   value="${ing.packageSize || ''}" required
                                   placeholder="e.g., 1000">
                        </div>
                    </div>
                    
                    <div style="margin-top: 16px; padding: 12px; background: white; border-radius: 8px; text-align: center;">
                        <span style="color: var(--text-secondary);">Cost per gram:</span>
                        <span id="costPerGramDisplay" style="font-size: 1.5rem; font-weight: bold; color: var(--primary); margin-left: 8px;">
                            ${ing.costPerGram ? Utils.formatCurrency(ing.costPerGram) : '₱0.00'}
                        </span>
                        <span style="color: var(--text-secondary);">/gram</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea" 
                              placeholder="Brand details, quality notes, etc.">${ing.notes || ''}</textarea>
                </div>
                
                <div style="background: #FEF9E7; padding: 12px; border-radius: 8px; border-left: 4px solid var(--warning);">
                    <strong>⚖️ Important:</strong> All recipes use <strong>grams</strong> only. 
                    Baker must use a digital scale - no cups, teaspoons, or tablespoons allowed!
                </div>
            </form>
        `;
    },
    
    setupCostCalculation() {
        const priceInput = document.getElementById('purchasePrice');
        const sizeInput = document.getElementById('packageSize');
        const display = document.getElementById('costPerGramDisplay');
        
        const calculate = () => {
            const price = parseFloat(priceInput.value) || 0;
            const size = parseFloat(sizeInput.value) || 0;
            const costPerGram = size > 0 ? price / size : 0;
            display.textContent = Utils.formatCurrency(costPerGram);
        };
        
        priceInput.addEventListener('input', calculate);
        sizeInput.addEventListener('input', calculate);
    },
    
    async save(id = null) {
        const data = Modal.getFormData();
        
        // Validation
        if (!data.name || !data.supplierId || !data.category || !data.purchasePrice || !data.packageSize) {
            Toast.error('Please fill all required fields');
            return;
        }
        
        // Calculate cost per gram
        data.costPerGram = data.packageSize > 0 ? data.purchasePrice / data.packageSize : 0;
        
        try {
            if (id) {
                await DB.update('ingredients', id, data);
                Toast.success('Ingredient updated');
            } else {
                await DB.add('ingredients', data);
                Toast.success('Ingredient added');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving ingredient:', error);
            Toast.error('Failed to save ingredient');
        }
    },
    
    async delete(id) {
        if (!confirm('Are you sure you want to delete this ingredient?')) return;
        
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
    
    // Get ingredient by ID
    getById(id) {
        return this.data.find(i => i.id === id);
    },
    
    // Get cost per gram (standardized)
    getCostPerGram(id) {
        const ing = this.getById(id);
        return ing?.costPerGram || 0;
    }
};
