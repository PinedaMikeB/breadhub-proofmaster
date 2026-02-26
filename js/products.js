/**
 * BreadHub ProofMaster - Products Management
 * Handles product assembly combining dough + multiple toppings + multiple fillings
 * With full cost breakdown and SRP calculation
 * 
 * ✅ UNIFIED SCHEMA - Single 'products' collection
 * - Recipe data (dough, fillings, toppings, costs)
 * - Shop data (images, description, published status)
 * - Single source of truth for pricing
 * - Main category (bread/drinks) + subcategory for analytics
 */

const Products = {
    data: [],
    categories: [],
    
    // Main categories for analytics
    mainCategories: [
        { value: 'bread', label: 'Bread & Pastries', emoji: '🍞' },
        { value: 'drinks', label: 'Drinks & Beverages', emoji: '🥤' }
    ],
    
    // Subcategories with their parent main category
    defaultCategories: [
        // BREAD subcategories
        { value: 'donut', label: 'Donuts', emoji: '🍩', mainCategory: 'bread' },
        { value: 'savory', label: 'Savory', emoji: '🥐', mainCategory: 'bread' },
        { value: 'loaf', label: 'Loaf Breads', emoji: '🍞', mainCategory: 'bread' },
        { value: 'cookies', label: 'Cookies', emoji: '🍪', mainCategory: 'bread' },
        { value: 'cinnamon-rolls', label: 'Cinnamon Rolls', emoji: '🥮', mainCategory: 'bread' },
        { value: 'classic-filipino', label: 'Classic Filipino', emoji: '🥖', mainCategory: 'bread' },
        { value: 'roti', label: 'Roti', emoji: '🫓', mainCategory: 'bread' },
        { value: 'cakes', label: 'Cakes', emoji: '🎂', mainCategory: 'bread' },
        { value: 'pandesal', label: 'Pandesal', emoji: '🥯', mainCategory: 'bread' },
        { value: 'desserts', label: 'Desserts', emoji: '🧁', mainCategory: 'bread' },
        // DRINKS subcategories
        { value: 'drinks', label: 'Drinks', emoji: '🥤', mainCategory: 'drinks' },
        { value: 'coffee', label: 'Coffee', emoji: '☕', mainCategory: 'drinks' },
        { value: 'non-coffee', label: 'Non-Coffee Drinks', emoji: '🧃', mainCategory: 'drinks' }
    ],
    
    // Get main category from subcategory
    getMainCategory(subcategory) {
        const cat = this.defaultCategories.find(c => c.value === subcategory);
        return cat?.mainCategory || 'bread';
    },
    
    // Called when category dropdown changes - auto-update main category
    onCategoryChange() {
        const categorySelect = document.getElementById('categorySelect');
        const mainCategoryInput = document.getElementById('mainCategoryInput');
        const badge = document.getElementById('mainCategoryBadge');
        
        if (!categorySelect) return;
        
        const selectedCategory = categorySelect.value;
        const mainCat = this.getMainCategory(selectedCategory);
        
        // Update hidden input
        if (mainCategoryInput) {
            mainCategoryInput.value = mainCat;
        }
        
        // Update badge
        if (badge) {
            badge.innerHTML = `
                <span style="display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; background: ${mainCat === 'bread' ? '#FFF3E0' : '#E3F2FD'}; color: ${mainCat === 'bread' ? '#E65100' : '#1565C0'};">
                    ${mainCat === 'bread' ? '🍞 Bread & Pastries' : '🥤 Drinks & Beverages'}
                </span>
            `;
        }
        
        const isDrinks = mainCat === 'drinks';
        
        // Hide/show bread-only sections
        const baseBreadSection = document.getElementById('baseBreadSection');
        if (baseBreadSection) {
            baseBreadSection.style.display = isDrinks ? 'none' : 'block';
        }
        
        // For drinks: auto-enable variants and hide single recipe mode
        const variantsCheckbox = document.getElementById('hasVariantsCheckbox');
        const variantsToggle = document.getElementById('variantsToggleSection');
        
        if (isDrinks) {
            // Auto-enable variants for drinks (drinks always need sizes)
            if (variantsCheckbox && !variantsCheckbox.checked) {
                variantsCheckbox.checked = true;
                this.toggleVariantMode();
            }
            // Hide variants toggle (always on for drinks)
            if (variantsToggle) variantsToggle.style.display = 'none';
        } else {
            // Show variants toggle for bread
            if (variantsToggle) variantsToggle.style.display = 'block';
        }
        
        // Rebuild existing variant sections to match new category
        this.rebuildVariantsForCategory(mainCat);
    },
    
    // Rebuild all variant sections when category changes (bread <-> drinks)
    rebuildVariantsForCategory(mainCategory) {
        const variantsList = document.getElementById('variantsList');
        if (!variantsList) return;
        
        const existingSections = variantsList.querySelectorAll('.variant-section');
        if (existingSections.length === 0) return;
        
        // Collect current variant data before rebuilding
        const currentVariants = [];
        existingSections.forEach(section => {
            const idx = section.dataset.idx;
            const name = document.querySelector(`[name="variant_${idx}_name"]`)?.value || '';
            const size = document.querySelector(`[name="variant_${idx}_size"]`)?.value || '';
            const price = document.querySelector(`[name="variant_${idx}_price"]`)?.value || '';
            const packagingCost = document.querySelector(`[name="variant_${idx}_packagingCost"]`)?.value || '';
            const laborCost = document.querySelector(`[name="variant_${idx}_laborCost"]`)?.value || '';
            const markupPercent = document.querySelector(`[name="variant_${idx}_markupPercent"]`)?.value || '';
            currentVariants.push({ name, size, price, recipe: { packagingCost: parseFloat(packagingCost) || 0, laborCost: parseFloat(laborCost) || 0, markupPercent: parseFloat(markupPercent) || 40 } });
        });
        
        // Rebuild with correct category template
        this.variantCounter = 0;
        variantsList.innerHTML = currentVariants.map((v, idx) => 
            this.getVariantHTML(idx, v, mainCategory)
        ).join('');
    },
    
    // Called when the Enable/Disable checkbox changes
    onEnabledChange() {
        const checkbox = document.getElementById('isEnabledCheckbox');
        const isEnabled = checkbox?.checked !== false;
        
        // Update the parent div to reflect the change visually
        const container = checkbox?.closest('div[style*="background"]');
        if (container) {
            container.style.background = isEnabled 
                ? 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)' 
                : 'linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)';
            container.style.borderColor = isEnabled ? '#4CAF50' : '#C62828';
            
            const h4 = container.querySelector('h4');
            const p = container.querySelector('p');
            if (h4) {
                h4.style.color = isEnabled ? '#2E7D32' : '#C62828';
                h4.innerHTML = isEnabled ? '✅ Product Enabled' : '🚫 Product Disabled';
            }
            if (p) {
                p.style.color = isEnabled ? '#2E7D32' : '#C62828';
                p.innerHTML = isEnabled 
                    ? 'Product is available for sale on POS and Website' 
                    : 'This product is hidden from POS and Website';
            }
        }
    },
    
    // Category mapping from old ProofMaster categories to new unified ones
    categoryMapping: {
        'sweet-bread': 'classic-filipino',
        'savory-bread': 'savory',
        'pastry': 'desserts',
        'roll': 'classic-filipino',
        'other': 'desserts'
    },
    
    // For tracking dynamic form elements
    fillingCounter: 0,
    toppingCounter: 0,
    
    async init() {
        await this.loadCategories();
        await this.load();
        this.render();
    },
    
    // Search/filter functionality
    filterCards(searchTerm) {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;
        
        const cards = grid.querySelectorAll('.recipe-card');
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            // Show all cards if search is empty
            cards.forEach(card => card.style.display = '');
            return;
        }
        
        cards.forEach(card => {
            const productId = card.getAttribute('data-id');
            const product = this.data.find(p => p.id === productId);
            
            if (product) {
                // Search in name and category
                const name = (product.name || '').toLowerCase();
                const category = (product.category || '').toLowerCase();
                const categoryLabel = this.formatCategory(product.category).toLowerCase();
                
                const matches = name.includes(term) || 
                               category.includes(term) || 
                               categoryLabel.includes(term);
                
                card.style.display = matches ? '' : 'none';
            }
        });
    },
    
    async loadCategories() {
        try {
            const stored = await DB.getAll('productCategories');
            
            // Check if we need to migrate to new categories
            const hasOldCategories = stored.some(c => ['sweet-bread', 'savory-bread', 'pastry', 'roll'].includes(c.value));
            const hasAllNewCategories = this.defaultCategories.every(dc => 
                stored.some(c => c.value === dc.value)
            );
            
            if (hasOldCategories || !hasAllNewCategories) {
                // Migrate to new unified categories
                console.log('Migrating to unified categories...');
                
                // Delete old categories
                for (const cat of stored) {
                    await DB.delete('productCategories', cat.id);
                }
                
                // Add new unified categories
                for (const cat of this.defaultCategories) {
                    await DB.add('productCategories', cat);
                }
                
                this.categories = this.defaultCategories.map(c => c.value);
                Toast.success('Categories updated to match website!');
            } else if (stored && stored.length > 0) {
                this.categories = stored.map(c => c.value);
            } else {
                // Initialize with defaults
                this.categories = this.defaultCategories.map(c => c.value);
                for (const cat of this.defaultCategories) {
                    await DB.add('productCategories', cat);
                }
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categories = this.defaultCategories.map(c => c.value);
        }
    },

    async load() {
        try {
            this.data = await DB.getAll('products');
            this.data.sort((a, b) => a.name.localeCompare(b.name));
            
            // Auto-migrate old categories in products
            let migrated = 0;
            for (const product of this.data) {
                if (this.categoryMapping[product.category]) {
                    const newCategory = this.categoryMapping[product.category];
                    await DB.update('products', product.id, { category: newCategory });
                    product.category = newCategory;
                    migrated++;
                }
            }
            if (migrated > 0) {
                console.log(`Migrated ${migrated} products to new categories`);
            }
        } catch (error) {
            console.error('Error loading products:', error);
            Toast.error('Failed to load products');
        }
    },
    
    render() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;
        
        // Buttons are now in HTML, no need to add dynamically
        
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
            
            // Get website status from unified schema
            const shopStatus = this.getShopStatus(product);
            
            // Get today's stock from Inventory module
            const stockInfo = this.getProductStock(product.id);
            
            // Get main category
            const mainCat = this.getMainCategory(product.category) || product.mainCategory || 'bread';
            const mainCatBadge = mainCat === 'bread' 
                ? '<span style="font-size:0.7rem;padding:2px 6px;background:#FFF3E0;color:#E65100;border-radius:10px;">🍞</span>'
                : '<span style="font-size:0.7rem;padding:2px 6px;background:#E3F2FD;color:#1565C0;border-radius:10px;">🥤</span>';
            
            // Check if product is disabled (master switch)
            const isDisabled = product.isEnabled === false;
            
            // Stock badge
            let stockBadge = '';
            if (isDisabled) {
                stockBadge = '<span style="position:absolute;top:8px;right:8px;background:#9E9E9E;color:white;padding:4px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;">🚫 DISABLED</span>';
            } else if (stockInfo && stockInfo.hasRecord) {
                if (stockInfo.status === 'out') {
                    stockBadge = '<span style="position:absolute;top:8px;right:8px;background:#FFEBEE;color:#C62828;padding:4px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;">OUT OF STOCK</span>';
                } else if (stockInfo.status === 'low') {
                    stockBadge = `<span style="position:absolute;top:8px;right:8px;background:#FFF3E0;color:#E65100;padding:4px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;">LOW: ${stockInfo.sellable}</span>`;
                } else {
                    stockBadge = `<span style="position:absolute;top:8px;right:8px;background:#E8F5E9;color:#2E7D32;padding:4px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;">📦 ${stockInfo.sellable}</span>`;
                }
            }
            
            return `
            <div class="recipe-card" data-id="${product.id}" style="position:relative;${isDisabled ? 'opacity:0.6;' : ''}">
                ${stockBadge}
                <div class="recipe-card-header" style="background: linear-gradient(135deg, ${mainCat === 'bread' ? '#8E44AD, #9B59B6' : '#1565C0, #42A5F5'});">
                    <h3>${product.name}</h3>
                    <span class="version">${this.formatCategoryWithEmoji(product.category)}</span>
                </div>
                <div class="recipe-card-body">
                    ${product.hasVariants && product.variants?.length > 0 ? `
                        <!-- Variants Display -->
                        <div style="background: #E3F2FD; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                            <div style="font-size: 0.85rem; font-weight: 600; color: #1565C0; margin-bottom: 4px;">
                                🏷️ ${product.variants.length} Variant${product.variants.length > 1 ? 's' : ''}
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                ${product.variants.slice(0, 4).map(v => `
                                    <span style="font-size: 0.75rem; background: white; padding: 2px 6px; border-radius: 4px;">
                                        ${v.name}${v.size ? ` (${v.size})` : ''}: <strong>${Utils.formatCurrency(v.price)}</strong>
                                    </span>
                                `).join('')}
                                ${product.variants.length > 4 ? `<span style="font-size: 0.75rem; color: #666;">+${product.variants.length - 4} more</span>` : ''}
                            </div>
                        </div>
                    ` : `
                        <!-- Single Product Pricing -->
                        <div class="recipe-stat">
                            <span>Total Cost:</span>
                            <span><strong>${Utils.formatCurrency(cost.totalCost)}</strong></span>
                        </div>
                        <div class="recipe-stat">
                            <span>Suggested SRP:</span>
                            <span>${Utils.formatCurrency(cost.suggestedSRP)}</span>
                        </div>
                        <div class="recipe-stat" style="background: var(--bg-input); padding: 8px; border-radius: 6px; margin: 4px 0;">
                            <span><strong>Final SRP:</strong></span>
                            <span style="color: var(--primary); font-size: 1.2rem;"><strong>${Utils.formatCurrency(product.finalSRP || 0)}</strong></span>
                        </div>
                        <div class="recipe-stat">
                            <span>Margin:</span>
                            <span style="color: ${marginPercent >= 30 ? 'var(--success)' : marginPercent >= 20 ? 'var(--warning)' : 'var(--danger)'}">
                                <strong>${marginPercent.toFixed(1)}%</strong>
                            </span>
                        </div>
                    `}
                    
                    <!-- Website Status -->
                    <div class="recipe-stat" style="background: ${shopStatus.color}; padding: 6px 8px; border-radius: 6px; margin-top: 8px;">
                        <span style="font-size: 0.85rem;">${shopStatus.icon} Website:</span>
                        <span style="font-size: 0.85rem; font-weight: 500;">${shopStatus.text}</span>
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
    
    // Get shop status from unified product schema
    getShopStatus(product) {
        const shop = product.shop;
        
        if (!shop) {
            return {
                icon: '⚠️',
                text: 'Not configured',
                color: '#FFF3CD'
            };
        }
        
        if (shop.isPublished) {
            const hasImage = shop.imageUrl || (shop.images && shop.images.length > 0);
            if (hasImage) {
                return {
                    icon: '✅',
                    text: 'Published',
                    color: '#D4EDDA'
                };
            } else {
                return {
                    icon: '🔶',
                    text: 'Published (no image)',
                    color: '#FFF3CD'
                };
            }
        } else {
            return {
                icon: '📝',
                text: 'Draft',
                color: '#E3F2FD'
            };
        }
    },
    
    // Get today's stock from Inventory module
    getProductStock(productId) {
        // Check if Inventory module is loaded and has data
        if (typeof Inventory === 'undefined' || !Inventory.dailyRecords) {
            return null;
        }
        
        const record = Inventory.dailyRecords.find(r => r.productId === productId);
        if (!record) {
            return { hasRecord: false, sellable: 0, status: 'none' };
        }
        
        const stock = Inventory.calculateStock(record);
        let status = 'ok';
        if (stock.sellable <= 0) status = 'out';
        else if (stock.sellable <= 5) status = 'low';
        
        return {
            hasRecord: true,
            sellable: stock.sellable,
            reserved: stock.reserved,
            sold: stock.sold,
            total: stock.totalAvailable,
            status: status
        };
    },
    
    formatCategory(cat) {
        if (!cat) return '-';
        return cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },
    
    formatCategoryWithEmoji(cat) {
        if (!cat) return '-';
        const catData = this.defaultCategories.find(c => c.value === cat);
        if (catData) {
            return `${catData.emoji} ${catData.label}`;
        }
        return this.formatCategory(cat);
    },
    
    getCategoryEmoji(cat) {
        const catData = this.defaultCategories.find(c => c.value === cat);
        return catData?.emoji || '🍞';
    },


    // Categories Management
    showCategoriesModal() {
        const catList = this.defaultCategories.map(cat => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-input); border-radius: 6px; margin-bottom: 8px;">
                <span style="font-size: 1.3rem;">${cat.emoji}</span>
                <span style="flex: 1;">${cat.label}</span>
                <span style="color: var(--text-secondary); font-size: 0.8rem;">${cat.value}</span>
            </div>
        `).join('');
        
        Modal.open({
            title: '🏷️ Product Categories (Synced with Website)',
            content: `
                <div style="margin-bottom: 16px;">
                    <p style="color: var(--text-secondary); margin-bottom: 12px;">
                        These 13 categories are synchronized with breadhub.shop website.
                    </p>
                    ${catList}
                </div>
                <div style="background: #E8F5E9; padding: 12px; border-radius: 8px;">
                    <strong>✅ Categories are synced!</strong><br>
                    <small>Both ProofMaster and Website use the same category system.</small>
                </div>
            `,
            showFooter: false,
            width: '500px'
        });
    },
    
    // ========== LAUNCH WEBSITE ADMIN ==========
    launchWebsiteAdmin(product) {
        // Build URL with product ID to edit in website admin
        const params = new URLSearchParams({
            edit: product.id
        });
        
        // Use breadhub.shop admin URL
        const adminUrl = `https://breadhub.shop/admin.html?${params.toString()}`;
        
        // Open in new tab
        window.open(adminUrl, '_blank');
        
        Toast.info('Opening Website Admin...');
    },
    
    // ========== FORM HTML ==========
    showAddModal() {
        this.fillingCounter = 0;
        this.toppingCounter = 0;
        Modal.open({
            title: 'New Product',
            content: this.getFormHTML(),
            saveText: 'Create Product',
            width: '900px',
            onSave: () => this.save()
        });
        this.setupCostCalculation();
    },
    
    async edit(id) {
        const product = this.data.find(p => p.id === id);
        if (!product) return;
        
        this.fillingCounter = 0;
        this.toppingCounter = 0;
        
        // Fix mainCategory if missing or wrong for drinks products
        const correctMainCat = this.getMainCategory(product.category);
        if (product.mainCategory !== correctMainCat) {
            product.mainCategory = correctMainCat;
        }
        
        Modal.open({
            title: 'Edit Product',
            content: this.getFormHTML(product),
            saveText: 'Update Product',
            width: '900px',
            onSave: () => this.save(id)
        });
        this.setupCostCalculation();
        
        // After modal opens, apply drinks-specific UI if needed
        const isDrinks = correctMainCat === 'drinks';
        if (isDrinks) {
            const baseBreadSection = document.getElementById('baseBreadSection');
            if (baseBreadSection) baseBreadSection.style.display = 'none';
            const variantsToggle = document.getElementById('variantsToggleSection');
            if (variantsToggle) variantsToggle.style.display = 'none';
        }
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
        
        // Handle legacy single filling/topping OR new array format
        const fillings = product.fillings || (product.fillingRecipeId ? [{recipeId: product.fillingRecipeId, weight: product.portioning?.fillingWeight || 0}] : []);
        const toppings = product.toppings || (product.toppingRecipeId ? [{recipeId: product.toppingRecipeId, weight: product.portioning?.toppingWeight || 0}] : []);
        
        // Get current main category - ALWAYS derive from subcategory to ensure correctness
        const currentMainCat = this.getMainCategory(product.category) || product.mainCategory || 'bread';
        
        // Group subcategories by main category
        const breadCategories = this.defaultCategories.filter(c => c.mainCategory === 'bread');
        const drinksCategories = this.defaultCategories.filter(c => c.mainCategory === 'drinks');
        
        return `
            <form id="productForm">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Product Name *</label>
                        <input type="text" name="name" class="form-input" 
                               value="${product.name || ''}" required
                               placeholder="e.g., Ensaymada">
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select name="category" id="categorySelect" class="form-select" onchange="Products.onCategoryChange()">
                            <optgroup label="🍞 BREAD & PASTRIES">
                                ${breadCategories.map(cat => 
                                    `<option value="${cat.value}" ${product.category === cat.value ? 'selected' : ''}>${cat.emoji} ${cat.label}</option>`
                                ).join('')}
                            </optgroup>
                            <optgroup label="🥤 DRINKS & BEVERAGES">
                                ${drinksCategories.map(cat => 
                                    `<option value="${cat.value}" ${product.category === cat.value ? 'selected' : ''}>${cat.emoji} ${cat.label}</option>`
                                ).join('')}
                            </optgroup>
                        </select>
                        <input type="hidden" name="mainCategory" id="mainCategoryInput" value="${currentMainCat}">
                    </div>
                </div>
                
                <!-- Main Category Badge (auto-updated) -->
                <div id="mainCategoryBadge" style="margin-bottom: 16px;">
                    <span style="display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; background: ${currentMainCat === 'bread' ? '#FFF3E0' : '#E3F2FD'}; color: ${currentMainCat === 'bread' ? '#E65100' : '#1565C0'};">
                        ${currentMainCat === 'bread' ? '🍞 Bread & Pastries' : '🥤 Drinks & Beverages'}
                    </span>
                </div>
                
                <!-- PRODUCT ENABLED/DISABLED TOGGLE (Master Switch) -->
                <div style="background: ${product.isEnabled === false ? '#FFEBEE' : '#E8F5E9'}; padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 2px solid ${product.isEnabled === false ? '#C62828' : '#4CAF50'};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: ${product.isEnabled === false ? '#C62828' : '#2E7D32'};">
                                ${product.isEnabled === false ? '🚫 Product Disabled' : '✅ Product Enabled'}
                            </h4>
                            <p style="font-size: 0.85rem; color: ${product.isEnabled === false ? '#C62828' : '#2E7D32'}; margin: 4px 0 0 0;">
                                ${product.isEnabled === false ? 'This product is hidden from POS and Website' : 'Product is available for sale on POS and Website'}
                            </p>
                        </div>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; background: white; padding: 8px 16px; border-radius: 8px;">
                            <input type="checkbox" name="isEnabled" id="isEnabledCheckbox" 
                                   ${product.isEnabled !== false ? 'checked' : ''} 
                                   onchange="Products.onEnabledChange()"
                                   style="width: 20px; height: 20px;">
                            <span style="font-weight: 600; color: #333;">Enabled</span>
                        </label>
                    </div>
                </div>
                
                <!-- VARIANTS TOGGLE -->
                <div id="variantsToggleSection" style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #2196F3; ${currentMainCat === 'drinks' ? 'display:none;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: #1565C0;">🏷️ Product Variants</h4>
                            <p style="font-size: 0.85rem; color: #1565C0; margin: 4px 0 0 0;">
                                Enable for sizes (Tall/Grande/Venti) or types (Classic/Premium)
                            </p>
                        </div>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; background: white; padding: 8px 16px; border-radius: 8px;">
                            <input type="checkbox" id="hasVariantsCheckbox" ${(product.variants && product.variants.length > 0) || currentMainCat === 'drinks' ? 'checked' : ''} 
                                   onchange="Products.toggleVariantMode()" style="width: 18px; height: 18px;">
                            <span style="font-weight: 600; color: #1565C0;">Enable</span>
                        </label>
                    </div>
                </div>

                <!-- BASE BREAD (JIT Finishing) -->
                <div id="baseBreadSection" style="background: linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%); padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #FFC107; ${currentMainCat === 'drinks' ? 'display:none;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: #F57C00;">🍞 Base Bread (JIT Finishing)</h4>
                            <p style="font-size: 0.85rem; color: #F57C00; margin: 4px 0 0 0;">
                                Link to a base bread if this product gets toppings added later
                            </p>
                        </div>
                        <select name="baseBreadId" id="baseBreadId" class="form-select" style="width: 200px;">
                            <option value="">None (sold as-is)</option>
                            ${(typeof BaseBreads !== 'undefined' ? BaseBreads.getActive() : []).map(b => 
                                `<option value="${b.id}" ${product.baseBreadId === b.id ? 'selected' : ''}>${b.icon} ${b.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
                <!-- SINGLE RECIPE MODE (default - no variants) -->
                <div id="singleRecipeMode" style="display: ${(product.variants && product.variants.length > 0) || currentMainCat === 'drinks' ? 'none' : 'block'};">
                
                <h4 style="margin: 16px 0 8px;">🥖 Dough Recipe *</h4>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label>Dough Recipe</label>
                        <select name="doughRecipeId" id="doughRecipeId" class="form-select" required>
                            <option value="">Select dough...</option>
                            ${doughOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Dough Weight (g) *</label>
                        <input type="number" name="doughWeight" id="doughWeight" class="form-input" 
                               value="${product.portioning?.doughWeight || 40}" required>
                    </div>
                </div>

                <!-- FILLINGS SECTION -->
                <div style="background: #FFF8E1; padding: 12px; border-radius: 8px; margin: 16px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="margin: 0;">🥥 Fillings</h4>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="Products.addFillingRow()">+ Add Filling</button>
                    </div>
                    <div id="fillingsContainer">
                        ${fillings.length > 0 ? fillings.map((f, idx) => this.getFillingRowHTML(idx, f)).join('') : '<p style="color: var(--text-secondary); font-size: 0.9rem; margin: 8px 0;">No fillings. Click "+ Add Filling" to add one.</p>'}
                    </div>
                </div>
                
                <!-- TOPPINGS SECTION -->
                <div style="background: #E8F5E9; padding: 12px; border-radius: 8px; margin: 16px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="margin: 0;">🧈 Toppings</h4>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="Products.addToppingRow()">+ Add Topping</button>
                    </div>
                    <div id="toppingsContainer">
                        ${toppings.length > 0 ? toppings.map((t, idx) => this.getToppingRowHTML(idx, t)).join('') : '<p style="color: var(--text-secondary); font-size: 0.9rem; margin: 8px 0;">No toppings. Click "+ Add Topping" to add one.</p>'}
                    </div>
                </div>
                
                <h4 style="margin: 16px 0 8px;">Final Weight</h4>
                <div style="display: grid; grid-template-columns: 1fr; gap: 16px; max-width: 200px;">
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
                                <span>🥥 Fillings Cost:</span>
                                <span id="displayFillingCost">₱0.00</span>
                            </div>
                            <div class="recipe-stat">
                                <span>🧈 Toppings Cost:</span>
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
                                Suggested SRP (Cost + Markup)
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
                
                </div><!-- END singleRecipeMode -->
                
                <!-- VARIANTS MODE (multiple recipes) -->
                <div id="variantsMode" style="display: ${(product.variants && product.variants.length > 0) || currentMainCat === 'drinks' ? 'block' : 'none'};">
                    <div id="variantsList">
                        ${product.variants && product.variants.length > 0 ? product.variants.map((v, idx) => this.getVariantHTML(idx, v, currentMainCat)).join('') : (currentMainCat === 'drinks' ? this._getDrinkDefaultVariantsHTML() : '')}
                    </div>
                    <button type="button" class="btn" onclick="Products.addVariant()" 
                            style="background: #2196F3; color: white; margin-top: 12px; width: 100%;">
                        ➕ Add Another Variant
                    </button>
                </div>
                
                <!-- WEBSITE SECTION (Unified Schema) -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin: 20px 0; color: white;">
                    <h4 style="margin: 0 0 12px; color: white;">🌐 Website Settings (breadhub.shop)</h4>
                    
                    <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                        ${product.shop ? `
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <span style="font-size: 1.2rem;">${product.shop.isPublished ? '✅' : '📝'}</span>
                                <span><strong>${product.shop.isPublished ? 'Published' : 'Draft'}</strong></span>
                            </div>
                            ${product.shop.imageUrl ? '<small style="opacity: 0.8;">✅ Has image</small>' : '<small style="opacity: 0.8;">⚠️ No image yet</small>'}
                        ` : `
                            <small style="opacity: 0.8;">💡 Shop settings will be created when you save.</small>
                        `}
                    </div>
                    
                    <!-- Publish checkbox -->
                    <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" name="shopIsPublished" id="shopIsPublished" 
                                   ${product.shop?.isPublished ? 'checked' : ''}
                                   style="width: 20px; height: 20px; cursor: pointer;">
                            <span style="font-size: 1rem;">
                                <strong>Publish on website</strong><br>
                                <small style="opacity: 0.8;">When checked, product will be visible on breadhub.shop</small>
                            </span>
                        </label>
                    </div>
                    
                    ${product.id ? `
                        <button type="button" class="btn" onclick="Products.launchWebsiteAdmin(Products.getById('${product.id}'))" 
                                style="background: white; color: #764ba2; font-weight: bold; width: 100%;">
                            🚀 Edit on Website Admin (Images, SEO, Description)
                        </button>
                    ` : ''}
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea" placeholder="Production notes, tips, etc.">${product.notes || ''}</textarea>
                </div>
            </form>
        `;
    },


    getFillingRowHTML(idx, filling = {}) {
        const options = Fillings.data.map(f => 
            `<option value="${f.id}" ${filling.recipeId === f.id ? 'selected' : ''}>${f.name}</option>`
        ).join('');
        
        this.fillingCounter = Math.max(this.fillingCounter, idx + 1);
        
        return `
            <div class="filling-row" data-idx="${idx}" style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 8px; margin-bottom: 8px; align-items: end;">
                <div class="form-group" style="margin-bottom: 0;">
                    <select name="filling_${idx}_id" class="form-select filling-select" data-idx="${idx}">
                        <option value="">Select filling...</option>
                        ${options}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <input type="number" name="filling_${idx}_weight" class="form-input filling-weight" data-idx="${idx}"
                           value="${filling.weight || 15}" placeholder="Weight (g)" min="0">
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="Products.removeFillingRow(${idx})" style="margin-bottom: 0;">✕</button>
            </div>
        `;
    },
    
    getToppingRowHTML(idx, topping = {}) {
        const options = Toppings.data.map(t => 
            `<option value="${t.id}" ${topping.recipeId === t.id ? 'selected' : ''}>${t.name}</option>`
        ).join('');
        
        this.toppingCounter = Math.max(this.toppingCounter, idx + 1);
        
        return `
            <div class="topping-row" data-idx="${idx}" style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 8px; margin-bottom: 8px; align-items: end;">
                <div class="form-group" style="margin-bottom: 0;">
                    <select name="topping_${idx}_id" class="form-select topping-select" data-idx="${idx}">
                        <option value="">Select topping...</option>
                        ${options}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <input type="number" name="topping_${idx}_weight" class="form-input topping-weight" data-idx="${idx}"
                           value="${topping.weight || 10}" placeholder="Weight (g)" min="0">
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="Products.removeToppingRow(${idx})" style="margin-bottom: 0;">✕</button>
            </div>
        `;
    },
    
    // ========== VARIANT FUNCTIONS ==========
    variantCounter: 0,
    
    // Generate default drink variant HTML (Tall/Grande/Venti) for new products
    _getDrinkDefaultVariantsHTML() {
        const drinkSizes = [
            { name: 'Tall', size: '12oz', recipe: { cupSize: 12, packagingCost: 5, laborCost: 1, markupPercent: 40 } },
            { name: 'Grande', size: '16oz', recipe: { cupSize: 16, packagingCost: 6, laborCost: 1, markupPercent: 40 } },
            { name: 'Venti', size: '22oz', recipe: { cupSize: 22, packagingCost: 7, laborCost: 1, markupPercent: 40 } }
        ];
        this.variantCounter = 0;
        return drinkSizes.map((v, idx) => this.getVariantHTML(idx, v, 'drinks')).join('');
    },
    
    // Toggle between single recipe mode and variants mode
    toggleVariantMode() {
        const checkbox = document.getElementById('hasVariantsCheckbox');
        const singleMode = document.getElementById('singleRecipeMode');
        const variantsMode = document.getElementById('variantsMode');
        
        if (checkbox.checked) {
            singleMode.style.display = 'none';
            variantsMode.style.display = 'block';
            
            // If no variants exist, create initial ones
            const variantsList = document.getElementById('variantsList');
            if (!variantsList.querySelector('.variant-section')) {
                this.variantCounter = 0;
                
                // Check if drinks category - pre-populate Tall/Grande/Venti
                const categorySelect = document.getElementById('categorySelect');
                const selectedCategory = categorySelect?.value || 'donut';
                const mainCat = this.getMainCategory(selectedCategory);
                
                if (mainCat === 'drinks') {
                    const drinkSizes = [
                        { name: 'Tall', size: '12oz', recipe: { cupSize: 12, packagingCost: 5, laborCost: 1, markupPercent: 40 } },
                        { name: 'Grande', size: '16oz', recipe: { cupSize: 16, packagingCost: 6, laborCost: 1, markupPercent: 40 } },
                        { name: 'Venti', size: '22oz', recipe: { cupSize: 22, packagingCost: 7, laborCost: 1, markupPercent: 40 } }
                    ];
                    variantsList.innerHTML = drinkSizes.map((v, idx) => 
                        this.getVariantHTML(idx, v, 'drinks')
                    ).join('');
                } else {
                    variantsList.innerHTML = this.getVariantHTML(0, {});
                }
            }
        } else {
            singleMode.style.display = 'block';
            variantsMode.style.display = 'none';
        }
    },
    
    // Generate HTML for a single variant with its own recipe
    getVariantHTML(idx, variant = {}, mainCategory = null) {
        this.variantCounter = Math.max(this.variantCounter, idx + 1);
        
        // Get current main category from form if not provided
        if (!mainCategory) {
            const categorySelect = document.getElementById('categorySelect');
            const selectedCategory = categorySelect?.value || 'donut';
            mainCategory = this.getMainCategory(selectedCategory);
        }
        
        const recipe = variant.recipe || {};
        const fillings = recipe.fillings || [];
        const toppings = recipe.toppings || [];
        const ingredients = recipe.ingredients || [];
        
        const isDrinks = mainCategory === 'drinks';
        
        const doughOptions = Doughs.data.map(d => 
            `<option value="${d.id}" ${recipe.doughRecipeId === d.id ? 'selected' : ''}>${d.name}</option>`
        ).join('');
        
        return `
            <div class="variant-section" data-idx="${idx}" style="background: white; border: 3px solid ${isDrinks ? '#1565C0' : '#8E44AD'}; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
                <!-- Variant Header -->
                <div style="background: linear-gradient(135deg, ${isDrinks ? '#1565C0 0%, #42A5F5 100%' : '#8E44AD 0%, #9B59B6 100%'}); padding: 12px 16px; color: white; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 12px; flex: 1;">
                        <div style="flex: 1;">
                            <label style="font-size: 0.75rem; opacity: 0.9;">Variant Name *</label>
                            <input type="text" name="variant_${idx}_name" class="form-input" 
                                   value="${variant.name || ''}" placeholder="${isDrinks ? 'e.g., Tall, Grande' : 'e.g., Classic, Premium'}" required
                                   style="background: rgba(255,255,255,0.95); font-weight: bold; margin-top: 4px;">
                        </div>
                        <div style="width: 100px;">
                            <label style="font-size: 0.75rem; opacity: 0.9;">${isDrinks ? 'Size' : 'Type'}</label>
                            <input type="text" name="variant_${idx}_size" class="form-input" 
                                   value="${variant.size || ''}" placeholder="${isDrinks ? '12oz' : ''}"
                                   style="background: rgba(255,255,255,0.95); margin-top: 4px;">
                        </div>
                        <div style="width: 100px;">
                            <label style="font-size: 0.75rem; opacity: 0.9;">Price ₱ *</label>
                            <input type="number" name="variant_${idx}_price" class="form-input" step="0.50"
                                   value="${variant.price || ''}" placeholder="0" required
                                   style="background: #FFF3E0; font-weight: bold; margin-top: 4px;"
                                   oninput="Products.updateVariantCost(${idx})">
                        </div>
                    </div>
                    ${idx > 0 ? `
                        <button type="button" onclick="Products.removeVariant(${idx})" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-left: 12px;">
                            🗑️
                        </button>
                    ` : '<span style="font-size: 0.75rem; opacity: 0.8; margin-left: 12px;">(Primary)</span>'}
                </div>
                
                <!-- Variant Recipe Content -->
                <div style="padding: 16px;">
                    ${isDrinks ? `
                        <!-- DRINKS: Individual Ingredients -->
                        <div style="background: #E3F2FD; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-weight: 600; font-size: 0.9rem;">🧪 Ingredients</span>
                                <button type="button" class="btn btn-sm" onclick="Products.addVariantIngredient(${idx})" 
                                        style="padding: 2px 8px; font-size: 0.75rem; background: #1565C0; color: white;">+ Add</button>
                            </div>
                            <div id="variant_${idx}_ingredients">
                                ${ingredients.length > 0 ? ingredients.map((ing, iidx) => this.getVariantIngredientHTML(idx, iidx, ing)).join('') : '<p style="font-size: 0.8rem; color: #666; margin: 4px 0;">No ingredients yet. Click "+ Add" to add milk, sugar, etc.</p>'}
                            </div>
                        </div>
                        
                        <!-- Toppings for Drinks (whip cream, etc.) -->
                        <div style="background: #E8F5E9; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-weight: 600; font-size: 0.9rem;">🧈 Toppings (Whip cream, etc.)</span>
                                <button type="button" class="btn btn-sm" onclick="Products.addVariantTopping(${idx})" 
                                        style="padding: 2px 8px; font-size: 0.75rem;">+</button>
                            </div>
                            <div id="variant_${idx}_toppings">
                                ${toppings.length > 0 ? toppings.map((t, tidx) => this.getVariantToppingHTML(idx, tidx, t)).join('') : '<p style="font-size: 0.8rem; color: #999; margin: 4px 0;">No toppings</p>'}
                            </div>
                        </div>
                    ` : `
                        <!-- BREADS: Dough, Fillings, Toppings -->
                        <!-- Dough Selection -->
                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
                            <div class="form-group" style="margin: 0;">
                                <label>🥖 Dough Recipe</label>
                                <select name="variant_${idx}_doughRecipeId" class="form-select" onchange="Products.updateVariantCost(${idx})">
                                    <option value="">Select dough...</option>
                                    ${doughOptions}
                                </select>
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label>Dough Weight (g)</label>
                                <input type="number" name="variant_${idx}_doughWeight" class="form-input" 
                                       value="${recipe.doughWeight || 40}" oninput="Products.updateVariantCost(${idx})">
                            </div>
                        </div>
                        
                        <!-- Fillings & Toppings -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                            <!-- Fillings -->
                            <div style="background: #FFF8E1; padding: 10px; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-weight: 600; font-size: 0.9rem;">🥥 Fillings</span>
                                    <button type="button" class="btn btn-sm" onclick="Products.addVariantFilling(${idx})" 
                                            style="padding: 2px 8px; font-size: 0.75rem;">+</button>
                                </div>
                                <div id="variant_${idx}_fillings">
                                    ${fillings.length > 0 ? fillings.map((f, fidx) => this.getVariantFillingHTML(idx, fidx, f)).join('') : '<p style="font-size: 0.8rem; color: #999; margin: 4px 0;">No fillings</p>'}
                                </div>
                            </div>
                            <!-- Toppings -->
                            <div style="background: #E8F5E9; padding: 10px; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-weight: 600; font-size: 0.9rem;">🧈 Toppings</span>
                                    <button type="button" class="btn btn-sm" onclick="Products.addVariantTopping(${idx})" 
                                            style="padding: 2px 8px; font-size: 0.75rem;">+</button>
                                </div>
                                <div id="variant_${idx}_toppings">
                                    ${toppings.length > 0 ? toppings.map((t, tidx) => this.getVariantToppingHTML(idx, tidx, t)).join('') : '<p style="font-size: 0.8rem; color: #999; margin: 4px 0;">No toppings</p>'}
                                </div>
                            </div>
                        </div>
                    `}
                    
                    <!-- Costs -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f5f5f5; padding: 10px; border-radius: 8px;">
                        ${!isDrinks ? `
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75rem;">Final Wt (g)</label>
                            <input type="number" name="variant_${idx}_finalWeight" class="form-input"
                                   value="${recipe.finalWeight || 38}" style="font-size: 0.9rem; padding: 6px;">
                        </div>
                        ` : `
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75rem;">Cup Size (oz)</label>
                            <input type="number" name="variant_${idx}_cupSize" class="form-input"
                                   value="${recipe.cupSize || 12}" style="font-size: 0.9rem; padding: 6px;">
                        </div>
                        `}
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75rem;">Packaging ₱</label>
                            <input type="number" name="variant_${idx}_packagingCost" class="form-input variant-cost-input" step="0.01"
                                   value="${recipe.packagingCost || (isDrinks ? 5 : 0.50)}" style="font-size: 0.9rem; padding: 6px;"
                                   onchange="Products.updateVariantCost(${idx})" oninput="Products.updateVariantCost(${idx})">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75rem;">Labor ₱</label>
                            <input type="number" name="variant_${idx}_laborCost" class="form-input variant-cost-input" step="0.01"
                                   value="${recipe.laborCost || 1.00}" style="font-size: 0.9rem; padding: 6px;"
                                   onchange="Products.updateVariantCost(${idx})" oninput="Products.updateVariantCost(${idx})">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75rem;">Markup %</label>
                            <input type="number" name="variant_${idx}_markupPercent" class="form-input variant-cost-input"
                                   value="${recipe.markupPercent || 40}" style="font-size: 0.9rem; padding: 6px;"
                                   onchange="Products.updateVariantCost(${idx})" oninput="Products.updateVariantCost(${idx})">
                        </div>
                    </div>
                    
                    <!-- COST BREAKDOWN for this variant -->
                    <div id="variant_${idx}_costBreakdown" style="background: linear-gradient(135deg, #F8F4E8 0%, #FDF9F0 100%); padding: 12px; border-radius: 8px; margin-top: 12px; border: 2px solid #DDD;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600; color: var(--primary);">💰 Cost Breakdown</span>
                            <button type="button" class="btn btn-sm" onclick="Products.updateVariantCost(${idx})" 
                                    style="padding: 2px 10px; font-size: 0.75rem; background: var(--primary); color: white;">
                                🔄 Calculate
                            </button>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; font-size: 0.85rem;">
                            ${isDrinks ? `
                                <div style="display: flex; justify-content: space-between;"><span>🧪 Ingredients:</span><span id="variant_${idx}_ingredientsCost">₱0.00</span></div>
                            ` : `
                                <div style="display: flex; justify-content: space-between;"><span>🥖 Dough:</span><span id="variant_${idx}_doughCost">₱0.00</span></div>
                                <div style="display: flex; justify-content: space-between;"><span>🥥 Fillings:</span><span id="variant_${idx}_fillingsCost">₱0.00</span></div>
                            `}
                            <div style="display: flex; justify-content: space-between;"><span>🧈 Toppings:</span><span id="variant_${idx}_toppingsCost">₱0.00</span></div>
                            <div style="display: flex; justify-content: space-between;"><span>📦 Packaging:</span><span id="variant_${idx}_packagingDisplay">₱0.00</span></div>
                            <div style="display: flex; justify-content: space-between;"><span>👷 Labor:</span><span id="variant_${idx}_laborDisplay">₱0.00</span></div>
                            <div style="display: flex; justify-content: space-between; background: #fff; padding: 4px 8px; border-radius: 4px; grid-column: 1/-1; margin-top: 4px;">
                                <span><strong>📊 TOTAL COST:</strong></span>
                                <span id="variant_${idx}_totalCost" style="font-weight: bold; color: var(--danger);">₱0.00</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; background: #E8F5E9; padding: 4px 8px; border-radius: 4px;">
                                <span>Suggested SRP:</span>
                                <span id="variant_${idx}_suggestedSRP" style="font-weight: bold; color: var(--success);">₱0.00</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; background: #E3F2FD; padding: 4px 8px; border-radius: 4px;">
                                <span>Margin:</span>
                                <span id="variant_${idx}_margin" style="font-weight: bold;">0%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Calculate and update cost display for a variant
    updateVariantCost(variantIdx) {
        const idx = variantIdx;
        
        // Get main category
        const categorySelect = document.getElementById('categorySelect');
        const selectedCategory = categorySelect?.value || 'donut';
        const mainCategory = this.getMainCategory(selectedCategory);
        const isDrinks = mainCategory === 'drinks';
        
        let totalCost = 0;
        
        if (isDrinks) {
            // Calculate ingredients cost
            let ingredientsCost = 0;
            const ingredientsContainer = document.getElementById(`variant_${idx}_ingredients`);
            if (ingredientsContainer) {
                ingredientsContainer.querySelectorAll('.variant-ingredient-row').forEach((row, iidx) => {
                    const ingredientId = row.querySelector(`[name="variant_${idx}_ingredient_${iidx}_id"]`)?.value;
                    const amount = parseFloat(row.querySelector(`[name="variant_${idx}_ingredient_${iidx}_amount"]`)?.value) || 0;
                    if (ingredientId && amount > 0) {
                        const price = IngredientPrices.getCheapest(ingredientId);
                        const costPerGram = price?.costPerGram || 0;
                        ingredientsCost += costPerGram * amount;
                    }
                });
            }
            document.getElementById(`variant_${idx}_ingredientsCost`).textContent = Utils.formatCurrency(ingredientsCost);
            totalCost += ingredientsCost;
        } else {
            // Calculate dough cost
            const doughId = document.querySelector(`[name="variant_${idx}_doughRecipeId"]`)?.value;
            const doughWeight = parseFloat(document.querySelector(`[name="variant_${idx}_doughWeight"]`)?.value) || 0;
            const dough = Doughs.getById(doughId);
            const doughCost = dough ? (dough.costPerGram || 0) * doughWeight : 0;
            document.getElementById(`variant_${idx}_doughCost`).textContent = Utils.formatCurrency(doughCost);
            totalCost += doughCost;
            
            // Calculate fillings cost
            let fillingsCost = 0;
            const fillingsContainer = document.getElementById(`variant_${idx}_fillings`);
            if (fillingsContainer) {
                fillingsContainer.querySelectorAll('.variant-filling-row').forEach((row, fidx) => {
                    const recipeId = row.querySelector(`[name="variant_${idx}_filling_${fidx}_id"]`)?.value;
                    const weight = parseFloat(row.querySelector(`[name="variant_${idx}_filling_${fidx}_weight"]`)?.value) || 0;
                    if (recipeId && weight > 0) {
                        const filling = Fillings.getById(recipeId);
                        fillingsCost += (filling?.costPerGram || 0) * weight;
                    }
                });
            }
            document.getElementById(`variant_${idx}_fillingsCost`).textContent = Utils.formatCurrency(fillingsCost);
            totalCost += fillingsCost;
        }
        
        // Calculate toppings cost (both breads and drinks)
        let toppingsCost = 0;
        const toppingsContainer = document.getElementById(`variant_${idx}_toppings`);
        if (toppingsContainer) {
            toppingsContainer.querySelectorAll('.variant-topping-row').forEach((row, tidx) => {
                const recipeId = row.querySelector(`[name="variant_${idx}_topping_${tidx}_id"]`)?.value;
                const weight = parseFloat(row.querySelector(`[name="variant_${idx}_topping_${tidx}_weight"]`)?.value) || 0;
                if (recipeId && weight > 0) {
                    const topping = Toppings.getById(recipeId);
                    toppingsCost += (topping?.costPerGram || 0) * weight;
                }
            });
        }
        document.getElementById(`variant_${idx}_toppingsCost`).textContent = Utils.formatCurrency(toppingsCost);
        totalCost += toppingsCost;
        
        // Add packaging and labor
        const packagingCost = parseFloat(document.querySelector(`[name="variant_${idx}_packagingCost"]`)?.value) || 0;
        const laborCost = parseFloat(document.querySelector(`[name="variant_${idx}_laborCost"]`)?.value) || 0;
        const markupPercent = parseFloat(document.querySelector(`[name="variant_${idx}_markupPercent"]`)?.value) || 40;
        
        document.getElementById(`variant_${idx}_packagingDisplay`).textContent = Utils.formatCurrency(packagingCost);
        document.getElementById(`variant_${idx}_laborDisplay`).textContent = Utils.formatCurrency(laborCost);
        
        totalCost += packagingCost + laborCost;
        
        // Update total cost
        document.getElementById(`variant_${idx}_totalCost`).textContent = Utils.formatCurrency(totalCost);
        
        // Calculate suggested SRP
        const suggestedSRP = totalCost * (1 + markupPercent / 100);
        document.getElementById(`variant_${idx}_suggestedSRP`).textContent = Utils.formatCurrency(suggestedSRP);
        
        // Calculate margin based on entered price
        const price = parseFloat(document.querySelector(`[name="variant_${idx}_price"]`)?.value) || 0;
        const margin = price > 0 ? ((price - totalCost) / price * 100) : 0;
        const marginEl = document.getElementById(`variant_${idx}_margin`);
        marginEl.textContent = margin.toFixed(1) + '%';
        marginEl.style.color = margin >= 30 ? 'var(--success)' : margin >= 20 ? 'var(--warning)' : 'var(--danger)';
    },
    
    // Generate ingredient row HTML for drinks variant
    getVariantIngredientHTML(variantIdx, ingredientIdx, ingredient = {}) {
        const options = Ingredients.data.map(ing => {
            const price = IngredientPrices.getCheapest(ing.id);
            const costPerGram = price?.costPerGram || 0;
            return `<option value="${ing.id}" ${ingredient.ingredientId === ing.id ? 'selected' : ''}>${ing.name} (₱${costPerGram.toFixed(2)}/g)</option>`;
        }).join('');
        
        return `
            <div class="variant-ingredient-row" style="display: flex; gap: 4px; margin-bottom: 4px; align-items: center;">
                <select name="variant_${variantIdx}_ingredient_${ingredientIdx}_id" class="form-select" style="flex: 2; font-size: 0.85rem; padding: 4px;"
                        onchange="Products.updateVariantCost(${variantIdx})">
                    <option value="">Select ingredient...</option>
                    ${options}
                </select>
                <input type="number" name="variant_${variantIdx}_ingredient_${ingredientIdx}_amount" class="form-input" 
                       value="${ingredient.amount || 50}" style="width: 60px; font-size: 0.85rem; padding: 4px;" placeholder="g"
                       oninput="Products.updateVariantCost(${variantIdx})">
                <span style="font-size: 0.75rem; color: #666;">g</span>
                <button type="button" onclick="this.parentElement.remove(); Products.updateVariantCost(${variantIdx})" style="border: none; background: #ffebee; color: #c62828; padding: 4px 8px; border-radius: 4px; cursor: pointer;">×</button>
            </div>
        `;
    },
    
    // Add ingredient to a drinks variant
    addVariantIngredient(variantIdx) {
        const container = document.getElementById(`variant_${variantIdx}_ingredients`);
        const emptyMsg = container.querySelector('p');
        if (emptyMsg) emptyMsg.remove();
        
        const existingRows = container.querySelectorAll('.variant-ingredient-row').length;
        container.insertAdjacentHTML('beforeend', this.getVariantIngredientHTML(variantIdx, existingRows, {}));
    },
    
    // Generate filling row HTML for a variant
    getVariantFillingHTML(variantIdx, fillingIdx, filling = {}) {
        const options = Fillings.data.map(f => 
            `<option value="${f.id}" ${filling.recipeId === f.id ? 'selected' : ''}>${f.name}</option>`
        ).join('');
        
        return `
            <div class="variant-filling-row" style="display: flex; gap: 4px; margin-bottom: 4px;">
                <select name="variant_${variantIdx}_filling_${fillingIdx}_id" class="form-select" style="flex: 2; font-size: 0.85rem; padding: 4px;"
                        onchange="Products.updateVariantCost(${variantIdx})">
                    <option value="">Select...</option>
                    ${options}
                </select>
                <input type="number" name="variant_${variantIdx}_filling_${fillingIdx}_weight" class="form-input" 
                       value="${filling.weight || 15}" style="width: 55px; font-size: 0.85rem; padding: 4px;" placeholder="g"
                       oninput="Products.updateVariantCost(${variantIdx})">
                <button type="button" onclick="this.parentElement.remove(); Products.updateVariantCost(${variantIdx})" style="border: none; background: #ffebee; color: #c62828; padding: 4px 8px; border-radius: 4px; cursor: pointer;">×</button>
            </div>
        `;
    },
    
    // Generate topping row HTML for a variant
    getVariantToppingHTML(variantIdx, toppingIdx, topping = {}) {
        const options = Toppings.data.map(t => 
            `<option value="${t.id}" ${topping.recipeId === t.id ? 'selected' : ''}>${t.name}</option>`
        ).join('');
        
        return `
            <div class="variant-topping-row" style="display: flex; gap: 4px; margin-bottom: 4px;">
                <select name="variant_${variantIdx}_topping_${toppingIdx}_id" class="form-select" style="flex: 2; font-size: 0.85rem; padding: 4px;"
                        onchange="Products.updateVariantCost(${variantIdx})">
                    <option value="">Select...</option>
                    ${options}
                </select>
                <input type="number" name="variant_${variantIdx}_topping_${toppingIdx}_weight" class="form-input" 
                       value="${topping.weight || 10}" style="width: 55px; font-size: 0.85rem; padding: 4px;" placeholder="g"
                       oninput="Products.updateVariantCost(${variantIdx})">
                <button type="button" onclick="this.parentElement.remove(); Products.updateVariantCost(${variantIdx})" style="border: none; background: #ffebee; color: #c62828; padding: 4px 8px; border-radius: 4px; cursor: pointer;">×</button>
            </div>
        `;
    },
    
    // Add a new variant
    addVariant() {
        const variantsList = document.getElementById('variantsList');
        const idx = this.variantCounter++;
        variantsList.insertAdjacentHTML('beforeend', this.getVariantHTML(idx, {}));
    },
    
    // Remove a variant
    removeVariant(idx) {
        const section = document.querySelector(`.variant-section[data-idx="${idx}"]`);
        if (section) section.remove();
    },
    
    // Add filling to a variant
    addVariantFilling(variantIdx) {
        const container = document.getElementById(`variant_${variantIdx}_fillings`);
        const emptyMsg = container.querySelector('p');
        if (emptyMsg) emptyMsg.remove();
        
        const existingRows = container.querySelectorAll('.variant-filling-row').length;
        container.insertAdjacentHTML('beforeend', this.getVariantFillingHTML(variantIdx, existingRows, {}));
    },
    
    // Add topping to a variant
    addVariantTopping(variantIdx) {
        const container = document.getElementById(`variant_${variantIdx}_toppings`);
        const emptyMsg = container.querySelector('p');
        if (emptyMsg) emptyMsg.remove();
        
        const existingRows = container.querySelectorAll('.variant-topping-row').length;
        container.insertAdjacentHTML('beforeend', this.getVariantToppingHTML(variantIdx, existingRows, {}));
    },

    addFillingRow() {
        const container = document.getElementById('fillingsContainer');
        const emptyMsg = container.querySelector('p');
        if (emptyMsg) emptyMsg.remove();
        
        const idx = this.fillingCounter++;
        container.insertAdjacentHTML('beforeend', this.getFillingRowHTML(idx, {}));
        
        // Add event listeners for cost calculation
        const select = container.querySelector(`[name="filling_${idx}_id"]`);
        const weight = container.querySelector(`[name="filling_${idx}_weight"]`);
        if (select) select.addEventListener('change', () => this.updateCosts());
        if (weight) weight.addEventListener('input', () => this.updateCosts());
        
        this.updateCosts();
    },
    
    removeFillingRow(idx) {
        const row = document.querySelector(`.filling-row[data-idx="${idx}"]`);
        if (row) row.remove();
        
        const container = document.getElementById('fillingsContainer');
        if (!container.querySelector('.filling-row')) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem; margin: 8px 0;">No fillings. Click "+ Add Filling" to add one.</p>';
        }
        this.updateCosts();
    },
    
    addToppingRow() {
        const container = document.getElementById('toppingsContainer');
        const emptyMsg = container.querySelector('p');
        if (emptyMsg) emptyMsg.remove();
        
        const idx = this.toppingCounter++;
        container.insertAdjacentHTML('beforeend', this.getToppingRowHTML(idx, {}));
        
        // Add event listeners for cost calculation
        const select = container.querySelector(`[name="topping_${idx}_id"]`);
        const weight = container.querySelector(`[name="topping_${idx}_weight"]`);
        if (select) select.addEventListener('change', () => this.updateCosts());
        if (weight) weight.addEventListener('input', () => this.updateCosts());
        
        this.updateCosts();
    },
    
    removeToppingRow(idx) {
        const row = document.querySelector(`.topping-row[data-idx="${idx}"]`);
        if (row) row.remove();
        
        const container = document.getElementById('toppingsContainer');
        if (!container.querySelector('.topping-row')) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem; margin: 8px 0;">No toppings. Click "+ Add Topping" to add one.</p>';
        }
        this.updateCosts();
    },

    setupCostCalculation() {
        // Add event listeners to static inputs
        const staticInputs = ['doughRecipeId', 'doughWeight', 'packagingCost', 'laborCost', 'markupPercent', 'finalSRP'];
        staticInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateCosts());
                el.addEventListener('change', () => this.updateCosts());
            }
        });
        
        // Add event listeners to existing filling/topping rows
        document.querySelectorAll('.filling-select, .filling-weight, .topping-select, .topping-weight').forEach(el => {
            el.addEventListener('input', () => this.updateCosts());
            el.addEventListener('change', () => this.updateCosts());
        });
        
        // Initial calculation
        setTimeout(() => this.updateCosts(), 100);
    },
    
    updateCosts() {
        // Get dough values
        const doughId = document.getElementById('doughRecipeId')?.value;
        const doughWeight = parseFloat(document.getElementById('doughWeight')?.value) || 0;
        
        // Collect all fillings
        let fillingCost = 0;
        document.querySelectorAll('.filling-row').forEach(row => {
            const idx = row.dataset.idx;
            const recipeId = document.querySelector(`[name="filling_${idx}_id"]`)?.value;
            const weight = parseFloat(document.querySelector(`[name="filling_${idx}_weight"]`)?.value) || 0;
            const filling = Fillings.getById(recipeId);
            if (filling) {
                fillingCost += (filling.costPerGram || 0) * weight;
            }
        });

        // Collect all toppings
        let toppingCost = 0;
        document.querySelectorAll('.topping-row').forEach(row => {
            const idx = row.dataset.idx;
            const recipeId = document.querySelector(`[name="topping_${idx}_id"]`)?.value;
            const weight = parseFloat(document.querySelector(`[name="topping_${idx}_weight"]`)?.value) || 0;
            const topping = Toppings.getById(recipeId);
            if (topping) {
                toppingCost += (topping.costPerGram || 0) * weight;
            }
        });
        
        const packagingCost = parseFloat(document.getElementById('packagingCost')?.value) || 0;
        const laborCost = parseFloat(document.getElementById('laborCost')?.value) || 0;
        const markupPercent = parseFloat(document.getElementById('markupPercent')?.value) || 40;
        const finalSRP = parseFloat(document.getElementById('finalSRP')?.value) || 0;
        
        // Calculate dough cost
        const dough = Doughs.getById(doughId);
        const doughCost = dough ? (dough.costPerGram || 0) * doughWeight : 0;
        
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
        if (marginDisplay) {
            marginDisplay.textContent = actualMargin.toFixed(1) + '%';
            marginDisplay.style.color = actualMargin >= 30 ? 'var(--success)' : actualMargin >= 20 ? 'var(--warning)' : 'var(--danger)';
        }
    },


    getViewHTML(product) {
        const cost = this.calculateProductCost(product);
        const dough = Doughs.getById(product.doughRecipeId);
        const actualMargin = product.finalSRP > 0 ? ((product.finalSRP - cost.totalCost) / product.finalSRP * 100) : 0;
        
        // Handle legacy and new format
        const fillings = product.fillings || (product.fillingRecipeId ? [{recipeId: product.fillingRecipeId, weight: product.portioning?.fillingWeight || 0}] : []);
        const toppings = product.toppings || (product.toppingRecipeId ? [{recipeId: product.toppingRecipeId, weight: product.portioning?.toppingWeight || 0}] : []);
        
        // Get shop status from unified schema
        const shopStatus = this.getShopStatus(product);
        
        // Get main category
        const mainCat = this.getMainCategory(product.category) || product.mainCategory || 'bread';
        const isDrinks = mainCat === 'drinks';
        
        // Check for variants
        const hasVariants = product.hasVariants && product.variants && product.variants.length > 0;
        
        return `
            <div style="padding: 16px 0;">
                <div class="recipe-stat">
                    <span>Category:</span>
                    <span>${this.formatCategoryWithEmoji(product.category)}</span>
                </div>
                
                ${hasVariants ? `
                    <!-- VARIANTS VIEW -->
                    <div style="background: #E3F2FD; padding: 16px; border-radius: 12px; margin: 16px 0;">
                        <h4 style="margin: 0 0 12px; color: #1565C0;">🏷️ Variants (${product.variants.length})</h4>
                        ${product.variants.map((v, idx) => `
                            <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 8px; ${idx === 0 ? 'border: 2px solid #2196F3;' : ''}">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <strong style="font-size: 1.1rem;">${v.name}${v.size ? ` (${v.size})` : ''}</strong>
                                    <span style="font-size: 1.2rem; color: var(--primary); font-weight: bold;">${Utils.formatCurrency(v.price)}</span>
                                </div>
                                ${v.recipe ? `
                                    <div style="font-size: 0.85rem; color: #666;">
                                        ${isDrinks ? `
                                            ${v.recipe.ingredients?.length > 0 ? `<div>🧪 Ingredients: ${v.recipe.ingredients.map(i => {
                                                const ing = Ingredients.getById(i.ingredientId);
                                                return `${ing?.name || '?'} (${i.amount}g)`;
                                            }).join(', ')}</div>` : ''}
                                        ` : `
                                            ${v.recipe.doughRecipeId ? `<div>🥖 Dough: ${Doughs.getById(v.recipe.doughRecipeId)?.name || '?'} (${v.recipe.doughWeight || 0}g)</div>` : ''}
                                            ${v.recipe.fillings?.length > 0 ? `<div>🥥 Fillings: ${v.recipe.fillings.map(f => {
                                                const fill = Fillings.getById(f.recipeId);
                                                return `${fill?.name || '?'} (${f.weight}g)`;
                                            }).join(', ')}</div>` : ''}
                                        `}
                                        ${v.recipe.toppings?.length > 0 ? `<div>🧈 Toppings: ${v.recipe.toppings.map(t => {
                                            const top = Toppings.getById(t.recipeId);
                                            return `${top?.name || '?'} (${t.weight}g)`;
                                        }).join(', ')}</div>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <!-- SINGLE RECIPE VIEW -->
                    <h4 style="margin: 16px 0 8px;">Recipe Components</h4>
                    <div class="recipe-stat">
                        <span>🥖 Dough:</span>
                        <span>${dough?.name || 'Unknown'} (${product.portioning?.doughWeight || 0}g)</span>
                    </div>
                    
                    <div style="margin: 8px 0;">
                        <strong>🥥 Fillings:</strong>
                        ${fillings.length > 0 ? `
                            <ul style="margin: 4px 0 0 20px;">
                                ${fillings.map(f => {
                                    const filling = Fillings.getById(f.recipeId);
                                    return `<li>${filling?.name || 'Unknown'} (${f.weight}g)</li>`;
                                }).join('')}
                            </ul>
                        ` : ' <span style="color: var(--text-secondary);">None</span>'}
                    </div>
                    
                    <div style="margin: 8px 0;">
                        <strong>🧈 Toppings:</strong>
                        ${toppings.length > 0 ? `
                            <ul style="margin: 4px 0 0 20px;">
                                ${toppings.map(t => {
                                    const topping = Toppings.getById(t.recipeId);
                                    return `<li>${topping?.name || 'Unknown'} (${t.weight}g)</li>`;
                                }).join('')}
                            </ul>
                        ` : ' <span style="color: var(--text-secondary);">None</span>'}
                    </div>
                `}

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
                            <span>🥥 Fillings:</span>
                            <span>${Utils.formatCurrency(cost.fillingCost)}</span>
                        </div>
                        <div class="recipe-stat">
                            <span>🧈 Toppings:</span>
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
                        <span><strong>Final SRP:</strong></span>
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
                
                <!-- Website Status Section -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 16px; border-radius: 12px; margin: 16px 0; color: white;">
                    <h4 style="margin: 0 0 12px; color: white;">🌐 Website Status</h4>
                    
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 1.3rem;">${shopStatus.icon}</span>
                        <span style="font-size: 1.1rem;">${shopStatus.text}</span>
                    </div>
                    
                    ${product.shop ? `
                        <div style="background: rgba(255,255,255,0.15); padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 0.9rem;">
                            <div>Published: ${product.shop.isPublished ? '✅ Yes' : '❌ No'}</div>
                            ${product.shop.description ? `<div>Description: ✅ Set</div>` : `<div>Description: ⚠️ Missing</div>`}
                            ${product.shop.imageUrl || (product.shop.images && product.shop.images.length > 0) ? `<div>Image: ✅ Set</div>` : `<div>Image: ⚠️ Missing</div>`}
                        </div>
                    ` : ''}
                    
                    <button class="btn" onclick="Products.launchWebsiteAdmin(Products.getById('${product.id}'))" 
                            style="background: white; color: #764ba2; font-weight: bold; width: 100%;">
                        🚀 Edit on Website Admin
                    </button>
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
        const doughWeight = product.portioning?.doughWeight || 0;
        const doughCost = dough ? (dough.costPerGram || 0) * doughWeight : 0;
        
        // Handle legacy single filling/topping OR new array format
        let fillingCost = 0;
        if (product.fillings && Array.isArray(product.fillings)) {
            product.fillings.forEach(f => {
                const filling = Fillings.getById(f.recipeId);
                if (filling) {
                    fillingCost += (filling.costPerGram || 0) * (f.weight || 0);
                }
            });
        } else if (product.fillingRecipeId) {
            const filling = Fillings.getById(product.fillingRecipeId);
            const fillingWeight = product.portioning?.fillingWeight || 0;
            fillingCost = filling ? (filling.costPerGram || 0) * fillingWeight : 0;
        }
        
        let toppingCost = 0;
        if (product.toppings && Array.isArray(product.toppings)) {
            product.toppings.forEach(t => {
                const topping = Toppings.getById(t.recipeId);
                if (topping) {
                    toppingCost += (topping.costPerGram || 0) * (t.weight || 0);
                }
            });
        } else if (product.toppingRecipeId) {
            const topping = Toppings.getById(product.toppingRecipeId);
            const toppingWeight = product.portioning?.toppingWeight || 0;
            toppingCost = topping ? (topping.costPerGram || 0) * toppingWeight : 0;
        }
        
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
        
        // Check if variants mode is enabled
        const hasVariants = document.getElementById('hasVariantsCheckbox')?.checked || false;
        
        let data;
        
        if (hasVariants) {
            // ========== VARIANTS MODE ==========
            const variants = this.collectVariants();
            
            if (variants.length === 0) {
                Toast.error('Please add at least one variant with name and price');
                return;
            }
            
            // Validate variants
            for (const v of variants) {
                if (!v.name || !v.price) {
                    Toast.error('Each variant must have a name and price');
                    return;
                }
            }
            
            // Use first variant's price as base finalSRP
            const baseSRP = variants[0].price;
            
            data = {
                name: formData.get('name'),
                category: formData.get('category'),
                mainCategory: this.getMainCategory(formData.get('category')) || formData.get('mainCategory') || 'bread',
                baseBreadId: formData.get('baseBreadId') || null,
                // Store first variant's recipe as the "base" recipe for backward compatibility
                doughRecipeId: variants[0].recipe?.doughRecipeId || '',
                fillings: variants[0].recipe?.fillings || [],
                toppings: variants[0].recipe?.toppings || [],
                portioning: {
                    doughWeight: variants[0].recipe?.doughWeight || 40,
                    finalWeight: variants[0].recipe?.finalWeight || 38
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
                    packaging: variants[0].recipe?.packagingCost || 0,
                    labor: variants[0].recipe?.laborCost || 0
                },
                pricing: {
                    markupPercent: variants[0].recipe?.markupPercent || 40
                },
                finalSRP: baseSRP,
                hasVariants: true,
                variants: variants,
                notes: formData.get('notes') || ''
            };
        } else {
            // ========== SINGLE RECIPE MODE ==========
            // Collect fillings
            const fillings = [];
            document.querySelectorAll('#singleRecipeMode .filling-row').forEach(row => {
                const idx = row.dataset.idx;
                const recipeId = document.querySelector(`[name="filling_${idx}_id"]`)?.value;
                const weight = parseFloat(document.querySelector(`[name="filling_${idx}_weight"]`)?.value) || 0;
                if (recipeId && weight > 0) {
                    fillings.push({ recipeId, weight });
                }
            });
            
            // Collect toppings
            const toppings = [];
            document.querySelectorAll('#singleRecipeMode .topping-row').forEach(row => {
                const idx = row.dataset.idx;
                const recipeId = document.querySelector(`[name="topping_${idx}_id"]`)?.value;
                const weight = parseFloat(document.querySelector(`[name="topping_${idx}_weight"]`)?.value) || 0;
                if (recipeId && weight > 0) {
                    toppings.push({ recipeId, weight });
                }
            });
            
            data = {
                name: formData.get('name'),
                category: formData.get('category'),
                mainCategory: this.getMainCategory(formData.get('category')) || formData.get('mainCategory') || 'bread',
                baseBreadId: formData.get('baseBreadId') || null,
                doughRecipeId: formData.get('doughRecipeId'),
                fillings,
                toppings,
                portioning: {
                    doughWeight: parseFloat(formData.get('doughWeight')) || 40,
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
                hasVariants: false,
                variants: [],
                notes: formData.get('notes') || ''
            };
            
            // Validate based on category - only require dough for breads
            const isBread = data.mainCategory === 'bread';
            if (isBread && !data.doughRecipeId) {
                Toast.error('Please select a dough recipe');
                return;
            }
            
            if (!data.finalSRP || data.finalSRP <= 0) {
                Toast.error('Please enter the Final SRP (selling price for Loyverse)');
                return;
            }
        }
        
        if (!data.name) {
            Toast.error('Please enter a product name');
            return;
        }
        
        // Get isEnabled state (master switch)
        const isEnabled = document.getElementById('isEnabledCheckbox')?.checked !== false;
        data.isEnabled = isEnabled;
        
        // Get existing shop data or create new
        const existingProduct = id ? this.data.find(p => p.id === id) : null;
        
        // Prepare shop variants for website display
        const shopVariants = data.hasVariants ? data.variants.map(v => ({
            name: v.name,
            size: v.size || '',
            price: v.price
        })) : [];
        
        data.shop = {
            isPublished: document.getElementById('shopIsPublished')?.checked || false,
            description: existingProduct?.shop?.description || '',
            fullDescription: existingProduct?.shop?.fullDescription || '',
            imageUrl: existingProduct?.shop?.imageUrl || '',
            images: existingProduct?.shop?.images || [],
            hasVariants: data.hasVariants,
            variants: shopVariants
        };
        
        try {
            let productId = id;
            
            if (id) {
                await DB.update('products', id, data);
                Toast.success('Product updated');
            } else {
                productId = await DB.add('products', data);
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
    
    // Collect all variants from the form
    collectVariants() {
        const variants = [];
        document.querySelectorAll('.variant-section').forEach(section => {
            const idx = section.dataset.idx;
            
            const name = document.querySelector(`[name="variant_${idx}_name"]`)?.value?.trim();
            const size = document.querySelector(`[name="variant_${idx}_size"]`)?.value?.trim() || '';
            const price = parseFloat(document.querySelector(`[name="variant_${idx}_price"]`)?.value) || 0;
            
            // Collect variant recipe - BREADS fields
            const doughRecipeId = document.querySelector(`[name="variant_${idx}_doughRecipeId"]`)?.value || '';
            const doughWeight = parseFloat(document.querySelector(`[name="variant_${idx}_doughWeight"]`)?.value) || 40;
            const finalWeight = parseFloat(document.querySelector(`[name="variant_${idx}_finalWeight"]`)?.value) || 38;
            
            // Collect variant recipe - DRINKS fields
            const cupSize = parseFloat(document.querySelector(`[name="variant_${idx}_cupSize"]`)?.value) || 12;
            
            // Common fields
            const packagingCost = parseFloat(document.querySelector(`[name="variant_${idx}_packagingCost"]`)?.value) || 0.50;
            const laborCost = parseFloat(document.querySelector(`[name="variant_${idx}_laborCost"]`)?.value) || 1.00;
            const markupPercent = parseFloat(document.querySelector(`[name="variant_${idx}_markupPercent"]`)?.value) || 40;
            
            // Collect variant fillings (for breads)
            const fillings = [];
            const fillingsContainer = document.getElementById(`variant_${idx}_fillings`);
            if (fillingsContainer) {
                fillingsContainer.querySelectorAll('.variant-filling-row').forEach((row, fidx) => {
                    const recipeId = row.querySelector(`[name="variant_${idx}_filling_${fidx}_id"]`)?.value;
                    const weight = parseFloat(row.querySelector(`[name="variant_${idx}_filling_${fidx}_weight"]`)?.value) || 0;
                    if (recipeId && weight > 0) {
                        fillings.push({ recipeId, weight });
                    }
                });
            }
            
            // Collect variant toppings (for both breads and drinks)
            const toppings = [];
            const toppingsContainer = document.getElementById(`variant_${idx}_toppings`);
            if (toppingsContainer) {
                toppingsContainer.querySelectorAll('.variant-topping-row').forEach((row, tidx) => {
                    const recipeId = row.querySelector(`[name="variant_${idx}_topping_${tidx}_id"]`)?.value;
                    const weight = parseFloat(row.querySelector(`[name="variant_${idx}_topping_${tidx}_weight"]`)?.value) || 0;
                    if (recipeId && weight > 0) {
                        toppings.push({ recipeId, weight });
                    }
                });
            }
            
            // Collect variant ingredients (for drinks)
            const ingredients = [];
            const ingredientsContainer = document.getElementById(`variant_${idx}_ingredients`);
            if (ingredientsContainer) {
                ingredientsContainer.querySelectorAll('.variant-ingredient-row').forEach((row, iidx) => {
                    const ingredientId = row.querySelector(`[name="variant_${idx}_ingredient_${iidx}_id"]`)?.value;
                    const amount = parseFloat(row.querySelector(`[name="variant_${idx}_ingredient_${iidx}_amount"]`)?.value) || 0;
                    if (ingredientId && amount > 0) {
                        ingredients.push({ ingredientId, amount });
                    }
                });
            }
            
            if (name) {
                variants.push({
                    name,
                    size,
                    price,
                    recipe: {
                        // Breads fields
                        doughRecipeId,
                        doughWeight,
                        finalWeight,
                        fillings,
                        // Drinks fields
                        cupSize,
                        ingredients,
                        // Common fields
                        toppings,
                        packagingCost,
                        laborCost,
                        markupPercent
                    }
                });
            }
        });
        
        return variants;
    },
    
    async delete(id) {
        const product = this.data.find(p => p.id === id);
        if (!product) return;
        
        let confirmMsg = `Delete "${product.name}"?`;
        
        if (product.shop?.isPublished) {
            confirmMsg += `\n\n⚠️ This product is published on the website. It will be removed from there too.`;
        }
        
        if (!confirm(confirmMsg)) return;
        
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
