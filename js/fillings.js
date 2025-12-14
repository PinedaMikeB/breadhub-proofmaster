/**
 * BreadHub ProofMaster - Fillings Management
 */

const Fillings = {
    data: [],
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('fillingRecipes');
            this.data.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error loading fillings:', error);
            Toast.error('Failed to load fillings');
        }
    },
    
    render() {
        const grid = document.getElementById('fillingsGrid');
        if (!grid) return;
        
        if (this.data.length === 0) {
            grid.innerHTML = `
                <p class="empty-state">
                    No filling recipes yet. Click "New Filling" to create one.
                </p>
            `;
            return;
        }
        
        grid.innerHTML = this.data.map(filling => `
            <div class="recipe-card" data-id="${filling.id}">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, #16A085 0%, #1ABC9C 100%);">
                    <h3>${filling.name}</h3>
                    <span class="version">v${filling.version || '1.0'}</span>
                </div>
                <div class="recipe-card-body">
                    <div class="recipe-stat">
                        <span>Batch Size:</span>
                        <span>${filling.batchSize}g</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Cost per batch:</span>
                        <span>${Utils.formatCurrency(filling.totalCost || 0)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Cost per gram:</span>
                        <span>${Utils.formatCurrency(filling.costPerGram || 0)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Prep Time:</span>
                        <span>${filling.preparation?.duration || '-'} min</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Shelf Life:</span>
                        <span>${filling.preparation?.shelfLife || '-'} hrs</span>
                    </div>
                </div>
                <div class="recipe-card-actions">
                    <button class="btn btn-secondary" onclick="Fillings.view('${filling.id}')">View</button>
                    <button class="btn btn-secondary" onclick="Fillings.edit('${filling.id}')">Edit</button>
                    <button class="btn btn-danger" onclick="Fillings.delete('${filling.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    },

    showAddModal() {
        Modal.open({
            title: 'New Filling Recipe',
            content: this.getFormHTML(),
            saveText: 'Create Recipe',
            width: '700px',
            onSave: () => this.save()
        });
    },
    
    async edit(id) {
        const filling = this.data.find(f => f.id === id);
        if (!filling) return;
        
        Modal.open({
            title: 'Edit Filling Recipe',
            content: this.getFormHTML(filling),
            saveText: 'Update Recipe',
            width: '700px',
            onSave: () => this.save(id)
        });
    },
    
    async view(id) {
        const filling = this.data.find(f => f.id === id);
        if (!filling) return;
        
        Modal.open({
            title: filling.name,
            content: this.getViewHTML(filling),
            showFooter: false,
            width: '700px'
        });
    },
    
    getFormHTML(filling = {}) {
        const ingredients = filling.ingredients || [];
        
        return `
            <form id="fillingForm">
                <div class="form-group">
                    <label>Recipe Name *</label>
                    <input type="text" name="name" class="form-input" 
                           value="${filling.name || ''}" required>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Batch Size (g) *</label>
                        <input type="number" name="batchSize" class="form-input" 
                               value="${filling.batchSize || 1000}" required>
                    </div>
                    <div class="form-group">
                        <label>Version</label>
                        <input type="text" name="version" class="form-input" 
                               value="${filling.version || '1.0'}">
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Ingredients</h4>
                <div id="fillingIngredientsList">
                    ${ingredients.map((ing, idx) => this.getIngredientRow(ing, idx)).join('')}
                </div>
                <button type="button" class="btn btn-secondary" onclick="Fillings.addIngredientRow()">
                    + Add Ingredient
                </button>
                
                <h4 style="margin: 16px 0 8px;">Preparation</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Method</label>
                        <select name="prepMethod" class="form-select">
                            <option value="mixing" ${filling.preparation?.method === 'mixing' ? 'selected' : ''}>Mixing</option>
                            <option value="cooking" ${filling.preparation?.method === 'cooking' ? 'selected' : ''}>Cooking</option>
                            <option value="blending" ${filling.preparation?.method === 'blending' ? 'selected' : ''}>Blending</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Duration (min)</label>
                        <input type="number" name="prepDuration" class="form-input" 
                               value="${filling.preparation?.duration || 15}">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Storage Temp (°C)</label>
                        <input type="number" name="storageTemp" class="form-input" 
                               value="${filling.preparation?.storageTemp || 25}">
                    </div>
                    <div class="form-group">
                        <label>Shelf Life (hours)</label>
                        <input type="number" name="shelfLife" class="form-input" 
                               value="${filling.preparation?.shelfLife || 48}">
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Standard Serving</h4>
                <div class="form-group">
                    <label>Amount per piece (g)</label>
                    <input type="number" name="servingAmount" class="form-input" 
                           value="${filling.standardServing?.amount || 8}">
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea">${filling.notes || ''}</textarea>
                </div>
            </form>
        `;
    },
    
    getIngredientRow(ing = {}, idx = 0) {
        const ingredientOptions = Ingredients.data.map(i => 
            `<option value="${i.id}" ${ing.ingredientId === i.id ? 'selected' : ''}>${i.name}</option>`
        ).join('');
        
        return `
            <div class="ingredient-row" style="display: flex; gap: 8px; margin-bottom: 8px;">
                <select name="ing_${idx}_id" class="form-select" style="flex: 2;">
                    <option value="">Select ingredient...</option>
                    ${ingredientOptions}
                </select>
                <input type="number" name="ing_${idx}_amount" class="form-input" 
                       value="${ing.amount || ''}" placeholder="Amount" style="flex: 1;">
                <select name="ing_${idx}_unit" class="form-select" style="flex: 1;">
                    <option value="g" ${ing.unit === 'g' ? 'selected' : ''}>g</option>
                    <option value="mL" ${ing.unit === 'mL' ? 'selected' : ''}>mL</option>
                </select>
                <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">×</button>
            </div>
        `;
    },
    
    addIngredientRow() {
        const list = document.getElementById('fillingIngredientsList');
        const idx = list.children.length;
        list.insertAdjacentHTML('beforeend', this.getIngredientRow({}, idx));
    },

    getViewHTML(filling) {
        const ingredients = filling.ingredients || [];
        
        return `
            <div style="padding: 16px 0;">
                <div class="recipe-stat">
                    <span>Version:</span>
                    <span>v${filling.version || '1.0'}</span>
                </div>
                <div class="recipe-stat">
                    <span>Batch Size:</span>
                    <span>${filling.batchSize}g</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Ingredients:</h4>
                ${ingredients.map(ing => {
                    const ingredient = Ingredients.getById(ing.ingredientId);
                    return `
                        <div class="recipe-stat">
                            <span>${ingredient?.name || 'Unknown'}:</span>
                            <span>${ing.amount}${ing.unit}</span>
                        </div>
                    `;
                }).join('')}
                
                <h4 style="margin: 16px 0 8px;">Preparation:</h4>
                <div class="recipe-stat">
                    <span>Method:</span>
                    <span>${filling.preparation?.method || '-'}</span>
                </div>
                <div class="recipe-stat">
                    <span>Duration:</span>
                    <span>${filling.preparation?.duration || '-'} min</span>
                </div>
                <div class="recipe-stat">
                    <span>Storage:</span>
                    <span>${filling.preparation?.storageTemp || '-'}°C for ${filling.preparation?.shelfLife || '-'} hrs</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Cost:</h4>
                <div class="recipe-stat">
                    <span>Per Batch:</span>
                    <span>${Utils.formatCurrency(filling.totalCost || 0)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Per Gram:</span>
                    <span>${Utils.formatCurrency(filling.costPerGram || 0)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Per Serving (${filling.standardServing?.amount || 8}g):</span>
                    <span>${Utils.formatCurrency((filling.costPerGram || 0) * (filling.standardServing?.amount || 8))}</span>
                </div>
            </div>
        `;
    },
    
    async save(id = null) {
        const form = document.getElementById('fillingForm');
        const formData = new FormData(form);
        
        const data = {
            name: formData.get('name'),
            batchSize: parseFloat(formData.get('batchSize')) || 1000,
            version: formData.get('version') || '1.0',
            preparation: {
                method: formData.get('prepMethod') || 'mixing',
                duration: parseFloat(formData.get('prepDuration')) || 15,
                storageTemp: parseFloat(formData.get('storageTemp')) || 25,
                shelfLife: parseFloat(formData.get('shelfLife')) || 48
            },
            standardServing: {
                amount: parseFloat(formData.get('servingAmount')) || 8
            },
            notes: formData.get('notes') || ''
        };
        
        // Extract ingredients
        const ingredients = [];
        let idx = 0;
        while (formData.has(`ing_${idx}_id`)) {
            const ingId = formData.get(`ing_${idx}_id`);
            const amount = formData.get(`ing_${idx}_amount`);
            if (ingId && amount) {
                ingredients.push({
                    ingredientId: ingId,
                    amount: parseFloat(amount),
                    unit: formData.get(`ing_${idx}_unit`) || 'g'
                });
            }
            idx++;
        }
        data.ingredients = ingredients;
        
        this.calculateCosts(data);
        
        if (!data.name) {
            Toast.error('Please enter a recipe name');
            return;
        }
        
        try {
            if (id) {
                await DB.update('fillingRecipes', id, data);
                Toast.success('Filling recipe updated');
            } else {
                await DB.add('fillingRecipes', data);
                Toast.success('Filling recipe created');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving filling recipe:', error);
            Toast.error('Failed to save filling recipe');
        }
    },
    
    calculateCosts(data) {
        let totalCost = 0;
        
        for (const ing of data.ingredients) {
            const ingredient = Ingredients.getById(ing.ingredientId);
            if (ingredient) {
                const costPerGram = Ingredients.getCostPerGram(ing.ingredientId);
                totalCost += costPerGram * ing.amount;
            }
        }
        
        data.totalCost = totalCost;
        data.costPerGram = data.batchSize > 0 ? totalCost / data.batchSize : 0;
    },
    
    async delete(id) {
        if (!confirm('Delete this filling recipe?')) return;
        
        try {
            await DB.delete('fillingRecipes', id);
            Toast.success('Filling recipe deleted');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting filling recipe:', error);
            Toast.error('Failed to delete filling recipe');
        }
    },
    
    getById(id) {
        return this.data.find(f => f.id === id);
    }
};
