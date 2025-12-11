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
        // Ensure ingredients are loaded
        if (Ingredients.data.length === 0) {
            Toast.error('Please wait for ingredients to load');
            return;
        }
        
        Modal.open({
            title: 'New Dough Recipe',
            content: this.getFormHTML(),
            saveText: 'Create Recipe',
            width: '700px',
            onSave: () => this.save()
        });
    },
    
    async edit(id) {
        const dough = this.data.find(d => d.id === id);
        if (!dough) return;
        
        // Ensure ingredients are loaded
        if (Ingredients.data.length === 0) {
            Toast.error('Please wait for ingredients to load');
            return;
        }
        
        Modal.open({
            title: 'Edit Dough Recipe',
            content: this.getFormHTML(dough),
            saveText: 'Update Recipe',
            width: '700px',
            onSave: () => this.save(id)
        });
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
        // Build ingredient options - simple list sorted alphabetically
        const ingredientOptions = Ingredients.data
            .slice() // copy array
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(i => {
                const stock = i.currentStock || 0;
                const stockDisplay = stock >= 1000 ? (stock/1000).toFixed(1) + 'kg' : stock + 'g';
                const category = Ingredients.formatCategory(i.category);
                const selected = ing.ingredientId === i.id ? 'selected' : '';
                return `<option value="${i.id}" ${selected}>${i.name} (${stockDisplay}) - ${category}</option>`;
            })
            .join('');
        
        return `
            <div class="ingredient-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                <select name="ing_${idx}_id" class="form-select" style="flex: 2;">
                    <option value="">Select ingredient...</option>
                    ${ingredientOptions}
                </select>
                <input type="number" name="ing_${idx}_amount" class="form-input" 
                       value="${ing.amount || ''}" placeholder="Qty" style="width: 80px;" step="0.1">
                <select name="ing_${idx}_unit" class="form-select" style="width: 70px;">
                    <option value="g" ${ing.unit === 'g' || !ing.unit ? 'selected' : ''}>g</option>
                    <option value="kg" ${ing.unit === 'kg' ? 'selected' : ''}>kg</option>
                    <option value="mL" ${ing.unit === 'mL' ? 'selected' : ''}>mL</option>
                    <option value="pcs" ${ing.unit === 'pcs' ? 'selected' : ''}>pcs</option>
                </select>
                <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding: 8px 12px;">✕</button>
            </div>
        `;
    },

    
    addIngredientRow() {
        const list = document.getElementById('ingredientsList');
        if (!list) {
            console.error('ingredientsList not found');
            return;
        }
        
        if (Ingredients.data.length === 0) {
            Toast.error('No ingredients loaded');
            return;
        }
        
        // Find next unique index
        const existingRows = list.querySelectorAll('.ingredient-row');
        let maxIdx = -1;
        existingRows.forEach(row => {
            const select = row.querySelector('select');
            if (select && select.name) {
                const match = select.name.match(/ing_(\d+)_id/);
                if (match) maxIdx = Math.max(maxIdx, parseInt(match[1]));
            }
        });
        const newIdx = maxIdx + 1;
        
        const newRow = this.getIngredientRow({}, newIdx);
        list.insertAdjacentHTML('beforeend', newRow);
    },
    
    getViewHTML(dough) {
        const ingredients = dough.ingredients || [];
        
        // Calculate total weight
        let totalWeight = 0;
        ingredients.forEach(ing => {
            let amount = ing.amount || 0;
            if (ing.unit === 'kg') amount *= 1000;
            totalWeight += amount;
        });
        
        return `
            <div style="padding: 16px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <span class="badge" style="background: var(--primary); color: white; font-size: 14px;">
                        Version ${dough.version || '1.0'}
                    </span>
                    <div>
                        <button class="btn btn-secondary btn-sm" onclick="Modal.close(); Doughs.edit('${dough.id}')">
                            ✏️ Edit
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="Doughs.saveAsNewVersion('${dough.id}')">
                            📋 Save as New Version
                        </button>
                    </div>
                </div>
                
                <div class="recipe-stat">
                    <span>Base Flour:</span>
                    <span><strong>${dough.baseFlour}g</strong></span>
                </div>
                <div class="recipe-stat">
                    <span>Total Yield:</span>
                    <span><strong>${totalWeight >= 1000 ? (totalWeight/1000).toFixed(2) + 'kg' : totalWeight + 'g'}</strong></span>
                </div>
                
                <h4 style="margin: 20px 0 12px; border-bottom: 1px solid var(--bg-input); padding-bottom: 8px;">
                    🧂 Ingredients (per ${dough.baseFlour}g flour)
                </h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--bg-input);">
                            <th style="padding: 8px; text-align: left;">Ingredient</th>
                            <th style="padding: 8px; text-align: right;">Amount</th>
                            <th style="padding: 8px; text-align: right;">Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ingredients.length > 0 ? ingredients.map(ing => {
                            const ingredient = Ingredients.getById(ing.ingredientId);
                            let amountG = ing.amount || 0;
                            if (ing.unit === 'kg') amountG *= 1000;
                            const costPerGram = ingredient ? Ingredients.getCostPerGram(ing.ingredientId) : 0;
                            const cost = costPerGram * amountG;
                            
                            return `
                                <tr style="border-bottom: 1px solid var(--bg-input);">
                                    <td style="padding: 8px;">
                                        ${ingredient?.name || 'Unknown'}
                                        <br><small style="color: var(--text-secondary);">${Ingredients.formatCategory(ingredient?.category)}</small>
                                    </td>
                                    <td style="padding: 8px; text-align: right;">${ing.amount}${ing.unit}</td>
                                    <td style="padding: 8px; text-align: right;">${Utils.formatCurrency(cost)}</td>
                                </tr>
                            `;
                        }).join('') : '<tr><td colspan="3" style="padding: 12px; text-align: center; color: var(--text-secondary);">No ingredients added</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr style="background: var(--bg-input); font-weight: bold;">
                            <td style="padding: 8px;">Total</td>
                            <td style="padding: 8px; text-align: right;">${totalWeight >= 1000 ? (totalWeight/1000).toFixed(2) + 'kg' : totalWeight + 'g'}</td>
                            <td style="padding: 8px; text-align: right; color: var(--primary);">${Utils.formatCurrency(dough.totalCost || 0)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <h4 style="margin: 20px 0 12px; border-bottom: 1px solid var(--bg-input); padding-bottom: 8px;">
                    ⚙️ Process
                </h4>
                <div class="recipe-stat">
                    <span>Mixing:</span>
                    <span>${dough.mixing?.duration || '-'} min → Target ${dough.mixing?.targetTemperature || '-'}°C</span>
                </div>
                <div class="recipe-stat">
                    <span>First Proof:</span>
                    <span>${dough.firstProof?.duration || '-'} min @ ${dough.firstProof?.temperature || '-'}°C, ${dough.firstProof?.humidity || '-'}% humidity</span>
                </div>
                <div class="recipe-stat">
                    <span>Proof Sensitivity:</span>
                    <span>${dough.characteristics?.proofSensitivity || 'Medium'}</span>
                </div>
                <div class="recipe-stat">
                    <span>Max Dough Age:</span>
                    <span>${dough.characteristics?.maxDoughAge || '-'} min</span>
                </div>
                
                <h4 style="margin: 20px 0 12px; border-bottom: 1px solid var(--bg-input); padding-bottom: 8px;">
                    💰 Cost Analysis
                </h4>
                <div class="recipe-stat">
                    <span>Cost per Batch:</span>
                    <span><strong style="color: var(--primary);">${Utils.formatCurrency(dough.totalCost || 0)}</strong></span>
                </div>
                <div class="recipe-stat">
                    <span>Cost per Gram:</span>
                    <span>${Utils.formatCurrency(dough.costPerGram || 0)}/g</span>
                </div>
                
                ${dough.notes ? `
                    <h4 style="margin: 20px 0 12px; border-bottom: 1px solid var(--bg-input); padding-bottom: 8px;">
                        📝 Notes
                    </h4>
                    <p style="color: var(--text-secondary); white-space: pre-wrap;">${dough.notes}</p>
                ` : ''}
            </div>
        `;
    },
    
    // Save as new version (duplicate with incremented version)
    async saveAsNewVersion(id) {
        const dough = this.data.find(d => d.id === id);
        if (!dough) return;
        
        // Parse current version and increment
        const currentVersion = dough.version || '1.0';
        const versionParts = currentVersion.split('.');
        let major = parseInt(versionParts[0]) || 1;
        let minor = parseInt(versionParts[1]) || 0;
        minor++;
        if (minor >= 10) {
            major++;
            minor = 0;
        }
        const newVersion = `${major}.${minor}`;
        
        // Create copy with new version
        const newDough = {
            ...dough,
            version: newVersion,
            previousVersionId: id,
            createdAt: new Date().toISOString()
        };
        delete newDough.id; // Remove ID so a new one is created
        
        try {
            const newId = await DB.add('doughRecipes', newDough);
            Toast.success(`Created version ${newVersion}`);
            Modal.close();
            await this.load();
            this.render();
            // Open the new version for editing
            this.edit(newId);
        } catch (error) {
            console.error('Error creating new version:', error);
            Toast.error('Failed to create new version');
        }
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
                // Convert to grams for calculation
                let amountInGrams = ing.amount || 0;
                if (ing.unit === 'kg') amountInGrams *= 1000;
                
                const costPerGram = Ingredients.getCostPerGram(ing.ingredientId);
                totalCost += costPerGram * amountInGrams;
                totalYield += amountInGrams;
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
