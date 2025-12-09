/**
 * BreadHub ProofMaster - Products Management
 * Handles product assembly combining dough + toppings + fillings
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
            return `
            <div class="recipe-card" data-id="${product.id}">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, #8E44AD 0%, #9B59B6 100%);">
                    <h3>${product.name}</h3>
                    <span class="version">${this.formatCategory(product.category)}</span>
                </div>
                <div class="recipe-card-body">
                    <div class="recipe-stat">
                        <span>Dough:</span>
                        <span>${product.portioning?.doughWeight || '-'}g</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Filling:</span>
                        <span>${product.portioning?.fillingWeight || 0}g</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Topping:</span>
                        <span>${product.portioning?.toppingWeight || 0}g</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Production Cost:</span>
                        <span>${Utils.formatCurrency(cost.total)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Retail Price:</span>
                        <span>${Utils.formatCurrency(product.pricing?.retailPrice || 0)}</span>
                    </div>
                    <div class="recipe-stat">
                        <span>Margin:</span>
                        <span style="color: ${cost.margin >= 30 ? 'var(--success)' : 'var(--warning)'}">
                            ${cost.margin.toFixed(1)}%
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
            width: '800px',
            onSave: () => this.save()
        });
    },
    
    async edit(id) {
        const product = this.data.find(p => p.id === id);
        if (!product) return;
        
        Modal.open({
            title: 'Edit Product',
            content: this.getFormHTML(product),
            saveText: 'Update Product',
            width: '800px',
            onSave: () => this.save(id)
        });
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
                               value="${product.name || ''}" required>
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
                        <select name="doughRecipeId" class="form-select" required>
                            <option value="">Select dough...</option>
                            ${doughOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Filling Recipe</label>
                        <select name="fillingRecipeId" class="form-select">
                            <option value="">None</option>
                            ${fillingOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Topping Recipe</label>
                        <select name="toppingRecipeId" class="form-select">
                            <option value="">None</option>
                            ${toppingOptions}
                        </select>
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Portioning (per piece)</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                    <div class="form-group">
                        <label>Dough (g) *</label>
                        <input type="number" name="doughWeight" class="form-input" 
                               value="${product.portioning?.doughWeight || 40}" required>
                    </div>
                    <div class="form-group">
                        <label>Filling (g)</label>
                        <input type="number" name="fillingWeight" class="form-input" 
                               value="${product.portioning?.fillingWeight || 0}">
                    </div>
                    <div class="form-group">
                        <label>Topping (g)</label>
                        <input type="number" name="toppingWeight" class="form-input" 
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
                
                <h4 style="margin: 16px 0 8px;">Pricing</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                    <div class="form-group">
                        <label>Packaging Cost (₱)</label>
                        <input type="number" name="packagingCost" class="form-input" step="0.01"
                               value="${product.costs?.packaging || 0.50}">
                    </div>
                    <div class="form-group">
                        <label>Wholesale Price (₱)</label>
                        <input type="number" name="wholesalePrice" class="form-input" step="0.01"
                               value="${product.pricing?.wholesalePrice || 0}">
                    </div>
                    <div class="form-group">
                        <label>Retail Price (₱) *</label>
                        <input type="number" name="retailPrice" class="form-input" step="0.01"
                               value="${product.pricing?.retailPrice || 0}" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea">${product.notes || ''}</textarea>
                </div>
            </form>
        `;
    },

    getViewHTML(product) {
        const cost = this.calculateProductCost(product);
        const dough = Doughs.getById(product.doughRecipeId);
        const filling = product.fillingRecipeId ? Fillings.getById(product.fillingRecipeId) : null;
        const topping = product.toppingRecipeId ? Toppings.getById(product.toppingRecipeId) : null;
        
        return `
            <div style="padding: 16px 0;">
                <div class="recipe-stat">
                    <span>Category:</span>
                    <span>${this.formatCategory(product.category)}</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Recipe Components</h4>
                <div class="recipe-stat">
                    <span>Dough:</span>
                    <span>${dough?.name || 'Unknown'}</span>
                </div>
                <div class="recipe-stat">
                    <span>Filling:</span>
                    <span>${filling?.name || 'None'}</span>
                </div>
                <div class="recipe-stat">
                    <span>Topping:</span>
                    <span>${topping?.name || 'None'}</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Portioning (per piece)</h4>
                <div class="recipe-stat">
                    <span>Dough:</span>
                    <span>${product.portioning?.doughWeight || '-'}g</span>
                </div>
                <div class="recipe-stat">
                    <span>Filling:</span>
                    <span>${product.portioning?.fillingWeight || 0}g</span>
                </div>
                <div class="recipe-stat">
                    <span>Topping:</span>
                    <span>${product.portioning?.toppingWeight || 0}g</span>
                </div>
                <div class="recipe-stat">
                    <span>Final Weight:</span>
                    <span>${product.portioning?.finalWeight || '-'}g</span>
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
                <div class="recipe-stat">
                    <span>Rotate at:</span>
                    <span>${product.baking?.rotateAt || '-'} min</span>
                </div>
                
                <h4 style="margin: 16px 0 8px; color: var(--primary);">Cost Breakdown</h4>
                <div class="recipe-stat">
                    <span>Dough (${product.portioning?.doughWeight || 0}g):</span>
                    <span>${Utils.formatCurrency(cost.dough)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Filling (${product.portioning?.fillingWeight || 0}g):</span>
                    <span>${Utils.formatCurrency(cost.filling)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Topping (${product.portioning?.toppingWeight || 0}g):</span>
                    <span>${Utils.formatCurrency(cost.topping)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Materials Subtotal:</span>
                    <span>${Utils.formatCurrency(cost.materials)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Packaging:</span>
                    <span>${Utils.formatCurrency(cost.packaging)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Labor (est.):</span>
                    <span>${Utils.formatCurrency(cost.labor)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Overhead:</span>
                    <span>${Utils.formatCurrency(cost.overhead)}</span>
                </div>
                <div class="recipe-stat" style="font-weight: bold; border-top: 2px solid var(--primary-light); padding-top: 8px;">
                    <span>TOTAL COST:</span>
                    <span>${Utils.formatCurrency(cost.total)}</span>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Pricing & Margins</h4>
                <div class="recipe-stat">
                    <span>Wholesale Price:</span>
                    <span>${Utils.formatCurrency(product.pricing?.wholesalePrice || 0)}</span>
                </div>
                <div class="recipe-stat">
                    <span>Retail Price:</span>
                    <span>${Utils.formatCurrency(product.pricing?.retailPrice || 0)}</span>
                </div>
                <div class="recipe-stat" style="font-weight: bold;">
                    <span>Retail Margin:</span>
                    <span style="color: ${cost.margin >= 30 ? 'var(--success)' : 'var(--warning)'}">
                        ${cost.margin.toFixed(1)}%
                    </span>
                </div>
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
        
        const materials = doughCost + fillingCost + toppingCost;
        const packaging = product.costs?.packaging || 0.50;
        const labor = (CONFIG.defaults.laborCostPerHour / 60) * 2; // ~2 min per piece
        const overhead = CONFIG.defaults.overheadPerPiece;
        
        const total = materials + packaging + labor + overhead;
        const retailPrice = product.pricing?.retailPrice || 0;
        const margin = retailPrice > 0 ? ((retailPrice - total) / retailPrice) * 100 : 0;
        
        return {
            dough: doughCost,
            filling: fillingCost,
            topping: toppingCost,
            materials,
            packaging,
            labor,
            overhead,
            total,
            margin
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
                packaging: parseFloat(formData.get('packagingCost')) || 0.50
            },
            pricing: {
                wholesalePrice: parseFloat(formData.get('wholesalePrice')) || 0,
                retailPrice: parseFloat(formData.get('retailPrice')) || 0
            },
            notes: formData.get('notes') || ''
        };
        
        if (!data.name || !data.doughRecipeId) {
            Toast.error('Please fill all required fields');
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
