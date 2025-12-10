/**
 * BreadHub ProofMaster - Sample Data Seeder
 * Run this after Firebase is configured to populate sample data
 * 
 * Usage: Open browser console and run: SeedData.seedAll()
 */

const SeedData = {
    // Sample suppliers
    suppliers: [
        { 
            companyName: 'Champion Flour Mills', 
            contactName: 'Sales Team',
            mobile: '09171234567',
            email: 'sales@champion.com.ph',
            facebook: 'https://facebook.com/championflour',
            address: 'Makati City',
            notes: 'Delivers every Monday and Thursday'
        },
        { 
            companyName: 'Metro Market Supplies', 
            contactName: 'Maria Santos',
            mobile: '09181234567',
            facebook: 'https://facebook.com/metromarket',
            address: 'Taytay, Rizal',
            notes: 'Good for dairy and eggs. Cash on delivery.'
        },
        { 
            companyName: 'Baking Essentials PH', 
            contactName: 'John Cruz',
            mobile: '09191234567',
            email: 'orders@bakingessentials.ph',
            website: 'https://bakingessentials.ph',
            address: 'Pasig City',
            notes: 'Online orders, delivers via Lalamove'
        }
    ],
    
    // Sample ingredients with purchase price and package size
    ingredients: [
        { name: 'Bread Flour (Champion)', category: 'flour', purchasePrice: 45, packageSize: 1000, supplierIndex: 0 },
        { name: 'Water', category: 'other', purchasePrice: 25, packageSize: 5000, supplierIndex: 1 },
        { name: 'Instant Yeast (Saf)', category: 'leavening', purchasePrice: 80, packageSize: 125, supplierIndex: 2 },
        { name: 'White Sugar', category: 'sugar', purchasePrice: 58, packageSize: 1000, supplierIndex: 1 },
        { name: 'Butter (Anchor)', category: 'fat', purchasePrice: 95, packageSize: 227, supplierIndex: 1 },
        { name: 'Salt (Iodized)', category: 'other', purchasePrice: 15, packageSize: 1000, supplierIndex: 1 },
        { name: 'Eggs (Large)', category: 'egg', purchasePrice: 8, packageSize: 60, supplierIndex: 1 },
        { name: 'Desiccated Coconut', category: 'filling', purchasePrice: 85, packageSize: 1000, supplierIndex: 2 },
        { name: 'Brown Sugar', category: 'sugar', purchasePrice: 62, packageSize: 1000, supplierIndex: 1 },
        { name: 'Condensed Milk (Alaska)', category: 'dairy', purchasePrice: 45, packageSize: 300, supplierIndex: 1 },
        { name: 'Cinnamon Powder', category: 'flavoring', purchasePrice: 45, packageSize: 50, supplierIndex: 2 },
        { name: 'Milk Powder (Anchor)', category: 'dairy', purchasePrice: 140, packageSize: 500, supplierIndex: 2 },
        { name: 'Cheese (Eden)', category: 'filling', purchasePrice: 105, packageSize: 165, supplierIndex: 1 }
    ],
    
    supplierIds: [], // Will be populated after seeding suppliers
    
    async seedSuppliers() {
        console.log('Seeding suppliers...');
        this.supplierIds = [];
        
        for (const supplier of this.suppliers) {
            try {
                const id = await DB.add('suppliers', supplier);
                this.supplierIds.push(id);
                console.log(`  Added: ${supplier.companyName}`);
            } catch (e) {
                console.error(`  Failed: ${supplier.companyName}`, e);
            }
        }
        
        await Suppliers.load();
        Suppliers.render();
        console.log('Suppliers seeded!');
    },
    
    async seedIngredients() {
        console.log('Seeding ingredients...');
        
        if (this.supplierIds.length === 0) {
            // Get supplier IDs from loaded data
            this.supplierIds = Suppliers.data.map(s => s.id);
        }
        
        for (const ing of this.ingredients) {
            try {
                const data = {
                    name: ing.name,
                    category: ing.category,
                    purchasePrice: ing.purchasePrice,
                    packageSize: ing.packageSize,
                    costPerGram: ing.purchasePrice / ing.packageSize,
                    supplierId: this.supplierIds[ing.supplierIndex] || this.supplierIds[0]
                };
                await DB.add('ingredients', data);
                console.log(`  Added: ${ing.name} (₱${data.costPerGram.toFixed(4)}/g)`);
            } catch (e) {
                console.error(`  Failed: ${ing.name}`, e);
            }
        }
        
        await Ingredients.load();
        Ingredients.render();
        console.log('Ingredients seeded!');
    },

    async seedDoughRecipes() {
        console.log('Seeding dough recipes...');
        
        // Get ingredient IDs
        const flour = Ingredients.data.find(i => i.name.includes('Bread Flour'))?.id;
        const water = Ingredients.data.find(i => i.name === 'Water')?.id;
        const yeast = Ingredients.data.find(i => i.name.includes('Yeast'))?.id;
        const sugar = Ingredients.data.find(i => i.name === 'White Sugar')?.id;
        const butter = Ingredients.data.find(i => i.name.includes('Butter'))?.id;
        const salt = Ingredients.data.find(i => i.name.includes('Salt'))?.id;
        const eggs = Ingredients.data.find(i => i.name.includes('Eggs'))?.id;
        
        if (!flour || !water || !yeast) {
            console.error('Required ingredients not found. Please seed ingredients first.');
            return;
        }
        
        const sweetDough = {
            name: 'Sweet Dough (Standard)',
            version: '1.0',
            baseFlour: 500,
            ingredients: [
                { ingredientId: flour, amount: 500, unit: 'g' },
                { ingredientId: water, amount: 280, unit: 'g' },
                { ingredientId: yeast, amount: 7, unit: 'g' },
                { ingredientId: sugar, amount: 75, unit: 'g' },
                { ingredientId: butter, amount: 50, unit: 'g' },
                { ingredientId: salt, amount: 5, unit: 'g' },
                { ingredientId: eggs, amount: 50, unit: 'g' }
            ],
            mixing: {
                duration: 12,
                targetTemperature: 27
            },
            firstProof: {
                duration: 60,
                temperature: 28,
                humidity: 75
            },
            characteristics: {
                proofSensitivity: 'high',
                maxDoughAge: 90
            },
            notes: 'Standard sweet dough for pandecoco, ensaymada, cinnamon rolls'
        };
        
        Doughs.calculateCosts(sweetDough);
        
        try {
            await DB.add('doughRecipes', sweetDough);
            console.log('  Added: Sweet Dough (Standard)');
        } catch (e) {
            console.error('  Failed: Sweet Dough', e);
        }
        
        await Doughs.load();
        Doughs.render();
        console.log('Dough recipes seeded!');
    },
    
    async seedFillings() {
        console.log('Seeding fillings...');
        
        const coconut = Ingredients.data.find(i => i.name.includes('Coconut'))?.id;
        const brownSugar = Ingredients.data.find(i => i.name === 'Brown Sugar')?.id;
        const butter = Ingredients.data.find(i => i.name.includes('Butter'))?.id;
        const condensedMilk = Ingredients.data.find(i => i.name.includes('Condensed'))?.id;
        const salt = Ingredients.data.find(i => i.name.includes('Salt'))?.id;
        
        const coconutFilling = {
            name: 'Coconut Filling (Pandecoco)',
            version: '1.0',
            batchSize: 1000,
            ingredients: [
                { ingredientId: coconut, amount: 500, unit: 'g' },
                { ingredientId: brownSugar, amount: 300, unit: 'g' },
                { ingredientId: butter, amount: 100, unit: 'g' },
                { ingredientId: condensedMilk, amount: 80, unit: 'g' },
                { ingredientId: salt, amount: 2, unit: 'g' }
            ],
            preparation: {
                method: 'cooking',
                duration: 20,
                storageTemp: 25,
                shelfLife: 48
            },
            standardServing: {
                amount: 8
            },
            notes: 'Cook until thick and sticky'
        };
        
        Fillings.calculateCosts(coconutFilling);
        
        try {
            await DB.add('fillingRecipes', coconutFilling);
            console.log('  Added: Coconut Filling');
        } catch (e) {
            console.error('  Failed: Coconut Filling', e);
        }
        
        await Fillings.load();
        Fillings.render();
        console.log('Fillings seeded!');
    },
    
    async seedToppings() {
        console.log('Seeding toppings...');
        
        const butter = Ingredients.data.find(i => i.name.includes('Butter'))?.id;
        const sugar = Ingredients.data.find(i => i.name === 'White Sugar')?.id;
        const milkPowder = Ingredients.data.find(i => i.name.includes('Milk Powder'))?.id;
        const salt = Ingredients.data.find(i => i.name.includes('Salt'))?.id;
        
        const ensaymadaIcing = {
            name: 'Ensaymada Butter Icing',
            version: '1.0',
            batchSize: 500,
            ingredients: [
                { ingredientId: butter, amount: 250, unit: 'g' },
                { ingredientId: sugar, amount: 200, unit: 'g' },
                { ingredientId: milkPowder, amount: 30, unit: 'g' },
                { ingredientId: salt, amount: 2, unit: 'g' }
            ],
            preparation: {
                method: 'creaming',
                duration: 8,
                storageTemp: 25,
                shelfLife: 8
            },
            standardServing: {
                amount: 20
            },
            notes: 'Cream until light and fluffy'
        };
        
        Toppings.calculateCosts(ensaymadaIcing);
        
        try {
            await DB.add('toppingRecipes', ensaymadaIcing);
            console.log('  Added: Ensaymada Butter Icing');
        } catch (e) {
            console.error('  Failed: Ensaymada Icing', e);
        }
        
        await Toppings.load();
        Toppings.render();
        console.log('Toppings seeded!');
    },

    async seedProducts() {
        console.log('Seeding products...');
        
        const sweetDough = Doughs.data.find(d => d.name.includes('Sweet'))?.id;
        const coconutFilling = Fillings.data.find(f => f.name.includes('Coconut'))?.id;
        const ensaymadaIcing = Toppings.data.find(t => t.name.includes('Ensaymada'))?.id;
        
        if (!sweetDough) {
            console.error('Sweet Dough not found. Please seed dough recipes first.');
            return;
        }
        
        const pandecoco = {
            name: 'Pandecoco',
            category: 'sweet-bread',
            doughRecipeId: sweetDough,
            fillingRecipeId: coconutFilling || null,
            toppingRecipeId: null,
            portioning: {
                doughWeight: 40,
                fillingWeight: 8,
                toppingWeight: 0,
                finalWeight: 45
            },
            secondProof: {
                duration: 45,
                temperature: 32,
                humidity: 80
            },
            baking: {
                ovenTempTop: 180,
                ovenTempBottom: 180,
                duration: 18,
                rotateAt: 9
            },
            costs: {
                packaging: 0.50
            },
            pricing: {
                wholesalePrice: 8,
                retailPrice: 10
            },
            notes: 'Classic Filipino coconut bread'
        };
        
        const ensaymada = {
            name: 'Ensaymada',
            category: 'sweet-bread',
            doughRecipeId: sweetDough,
            fillingRecipeId: null,
            toppingRecipeId: ensaymadaIcing || null,
            portioning: {
                doughWeight: 45,
                fillingWeight: 0,
                toppingWeight: 20,
                finalWeight: 60
            },
            secondProof: {
                duration: 50,
                temperature: 32,
                humidity: 80
            },
            baking: {
                ovenTempTop: 170,
                ovenTempBottom: 170,
                duration: 16,
                rotateAt: 8
            },
            costs: {
                packaging: 1.00
            },
            pricing: {
                wholesalePrice: 15,
                retailPrice: 20
            },
            notes: 'Classic ensaymada with butter icing and cheese'
        };
        
        try {
            await DB.add('products', pandecoco);
            console.log('  Added: Pandecoco');
            await DB.add('products', ensaymada);
            console.log('  Added: Ensaymada');
        } catch (e) {
            console.error('  Failed to add products', e);
        }
        
        await Products.load();
        Products.render();
        console.log('Products seeded!');
    },
    
    async seedAll() {
        console.log('=== Starting full seed ===');
        console.log('');
        
        // Seed suppliers first
        await this.seedSuppliers();
        console.log('');
        
        await new Promise(r => setTimeout(r, 1000));
        
        await this.seedIngredients();
        console.log('');
        
        await new Promise(r => setTimeout(r, 1000));
        
        await this.seedDoughRecipes();
        console.log('');
        
        await new Promise(r => setTimeout(r, 1000));
        
        await this.seedFillings();
        console.log('');
        
        await new Promise(r => setTimeout(r, 1000));
        
        await this.seedToppings();
        console.log('');
        
        await new Promise(r => setTimeout(r, 1000));
        
        await this.seedProducts();
        console.log('');
        
        console.log('=== Seed complete! ===');
        console.log('');
        console.log('Sample data added:');
        console.log('- 3 suppliers');
        console.log('- 13 ingredients (with cost per gram)');
        console.log('- 1 dough recipe (Sweet Dough)');
        console.log('- 1 filling (Coconut)');
        console.log('- 1 topping (Ensaymada Icing)');
        console.log('- 2 products (Pandecoco, Ensaymada)');
        console.log('');
        console.log('You can now try a production run!');
        
        Toast.success('Sample data loaded successfully!');
    },
    
    async clearAll() {
        if (!confirm('This will delete ALL data. Are you sure?')) return;
        
        console.log('Clearing all data...');
        
        const collections = ['suppliers', 'ingredients', 'doughRecipes', 'fillingRecipes', 'toppingRecipes', 'products', 'productionRuns'];
        
        for (const collection of collections) {
            try {
                const docs = await DB.getAll(collection);
                for (const doc of docs) {
                    await DB.delete(collection, doc.id);
                }
                console.log(`  Cleared: ${collection}`);
            } catch (e) {
                console.error(`  Failed to clear ${collection}`, e);
            }
        }
        
        // Reload all data
        await App.loadData();
        
        console.log('All data cleared!');
        Toast.success('All data cleared');
    }
};

// Add to window for console access
window.SeedData = SeedData;
