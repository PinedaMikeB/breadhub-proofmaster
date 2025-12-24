/**
 * BreadHub ProofMaster - Sales & Import System
 * 
 * RULES:
 * 1. ProofMaster product names = FINAL (never overwritten)
 * 2. ProofMaster costs = TRUE (Loyverse COGS ignored)
 * 3. Loyverse provides: quantity, sales amounts, dates only
 * 
 * Firebase Collections:
 * - sales: Individual POS transactions
 * - salesImports: Imported Loyverse data batches
 * - productMapping: Loyverse name → ProofMaster product ID
 */

const Sales = {
    data: [],
    imports: [],
    productMapping: {},  // loyverseName -> { productId, variantIndex }
    
    async init() {
        await this.loadMapping();
        await this.loadImports();
    },
    
    // ========== PRODUCT MAPPING ==========
    
    async loadMapping() {
        try {
            const mappings = await DB.getAll('productMapping');
            this.productMapping = {};
            mappings.forEach(m => {
                this.productMapping[m.loyverseName.toLowerCase()] = {
                    id: m.id,
                    productId: m.productId,
                    productName: m.productName,
                    variantIndex: m.variantIndex || null,
                    variantName: m.variantName || null,
                    category: m.category
                };
            });
            console.log(`Loaded ${mappings.length} product mappings`);
        } catch (error) {
            console.error('Error loading product mappings:', error);
        }
    },
    
    async saveMapping(loyverseName, productId, variantIndex = null) {
        const product = Products.data.find(p => p.id === productId);
        if (!product) return false;
        
        const key = loyverseName.toLowerCase();
        const variantName = variantIndex !== null && product.variants?.[variantIndex]
            ? product.variants[variantIndex].name
            : null;
        
        const mappingData = {
            loyverseName: loyverseName,
            productId: productId,
            productName: product.name,
            variantIndex: variantIndex,
            variantName: variantName,
            category: product.category,
            mainCategory: product.mainCategory,
            createdAt: new Date().toISOString()
        };
        
        // Check if mapping exists
        const existing = Object.values(this.productMapping).find(m => 
            m.productId === productId && m.variantIndex === variantIndex
        );
        
        if (this.productMapping[key]?.id) {
            // Update existing
            await DB.update('productMapping', this.productMapping[key].id, mappingData);
        } else {
            // Create new
            const id = await DB.add('productMapping', mappingData);
            mappingData.id = id;
        }
        
        this.productMapping[key] = mappingData;
        return true;
    },
    
    async deleteMapping(loyverseName) {
        const key = loyverseName.toLowerCase();
        const mapping = this.productMapping[key];
        if (mapping?.id) {
            await DB.delete('productMapping', mapping.id);
            delete this.productMapping[key];
            return true;
        }
        return false;
    },
    
    // Get ProofMaster product for Loyverse item
    getMappedProduct(loyverseName) {
        const key = loyverseName.toLowerCase();
        const mapping = this.productMapping[key];
        if (!mapping) return null;
        
        const product = Products.data.find(p => p.id === mapping.productId);
        if (!product) return null;
        
        return {
            product,
            variantIndex: mapping.variantIndex,
            variantName: mapping.variantName
        };
    },

    // ========== LOYVERSE IMPORT ==========
    
    async loadImports() {
        try {
            this.imports = await DB.getAll('salesImports');
            this.imports.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
        } catch (error) {
            console.error('Error loading imports:', error);
        }
    },
    
    showImportModal() {
        Modal.open({
            title: '📥 Import Loyverse Sales Data',
            content: `
                <div style="padding: 8px 0;">
                    <div style="background: #E3F2FD; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--primary);">
                        <strong>📋 Import Rules:</strong>
                        <ul style="margin: 8px 0 0 20px; font-size: 0.9rem;">
                            <li>ProofMaster product names are FINAL</li>
                            <li>Loyverse costs are IGNORED (we use true costs)</li>
                            <li>Only sales data (qty, amount, date) is imported</li>
                        </ul>
                    </div>
                    
                    <div class="form-group">
                        <label><strong>Step 1:</strong> Upload Loyverse Item Sales CSV</label>
                        <input type="file" id="loyverseItemFile" accept=".csv" class="form-input">
                        <small style="color: var(--text-secondary);">Export: Loyverse → Reports → Item Sales Summary → Export CSV</small>
                    </div>
                    
                    <div class="form-group">
                        <label><strong>Step 2:</strong> Upload Loyverse Daily Sales CSV (Optional)</label>
                        <input type="file" id="loyverseDailyFile" accept=".csv" class="form-input">
                        <small style="color: var(--text-secondary);">Export: Loyverse → Reports → Sales Summary → Export CSV</small>
                    </div>
                    
                    <div class="form-group">
                        <label><strong>Step 3:</strong> Import Period Label</label>
                        <input type="text" id="importLabel" class="form-input" 
                               placeholder="e.g., Oct-Dec 2025" value="">
                    </div>
                    
                    <div id="importPreview" style="display: none; margin-top: 16px;">
                        <h4>📊 Preview</h4>
                        <div id="previewContent"></div>
                    </div>
                </div>
            `,
            saveText: 'Parse & Preview',
            width: '600px',
            onSave: () => this.parseImportFiles()
        });
        
        // Add file change listeners
        setTimeout(() => {
            document.getElementById('loyverseItemFile')?.addEventListener('change', () => this.previewImport());
        }, 100);
    },
    
    async previewImport() {
        const itemFile = document.getElementById('loyverseItemFile')?.files[0];
        if (!itemFile) return;
        
        const previewDiv = document.getElementById('importPreview');
        const contentDiv = document.getElementById('previewContent');
        
        try {
            const text = await itemFile.text();
            const lines = text.trim().split('\n');
            const itemCount = lines.length - 1; // Subtract header
            
            previewDiv.style.display = 'block';
            contentDiv.innerHTML = `
                <div style="background: var(--bg-input); padding: 12px; border-radius: 8px;">
                    <p>📦 <strong>${itemCount}</strong> product records found</p>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">
                        Click "Parse & Preview" to analyze and map products
                    </p>
                </div>
            `;
        } catch (error) {
            contentDiv.innerHTML = `<p style="color: var(--danger);">Error reading file</p>`;
        }
    },
    
    async parseImportFiles() {
        const itemFile = document.getElementById('loyverseItemFile')?.files[0];
        const dailyFile = document.getElementById('loyverseDailyFile')?.files[0];
        const label = document.getElementById('importLabel')?.value || 'Import ' + new Date().toLocaleDateString();
        
        if (!itemFile) {
            Toast.error('Please select the Item Sales CSV file');
            return false;
        }
        
        try {
            // Parse item sales
            const itemText = await itemFile.text();
            const itemData = this.parseCSV(itemText);
            
            // Parse daily sales if provided
            let dailyData = [];
            if (dailyFile) {
                const dailyText = await dailyFile.text();
                dailyData = this.parseCSV(dailyText);
            }
            
            Modal.close();
            
            // Show mapping interface
            this.showMappingModal(itemData, dailyData, label);
            
        } catch (error) {
            console.error('Error parsing files:', error);
            Toast.error('Failed to parse CSV files');
            return false;
        }
    },
    
    parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        return lines.slice(1).map(line => {
            const values = this.parseCSVLine(line);
            const obj = {};
            headers.forEach((header, i) => {
                obj[header] = values[i]?.trim().replace(/"/g, '') || '';
            });
            return obj;
        });
    },
    
    // Handle CSV values with commas inside quotes
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);
        return values;
    },

    // ========== MAPPING INTERFACE ==========
    
    showMappingModal(itemData, dailyData, label) {
        // Analyze what needs mapping
        const unmapped = [];
        const mapped = [];
        
        itemData.forEach(item => {
            const name = item['Item name'];
            const mapping = this.getMappedProduct(name);
            
            if (mapping) {
                mapped.push({
                    loyverseName: name,
                    productName: mapping.product.name,
                    variantName: mapping.variantName,
                    qty: parseFloat(item['Items sold']) || 0,
                    netSales: parseFloat(item['Net sales']) || 0,
                    category: item['Category']
                });
            } else {
                unmapped.push({
                    loyverseName: name,
                    sku: item['SKU'],
                    category: item['Category'],
                    qty: parseFloat(item['Items sold']) || 0,
                    netSales: parseFloat(item['Net sales']) || 0
                });
            }
        });
        
        // Sort unmapped by sales (highest first)
        unmapped.sort((a, b) => b.netSales - a.netSales);
        
        // Store for later use
        this._pendingImport = { itemData, dailyData, label, unmapped, mapped };
        
        const totalItems = itemData.length;
        const totalSales = itemData.reduce((sum, i) => sum + (parseFloat(i['Net sales']) || 0), 0);
        
        Modal.open({
            title: '🔗 Map Loyverse Products to ProofMaster',
            content: `
                <div style="padding: 8px 0;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div style="background: var(--bg-input); padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${totalItems}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Items</div>
                        </div>
                        <div style="background: #E8F5E9; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: var(--success);">${mapped.length}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">Mapped ✓</div>
                        </div>
                        <div style="background: ${unmapped.length > 0 ? '#FFF3E0' : '#E8F5E9'}; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: ${unmapped.length > 0 ? 'var(--warning)' : 'var(--success)'};">${unmapped.length}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">Need Mapping</div>
                        </div>
                    </div>
                    
                    <div style="background: #E3F2FD; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                        <strong>💰 Total Net Sales:</strong> ${Utils.formatCurrency(totalSales)}
                    </div>
                    
                    ${unmapped.length > 0 ? `
                        <h4 style="margin-bottom: 12px;">⚠️ Unmapped Products (${unmapped.length})</h4>
                        <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead style="background: var(--bg-input); position: sticky; top: 0;">
                                    <tr>
                                        <th style="padding: 10px; text-align: left;">Loyverse Name</th>
                                        <th style="padding: 10px; text-align: left;">Category</th>
                                        <th style="padding: 10px; text-align: right;">Sales</th>
                                        <th style="padding: 10px; text-align: left;">Map To</th>
                                    </tr>
                                </thead>
                                <tbody id="unmappedTableBody">
                                    ${unmapped.map((item, idx) => `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 10px;">
                                                <strong>${item.loyverseName}</strong>
                                                <br><small style="color: var(--text-secondary);">SKU: ${item.sku}</small>
                                            </td>
                                            <td style="padding: 10px; color: var(--text-secondary);">${item.category}</td>
                                            <td style="padding: 10px; text-align: right;">${Utils.formatCurrency(item.netSales)}</td>
                                            <td style="padding: 10px;">
                                                <select class="form-select mapping-select" data-idx="${idx}" 
                                                        style="font-size: 0.85rem; padding: 6px;">
                                                    <option value="">-- Select Product --</option>
                                                    <option value="__skip__">⏭️ Skip (Don't Import)</option>
                                                    <option value="__new__">➕ Create New Product</option>
                                                    ${this.getProductOptionsHTML(item.loyverseName)}
                                                </select>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="margin-top: 12px; display: flex; gap: 8px;">
                            <button class="btn btn-secondary btn-sm" onclick="Sales.autoMapSimilar()">
                                🔮 Auto-Map Similar Names
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="Sales.skipAllUnmapped()">
                                ⏭️ Skip All Unmapped
                            </button>
                        </div>
                    ` : `
                        <div style="background: #E8F5E9; padding: 16px; border-radius: 8px; text-align: center;">
                            <span style="font-size: 2rem;">✅</span>
                            <p style="margin: 8px 0 0 0; font-weight: 600; color: var(--success);">All products are mapped!</p>
                        </div>
                    `}
                    
                    ${mapped.length > 0 ? `
                        <details style="margin-top: 16px;">
                            <summary style="cursor: pointer; font-weight: 600;">✅ Already Mapped (${mapped.length})</summary>
                            <div style="max-height: 200px; overflow-y: auto; margin-top: 8px;">
                                ${mapped.slice(0, 20).map(m => `
                                    <div style="padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 0.85rem;">
                                        <span style="color: var(--text-secondary);">${m.loyverseName}</span>
                                        <span style="color: var(--success);"> → </span>
                                        <strong>${m.productName}</strong>
                                        ${m.variantName ? `<span style="color: var(--primary);"> (${m.variantName})</span>` : ''}
                                    </div>
                                `).join('')}
                                ${mapped.length > 20 ? `<div style="padding: 8px; color: var(--text-secondary);">...and ${mapped.length - 20} more</div>` : ''}
                            </div>
                        </details>
                    ` : ''}
                </div>
            `,
            saveText: unmapped.length > 0 ? 'Save Mappings & Continue' : 'Import Now',
            width: '800px',
            onSave: () => this.processMappingsAndImport()
        });
    },
    
    getProductOptionsHTML(loyverseName) {
        // Group products by category
        const byCategory = {};
        Products.data.forEach(p => {
            const cat = p.category || 'other';
            if (!byCategory[cat]) byCategory[cat] = [];
            
            // Add base product
            byCategory[cat].push({
                id: p.id,
                name: p.name,
                variantIndex: null,
                display: p.name
            });
            
            // Add variants
            if (p.hasVariants && p.variants) {
                p.variants.forEach((v, idx) => {
                    byCategory[cat].push({
                        id: p.id,
                        name: p.name,
                        variantIndex: idx,
                        display: `${p.name} (${v.name})`
                    });
                });
            }
        });
        
        let html = '';
        Object.keys(byCategory).sort().forEach(cat => {
            const catInfo = Products.defaultCategories.find(c => c.value === cat);
            const catLabel = catInfo ? `${catInfo.emoji} ${catInfo.label}` : cat;
            
            html += `<optgroup label="${catLabel}">`;
            byCategory[cat].forEach(p => {
                const value = p.variantIndex !== null ? `${p.id}|${p.variantIndex}` : p.id;
                html += `<option value="${value}">${p.display}</option>`;
            });
            html += '</optgroup>';
        });
        
        return html;
    },

    autoMapSimilar() {
        const selects = document.querySelectorAll('.mapping-select');
        let mapped = 0;
        
        selects.forEach((select, idx) => {
            if (select.value) return; // Already mapped
            
            const item = this._pendingImport.unmapped[idx];
            const loyName = item.loyverseName.toLowerCase();
            
            // Try to find similar product name
            for (const product of Products.data) {
                const prodName = product.name.toLowerCase();
                
                // Check direct match
                if (prodName === loyName || loyName.includes(prodName) || prodName.includes(loyName)) {
                    select.value = product.id;
                    mapped++;
                    break;
                }
                
                // Check variants
                if (product.hasVariants && product.variants) {
                    for (let i = 0; i < product.variants.length; i++) {
                        const v = product.variants[i];
                        const fullName = `${product.name} (${v.name})`.toLowerCase();
                        const altName = `${product.name} ${v.name}`.toLowerCase();
                        
                        if (loyName.includes(prodName) && loyName.includes(v.name.toLowerCase())) {
                            select.value = `${product.id}|${i}`;
                            mapped++;
                            break;
                        }
                    }
                }
            }
        });
        
        Toast.success(`Auto-mapped ${mapped} products`);
    },
    
    skipAllUnmapped() {
        const selects = document.querySelectorAll('.mapping-select');
        selects.forEach(select => {
            if (!select.value) {
                select.value = '__skip__';
            }
        });
        Toast.info('All unmapped items set to skip');
    },
    
    async processMappingsAndImport() {
        const selects = document.querySelectorAll('.mapping-select');
        const unmapped = this._pendingImport.unmapped;
        
        // Save new mappings
        let newMappings = 0;
        let skipped = 0;
        
        for (let i = 0; i < selects.length; i++) {
            const select = selects[i];
            const item = unmapped[i];
            const value = select.value;
            
            if (!value || value === '__skip__') {
                skipped++;
                continue;
            }
            
            if (value === '__new__') {
                // TODO: Create new product flow
                Toast.warning(`Creating new products not yet implemented. Skipping ${item.loyverseName}`);
                skipped++;
                continue;
            }
            
            // Parse product ID and variant index
            let productId, variantIndex = null;
            if (value.includes('|')) {
                [productId, variantIndex] = value.split('|');
                variantIndex = parseInt(variantIndex);
            } else {
                productId = value;
            }
            
            await this.saveMapping(item.loyverseName, productId, variantIndex);
            newMappings++;
        }
        
        Toast.success(`Saved ${newMappings} mappings, skipped ${skipped}`);
        
        // Now perform the actual import
        Modal.close();
        await this.executeImport();
    },
    
    async executeImport() {
        const { itemData, dailyData, label } = this._pendingImport;
        
        // Reload mappings after saving
        await this.loadMapping();
        
        // Process items with TRUE costs from ProofMaster
        const importedItems = [];
        let totalQty = 0;
        let totalNetSales = 0;
        let totalTrueCost = 0;
        let skippedItems = [];
        
        for (const item of itemData) {
            const name = item['Item name'];
            const qty = parseFloat(item['Items sold']) || 0;
            const grossSales = parseFloat(item['Gross sales']) || 0;
            const netSales = parseFloat(item['Net sales']) || 0;
            const discounts = parseFloat(item['Discounts']) || 0;
            
            const mapping = this.getMappedProduct(name);
            
            if (!mapping) {
                skippedItems.push({ name, netSales });
                continue;
            }
            
            // Get TRUE cost from ProofMaster
            const trueCost = this.getTrueCost(mapping.product, mapping.variantIndex);
            const totalCost = trueCost * qty;
            const trueProfit = netSales - totalCost;
            const trueMargin = netSales > 0 ? (trueProfit / netSales) * 100 : 0;
            
            importedItems.push({
                loyverseName: name,
                loyverseSKU: item['SKU'],
                loyverseCategory: item['Category'],
                
                // ProofMaster product (TRUE)
                productId: mapping.product.id,
                productName: mapping.product.name,
                category: mapping.product.category,
                mainCategory: mapping.product.mainCategory,
                variantIndex: mapping.variantIndex,
                variantName: mapping.variantName,
                
                // Sales data from Loyverse
                quantity: qty,
                grossSales: grossSales,
                discounts: discounts,
                netSales: netSales,
                
                // TRUE costs from ProofMaster (not Loyverse!)
                trueCostPerUnit: trueCost,
                trueTotalCost: totalCost,
                trueProfit: trueProfit,
                trueMargin: trueMargin
            });
            
            totalQty += qty;
            totalNetSales += netSales;
            totalTrueCost += totalCost;
        }
