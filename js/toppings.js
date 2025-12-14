/**
 * BreadHub ProofMaster - Toppings Management
 */

const Toppings = {
    data: [],
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('toppingRecipes');
            this.data.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error loading toppings:', error);
            Toast.error('Failed to load toppings');
        }
    },
    
    render() {
        const grid = document.getElementById('toppingsGrid');
        if (!grid) return;
        
        if (this.data.length === 0) {
            grid.innerHTML = `
                <p class="empty-state">
                    No topping recipes yet. Click "New Topping" to create one.
                </p>
            `;
            return;
        }
        
        grid.innerHTML = this.data.map(topping => `
            <div class="recipe-card" data-id="${topping.id}">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, #E67E22 0%, #D35400 100%);">
                    <h3>${topping.name}</h3>
                    <span class="version">v${topping.version || '1.0'}</span>
                </div>
                <div class="recipe-card-body">
                    <div class="recipe-stat">
                        <span>Batch Size:</span>
                        <span>${topping.batchSize}g</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Cost per batch:</span>
                        <span>${Utils.formatCurrency(topping.totalCost || 0)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Cost per gram:</span>
                        <span>${Utils.formatCurrency(topping.costPerGram || 0)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Prep Time:</span>
                        <span>${topping.preparation?.duration || '-'} min</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Shelf Life:</span>
                        <span>${topping.preparation?.shelfLife || '-'} hrs</span>
                    </div>
                </div>
                <div class="recipe-card-actions">
                    <button class="btn btn-secondary" onclick="Toppings.view('${topping.id}')">View</button>
                    <button class="btn btn-secondary" onclick="Toppings.edit('${topping.id}')">Edit</button>
                    <button class="btn btn-danger" onclick="Toppings.delete('${topping.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    },

    showAddModal() {
        Modal.open({
            title: 'New Topping Recipe',
            content: this.getFormHTML(),
            saveText: 'Create Recipe',
            width: '700px',
            onSave: () => this.save()
        });
        this.setupIngredientAdder();
    },
    
    async edit(id) {
        const topping = this.data.find(t => t.id === id);
        if (!topping) return;
        
        Modal.open({
            title: 'Edit Topping Recipe',
            content: this.getFormHTML(topping),
            saveText: 'Update Recipe',
            width: '700px',
            onSave: () => this.save(id)
        });
        this.setupIngredientAdder();
    },
    
    async view(id) {
        const topping = this.data.find(t => t.id === id);
        if (!topping) return;
        
        Modal.open({
            title: topping.name,
            content: this.getViewHTML(topping),
            showFooter: false,
            width: '700px'
        });
    },
    
    getFormHTML(topping = {}) {
        const ingredients = topping.ingredients || [];
        
        return `
            <form id="toppingForm">
                <div class="form-group">
                    <label>Recipe Name *</label>
                    <input type="text" name="name" class="form-input" 
                           value="${topping.name || ''}" required>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Batch Size (g) *</label>
                        <input type="number" name="batchSize" class="form-input" 
                               value="${topping.batchSize || 500}" required>
                    </div>
                    <div class="form-group">
                        <label>Version</label>
                        <input type="text" name="version" class="form-input" 
                               value="${topping.version || '1.0'}">
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Ingredients</h4>
                <div id="toppingIngredientsList">
                    ${ingredients.map((ing, idx) => this.getIngredientRow(ing, idx)).join('')}
                </div>
                <button type="button" class="btn btn-secondary" onclick="Toppings.addIngredientRow()">
                    + Add Ingredient
                </button>
                
                <h4 style="margin: 16px 0 8px;">Preparation</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Method</label>
                        <select name="prepMethod" class="form-select">
                            <option value="mixing" ${topping.preparation?.method === 'mixing' ? 'selected' : ''}>Mixing</option>
                            <option value="creaming" ${topping.preparation?.method === 'creaming' ? 'selected' : ''}>Creaming</option>
                            <option value="cooking" ${topping.preparation?.method === 'cooking' ? 'selected' : ''}>Cooking</option>
                            <option value="whipping" ${topping.preparation?.method === 'whipping' ? 'selected' : ''}>Whipping</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Duration (min)</label>
                        <input type="number" name="prepDuration" class="form-input" 
                               value="${topping.preparation?.duration || 10}">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Storage Temp (°C)</label>
                        <input type="number" name="storageTemp" class="form-input" 
                               value="${topping.preparation?.storageTemp || 25}">
                    </div>
                    <div class="form-group">
                        <label>Shelf Life (hours)</label>
                        <input type="number" name="shelfLife" class="form-input" 
                               value="${topping.preparation?.shelfLife || 24}">
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Standard Serving</h4>
                <div class="form-group">
                    <label>Amount per piece (g)</label>
                    <input type="number" name="servingAmount" class="form-input" 
                           value="${topping.standardServing?.amount || 20}">
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea">${topping.notes || ''}</textarea>
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
    
    setupIngredientAdder() {
        // Can add setup logic here if needed
    },
    
    addIngredientRow() {
        const list = document.getElementById('toppingIngredientsList');
        const idx = list.children.length;
        list.insertAdjacentHTML('beforeend', this.getIngredientRow({}, idx));
    },
    
    getViewHTML(topping) {
        const ingredients = topping.ingredients || [];
        
        return `
            <div style="padding: 16px 0;">
                <div class="recipe-stat">
                    <span>Version:</span>
                    <span>v${topping.version || '1.0'}</span>
                </div>
                <div class="recipe-stat">
                    <span>Batch Size:</span>
                    <span>${topping.batchSize}g</span>
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
                    <span>${topping.preparation?.method || '-'}</span>
                </div>
                <div class="recipe-stat">
                    <span>Duration:</span>
                    <span>${topping.preparation?.duration || '-'} min</span>
                </div>
                <div class="recipe-stat">
                    <span>Storage:</span>
                    <span>${topping.preparation?.storageTemp || '-'}°C for ${topping.preparation?.shelfLife || '-'} hrs</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Cost:</h4>
                <div class="recipe-stat">
                    <span>Per Batch:</span>
                    <span>${Utils.formatCurrency(topping.totalCost || 0)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Per Gram:</span>
                    <span>${Utils.formatCurrency(topping.costPerGram || 0)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Per Serving (${topping.standardServing?.amount || 20}g):</span>
                    <span>${Utils.formatCurrency((topping.costPerGram || 0) * (topping.standardServing?.amount || 20))}</span>
                </div>
            </div>
        `;
    },

    async save(id = null) {
        const form = document.getElementById('toppingForm');
        const formData = new FormData(form);
        
        const data = {
            name: formData.get('name'),
            batchSize: parseFloat(formData.get('batchSize')) || 500,
            version: formData.get('version') || '1.0',
            preparation: {
                method: formData.get('prepMethod') || 'mixing',
                duration: parseFloat(formData.get('prepDuration')) || 10,
                storageTemp: parseFloat(formData.get('storageTemp')) || 25,
                shelfLife: parseFloat(formData.get('shelfLife')) || 24
            },
            standardServing: {
                amount: parseFloat(formData.get('servingAmount')) || 20
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
        
        // Calculate costs
        this.calculateCosts(data);
        
        if (!data.name) {
            Toast.error('Please enter a recipe name');
            return;
        }
        
        try {
            if (id) {
                await DB.update('toppingRecipes', id, data);
                Toast.success('Topping recipe updated');
            } else {
                await DB.add('toppingRecipes', data);
                Toast.success('Topping recipe created');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving topping recipe:', error);
            Toast.error('Failed to save topping recipe');
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
        if (!confirm('Delete this topping recipe?')) return;
        
        try {
            await DB.delete('toppingRecipes', id);
            Toast.success('Topping recipe deleted');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting topping recipe:', error);
            Toast.error('Failed to delete topping recipe');
        }
    },
    
    getById(id) {
        return this.data.find(t => t.id === id);
    }
};
