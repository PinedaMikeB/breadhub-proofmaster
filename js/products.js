/**
 * BreadHub ProofMaster - Products Management
 * Handles product assembly combining dough + toppings + fillings
 * With full cost breakdown and SRP calculation
 */

const Products = {
    data: [],
    categories: ['sweet-bread', 'savory-bread', 'pastry', 'roll', 'other'],
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('products');
            this.data.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error loading products:', error);
            Toast.error('Failed to load products');
        }
    },
    
    render() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;
        
        if (this.data.length === 0) {
            grid.innerHTML = `
                <p class="empty-state">
                    No products yet. Click "New Product" to create one.
                </p>
            `;
            return;
        }
        
        grid.innerHTML = this.data.map(product => {
            const cost = this.calculateProductCost(product);
            const marginPercent = product.finalSRP > 0 
                ? ((product.finalSRP - cost.totalCost) / product.finalSRP * 100) 
                : 0;
            
            return `
            <div class="recipe-card" data-id="${product.id}">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, #8E44AD 0%, #9B59B6 100%);">
                    <h3>${product.name}</h3>
                    <span class="version">${this.formatCategory(product.category)}</span>
                </div>
                <div class="recipe-card-body">
                    <div class="recipe-stat">
                        <span>Total Cost:</span>
                        <span><strong>${Utils.formatCurrency(cost.totalCost)}</strong></span>
                    </div>
                    <div class="recipe-stat">
                        <span>Suggested SRP:</span>
                        <span>${Utils.formatCurrency(cost.suggestedSRP)}</span>
                    </div>
                    <div class="recipe-stat" style="background: var(--bg-input); padding: 8px; border-radius: 6px; margin: 4px 0;">
                        <span><strong>Final SRP (Loyverse):</strong></span>
                        <span style="color: var(--primary); font-size: 1.2rem;"><strong>${Utils.formatCurrency(product.finalSRP || 0)}</strong></span>
                    </div>
                    <div class="recipe-stat">
                        <span>Actual Margin:</span>
                        <span style="color: ${marginPercent >= 30 ? 'var(--success)' : marginPercent >= 20 ? 'var(--warning)' : 'var(--danger)'}">
                            <strong>${marginPercent.toFixed(1)}%</strong>
                        </span>
                    </div>
                </div>
                <div class="recipe-card-actions">
                    <button class="btn btn-secondary" onclick="Products.view('${product.id}')">View</button>
                    <button class="btn btn-secondary" onclick="Products.edit('${product.id}')">Edit</button>
                    <button class="btn btn-danger" onclick="Products.delete('${product.id}')">Delete</button>
                </div>
            </div>
        `}).join('');
    },
    
    formatCategory(cat) {
        if (!cat) return '-';
        return cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },

    showAddModal() {
        Modal.open({
            title: 'New Product',
            content: this.getFormHTML(),
            saveText: 'Create Product',
            width: '850px',
            onSave: () => this.save()
        });
        this.setupCostCalculation();
    },
    
    async edit(id) {
        const product = this.data.find(p => p.id === id);
        if (!product) return;
        
        Modal.open({
            title: 'Edit Product',
            content: this.getFormHTML(product),
            saveText: 'Update Product',
            width: '850px',
            onSave: () => this.save(id)
        });
        this.setupCostCalculation();
    },
    
    async view(id) {
        const product = this.data.find(p => p.id === id);
        if (!product) return;
        
        Modal.open({
            title: product.name,
            content: this.getViewHTML(product),
            showFooter: false,
            width: '800px'
        });
    },
    
    getFormHTML(product = {}) {
        const doughOptions = Doughs.data.map(d => 
            `<option value="${d.id}" ${product.doughRecipeId === d.id ? 'selected' : ''}>${d.name}</option>`
        ).join('');
        
        const fillingOptions = Fillings.data.map(f => 
            `<option value="${f.id}" ${product.fillingRecipeId === f.id ? 'selected' : ''}>${f.name}</option>`
        ).join('');
        
        const toppingOptions = Toppings.data.map(t => 
            `<option value="${t.id}" ${product.toppingRecipeId === t.id ? 'selected' : ''}>${t.name}</option>`
        ).join('');
        
        return `
            <form id="productForm">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Product Name *</label>
                        <input type="text" name="name" class="form-input" 
                               value="${product.name || ''}" required
                               placeholder="e.g., Pandecoco">
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select name="category" class="form-select">
                            ${this.categories.map(cat => 
                                `<option value="${cat}" ${product.category === cat ? 'selected' : ''}>${this.formatCategory(cat)}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Recipe Components</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Dough Recipe *</label>
                        <select name="doughRecipeId" id="doughRecipeId" class="form-select" required>
                            <option value="">Select dough...</option>
                            ${doughOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Filling Recipe</label>
                        <select name="fillingRecipeId" id="fillingRecipeId" class="form-select">
                            <option value="">None</option>
                            ${fillingOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Topping Recipe</label>
                        <select name="toppingRecipeId" id="toppingRecipeId" class="form-select">
                            <option value="">None</option>
                            ${toppingOptions}
                        </select>
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Portioning (per piece in grams)</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                    <div class="form-group">
                        <label>Dough (g) *</label>
                        <input type="number" name="doughWeight" id="doughWeight" class="form-input" 
                               value="${product.portioning?.doughWeight || 40}" required>
                    </div>
                    <div class="form-group">
                        <label>Filling (g)</label>
                        <input type="number" name="fillingWeight" id="fillingWeight" class="form-input" 
                               value="${product.portioning?.fillingWeight || 0}">
                    </div>
                    <div class="form-group">
                        <label>Topping (g)</label>
                        <input type="number" name="toppingWeight" id="toppingWeight" class="form-input" 
                               value="${product.portioning?.toppingWeight || 0}">
                    </div>
                    <div class="form-group">
                        <label>Final Weight (g)</label>
                        <input type="number" name="finalWeight" class="form-input" 
                               value="${product.portioning?.finalWeight || 38}" 
                               placeholder="After baking">
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Second Proof (after shaping)</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                    <div class="form-group">
                        <label>Duration (min)</label>
                        <input type="number" name="proofDuration" class="form-input" 
                               value="${product.secondProof?.duration || 45}">
                    </div>
                    <div class="form-group">
                        <label>Temperature (°C)</label>
                        <input type="number" name="proofTemp" class="form-input" 
                               value="${product.secondProof?.temperature || 32}">
                    </div>
                    <div class="form-group">
                        <label>Humidity (%)</label>
                        <input type="number" name="proofHumidity" class="form-input" 
                               value="${product.secondProof?.humidity || 80}">
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Baking</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                    <div class="form-group">
                        <label>Oven Top (°C)</label>
                        <input type="number" name="ovenTempTop" class="form-input" 
                               value="${product.baking?.ovenTempTop || 180}">
                    </div>
                    <div class="form-group">
                        <label>Oven Bottom (°C)</label>
                        <input type="number" name="ovenTempBottom" class="form-input" 
                               value="${product.baking?.ovenTempBottom || 180}">
                    </div>
                    <div class="form-group">
                        <label>Duration (min)</label>
                        <input type="number" name="bakeDuration" class="form-input" 
                               value="${product.baking?.duration || 18}">
                    </div>
                    <div class="form-group">
                        <label>Rotate at (min)</label>
                        <input type="number" name="rotateAt" class="form-input" 
                               value="${product.baking?.rotateAt || 9}">
                    </div>
                </div>
                
                <!-- COST & PRICING SECTION -->
                <div style="background: linear-gradient(135deg, #F8F4E8 0%, #FDF9F0 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border: 2px solid var(--primary-light);">
                    <h4 style="margin: 0 0 16px; color: var(--primary);">💰 Cost & Pricing Calculator</h4>
                    
                    <!-- Cost Inputs -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Packaging Cost (₱)</label>
                            <input type="number" name="packagingCost" id="packagingCost" class="form-input" step="0.01"
                                   value="${product.costs?.packaging || 0.50}">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Labor Cost (₱)</label>
                            <input type="number" name="laborCost" id="laborCost" class="form-input" step="0.01"
                                   value="${product.costs?.labor || 1.00}"
                                   placeholder="Per piece">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Markup (%)</label>
                            <input type="number" name="markupPercent" id="markupPercent" class="form-input" step="1"
                                   value="${product.pricing?.markupPercent || 40}"
                                   placeholder="e.g., 40">
                        </div>
                    </div>
                    
                    <!-- Cost Breakdown Display -->
                    <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                            <div class="recipe-stat">
                                <span>🥖 Dough Cost:</span>
                                <span id="displayDoughCost">₱0.00</span>
                            </div>
                            <div class="recipe-stat">
                                <span>🥥 Filling Cost:</span>
                                <span id="displayFillingCost">₱0.00</span>
                            </div>
                            <div class="recipe-stat">
                                <span>🧈 Topping Cost:</span>
                                <span id="displayToppingCost">₱0.00</span>
                            </div>
                            <div class="recipe-stat">
                                <span>📦 Packaging:</span>
                                <span id="displayPackagingCost">₱0.00</span>
                            </div>
                            <div class="recipe-stat">
                                <span>👷 Labor Cost:</span>
                                <span id="displayLaborCost">₱0.00</span>
                            </div>
                            <div class="recipe-stat" style="background: var(--bg-input); padding: 8px; border-radius: 4px;">
                                <span><strong>📊 TOTAL COST:</strong></span>
                                <span id="displayTotalCost" style="font-weight: bold; color: var(--danger);">₱0.00</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- SRP Section -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="background: #E8F5E9; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;">
                                Suggested SRP (Cost + ${product.pricing?.markupPercent || 40}% Markup)
                            </div>
                            <div id="displaySuggestedSRP" style="font-size: 1.8rem; font-weight: bold; color: var(--success);">
                                ₱0.00
                            </div>
                        </div>
                        <div style="background: var(--primary-light); padding: 16px; border-radius: 8px;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="color: var(--primary-dark); font-weight: bold;">
                                    💵 Final SRP (for Loyverse) *
                                </label>
                                <input type="number" name="finalSRP" id="finalSRP" class="form-input" step="0.50"
                                       value="${product.finalSRP || ''}" required
                                       placeholder="Your actual selling price"
                                       style="font-size: 1.3rem; font-weight: bold; text-align: center;">
                            </div>
                            <div style="text-align: center; margin-top: 8px;">
                                <span style="font-size: 0.85rem; color: var(--text-secondary);">Actual Margin: </span>
                                <span id="displayActualMargin" style="font-weight: bold;">0%</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea" placeholder="Production notes, tips, etc.">${product.notes || ''}</textarea>
                </div>
            </form>
        `;
    },

    setupCostCalculation() {
        const updateCosts = () => {
            // Get values
            const doughId = document.getElementById('doughRecipeId')?.value;
            const fillingId = document.getElementById('fillingRecipeId')?.value;
            const toppingId = document.getElementById('toppingRecipeId')?.value;
            
            const doughWeight = parseFloat(document.getElementById('doughWeight')?.value) || 0;
            const fillingWeight = parseFloat(document.getElementById('fillingWeight')?.value) || 0;
            const toppingWeight = parseFloat(document.getElementById('toppingWeight')?.value) || 0;
            
            const packagingCost = parseFloat(document.getElementById('packagingCost')?.value) || 0;
            const laborCost = parseFloat(document.getElementById('laborCost')?.value) || 0;
            const markupPercent = parseFloat(document.getElementById('markupPercent')?.value) || 40;
            const finalSRP = parseFloat(document.getElementById('finalSRP')?.value) || 0;
            
            // Calculate component costs
            const dough = Doughs.getById(doughId);
            const filling = Fillings.getById(fillingId);
            const topping = Toppings.getById(toppingId);
            
            const doughCost = dough ? (dough.costPerGram || 0) * doughWeight : 0;
            const fillingCost = filling ? (filling.costPerGram || 0) * fillingWeight : 0;
            const toppingCost = topping ? (topping.costPerGram || 0) * toppingWeight : 0;
            
            const totalCost = doughCost + fillingCost + toppingCost + packagingCost + laborCost;
            const suggestedSRP = totalCost * (1 + markupPercent / 100);
            const actualMargin = finalSRP > 0 ? ((finalSRP - totalCost) / finalSRP * 100) : 0;
            
            // Update displays
            document.getElementById('displayDoughCost').textContent = Utils.formatCurrency(doughCost);
            document.getElementById('displayFillingCost').textContent = Utils.formatCurrency(fillingCost);
            document.getElementById('displayToppingCost').textContent = Utils.formatCurrency(toppingCost);
            document.getElementById('displayPackagingCost').textContent = Utils.formatCurrency(packagingCost);
            document.getElementById('displayLaborCost').textContent = Utils.formatCurrency(laborCost);
            document.getElementById('displayTotalCost').textContent = Utils.formatCurrency(totalCost);
            document.getElementById('displaySuggestedSRP').textContent = Utils.formatCurrency(suggestedSRP);
            
            const marginDisplay = document.getElementById('displayActualMargin');
            marginDisplay.textContent = actualMargin.toFixed(1) + '%';
            marginDisplay.style.color = actualMargin >= 30 ? 'var(--success)' : actualMargin >= 20 ? 'var(--warning)' : 'var(--danger)';
        };
        
        // Add event listeners to all relevant inputs
        const inputs = ['doughRecipeId', 'fillingRecipeId', 'toppingRecipeId', 
                       'doughWeight', 'fillingWeight', 'toppingWeight',
                       'packagingCost', 'laborCost', 'markupPercent', 'finalSRP'];
        
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', updateCosts);
                el.addEventListener('change', updateCosts);
            }
        });
        
        // Initial calculation
        setTimeout(updateCosts, 100);
    },
    
    getViewHTML(product) {
        const cost = this.calculateProductCost(product);
        const dough = Doughs.getById(product.doughRecipeId);
        const filling = product.fillingRecipeId ? Fillings.getById(product.fillingRecipeId) : null;
        const topping = product.toppingRecipeId ? Toppings.getById(product.toppingRecipeId) : null;
        const actualMargin = product.finalSRP > 0 ? ((product.finalSRP - cost.totalCost) / product.finalSRP * 100) : 0;
        
        return `
            <div style="padding: 16px 0;">
                <div class="recipe-stat">
                    <span>Category:</span>
                    <span>${this.formatCategory(product.category)}</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Recipe Components</h4>
                <div class="recipe-stat">
                    <span>Dough:</span>
                    <span>${dough?.name || 'Unknown'} (${product.portioning?.doughWeight || 0}g)</span>
                </div>
                <div class="recipe-stat">
                    <span>Filling:</span>
                    <span>${filling?.name || 'None'} ${filling ? `(${product.portioning?.fillingWeight || 0}g)` : ''}</span>
                </div>
                <div class="recipe-stat">
                    <span>Topping:</span>
                    <span>${topping?.name || 'None'} ${topping ? `(${product.portioning?.toppingWeight || 0}g)` : ''}</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Process</h4>
                <div class="recipe-stat">
                    <span>Second Proof:</span>
                    <span>${product.secondProof?.duration || '-'} min @ ${product.secondProof?.temperature || '-'}°C</span>
                </div>
                <div class="recipe-stat">
                    <span>Baking:</span>
                    <span>${product.baking?.duration || '-'} min @ ${product.baking?.ovenTempTop || '-'}°C / ${product.baking?.ovenTempBottom || '-'}°C</span>
                </div>
                
                <!-- Cost Breakdown -->
                <div style="background: linear-gradient(135deg, #F8F4E8 0%, #FDF9F0 100%); padding: 16px; border-radius: 12px; margin: 16px 0; border: 2px solid var(--primary-light);">
                    <h4 style="margin: 0 0 12px; color: var(--primary);">💰 Cost Breakdown (per piece)</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div class="recipe-stat">
                            <span>🥖 Dough (${product.portioning?.doughWeight || 0}g):</span>
                            <span>${Utils.formatCurrency(cost.doughCost)}</span>
                        </div>
                        <div class="recipe-stat">
                            <span>🥥 Filling (${product.portioning?.fillingWeight || 0}g):</span>
                            <span>${Utils.formatCurrency(cost.fillingCost)}</span>
                        </div>
                        <div class="recipe-stat">
                            <span>🧈 Topping (${product.portioning?.toppingWeight || 0}g):</span>
                            <span>${Utils.formatCurrency(cost.toppingCost)}</span>
                        </div>
                        <div class="recipe-stat">
                            <span>📦 Packaging:</span>
                            <span>${Utils.formatCurrency(cost.packagingCost)}</span>
                        </div>
                        <div class="recipe-stat">
                            <span>👷 Labor:</span>
                            <span>${Utils.formatCurrency(cost.laborCost)}</span>
                        </div>
                    </div>
                    
                    <div style="border-top: 2px dashed var(--primary-light); margin: 12px 0; padding-top: 12px;">
                        <div class="recipe-stat" style="font-size: 1.1rem;">
                            <span><strong>📊 TOTAL COST:</strong></span>
                            <span style="color: var(--danger);"><strong>${Utils.formatCurrency(cost.totalCost)}</strong></span>
                        </div>
                    </div>
                </div>
                
                <!-- Pricing Section -->
                <div style="background: white; padding: 16px; border-radius: 12px; border: 2px solid var(--success);">
                    <h4 style="margin: 0 0 12px; color: var(--success);">💵 Pricing</h4>
                    
                    <div class="recipe-stat">
                        <span>Markup:</span>
                        <span>${product.pricing?.markupPercent || 0}%</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Suggested SRP:</span>
                        <span>${Utils.formatCurrency(cost.suggestedSRP)}</span>
                    </div>
                    <div class="recipe-stat" style="font-size: 1.2rem; background: var(--primary-light); padding: 12px; border-radius: 8px; margin-top: 8px;">
                        <span><strong>Final SRP (Loyverse):</strong></span>
                        <span style="color: var(--primary-dark);"><strong>${Utils.formatCurrency(product.finalSRP || 0)}</strong></span>
                    </div>
                    <div class="recipe-stat" style="margin-top: 8px;">
                        <span>Actual Profit Margin:</span>
                        <span style="color: ${actualMargin >= 30 ? 'var(--success)' : actualMargin >= 20 ? 'var(--warning)' : 'var(--danger)'}; font-weight: bold; font-size: 1.2rem;">
                            ${actualMargin.toFixed(1)}%
                        </span>
                    </div>
                    <div class="recipe-stat">
                        <span>Profit per piece:</span>
                        <span style="color: var(--success); font-weight: bold;">
                            ${Utils.formatCurrency((product.finalSRP || 0) - cost.totalCost)}
                        </span>
                    </div>
                </div>
                
                ${product.notes ? `
                    <div style="margin-top: 16px; padding: 12px; background: var(--bg-input); border-radius: 8px;">
                        <strong>Notes:</strong><br>
                        ${product.notes}
                    </div>
                ` : ''}
            </div>
        `;
    },

    calculateProductCost(product) {
        const dough = Doughs.getById(product.doughRecipeId);
        const filling = product.fillingRecipeId ? Fillings.getById(product.fillingRecipeId) : null;
        const topping = product.toppingRecipeId ? Toppings.getById(product.toppingRecipeId) : null;
        
        const doughWeight = product.portioning?.doughWeight || 0;
        const fillingWeight = product.portioning?.fillingWeight || 0;
        const toppingWeight = product.portioning?.toppingWeight || 0;
        
        const doughCost = dough ? (dough.costPerGram || 0) * doughWeight : 0;
        const fillingCost = filling ? (filling.costPerGram || 0) * fillingWeight : 0;
        const toppingCost = topping ? (topping.costPerGram || 0) * toppingWeight : 0;
        
        const packagingCost = product.costs?.packaging || 0;
        const laborCost = product.costs?.labor || 0;
        
        const totalCost = doughCost + fillingCost + toppingCost + packagingCost + laborCost;
        
        const markupPercent = product.pricing?.markupPercent || 40;
        const suggestedSRP = totalCost * (1 + markupPercent / 100);
        
        return {
            doughCost,
            fillingCost,
            toppingCost,
            packagingCost,
            laborCost,
            totalCost,
            markupPercent,
            suggestedSRP
        };
    },
    
    async save(id = null) {
        const form = document.getElementById('productForm');
        const formData = new FormData(form);
        
        const data = {
            name: formData.get('name'),
            category: formData.get('category'),
            doughRecipeId: formData.get('doughRecipeId'),
            fillingRecipeId: formData.get('fillingRecipeId') || null,
            toppingRecipeId: formData.get('toppingRecipeId') || null,
            portioning: {
                doughWeight: parseFloat(formData.get('doughWeight')) || 40,
                fillingWeight: parseFloat(formData.get('fillingWeight')) || 0,
                toppingWeight: parseFloat(formData.get('toppingWeight')) || 0,
                finalWeight: parseFloat(formData.get('finalWeight')) || 38
            },
            secondProof: {
                duration: parseFloat(formData.get('proofDuration')) || 45,
                temperature: parseFloat(formData.get('proofTemp')) || 32,
                humidity: parseFloat(formData.get('proofHumidity')) || 80
            },
            baking: {
                ovenTempTop: parseFloat(formData.get('ovenTempTop')) || 180,
                ovenTempBottom: parseFloat(formData.get('ovenTempBottom')) || 180,
                duration: parseFloat(formData.get('bakeDuration')) || 18,
                rotateAt: parseFloat(formData.get('rotateAt')) || 9
            },
            costs: {
                packaging: parseFloat(formData.get('packagingCost')) || 0,
                labor: parseFloat(formData.get('laborCost')) || 0
            },
            pricing: {
                markupPercent: parseFloat(formData.get('markupPercent')) || 40
            },
            finalSRP: parseFloat(formData.get('finalSRP')) || 0,
            notes: formData.get('notes') || ''
        };
        
        if (!data.name || !data.doughRecipeId) {
            Toast.error('Please fill product name and select a dough recipe');
            return;
        }
        
        if (!data.finalSRP || data.finalSRP <= 0) {
            Toast.error('Please enter the Final SRP (selling price for Loyverse)');
            return;
        }
        
        try {
            if (id) {
                await DB.update('products', id, data);
                Toast.success('Product updated');
            } else {
                await DB.add('products', data);
                Toast.success('Product created');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving product:', error);
            Toast.error('Failed to save product');
        }
    },
    
    async delete(id) {
        if (!confirm('Delete this product?')) return;
        
        try {
            await DB.delete('products', id);
            Toast.success('Product deleted');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting product:', error);
            Toast.error('Failed to delete product');
        }
    },
    
    getById(id) {
        return this.data.find(p => p.id === id);
    }
};
