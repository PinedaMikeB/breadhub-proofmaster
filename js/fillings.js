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
        this.setupCalculation();
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
        this.setupCalculation();
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
                
                <h4 style="margin: 16px 0 8px;">Ingredients</h4>
                <div id="fillingIngredientsList">
                    ${ingredients.map((ing, idx) => this.getIngredientRow(ing, idx)).join('')}
                </div>
                <button type="button" class="btn btn-secondary" onclick="Fillings.addIngredientRow()">
                    + Add Ingredient
                </button>
                
                <!-- BATCH CALCULATION DISPLAY -->
                <div id="fillingCalcDisplay" style="background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%); padding: 16px; border-radius: 12px; margin: 16px 0; border: 2px solid #FF9800;">
                    <h4 style="margin: 0 0 12px; color: #E65100;">📊 Batch Calculation</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <div class="recipe-stat">
                            <span>⚖️ Total Batch Weight:</span>
                            <span id="fillingTotalWeight" style="font-weight: bold;">0g</span>
                        </div>
                        <div class="recipe-stat">
                            <span>💰 Total Batch Cost:</span>
                            <span id="fillingTotalCost" style="font-weight: bold; color: var(--danger);">₱0.00</span>
                        </div>
                        <div class="recipe-stat" style="background: white; padding: 8px; border-radius: 6px;">
                            <span>🥥 Pieces Producible:</span>
                            <span id="fillingPiecesCount" style="font-weight: bold; color: var(--primary); font-size: 1.2rem;">0 pcs</span>
                        </div>
                        <div class="recipe-stat" style="background: white; padding: 8px; border-radius: 6px;">
                            <span>💵 Cost per Piece:</span>
                            <span id="fillingCostPerPiece" style="font-weight: bold; color: var(--success); font-size: 1.2rem;">₱0.00</span>
                        </div>
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Standard Serving</h4>
                <div class="form-group">
                    <label>Amount per piece (g)</label>
                    <input type="number" name="servingAmount" id="fillingServingAmount" class="form-input" 
                           value="${filling.standardServing?.amount || 8}" min="1">
                </div>
                
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
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea">${filling.notes || ''}</textarea>
                </div>
            </form>
        `;
    },
    
    getIngredientRow(ing = {}, idx = 0) {
        const selectedIngredient = ing.ingredientId ? Ingredients.getById(ing.ingredientId) : null;
        
        // Calculate initial cost
        let rowCost = 0;
        if (selectedIngredient && ing.amount) {
            const costPerGram = Ingredients.getCostPerGram(ing.ingredientId);
            rowCost = costPerGram * ing.amount;
        }
        
        return `
            <div class="ingredient-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                <div class="ingredient-select-wrapper" style="flex: 2; position: relative;">
                    <input 
                        type="text" 
                        class="form-input filling-ing-search" 
                        placeholder="Type to search ingredients..."
                        value="${selectedIngredient ? selectedIngredient.name : ''}"
                        data-idx="${idx}"
                        autocomplete="off"
                        onfocus="Fillings.showIngredientDropdown(${idx})"
                        oninput="Fillings.filterIngredients(${idx}, this.value)"
                    />
                    <input 
                        type="hidden" 
                        name="ing_${idx}_id" 
                        class="filling-ing-select" 
                        value="${ing.ingredientId || ''}"
                    />
                    <div 
                        id="fillingIngredientDropdown_${idx}" 
                        class="ingredient-dropdown" 
                        style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ddd; border-radius: 4px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
                    >
                        ${this.getIngredientOptions(ing.ingredientId)}
                    </div>
                </div>
                <input 
                    type="number" 
                    name="ing_${idx}_amount" 
                    class="form-input filling-ing-amount" 
                    value="${ing.amount || ''}" 
                    placeholder="Amount" 
                    style="flex: 0 0 100px;" 
                    oninput="Fillings.updateCalculation()"
                />
                <select name="ing_${idx}_unit" class="form-select" style="flex: 0 0 70px;">
                    <option value="g" ${ing.unit === 'g' ? 'selected' : ''}>g</option>
                    <option value="mL" ${ing.unit === 'mL' ? 'selected' : ''}>mL</option>
                </select>
                <div 
                    class="ingredient-row-cost" 
                    data-idx="${idx}"
                    style="flex: 0 0 80px; text-align: right; font-weight: 600; color: var(--primary); font-size: 0.9rem;"
                >
                    ${Utils.formatCurrency(rowCost)}
                </div>
                <button type="button" class="btn btn-danger" style="flex: 0 0 40px; padding: 8px;" onclick="this.parentElement.remove(); Fillings.updateCalculation();">×</button>
            </div>
        `;
    },
    
    getIngredientOptions(selectedId = null, filterText = '') {
        const filter = filterText.toLowerCase();
        const filtered = Ingredients.data.filter(i => 
            !filterText || i.name.toLowerCase().includes(filter)
        );
        
        if (filtered.length === 0) {
            return '<div style="padding: 8px; text-align: center; color: #999;">No ingredients found</div>';
        }
        
        return filtered.map(i => `
            <div 
                class="ingredient-option ${i.id === selectedId ? 'selected' : ''}" 
                data-id="${i.id}" 
                data-name="${i.name}"
                style="padding: 8px 12px; cursor: pointer; ${i.id === selectedId ? 'background: #E3F2FD;' : ''}"
                onmouseenter="this.style.background='#f5f5f5'"
                onmouseleave="this.style.background='${i.id === selectedId ? '#E3F2FD' : 'white'}'"
            >
                ${i.name}
            </div>
        `).join('');
    },
    
    showIngredientDropdown(idx) {
        // Hide all other dropdowns
        document.querySelectorAll('.ingredient-dropdown').forEach(dd => {
            if (dd.id !== `fillingIngredientDropdown_${idx}`) {
                dd.style.display = 'none';
            }
        });
        
        const dropdown = document.getElementById(`fillingIngredientDropdown_${idx}`);
        if (dropdown) {
            dropdown.style.display = 'block';
            this.attachDropdownListeners(idx);
        }
    },
    
    filterIngredients(idx, searchText) {
        const dropdown = document.getElementById(`fillingIngredientDropdown_${idx}`);
        if (!dropdown) return;
        
        dropdown.innerHTML = this.getIngredientOptions(null, searchText);
        dropdown.style.display = 'block';
        this.attachDropdownListeners(idx);
    },
    
    attachDropdownListeners(idx) {
        const dropdown = document.getElementById(`fillingIngredientDropdown_${idx}`);
        if (!dropdown) return;
        
        dropdown.querySelectorAll('.ingredient-option').forEach(option => {
            option.onclick = () => {
                const id = option.dataset.id;
                const name = option.dataset.name;
                
                // Set the hidden input value
                const hiddenInput = dropdown.parentElement.querySelector(`[name="ing_${idx}_id"]`);
                if (hiddenInput) hiddenInput.value = id;
                
                // Set the search box value
                const searchInput = dropdown.parentElement.querySelector('.filling-ing-search');
                if (searchInput) searchInput.value = name;
                
                // Hide dropdown
                dropdown.style.display = 'none';
                
                // Update calculation
                this.updateCalculation();
            };
        });
    },
    
    addIngredientRow() {
        const list = document.getElementById('fillingIngredientsList');
        const idx = list.children.length;
        list.insertAdjacentHTML('beforeend', this.getIngredientRow({}, idx));
        this.updateCalculation();
    },
    
    setupCalculation() {
        const servingInput = document.getElementById('fillingServingAmount');
        if (servingInput) {
            servingInput.addEventListener('input', () => this.updateCalculation());
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ingredient-select-wrapper')) {
                document.querySelectorAll('.ingredient-dropdown').forEach(dd => {
                    dd.style.display = 'none';
                });
            }
        });
        
        // Initial calculation
        setTimeout(() => this.updateCalculation(), 100);
    },
    
    updateCalculation() {
        let totalWeight = 0;
        let totalCost = 0;
        
        // Sum all ingredients and update row costs
        document.querySelectorAll('#fillingIngredientsList .ingredient-row').forEach(row => {
            const hiddenInput = row.querySelector('.filling-ing-select');
            const amountInput = row.querySelector('.filling-ing-amount');
            const costDisplay = row.querySelector('.ingredient-row-cost');
            
            const ingredientId = hiddenInput?.value;
            const amount = parseFloat(amountInput?.value) || 0;
            
            // Calculate and display row cost
            let rowCost = 0;
            if (ingredientId && amount > 0) {
                totalWeight += amount;
                
                // Get cost per gram for this ingredient
                const costPerGram = Ingredients.getCostPerGram(ingredientId);
                rowCost = costPerGram * amount;
                totalCost += rowCost;
            }
            
            // Update the row cost display
            if (costDisplay) {
                costDisplay.textContent = Utils.formatCurrency(rowCost);
            }
        });
        
        const servingAmount = parseFloat(document.getElementById('fillingServingAmount')?.value) || 8;
        const piecesCount = servingAmount > 0 ? Math.floor(totalWeight / servingAmount) : 0;
        const costPerPiece = piecesCount > 0 ? totalCost / piecesCount : 0;
        
        // Update display
        document.getElementById('fillingTotalWeight').textContent = totalWeight >= 1000 
            ? `${(totalWeight / 1000).toFixed(2)}kg` 
            : `${totalWeight}g`;
        document.getElementById('fillingTotalCost').textContent = Utils.formatCurrency(totalCost);
        document.getElementById('fillingPiecesCount').textContent = `${piecesCount} pcs`;
        document.getElementById('fillingCostPerPiece').textContent = Utils.formatCurrency(costPerPiece);
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
        
        // Extract ingredients first to calculate batch size
        const ingredients = [];
        let idx = 0;
        let totalWeight = 0;
        while (document.querySelector(`[name="ing_${idx}_id"]`)) {
            const ingId = document.querySelector(`[name="ing_${idx}_id"]`)?.value;
            const amount = parseFloat(document.querySelector(`[name="ing_${idx}_amount"]`)?.value) || 0;
            const unit = document.querySelector(`[name="ing_${idx}_unit"]`)?.value || 'g';
            if (ingId && amount > 0) {
                ingredients.push({
                    ingredientId: ingId,
                    amount: amount,
                    unit: unit
                });
                totalWeight += amount;
            }
            idx++;
        }
        
        const data = {
            name: formData.get('name'),
            batchSize: totalWeight, // Calculated from sum of ingredients
            version: '1.0',
            preparation: {
                method: formData.get('prepMethod') || 'mixing',
                duration: parseFloat(formData.get('prepDuration')) || 15,
                storageTemp: parseFloat(formData.get('storageTemp')) || 25,
                shelfLife: parseFloat(formData.get('shelfLife')) || 48
            },
            standardServing: {
                amount: parseFloat(formData.get('servingAmount')) || 8
            },
            notes: formData.get('notes') || '',
            ingredients: ingredients
        };
        
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
