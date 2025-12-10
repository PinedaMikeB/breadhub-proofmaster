/**
 * BreadHub ProofMaster - Ingredient Prices
 * Handles multiple suppliers/prices per ingredient
 */

const IngredientPrices = {
    data: [],
    
    async init() {
        await this.load();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('ingredientPrices');
        } catch (error) {
            console.error('Error loading ingredient prices:', error);
        }
    },
    
    // Get all prices for an ingredient (sorted by cost per gram)
    getByIngredient(ingredientId) {
        return this.data
            .filter(p => p.ingredientId === ingredientId)
            .sort((a, b) => (a.costPerGram || 0) - (b.costPerGram || 0));
    },
    
    // Get all prices from a supplier
    getBySupplier(supplierId) {
        return this.data.filter(p => p.supplierId === supplierId);
    },
    
    // Get the cheapest price for an ingredient (within service area)
    getCheapest(ingredientId, serviceAreaOnly = true) {
        let prices = this.getByIngredient(ingredientId);
        
        if (serviceAreaOnly) {
            prices = prices.filter(p => {
                const supplier = Suppliers.getById(p.supplierId);
                return supplier && Suppliers.isInServiceArea(supplier.location);
            });
        }
        
        return prices[0] || null; // Already sorted by costPerGram
    },
    
    // Get the last purchase price for an ingredient
    getLastPurchase(ingredientId) {
        const prices = this.data
            .filter(p => p.ingredientId === ingredientId && p.lastPurchaseDate)
            .sort((a, b) => new Date(b.lastPurchaseDate) - new Date(a.lastPurchaseDate));
        
        return prices[0] || null;
    },
    
    // Get price for costing (based on ingredient's costing method)
    getPriceForCosting(ingredientId) {
        const ingredient = Ingredients.getById(ingredientId);
        if (!ingredient) return null;
        
        const method = ingredient.costingMethod || 'lastPurchase';
        
        switch (method) {
            case 'cheapest':
                return this.getCheapest(ingredientId);
            case 'preferred':
                if (ingredient.preferredSupplierId) {
                    return this.data.find(p => 
                        p.ingredientId === ingredientId && 
                        p.supplierId === ingredient.preferredSupplierId
                    );
                }
                return this.getCheapest(ingredientId);
            case 'lastPurchase':
            default:
                return this.getLastPurchase(ingredientId) || this.getCheapest(ingredientId);
        }
    },
    
    // Add or update price
    async savePrice(data) {
        // Check if this supplier-ingredient combo exists
        const existing = this.data.find(p => 
            p.ingredientId === data.ingredientId && 
            p.supplierId === data.supplierId
        );
        
        // Calculate cost per gram
        data.costPerGram = data.packageSize > 0 ? data.purchasePrice / data.packageSize : 0;
        
        // Get names for easy display
        const ingredient = Ingredients.getById(data.ingredientId);
        const supplier = Suppliers.getById(data.supplierId);
        data.ingredientName = ingredient?.name || '';
        data.supplierName = supplier?.companyName || '';
        
        try {
            if (existing) {
                await DB.update('ingredientPrices', existing.id, data);
            } else {
                await DB.add('ingredientPrices', data);
            }
            await this.load();
            return true;
        } catch (error) {
            console.error('Error saving price:', error);
            return false;
        }
    },
    
    // Delete price
    async deletePrice(id) {
        try {
            await DB.delete('ingredientPrices', id);
            await this.load();
            return true;
        } catch (error) {
            console.error('Error deleting price:', error);
            return false;
        }
    },
    
    // Update price after purchase (mark as last purchase)
    async recordPurchase(ingredientId, supplierId, purchasePrice, packageSize) {
        const data = {
            ingredientId,
            supplierId,
            purchasePrice,
            packageSize,
            lastPurchaseDate: new Date().toISOString()
        };
        
        return await this.savePrice(data);
    },
    
    // Get comparison table data for an ingredient
    getComparisonTable(ingredientId, qtyNeeded = 0) {
        const prices = this.getByIngredient(ingredientId);
        
        return prices.map(price => {
            const supplier = Suppliers.getById(price.supplierId);
            const inServiceArea = supplier ? Suppliers.isInServiceArea(supplier.location) : false;
            
            // Calculate how many packages needed
            const packagesNeeded = qtyNeeded > 0 ? Math.ceil(qtyNeeded / price.packageSize) : 1;
            const itemTotal = packagesNeeded * price.purchasePrice;
            
            // Calculate delivery
            const deliveryFee = supplier ? Suppliers.calculateDeliveryFee(supplier.id, itemTotal) : 0;
            const grandTotal = itemTotal + deliveryFee;
            
            return {
                priceId: price.id,
                supplierId: price.supplierId,
                supplierName: supplier?.companyName || 'Unknown',
                location: supplier?.location || '-',
                inServiceArea,
                purchasePrice: price.purchasePrice,
                packageSize: price.packageSize,
                costPerGram: price.costPerGram,
                packagesNeeded,
                itemTotal,
                deliveryFee,
                grandTotal,
                lastPurchaseDate: price.lastPurchaseDate
            };
        }).sort((a, b) => {
            // Sort: service area first, then by grand total
            if (a.inServiceArea && !b.inServiceArea) return -1;
            if (!a.inServiceArea && b.inServiceArea) return 1;
            return a.grandTotal - b.grandTotal;
        });
    }
};
