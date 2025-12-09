/**
 * BreadHub ProofMaster - Dough Recipes Management
 */

const Doughs = {
    data: [],
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('doughRecipes');
            this.data.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error loading dough recipes:', error);
            Toast.error('Failed to load dough recipes');
        }
    },
    
    render() {
        const grid = document.getElementById('doughsGrid');
        if (!grid) return;
        
        if (this.data.length === 0) {
            grid.innerHTML = `
                <p class="empty-state">
                    No dough recipes yet. Click "New Dough Recipe" to create one.
                </p>
            `;
            return;
        }
        
        grid.innerHTML = this.data.map(dough => `
            <div class="recipe-card" data-id="${dough.id}">
                <div class="recipe-card-header">
                    <h3>${dough.name}</h3>
                    <span class="version">v${dough.version || '1.0'}</span>
                </div>
                <div class="recipe-card-body">
                    <div class="recipe-stat">
                        <span>Base Flour:</span>
                        <span>${dough.baseFlour}g</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Yield:</span>
                        <span>${dough.yield || '-'}g</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Cost per batch:</span>
                        <span>${Utils.formatCurrency(dough.totalCost || 0)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Mix Time:</span>
                        <span>${dough.mixing?.duration || '-'} min</span>
                    </div>
                    <div class="recipe-stat">
                        <span>First Proof:</span>
                        <span>${dough.firstProof?.duration || '-'} min</span>
                    </div>
                </div>
                <div class="recipe-card-actions">
                    <button class="btn btn-secondary" onclick="Doughs.view('${dough.id}')">
                        View
                    </button>
                    <button class="btn btn-secondary" onclick="Doughs.edit('${dough.id}')">
                        Edit
                    </button>
                    <button class="btn btn-danger" onclick="Doughs.delete('${dough.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    },

    
    showAddModal() {
        Modal.open({
            title: 'New Dough Recipe',
            content: this.getFormHTML(),
            saveText: 'Create Recipe',
            width: '700px',
            onSave: () => this.save()
        });
        this.setupIngredientAdder();
    },
    
    async edit(id) {
        const dough = this.data.find(d => d.id === id);
        if (!dough) return;
        
        Modal.open({
            title: 'Edit Dough Recipe',
            content: this.getFormHTML(dough),
            saveText: 'Update Recipe',
            width: '700px',
            onSave: () => this.save(id)
        });
        this.setupIngredientAdder();
    },
    
    async view(id) {
        const dough = this.data.find(d => d.id === id);
        if (!dough) return;
        
        Modal.open({
            title: dough.name,
            content: this.getViewHTML(dough),
            showFooter: false,
            width: '700px'
        });
    },
    
    getFormHTML(dough = {}) {
        const ingredients = dough.ingredients || [];
        
        return `
            <form id="doughForm">
                <div class="form-group">
                    <label>Recipe Name *</label>
                    <input type="text" name="name" class="form-input" 
                           value="${dough.name || ''}" required>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Base Flour (g) *</label>
                        <input type="number" name="baseFlour" class="form-input" 
                               value="${dough.baseFlour || 500}" required>
                    </div>
                    <div class="form-group">
                        <label>Version</label>
                        <input type="text" name="version" class="form-input" 
                               value="${dough.version || '1.0'}">
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Ingredients</h4>
                <div id="ingredientsList">
                    ${ingredients.map((ing, idx) => this.getIngredientRow(ing, idx)).join('')}
                </div>
                <button type="button" class="btn btn-secondary" onclick="Doughs.addIngredientRow()">
                    + Add Ingredient
                </button>
                
                <h4 style="margin: 16px 0 8px;">Mixing Process</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Total Mix Time (min)</label>
                        <input type="number" name="mixDuration" class="form-input" 
                               value="${dough.mixing?.duration || 12}">
                    </div>
                    <div class="form-group">
                        <label>Target Temp (°C)</label>
                        <input type="number" name="mixTargetTemp" class="form-input" 
                               value="${dough.mixing?.targetTemperature || 27}">
                    </div>
                </div>

                
                <h4 style="margin: 16px 0 8px;">First Proof (Bulk Fermentation)</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Duration (min)</label>
                        <input type="number" name="proofDuration" class="form-input" 
                               value="${dough.firstProof?.duration || 60}">
                    </div>
                    <div class="form-group">
                        <label>Temperature (°C)</label>
                        <input type="number" name="proofTemp" class="form-input" 
                               value="${dough.firstProof?.temperature || 28}">
                    </div>
                    <div class="form-group">
                        <label>Humidity (%)</label>
                        <input type="number" name="proofHumidity" class="form-input" 
                               value="${dough.firstProof?.humidity || 75}">
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Characteristics</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Proof Sensitivity</label>
                        <select name="proofSensitivity" class="form-select">
                            <option value="high" ${dough.characteristics?.proofSensitivity === 'high' ? 'selected' : ''}>High</option>
                            <option value="medium" ${dough.characteristics?.proofSensitivity === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="low" ${dough.characteristics?.proofSensitivity === 'low' ? 'selected' : ''}>Low</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Max Dough Age (min)</label>
                        <input type="number" name="maxDoughAge" class="form-input" 
                               value="${dough.characteristics?.maxDoughAge || 90}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea">${dough.notes || ''}</textarea>
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
        // Nothing special needed - handled inline
    },
    
    addIngredientRow() {
        const list = document.getElementById('ingredientsList');
        const idx = list.children.length;
        list.insertAdjacentHTML('beforeend', this.getIngredientRow({}, idx));
    },
    
    getViewHTML(dough) {
        const ingredients = dough.ingredients || [];
        
        return `
            <div style="padding: 16px 0;">
                <div class="recipe-stat">
                    <span>Version:</span>
                    <span>v${dough.version || '1.0'}</span>
                </div>
                <div class="recipe-stat">
                    <span>Base Flour:</span>
                    <span>${dough.baseFlour}g</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Ingredients per ${dough.baseFlour}g flour:</h4>
                ${ingredients.map(ing => {
                    const ingredient = Ingredients.getById(ing.ingredientId);
                    return `
                        <div class="recipe-stat">
                            <span>${ingredient?.name || 'Unknown'}:</span>
                            <span>${ing.amount}${ing.unit}</span>
                        </div>
                    `;
                }).join('')}
                
                <h4 style="margin: 16px 0 8px;">Process:</h4>
                <div class="recipe-stat">
                    <span>Mix Duration:</span>
                    <span>${dough.mixing?.duration || '-'} min</span>
                </div>
                <div class="recipe-stat">
                    <span>Target Dough Temp:</span>
                    <span>${dough.mixing?.targetTemperature || '-'}°C</span>
                </div>
                <div class="recipe-stat">
                    <span>First Proof:</span>
                    <span>${dough.firstProof?.duration || '-'} min @ ${dough.firstProof?.temperature || '-'}°C</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Cost:</h4>
                <div class="recipe-stat">
                    <span>Per Batch:</span>
                    <span>${Utils.formatCurrency(dough.totalCost || 0)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Per Gram:</span>
                    <span>${Utils.formatCurrency(dough.costPerGram || 0)}</span>
                </div>
            </div>
        `;
    },

    
    async save(id = null) {
        const form = document.getElementById('doughForm');
        const formData = new FormData(form);
        
        // Extract basic data
        const data = {
            name: formData.get('name'),
            baseFlour: parseFloat(formData.get('baseFlour')) || 500,
            version: formData.get('version') || '1.0',
            mixing: {
                duration: parseFloat(formData.get('mixDuration')) || 12,
                targetTemperature: parseFloat(formData.get('mixTargetTemp')) || 27
            },
            firstProof: {
                duration: parseFloat(formData.get('proofDuration')) || 60,
                temperature: parseFloat(formData.get('proofTemp')) || 28,
                humidity: parseFloat(formData.get('proofHumidity')) || 75
            },
            characteristics: {
                proofSensitivity: formData.get('proofSensitivity') || 'medium',
                maxDoughAge: parseFloat(formData.get('maxDoughAge')) || 90
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
        
        // Validation
        if (!data.name) {
            Toast.error('Please enter a recipe name');
            return;
        }
        
        try {
            if (id) {
                await DB.update('doughRecipes', id, data);
                Toast.success('Recipe updated');
            } else {
                await DB.add('doughRecipes', data);
                Toast.success('Recipe created');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving recipe:', error);
            Toast.error('Failed to save recipe');
        }
    },
    
    calculateCosts(data) {
        let totalCost = 0;
        let totalYield = 0;
        
        for (const ing of data.ingredients) {
            const ingredient = Ingredients.getById(ing.ingredientId);
            if (ingredient) {
                const costPerGram = Ingredients.getCostPerGram(ing.ingredientId);
                totalCost += costPerGram * ing.amount;
                totalYield += ing.amount;
            }
        }
        
        data.totalCost = totalCost;
        data.yield = totalYield;
        data.costPerGram = totalYield > 0 ? totalCost / totalYield : 0;
    },
    
    async delete(id) {
        if (!confirm('Delete this dough recipe?')) return;
        
        try {
            await DB.delete('doughRecipes', id);
            Toast.success('Recipe deleted');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting recipe:', error);
            Toast.error('Failed to delete recipe');
        }
    },
    
    getById(id) {
        return this.data.find(d => d.id === id);
    }
};
