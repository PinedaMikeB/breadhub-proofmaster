/**
 * BreadHub ProofMaster - Production Management
 * Handles the core production workflow
 */

const Production = {
    currentRun: null,
    plannedProducts: [],
    mixTimer: null,
    mixStartTime: null,
    doughAgeTimer: null,
    doughStartTime: null,
    
    init() {
        this.loadProductSelect();
    },
    
    loadProductSelect() {
        const select = document.getElementById('productSelect');
        if (!select) return;
        
        select.innerHTML = `
            <option value="">Select a product...</option>
            ${Products.data.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        `;
    },
    
    addProduct() {
        const select = document.getElementById('productSelect');
        const piecesInput = document.getElementById('productPieces');
        
        const productId = select.value;
        const pieces = parseInt(piecesInput.value) || 0;
        
        if (!productId || pieces <= 0) {
            Toast.warning('Please select a product and enter pieces');
            return;
        }
        
        const product = Products.getById(productId);
        if (!product) return;
        
        // Check if already added
        const existing = this.plannedProducts.find(p => p.productId === productId);
        if (existing) {
            existing.pieces += pieces;
        } else {
            const doughNeeded = pieces * (product.portioning?.doughWeight || 40);
            this.plannedProducts.push({
                productId,
                name: product.name,
                pieces,
                doughWeight: product.portioning?.doughWeight || 40,
                doughNeeded
            });
        }
        
        // Reset inputs
        select.value = '';
        piecesInput.value = '';
        
        this.renderPlannedProducts();
        this.updateProductionSummary();
    },
    
    removePlannedProduct(productId) {
        this.plannedProducts = this.plannedProducts.filter(p => p.productId !== productId);
        this.renderPlannedProducts();
        this.updateProductionSummary();
    },
    
    renderPlannedProducts() {
        const container = document.getElementById('plannedProducts');
        if (!container) return;
        
        if (this.plannedProducts.length === 0) {
            container.innerHTML = '<p class="empty-state">No products added yet</p>';
            document.getElementById('startMixingBtn').disabled = true;
            return;
        }
        
        container.innerHTML = this.plannedProducts.map(p => `
            <div class="planned-item">
                <div class="planned-item-info">
                    <h4>${p.name}</h4>
                    <span>${p.pieces} pieces × ${p.doughWeight}g = ${Utils.formatWeight(p.doughNeeded)} dough</span>
                </div>
                <div class="planned-item-actions">
                    <button class="btn btn-danger" onclick="Production.removePlannedProduct('${p.productId}')">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
        
        document.getElementById('startMixingBtn').disabled = false;
    },

    updateProductionSummary() {
        const summary = document.getElementById('productionSummary');
        if (!summary) return;
        
        if (this.plannedProducts.length === 0) {
            summary.style.display = 'none';
            return;
        }
        
        summary.style.display = 'block';
        
        const totalDough = this.plannedProducts.reduce((sum, p) => sum + p.doughNeeded, 0);
        const buffer = CONFIG.defaults.doughBuffer;
        const totalWithBuffer = Math.ceil(totalDough * (1 + buffer));
        const totalPieces = this.plannedProducts.reduce((sum, p) => sum + p.pieces, 0);
        
        document.getElementById('totalDough').textContent = Utils.formatWeight(totalDough);
        
        // Only show buffer if > 0
        const bufferEl = document.getElementById('totalDoughBuffer');
        const bufferRow = bufferEl?.closest('.recipe-stat');
        if (buffer > 0) {
            bufferEl.textContent = Utils.formatWeight(totalWithBuffer);
            if (bufferRow) bufferRow.style.display = '';
        } else {
            if (bufferRow) bufferRow.style.display = 'none';
        }
        
        // Calculate ingredients based on dough recipe
        const ingredients = this.calculateIngredients(totalWithBuffer);
        this.renderIngredientsList(ingredients);
        
        // Calculate estimated cost
        const estimatedCost = this.calculateEstimatedCost();
        document.getElementById('estimatedCost').textContent = Utils.formatCurrency(estimatedCost);
        
        // Calculate and show cost per piece
        const costPerPiece = totalPieces > 0 ? estimatedCost / totalPieces : 0;
        const costPerPieceEl = document.getElementById('costPerPiece');
        if (costPerPieceEl) {
            costPerPieceEl.textContent = Utils.formatCurrency(costPerPiece);
        }
    },
    
    calculateIngredients(totalDough) {
        // Get the first product's dough recipe (assuming same dough for all)
        if (this.plannedProducts.length === 0) return [];
        
        const firstProduct = Products.getById(this.plannedProducts[0].productId);
        if (!firstProduct) return [];
        
        const doughRecipe = Doughs.getById(firstProduct.doughRecipeId);
        if (!doughRecipe) return [];
        
        // Calculate scale factor based on recipe yield
        const baseYield = doughRecipe.yield || 1000;
        const scaleFactor = totalDough / baseYield;
        
        return (doughRecipe.ingredients || []).map(ing => {
            const ingredient = Ingredients.getById(ing.ingredientId);
            const scaledAmount = Math.ceil(ing.amount * scaleFactor);
            const currentStock = ingredient?.currentStock || 0;
            const hasEnough = currentStock >= scaledAmount;
            const costPerGram = ingredient ? Ingredients.getCostPerGram(ing.ingredientId) : 0;
            const hasPrice = costPerGram > 0;
            
            return {
                ingredientId: ing.ingredientId,
                name: ingredient?.name || 'Unknown',
                amount: scaledAmount,
                unit: ing.unit,
                currentStock,
                hasEnough,
                hasPrice,
                costPerGram
            };
        });
    },
    
    renderIngredientsList(ingredients) {
        const container = document.getElementById('ingredientsList');
        if (!container) return;
        
        // Check for issues
        const missingPrices = ingredients.filter(i => !i.hasPrice);
        const insufficientStock = ingredients.filter(i => !i.hasEnough);
        
        // Store insufficient stock items for purchase request
        this.lowStockItems = insufficientStock;
        
        let warningsHTML = '';
        
        if (missingPrices.length > 0) {
            warningsHTML += `
                <div style="background: #FEF3E2; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 0.85rem; color: #8B5A00;">
                    ⚠️ <strong>Missing prices:</strong> ${missingPrices.map(i => i.name).join(', ')}
                </div>
            `;
        }
        
        if (insufficientStock.length > 0) {
            warningsHTML += `
                <div style="background: #FDEDEC; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 0.85rem; color: #922B21;">
                    ❌ <strong>Low stock:</strong> ${insufficientStock.map(i => `${i.name} (need ${Utils.formatWeight(i.amount)}, have ${Utils.formatWeight(i.currentStock)})`).join(', ')}
                </div>
                <div style="text-align: center; margin-bottom: 12px;">
                    <button class="btn btn-primary" onclick="Production.requestToBuy()" style="background: linear-gradient(135deg, #E74C3C 0%, #C0392B 100%);">
                        🛒 Request To Buy Low Stock Items
                    </button>
                </div>
            `;
        }
        
        container.innerHTML = warningsHTML + ingredients.map(ing => {
            const stockColor = ing.hasEnough ? 'var(--success)' : 'var(--danger)';
            const stockIcon = ing.hasEnough ? '✓' : '✗';
            const priceWarning = !ing.hasPrice ? ' <span style="color: var(--warning);" title="No price set">⚠️</span>' : '';
            
            return `
                <div class="ingredient-item" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${ing.name}${priceWarning}</span>
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <span>${Utils.formatWeight(ing.amount)}</span>
                        <span style="color: ${stockColor}; font-size: 0.8rem;" title="Stock: ${Utils.formatWeight(ing.currentStock)}">${stockIcon}</span>
                    </span>
                </div>
            `;
        }).join('');
    },
    
    // Open Purchase Request modal pre-filled with low stock items
    requestToBuy() {
        if (!this.lowStockItems || this.lowStockItems.length === 0) {
            Toast.warning('No low stock items to purchase');
            return;
        }
        
        // Store that we came from production
        this.returnToProduction = true;
        
        // Open custom purchase request modal with pre-filled items
        PurchaseRequests.showCreateModalWithItems(this.lowStockItems);
    },
    
    calculateEstimatedCost() {
        return this.plannedProducts.reduce((total, p) => {
            const product = Products.getById(p.productId);
            if (!product) return total;
            const cost = Products.calculateProductCost(product);
            // Use totalCost (not total) and handle NaN
            const productCost = cost.totalCost || 0;
            return total + (productCost * p.pieces);
        }, 0);
    },
    
    // Step navigation
    goToStep(step) {
        document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
        document.querySelector(`.wizard-step[data-step="${step}"]`).classList.add('active');
    },
    
    // MIXING PHASE
    startMixing() {
        if (this.plannedProducts.length === 0) {
            Toast.warning('Please add products first');
            return;
        }
        
        // Create production run
        this.currentRun = {
            runId: Utils.generateRunId(),
            status: 'mixing',
            productsPlanned: [...this.plannedProducts],
            startedAt: new Date(),
            doughBatch: {
                totalWeight: this.plannedProducts.reduce((sum, p) => sum + p.doughNeeded, 0) * (1 + CONFIG.defaults.doughBuffer)
            }
        };
        
        // Setup mixing guidance
        this.setupMixingGuidance();
        
        // Go to step 2
        this.goToStep(2);
        
        Toast.success(`Production run ${this.currentRun.runId} started`);
    },
    
    setupMixingGuidance() {
        const container = document.getElementById('mixingStages');
        if (!container) return;
        
        // Get dough recipe
        const firstProduct = Products.getById(this.plannedProducts[0].productId);
        const doughRecipe = firstProduct ? Doughs.getById(firstProduct.doughRecipeId) : null;
        
        if (doughRecipe && doughRecipe.mixing) {
            container.innerHTML = `
                <div class="recipe-stat">
                    <span>Total mix time:</span>
                    <span>${doughRecipe.mixing.duration} minutes</span>
                </div>
                <div class="recipe-stat">
                    <span>Target temp:</span>
                    <span>${doughRecipe.mixing.targetTemperature}°C</span>
                </div>
            `;
        }
    },
    
    startMixTimer() {
        if (this.mixTimer) return;
        
        this.mixStartTime = Date.now();
        this.mixTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.mixStartTime) / 1000);
            document.getElementById('mixTimer').textContent = Utils.formatTime(elapsed);
        }, 1000);
        
        Toast.info('Mix timer started');
    },
    
    pauseMixTimer() {
        if (this.mixTimer) {
            clearInterval(this.mixTimer);
            this.mixTimer = null;
            Toast.info('Mix timer paused');
        }
    },
    
    resetMixTimer() {
        this.pauseMixTimer();
        this.mixStartTime = null;
        document.getElementById('mixTimer').textContent = '00:00';
    },

    completeMixing() {
        const quality = document.querySelector('input[name="doughQuality"]:checked')?.value;
        const temp = document.getElementById('doughTemp').value;
        const notes = document.getElementById('mixingNotes').value;
        
        if (!quality) {
            Toast.warning('Please rate the dough quality');
            return;
        }
        
        if (quality === 'poor') {
            if (!confirm('Poor quality dough selected. Continue anyway?')) return;
        }
        
        // Save mixing data
        this.currentRun.doughBatch.mixCompleted = new Date();
        this.currentRun.doughBatch.quality = quality;
        this.currentRun.doughBatch.temperature = parseFloat(temp) || null;
        this.currentRun.doughBatch.notes = notes;
        
        if (this.mixStartTime) {
            this.currentRun.doughBatch.mixDuration = Math.floor((Date.now() - this.mixStartTime) / 1000 / 60);
        }
        
        this.pauseMixTimer();
        this.currentRun.status = 'dividing';
        
        // Start dough age tracking
        this.startDoughAgeTracking();
        
        // Setup division queue
        this.setupDivisionQueue();
        
        // Go to step 3
        this.goToStep(3);
        
        Toast.success('Mixing complete! Starting division phase.');
    },
    
    // DIVISION PHASE
    startDoughAgeTracking() {
        this.doughStartTime = Date.now();
        
        this.doughAgeTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.doughStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            
            const display = document.getElementById('doughAge');
            if (display) {
                display.textContent = Utils.formatTime(elapsed);
                
                // Color coding based on age
                const maxAge = CONFIG.defaults.maxDoughAge * 60; // in seconds
                if (elapsed > maxAge * 0.8) {
                    display.classList.add('timer-danger');
                    display.classList.remove('timer-warning');
                } else if (elapsed > maxAge * 0.6) {
                    display.classList.add('timer-warning');
                    display.classList.remove('timer-danger');
                } else {
                    display.classList.remove('timer-warning', 'timer-danger');
                }
            }
        }, 1000);
    },
    
    setupDivisionQueue() {
        const container = document.getElementById('queueItems');
        const remaining = document.getElementById('doughRemaining');
        
        if (!container) return;
        
        // Calculate remaining dough
        const totalDough = this.currentRun.doughBatch.totalWeight;
        remaining.textContent = Utils.formatWeight(totalDough);
        
        // Initialize division status for each product
        this.currentRun.productBatches = this.plannedProducts.map(p => ({
            productId: p.productId,
            name: p.name,
            pieces: p.pieces,
            doughNeeded: p.doughNeeded,
            status: 'queued',
            divisionStarted: null,
            divisionCompleted: null,
            proofStarted: null,
            proofCompleted: null
        }));
        
        this.renderDivisionQueue();
    },
    
    renderDivisionQueue() {
        const queueContainer = document.getElementById('queueItems');
        const progressContainer = document.getElementById('currentDivision');
        const completedContainer = document.getElementById('completedDivisions');
        
        const queued = this.currentRun.productBatches.filter(b => b.status === 'queued');
        const inProgress = this.currentRun.productBatches.filter(b => b.status === 'dividing');
        const completed = this.currentRun.productBatches.filter(b => 
            b.status === 'proofing' || b.status === 'completed'
        );
        
        // Render queue
        queueContainer.innerHTML = queued.length === 0 
            ? '<p class="empty-state">All products divided</p>'
            : queued.map(b => `
                <div class="queue-item">
                    <div>
                        <strong>${b.name}</strong>
                        <div>${b.pieces} pcs × ${b.doughNeeded / b.pieces}g = ${Utils.formatWeight(b.doughNeeded)}</div>
                    </div>
                    <button class="btn btn-primary" onclick="Production.startDividing('${b.productId}')">
                        Start Dividing
                    </button>
                </div>
            `).join('');
        
        // Render in progress
        document.getElementById('inProgressSection').style.display = inProgress.length > 0 ? 'block' : 'none';
        progressContainer.innerHTML = inProgress.map(b => `
            <div class="queue-item in-progress">
                <div>
                    <strong>🔪 ${b.name}</strong>
                    <div>${b.pieces} pieces</div>
                </div>
                <button class="btn btn-success" onclick="Production.completeDividing('${b.productId}')">
                    Complete Division
                </button>
            </div>
        `).join('');
        
        // Render completed
        document.getElementById('completedSection').style.display = completed.length > 0 ? 'block' : 'none';
        completedContainer.innerHTML = completed.map(b => `
            <div class="queue-item completed">
                <div>
                    <strong>✅ ${b.name}</strong>
                    <div>${b.piecesActual || b.pieces} pieces - ${b.status}</div>
                </div>
                ${b.status === 'proofing' ? `
                    <button class="btn btn-secondary" onclick="Timers.viewTimer('${b.productId}')">
                        View Timer
                    </button>
                ` : ''}
            </div>
        `).join('');
        
        // Show complete button if all divided
        document.getElementById('completeDivisionBtn').style.display = 
            queued.length === 0 && inProgress.length === 0 ? 'block' : 'none';
    },
    
    startDividing(productId) {
        const batch = this.currentRun.productBatches.find(b => b.productId === productId);
        if (!batch) return;
        
        batch.status = 'dividing';
        batch.divisionStarted = new Date();
        
        this.renderDivisionQueue();
        Toast.info(`Started dividing ${batch.name}`);
    },

    completeDividing(productId) {
        const batch = this.currentRun.productBatches.find(b => b.productId === productId);
        if (!batch) return;
        
        // Show modal to confirm pieces and start proofing
        const product = Products.getById(productId);
        
        Modal.open({
            title: `Complete Division: ${batch.name}`,
            content: `
                <form id="divisionCompleteForm">
                    <div class="form-group">
                        <label>Actual pieces made</label>
                        <input type="number" name="piecesActual" class="form-input" 
                               value="${batch.pieces}" min="1">
                    </div>
                    
                    <div class="form-group">
                        <label>Issues during division?</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <label><input type="checkbox" name="issues" value="sticky"> Dough too sticky</label>
                            <label><input type="checkbox" name="issues" value="tearing"> Dough tearing</label>
                            <label><input type="checkbox" name="issues" value="uneven"> Uneven portions</label>
                        </div>
                    </div>
                    
                    <h4 style="margin: 16px 0 8px;">Start Proofing?</h4>
                    <div class="recipe-stat">
                        <span>Standard proof time:</span>
                        <span>${product?.secondProof?.duration || 45} minutes @ ${product?.secondProof?.temperature || 32}°C</span>
                    </div>
                    
                    <div class="form-group">
                        <label>Adjust proof time (minutes)</label>
                        <input type="number" name="proofDuration" class="form-input" 
                               value="${product?.secondProof?.duration || 45}">
                    </div>
                </form>
            `,
            saveText: 'Start Proofing',
            onSave: () => {
                const form = document.getElementById('divisionCompleteForm');
                const formData = new FormData(form);
                
                batch.divisionCompleted = new Date();
                batch.piecesActual = parseInt(formData.get('piecesActual')) || batch.pieces;
                batch.issues = formData.getAll('issues');
                batch.status = 'proofing';
                batch.proofStarted = new Date();
                
                const proofDuration = parseInt(formData.get('proofDuration')) || 45;
                
                // Create proof timer
                Timers.createTimer({
                    id: `proof-${productId}`,
                    productId,
                    name: batch.name,
                    type: 'proofing',
                    duration: proofDuration * 60, // seconds
                    startedAt: Date.now(),
                    onComplete: () => this.onProofComplete(productId)
                });
                
                // Update remaining dough
                const remaining = document.getElementById('doughRemaining');
                const used = batch.piecesActual * (batch.doughNeeded / batch.pieces);
                const currentRemaining = parseFloat(remaining.textContent) || this.currentRun.doughBatch.totalWeight;
                remaining.textContent = Utils.formatWeight(currentRemaining - used);
                
                Modal.close();
                this.renderDivisionQueue();
                Toast.success(`${batch.name} now proofing for ${proofDuration} minutes`);
            }
        });
    },
    
    onProofComplete(productId) {
        const batch = this.currentRun.productBatches.find(b => b.productId === productId);
        if (!batch) return;
        
        batch.proofCompleted = new Date();
        
        // Show alert
        Alert.show(
            `${batch.name} Ready!`,
            `Proofing complete - ready for baking. Preheat oven if needed.`
        );
        
        // Show baking modal
        this.showBakingModal(productId);
    },
    
    showBakingModal(productId) {
        const batch = this.currentRun.productBatches.find(b => b.productId === productId);
        const product = Products.getById(productId);
        if (!batch || !product) return;
        
        Modal.open({
            title: `Start Baking: ${batch.name}`,
            content: `
                <form id="bakingStartForm">
                    <h4 style="margin-bottom: 8px;">Proof Quality Check</h4>
                    <div class="qa-options" style="margin-bottom: 16px;">
                        <label class="qa-option">
                            <input type="radio" name="proofQuality" value="perfect">
                            <span>Perfect (springs back)</span>
                        </label>
                        <label class="qa-option">
                            <input type="radio" name="proofQuality" value="good">
                            <span>Good</span>
                        </label>
                        <label class="qa-option">
                            <input type="radio" name="proofQuality" value="under">
                            <span>Under-proofed</span>
                        </label>
                        <label class="qa-option">
                            <input type="radio" name="proofQuality" value="over">
                            <span>Over-proofed</span>
                        </label>
                    </div>
                    
                    <h4 style="margin-bottom: 8px;">Baking Settings</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label>Oven Temp Top (°C)</label>
                            <input type="number" name="ovenTempTop" class="form-input" 
                                   value="${product.baking?.ovenTempTop || 180}">
                        </div>
                        <div class="form-group">
                            <label>Oven Temp Bottom (°C)</label>
                            <input type="number" name="ovenTempBottom" class="form-input" 
                                   value="${product.baking?.ovenTempBottom || 180}">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Bake Duration (minutes)</label>
                        <input type="number" name="bakeDuration" class="form-input" 
                               value="${product.baking?.duration || 18}">
                    </div>
                </form>
            `,
            saveText: 'Start Baking Timer',
            onSave: () => {
                const form = document.getElementById('bakingStartForm');
                const formData = new FormData(form);
                
                batch.proofQuality = formData.get('proofQuality');
                batch.bakeStarted = new Date();
                batch.ovenTempTop = parseFloat(formData.get('ovenTempTop'));
                batch.ovenTempBottom = parseFloat(formData.get('ovenTempBottom'));
                batch.status = 'baking';
                
                const bakeDuration = parseInt(formData.get('bakeDuration')) || 18;
                
                // Create bake timer
                Timers.createTimer({
                    id: `bake-${productId}`,
                    productId,
                    name: batch.name,
                    type: 'baking',
                    duration: bakeDuration * 60,
                    startedAt: Date.now(),
                    rotateAt: (product.baking?.rotateAt || 9) * 60,
                    onComplete: () => this.onBakeComplete(productId)
                });
                
                Modal.close();
                Toast.success(`${batch.name} baking for ${bakeDuration} minutes`);
            }
        });
    },
    
    onBakeComplete(productId) {
        const batch = this.currentRun.productBatches.find(b => b.productId === productId);
        if (!batch) return;
        
        batch.bakeCompleted = new Date();
        batch.status = 'completed';
        
        Alert.show(
            `${batch.name} Done!`,
            'Baking complete - remove from oven now!'
        );
        
        this.renderDivisionQueue();
        Toast.success(`${batch.name} baking complete!`);
    },
    
    completeDivision() {
        if (this.doughAgeTimer) {
            clearInterval(this.doughAgeTimer);
        }
        
        // Save production run
        this.saveProductionRun();
        
        Toast.success('Production run complete!');
        App.showView('dashboard');
    },
    
    async saveProductionRun() {
        if (!this.currentRun) return;
        
        this.currentRun.status = 'completed';
        this.currentRun.completedAt = new Date();
        
        try {
            await DB.add('productionRuns', this.currentRun);
            Toast.success('Production run saved');
        } catch (error) {
            console.error('Error saving production run:', error);
            Toast.error('Failed to save production run');
        }
        
        // Reset
        this.currentRun = null;
        this.plannedProducts = [];
    }
};
