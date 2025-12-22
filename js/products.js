/**
 * BreadHub ProofMaster - Products Management
 * Handles product assembly combining dough + multiple toppings + multiple fillings
 * With full cost breakdown and SRP calculation
 * 
 * ✅ INTEGRATED with BreadHub.shop Website
 * - Two-way sync with shopProducts collection
 * - Auto-creates shop product on save
 * - Launch Website Admin button
 */

const Products = {
    data: [],
    categories: [],
    shopProducts: [], // Cache of website products for linking
    
    // Unified categories (synced with website)
    defaultCategories: [
        { value: 'donut', label: 'Donuts', emoji: '🍩' },
        { value: 'savory', label: 'Savory', emoji: '🥐' },
        { value: 'loaf', label: 'Loaf Breads', emoji: '🍞' },
        { value: 'cookies', label: 'Cookies', emoji: '🍪' },
        { value: 'cinnamon-rolls', label: 'Cinnamon Rolls', emoji: '🥮' },
        { value: 'classic-filipino', label: 'Classic Filipino', emoji: '🥖' },
        { value: 'roti', label: 'Roti', emoji: '🫓' },
        { value: 'cakes', label: 'Cakes', emoji: '🎂' },
        { value: 'pandesal', label: 'Pandesal', emoji: '🥯' },
        { value: 'desserts', label: 'Desserts', emoji: '🧁' },
        { value: 'drinks', label: 'Drinks', emoji: '🥤' },
        { value: 'coffee', label: 'Coffee', emoji: '☕' },
        { value: 'non-coffee', label: 'Non-Coffee Drinks', emoji: '🧃' }
    ],
    
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
        await this.loadShopProducts();
        this.render();
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
    
    // Load shop products for linking
    async loadShopProducts() {
        try {
            this.shopProducts = await DB.getAll('shopProducts');
        } catch (error) {
            console.error('Error loading shop products:', error);
            this.shopProducts = [];
        }
    },
    
    // Find linked shop product
    getLinkedShopProduct(productId) {
        return this.shopProducts.find(sp => sp.proofmasterProductId === productId);
    },
    
    // Find shop product by name (for initial auto-linking)
    findShopProductByName(name) {
        const normalizedName = name.toLowerCase().trim();
        return this.shopProducts.find(sp => 
            sp.name.toLowerCase().trim() === normalizedName
        );
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
            
            // Check sync status
            const linkedShop = this.getLinkedShopProduct(product.id);
            const syncStatus = this.getSyncStatus(product, linkedShop);
            
            return `
            <div class="recipe-card" data-id="${product.id}">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, #8E44AD 0%, #9B59B6 100%);">
                    <h3>${product.name}</h3>
                    <span class="version">${this.formatCategoryWithEmoji(product.category)}</span>
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
                        <span><strong>Final SRP:</strong></span>
                        <span style="color: var(--primary); font-size: 1.2rem;"><strong>${Utils.formatCurrency(product.finalSRP || 0)}</strong></span>
                    </div>
                    <div class="recipe-stat">
                        <span>Margin:</span>
                        <span style="color: ${marginPercent >= 30 ? 'var(--success)' : marginPercent >= 20 ? 'var(--warning)' : 'var(--danger)'}">
                            <strong>${marginPercent.toFixed(1)}%</strong>
                        </span>
                    </div>
                    
                    <!-- Website Sync Status -->
                    <div class="recipe-stat" style="background: ${syncStatus.color}; padding: 6px 8px; border-radius: 6px; margin-top: 8px;">
                        <span style="font-size: 0.85rem;">${syncStatus.icon} Website:</span>
                        <span style="font-size: 0.85rem; font-weight: 500;">${syncStatus.text}</span>
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
    
    getSyncStatus(product, linkedShop) {
        if (!linkedShop) {
            return {
                icon: '⚠️',
                text: 'Not linked',
                color: '#FFF3CD'
            };
        }
        
        // Check if prices match
        const priceMatch = Math.abs((linkedShop.price || 0) - (product.finalSRP || 0)) < 0.01;
        
        if (priceMatch) {
            return {
                icon: '✅',
                text: `Synced (₱${product.finalSRP})`,
                color: '#D4EDDA'
            };
        } else {
            return {
                icon: '🔄',
                text: `Price mismatch (Shop: ₱${linkedShop.price})`,
                color: '#F8D7DA'
            };
        }
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
    
    // ========== LINK TO WEBSITE PRODUCT MODAL ==========
    async showLinkModal(productId) {
        const product = this.data.find(p => p.id === productId);
        if (!product) return;
        
        await this.loadShopProducts();
        
        // Find unlinked shop products (those without proofmasterProductId)
        const unlinkedShopProducts = this.shopProducts.filter(sp => !sp.proofmasterProductId);
        
        if (unlinkedShopProducts.length === 0) {
            Modal.open({
                title: '🔗 Link to Website Product',
                content: `
                    <div style="padding: 16px; text-align: center;">
                        <p>No unlinked website products found.</p>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">
                            All website products are already linked to ProofMaster products.
                        </p>
                    </div>
                `,
                showFooter: false,
                width: '450px'
            });
            return;
        }
        
        // Sort: matching names first, then alphabetically
        const productNameLower = product.name.toLowerCase().trim();
        const sortedProducts = [...unlinkedShopProducts].sort((a, b) => {
            const aName = a.name.toLowerCase().trim();
            const bName = b.name.toLowerCase().trim();
            const aMatch = aName.includes(productNameLower) || productNameLower.includes(aName);
            const bMatch = bName.includes(productNameLower) || productNameLower.includes(bName);
            
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return a.name.localeCompare(b.name);
        });
        
        // Store for filtering
        window._linkModalProducts = sortedProducts;
        window._linkModalProductId = productId;
        
        Modal.open({
            title: `🔗 Link "${product.name}" to Website`,
            content: `
                <div style="padding: 8px 0;">
                    <div style="margin-bottom: 12px;">
                        <input type="text" id="linkSearchInput" class="form-input" 
                               placeholder="🔍 Search website products..." 
                               oninput="Products.filterLinkModal(this.value)"
                               style="width: 100%;">
                    </div>
                    <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 0.9rem;">
                        Showing ${sortedProducts.length} unlinked website products:
                    </p>
                    <div id="linkProductsList" style="max-height: 400px; overflow-y: auto;">
                        ${this.renderLinkProductsList(sortedProducts, productId, productNameLower)}
                    </div>
                </div>
            `,
            showFooter: false,
            width: '500px'
        });
        
        // Focus search input
        setTimeout(() => document.getElementById('linkSearchInput')?.focus(), 100);
    },
    
    // Render the list of products for linking
    renderLinkProductsList(products, productId, highlightName = '') {
        if (products.length === 0) {
            return '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No matching products found</p>';
        }
        
        return products.map(sp => {
            const spNameLower = sp.name.toLowerCase().trim();
            const isMatch = highlightName && (spNameLower.includes(highlightName) || highlightName.includes(spNameLower));
            
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: ${isMatch ? '#E8F5E9' : 'var(--bg-input)'}; border-radius: 8px; margin-bottom: 8px; ${isMatch ? 'border: 2px solid var(--success);' : ''}">
                    <div>
                        <strong>${sp.name}</strong>
                        ${isMatch ? '<span style="color: var(--success); font-size: 0.8rem; margin-left: 8px;">⭐ Name match!</span>' : ''}
                        <br>
                        <small style="color: var(--text-secondary);">₱${sp.price || 0} • ${sp.category || 'No category'}</small>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="Products.linkToShopProduct('${productId}', '${sp.id}')">
                        Link
                    </button>
                </div>
            `;
        }).join('');
    },
    
    // Filter the link modal list
    filterLinkModal(searchTerm) {
        const products = window._linkModalProducts || [];
        const productId = window._linkModalProductId;
        const product = this.data.find(p => p.id === productId);
        const productNameLower = product?.name.toLowerCase().trim() || '';
        
        const filtered = searchTerm.trim() 
            ? products.filter(sp => sp.name.toLowerCase().includes(searchTerm.toLowerCase()))
            : products;
        
        const listContainer = document.getElementById('linkProductsList');
        if (listContainer) {
            listContainer.innerHTML = this.renderLinkProductsList(filtered, productId, productNameLower);
        }
    },
    
    // Link ProofMaster product to Shop product
    async linkToShopProduct(productId, shopProductId) {
        try {
            // Update both records
            await DB.update('shopProducts', shopProductId, {
                proofmasterProductId: productId
            });
            await DB.update('products', productId, {
                shopProductId: shopProductId,
                lastSyncedAt: new Date().toISOString()
            });
            
            // Update local data
            const product = this.data.find(p => p.id === productId);
            if (product) product.shopProductId = shopProductId;
            
            const shopProduct = this.shopProducts.find(sp => sp.id === shopProductId);
            if (shopProduct) shopProduct.proofmasterProductId = productId;
            
            Modal.close();
            Toast.success(`Linked successfully! You can now sync prices.`);
            
            // Refresh the edit modal
            this.edit(productId);
            
        } catch (error) {
            console.error('Error linking products:', error);
            Toast.error('Failed to link products');
        }
    },
    
    // ========== SYNC MODAL ==========
    async showSyncModal() {
        await this.loadShopProducts();
        
        // Analyze sync status
        let linked = 0;
        let unlinked = 0;
        let priceMismatch = 0;
        const unlinkedProducts = [];
        const mismatchProducts = [];
        
        for (const product of this.data) {
            const shopProduct = this.getLinkedShopProduct(product.id);
            if (shopProduct) {
                linked++;
                if (Math.abs((shopProduct.price || 0) - (product.finalSRP || 0)) >= 0.01) {
                    priceMismatch++;
                    mismatchProducts.push({ pm: product, shop: shopProduct });
                }
            } else {
                unlinked++;
                // Try to find by name
                const byName = this.findShopProductByName(product.name);
                unlinkedProducts.push({ pm: product, possibleMatch: byName });
            }
        }
        
        Modal.open({
            title: '🔄 Website Sync Status',
            content: `
                <div style="padding: 8px 0;">
                    <!-- Summary -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                        <div style="background: #D4EDDA; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 2rem; font-weight: bold; color: var(--success);">${linked}</div>
                            <div style="font-size: 0.85rem;">Linked</div>
                        </div>
                        <div style="background: #FFF3CD; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 2rem; font-weight: bold; color: #856404;">${unlinked}</div>
                            <div style="font-size: 0.85rem;">Not Linked</div>
                        </div>
                        <div style="background: #F8D7DA; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 2rem; font-weight: bold; color: var(--danger);">${priceMismatch}</div>
                            <div style="font-size: 0.85rem;">Price Mismatch</div>
                        </div>
                    </div>
                    
                    ${unlinked > 0 ? `
                        <h4 style="margin-bottom: 12px;">⚠️ Unlinked Products (${unlinked})</h4>
                        <div style="max-height: 200px; overflow-y: auto; margin-bottom: 16px;">
                            ${unlinkedProducts.map(({ pm, possibleMatch }) => `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: var(--bg-input); border-radius: 6px; margin-bottom: 4px;">
                                    <span>${pm.name}</span>
                                    ${possibleMatch ? `
                                        <span style="color: var(--success); font-size: 0.85rem;">🔗 Match found</span>
                                    ` : `
                                        <span style="color: var(--text-secondary); font-size: 0.85rem;">New</span>
                                    `}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${priceMismatch > 0 ? `
                        <h4 style="margin-bottom: 12px;">💰 Price Mismatches (${priceMismatch})</h4>
                        <div style="max-height: 150px; overflow-y: auto; margin-bottom: 16px;">
                            ${mismatchProducts.map(({ pm, shop }) => `
                                <div style="padding: 8px; background: #FFF3CD; border-radius: 6px; margin-bottom: 4px;">
                                    <strong>${pm.name}</strong><br>
                                    <small>ProofMaster: ₱${pm.finalSRP} → Website: ₱${shop.price}</small>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 8px; margin-top: 16px;">
                        <button class="btn btn-primary" onclick="Products.runFullSync()" style="flex: 1;">
                            🚀 Run Full Sync
                        </button>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 12px; text-align: center;">
                        This will link products by name and sync all prices from ProofMaster → Website
                    </p>
                </div>
            `,
            showFooter: false,
            width: '550px'
        });
    },
    
    // ========== FULL SYNC ==========
    async runFullSync() {
        Modal.close();
        Toast.info('Starting sync...');
        
        let linked = 0;
        let created = 0;
        let pricesUpdated = 0;
        let errors = 0;
        
        try {
            await this.loadShopProducts();
            
            for (const product of this.data) {
                try {
                    // Check if already linked
                    let shopProduct = this.getLinkedShopProduct(product.id);
                    
                    if (!shopProduct) {
                        // Try to find by name and link
                        shopProduct = this.findShopProductByName(product.name);
                        
                        if (shopProduct) {
                            // Link existing shop product
                            await DB.update('shopProducts', shopProduct.id, {
                                proofmasterProductId: product.id
                            });
                            await DB.update('products', product.id, {
                                shopProductId: shopProduct.id,
                                lastSyncedAt: new Date().toISOString()
                            });
                            shopProduct.proofmasterProductId = product.id;
                            product.shopProductId = shopProduct.id;
                            linked++;
                        } else {
                            // Create new shop product
                            const newShopProductId = await this.createShopProduct(product);
                            if (newShopProductId) {
                                await DB.update('products', product.id, {
                                    shopProductId: newShopProductId,
                                    lastSyncedAt: new Date().toISOString()
                                });
                                product.shopProductId = newShopProductId;
                                created++;
                            }
                        }
                    }
                    
                    // Sync price if linked
                    if (shopProduct || product.shopProductId) {
                        const shopId = shopProduct?.id || product.shopProductId;
                        const currentShop = this.shopProducts.find(sp => sp.id === shopId);
                        
                        if (currentShop && Math.abs((currentShop.price || 0) - (product.finalSRP || 0)) >= 0.01) {
                            await DB.update('shopProducts', shopId, {
                                price: product.finalSRP
                            });
                            pricesUpdated++;
                        }
                    }
                } catch (err) {
                    console.error(`Error syncing ${product.name}:`, err);
                    errors++;
                }
            }
            
            // Reload data
            await this.loadShopProducts();
            await this.load();
            this.render();
            
            Toast.success(`Sync complete! Linked: ${linked}, Created: ${created}, Prices updated: ${pricesUpdated}${errors > 0 ? `, Errors: ${errors}` : ''}`);
            
        } catch (error) {
            console.error('Sync error:', error);
            Toast.error('Sync failed: ' + error.message);
        }
    },
    
    // Create a new shop product from ProofMaster product
    async createShopProduct(product) {
        try {
            const shopData = {
                name: product.name,
                price: product.finalSRP || 0,
                category: product.category,
                description: '',
                fullDescription: '',
                isActive: true,
                proofmasterProductId: product.id,
                hasVariants: false,
                variants: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection('shopProducts').add(shopData);
            
            // Add to local cache
            this.shopProducts.push({ id: docRef.id, ...shopData });
            
            return docRef.id;
        } catch (error) {
            console.error('Error creating shop product:', error);
            return null;
        }
    },


    // ========== SYNC TO WEBSITE ON SAVE ==========
    // Only syncs if product is ALREADY linked - does NOT create or auto-link
    async syncToWebsite(productId, productData) {
        try {
            // Reload shop products to ensure we have latest data
            await this.loadShopProducts();
            
            // Find by existing link (proofmasterProductId)
            let shopProduct = this.getLinkedShopProduct(productId);
            
            // Also check by shopProductId stored in product
            if (!shopProduct && productData.shopProductId) {
                shopProduct = this.shopProducts.find(sp => sp.id === productData.shopProductId);
            }
            
            if (shopProduct) {
                // Update existing shop product price
                await DB.update('shopProducts', shopProduct.id, {
                    price: productData.finalSRP,
                    updatedAt: new Date().toISOString()
                });
                console.log(`Synced price ₱${productData.finalSRP} to website for ${productData.name}`);
                return true;
            } else {
                // Not linked - don't create or auto-link
                console.log(`Product "${productData.name}" is not linked to website. Skipping sync.`);
                return false;
            }
        } catch (error) {
            console.error('Error syncing to website:', error);
            return false;
        }
    },
    
    // ========== LAUNCH WEBSITE ADMIN ==========
    launchWebsiteAdmin(product) {
        // Build URL with pre-populated data
        const params = new URLSearchParams({
            prefill: 'true',
            name: product.name,
            price: product.finalSRP || 0,
            category: product.category || '',
            proofmasterId: product.id
        });
        
        // Use breadhub.shop admin URL (works both locally and on Netlify)
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
        
        Modal.open({
            title: 'Edit Product',
            content: this.getFormHTML(product),
            saveText: 'Update Product',
            width: '900px',
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
        
        // Handle legacy single filling/topping OR new array format
        const fillings = product.fillings || (product.fillingRecipeId ? [{recipeId: product.fillingRecipeId, weight: product.portioning?.fillingWeight || 0}] : []);
        const toppings = product.toppings || (product.toppingRecipeId ? [{recipeId: product.toppingRecipeId, weight: product.portioning?.toppingWeight || 0}] : []);
        
        // Sync status for existing products
        const linkedShop = product.id ? this.getLinkedShopProduct(product.id) : null;
        const syncStatus = product.id ? this.getSyncStatus(product, linkedShop) : null;
        
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
                        <select name="category" class="form-select">
                            ${this.defaultCategories.map(cat => 
                                `<option value="${cat.value}" ${product.category === cat.value ? 'selected' : ''}>${cat.emoji} ${cat.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
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
                
                <!-- WEBSITE INTEGRATION SECTION -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin: 20px 0; color: white;">
                    <h4 style="margin: 0 0 12px; color: white;">🌐 Website Integration (breadhub.shop)</h4>
                    
                    ${product.id ? `
                        <!-- Sync Status -->
                        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                            ${linkedShop ? `
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 1.2rem;">✅</span>
                                    <span><strong>Linked</strong> to website product</span>
                                </div>
                                <small style="opacity: 0.8;">Shop ID: ${linkedShop.id}</small><br>
                                <small style="opacity: 0.8;">Shop Price: ₱${linkedShop.price || 0}</small>
                            ` : `
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 1.2rem;">⚠️</span>
                                    <span><strong>Not linked</strong> to any website product</span>
                                </div>
                                <button type="button" class="btn btn-sm" onclick="Products.showLinkModal('${product.id}')" 
                                        style="background: white; color: #764ba2; margin-top: 8px;">
                                    🔗 Link to Existing Website Product
                                </button>
                            `}
                        </div>
                        
                        <!-- Auto-sync checkbox -->
                        <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" name="autoSyncWebsite" id="autoSyncWebsite" 
                                       ${product.autoSyncWebsite !== false ? 'checked' : ''}
                                       style="width: 20px; height: 20px; cursor: pointer;">
                                <span style="font-size: 1rem;">
                                    <strong>Auto-sync price to website</strong><br>
                                    <small style="opacity: 0.8;">When enabled, saving will update the website price</small>
                                </span>
                            </label>
                        </div>
                    ` : `
                        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                            <span>💡 Save the product first to enable website linking.</span>
                        </div>
                    `}
                    
                    ${product.id && linkedShop ? `
                        <button type="button" class="btn" onclick="Products.launchWebsiteAdmin(Products.getById('${product.id}'))" 
                                style="background: white; color: #764ba2; font-weight: bold; width: 100%;">
                            🚀 Launch Website Admin (Add Images, SEO, Description)
                        </button>
                    ` : product.id ? `
                        <p style="font-size: 0.85rem; opacity: 0.8; text-align: center;">
                            Link to a website product first, then you can launch Website Admin.
                        </p>
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
        
        // Sync status
        const linkedShop = this.getLinkedShopProduct(product.id);
        const syncStatus = this.getSyncStatus(product, linkedShop);
        
        return `
            <div style="padding: 16px 0;">
                <div class="recipe-stat">
                    <span>Category:</span>
                    <span>${this.formatCategoryWithEmoji(product.category)}</span>
                </div>
                
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
                
                <!-- Website Integration Section -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 16px; border-radius: 12px; margin: 16px 0; color: white;">
                    <h4 style="margin: 0 0 12px; color: white;">🌐 Website Status</h4>
                    
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 1.3rem;">${syncStatus.icon}</span>
                        <span style="font-size: 1.1rem;">${syncStatus.text}</span>
                    </div>
                    
                    ${linkedShop ? `
                        <div style="background: rgba(255,255,255,0.15); padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 0.9rem;">
                            <div>Shop Price: <strong>₱${linkedShop.price || 0}</strong></div>
                            <div>Active: ${linkedShop.isActive ? '✅ Yes' : '❌ No'}</div>
                            ${linkedShop.description ? `<div>Description: ✅ Set</div>` : `<div>Description: ⚠️ Missing</div>`}
                            ${linkedShop.imageUrl ? `<div>Image: ✅ Set</div>` : `<div>Image: ⚠️ Missing</div>`}
                        </div>
                    ` : ''}
                    
                    <button class="btn" onclick="Products.launchWebsiteAdmin(Products.getById('${product.id}'))" 
                            style="background: white; color: #764ba2; font-weight: bold; width: 100%;">
                        🚀 Launch Website Admin
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
        
        // Collect fillings
        const fillings = [];
        document.querySelectorAll('.filling-row').forEach(row => {
            const idx = row.dataset.idx;
            const recipeId = document.querySelector(`[name="filling_${idx}_id"]`)?.value;
            const weight = parseFloat(document.querySelector(`[name="filling_${idx}_weight"]`)?.value) || 0;
            if (recipeId && weight > 0) {
                fillings.push({ recipeId, weight });
            }
        });
        
        // Collect toppings
        const toppings = [];
        document.querySelectorAll('.topping-row').forEach(row => {
            const idx = row.dataset.idx;
            const recipeId = document.querySelector(`[name="topping_${idx}_id"]`)?.value;
            const weight = parseFloat(document.querySelector(`[name="topping_${idx}_weight"]`)?.value) || 0;
            if (recipeId && weight > 0) {
                toppings.push({ recipeId, weight });
            }
        });
        
        const data = {
            name: formData.get('name'),
            category: formData.get('category'),
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
            autoSyncWebsite: document.getElementById('autoSyncWebsite')?.checked !== false,
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
            let productId = id;
            
            if (id) {
                await DB.update('products', id, data);
                Toast.success('Product updated');
            } else {
                productId = await DB.add('products', data);
                Toast.success('Product created');
            }
            
            // Only sync to website if auto-sync is enabled AND product is already linked
            const existingProduct = id ? this.data.find(p => p.id === id) : null;
            const isLinked = existingProduct?.shopProductId || this.getLinkedShopProduct(productId);
            
            if (data.autoSyncWebsite && isLinked) {
                await this.syncToWebsite(productId, data);
                Toast.info('Price synced to website');
            }
            
            Modal.close();
            await this.load();
            await this.loadShopProducts();
            this.render();
            
        } catch (error) {
            console.error('Error saving product:', error);
            Toast.error('Failed to save product');
        }
    },
    
    async delete(id) {
        const product = this.data.find(p => p.id === id);
        if (!product) return;
        
        const linkedShop = this.getLinkedShopProduct(id);
        let confirmMsg = `Delete "${product.name}"?`;
        
        if (linkedShop) {
            confirmMsg += `\n\nThis product is linked to the website. The website product will NOT be deleted automatically.`;
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
