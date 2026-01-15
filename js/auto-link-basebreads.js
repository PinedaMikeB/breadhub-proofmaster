/**
 * Auto-link products to base breads based on product names/categories
 * Run once to set up all the links
 */

const AutoLinkBaseBread = {
    
    // Mapping rules: product name patterns → base bread name
    rules: [
        // Donut Premium variants
        { pattern: /biscoff.*donut.*premium/i, baseName: 'Donut Premium Base' },
        { pattern: /oreo.*donut.*premium/i, baseName: 'Donut Premium Base' },
        { pattern: /nutella.*donut.*premium/i, baseName: 'Donut Premium Base' },
        { pattern: /tiramisu.*donut/i, baseName: 'Donut Premium Base' },
        { pattern: /matcha.*donut.*premium/i, baseName: 'Donut Premium Base' },
        { pattern: /ube.*donut.*premium/i, baseName: 'Donut Premium Base' },
        { pattern: /strawberry.*donut.*premium/i, baseName: 'Donut Premium Base' },
        { pattern: /smores.*donut/i, baseName: 'Donut Premium Base' },
        { pattern: /donut.*premium/i, baseName: 'Donut Premium Base' },
        
        // Donut Classic variants
        { pattern: /biscoff.*donut.*classic/i, baseName: 'Donut Classic Base' },
        { pattern: /oreo.*donut.*classic/i, baseName: 'Donut Classic Base' },
        { pattern: /nutella.*donut.*classic/i, baseName: 'Donut Classic Base' },
        { pattern: /bavarian.*donut/i, baseName: 'Donut Classic Base' },
        { pattern: /choco.*donut.*classic/i, baseName: 'Donut Classic Base' },
        { pattern: /donut.*classic/i, baseName: 'Donut Classic Base' },
        { pattern: /glazed.*donut/i, baseName: 'Donut Classic Base' },
        
        // Cinnamon variants
        { pattern: /biscoff.*cinnamon/i, baseName: 'Cinnamon Base' },
        { pattern: /blueberry.*cinnamon/i, baseName: 'Cinnamon Base' },
        { pattern: /strawberry.*cinnamon/i, baseName: 'Cinnamon Base' },
        { pattern: /mango.*cinnamon/i, baseName: 'Cinnamon Base' },
        { pattern: /ube.*cinnamon/i, baseName: 'Cinnamon Base' },
        { pattern: /matcha.*cinnamon/i, baseName: 'Cinnamon Base' },
        { pattern: /cinnamon/i, baseName: 'Cinnamon Base' },
        
        // Pork Floss variants
        { pattern: /pork.*floss/i, baseName: 'Pork Floss Base' },
        { pattern: /chicken.*floss/i, baseName: 'Pork Floss Base' },
        { pattern: /beef.*floss/i, baseName: 'Pork Floss Base' },
        
        // Cheese Roll variants
        { pattern: /butter.*melt/i, baseName: 'Cheese Roll Base' },
        { pattern: /milky.*cheese/i, baseName: 'Cheese Roll Base' },
        { pattern: /cheese.*roll/i, baseName: 'Cheese Roll Base' },
        
        // Focaccia/Pizza variants
        { pattern: /manhattan.*pizza/i, baseName: 'Focaccia Base' },
        { pattern: /focaccia/i, baseName: 'Focaccia Base' },
        { pattern: /pizza.*bread/i, baseName: 'Focaccia Base' },
        
        // Ensaymada variants
        { pattern: /ensaymada/i, baseName: 'Ensaymada Base' },
        { pattern: /ensaimada/i, baseName: 'Ensaymada Base' }
    ],
    
    async run() {
        console.log('🔗 Auto-linking products to base breads...');
        
        // Ensure base breads are loaded
        if (!BaseBreads.initialized) {
            await BaseBreads.init();
        }
        
        const products = await DB.getAll('products');
        let linked = 0;
        let skipped = 0;
        let noMatch = 0;
        
        for (const product of products) {
            // Skip if already linked
            if (product.baseBreadId) {
                skipped++;
                continue;
            }
            
            // Try to match
            const baseBread = this.findMatchingBase(product.name);
            
            if (baseBread) {
                await DB.update('products', product.id, { baseBreadId: baseBread.id });
                console.log(`  ✓ ${product.name} → ${baseBread.name}`);
                linked++;
            } else {
                // No match - that's OK, not all products need a base
                noMatch++;
            }
        }
        
        console.log(`\n📊 Auto-link complete:`);
        console.log(`  ✓ Linked: ${linked}`);
        console.log(`  ⏭️ Already linked: ${skipped}`);
        console.log(`  ○ No base needed: ${noMatch}`);
        
        Toast.success(`Linked ${linked} products to base breads`);
        
        return { linked, skipped, noMatch };
    },
    
    findMatchingBase(productName) {
        for (const rule of this.rules) {
            if (rule.pattern.test(productName)) {
                const base = BaseBreads.data.find(b => b.name === rule.baseName);
                if (base) return base;
            }
        }
        return null;
    }
};

// Make available globally
window.AutoLinkBaseBread = AutoLinkBaseBread;
