/**
 * BreadHub ProofMaster - Ingredients Management
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
            // Sort by name
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
        
        tbody.innerHTML = this.data.map(ing => `
            <tr data-id="${ing.id}">
                <td><strong>${ing.name}</strong></td>
                <td>${this.formatCategory(ing.category)}</td>
                <td>${ing.unit}</td>
                <td>${Utils.formatCurrency(ing.costPerUnit)}/${ing.unit}</td>
                <td>${ing.supplier || '-'}</td>
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
        `).join('');
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
                           value="${ing.name || ''}" required>
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
                
                <div class="form-group">
                    <label>Unit *</label>
                    <select name="unit" class="form-select" required>
                        <option value="">Select unit...</option>
                        <option value="kg" ${ing.unit === 'kg' ? 'selected' : ''}>Kilogram (kg)</option>
                        <option value="g" ${ing.unit === 'g' ? 'selected' : ''}>Gram (g)</option>
                        <option value="L" ${ing.unit === 'L' ? 'selected' : ''}>Liter (L)</option>
                        <option value="mL" ${ing.unit === 'mL' ? 'selected' : ''}>Milliliter (mL)</option>
                        <option value="pc" ${ing.unit === 'pc' ? 'selected' : ''}>Piece (pc)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Cost per Unit (₱) *</label>
                    <input type="number" name="costPerUnit" class="form-input" 
                           value="${ing.costPerUnit || ''}" step="0.01" min="0" required>
                </div>
                
                <div class="form-group">
                    <label>Supplier</label>
                    <input type="text" name="supplier" class="form-input" 
                           value="${ing.supplier || ''}" placeholder="Optional">
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea" 
                              placeholder="Optional notes...">${ing.notes || ''}</textarea>
                </div>
            </form>
        `;
    },
    
    async save(id = null) {
        const data = Modal.getFormData();
        
        // Validation
        if (!data.name || !data.category || !data.unit || !data.costPerUnit) {
            Toast.error('Please fill all required fields');
            return;
        }
        
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
    
    // Get cost per gram
    getCostPerGram(id) {
        const ing = this.getById(id);
        if (!ing) return 0;
        
        if (ing.unit === 'kg') return ing.costPerUnit / 1000;
        if (ing.unit === 'g') return ing.costPerUnit;
        if (ing.unit === 'L') return ing.costPerUnit / 1000;
        if (ing.unit === 'mL') return ing.costPerUnit;
        return ing.costPerUnit;
    }
};
