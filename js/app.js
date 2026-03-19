/**
 * BreadHub ProofMaster - Main Application Controller
 */

const App = {
    currentView: 'dashboard',
    protectedSections: {
        fraudAdmin: {
            sessionKey: 'proofmaster.fraudAdminUnlocked',
            passwordHash: 'b776f437373d8f110da74691107468fce2c6cb1fc7c0757963ef6b0fe49f8069'
        }
    },

    init() {
        console.log('Initializing BreadHub ProofMaster...');

        if (!initFirebase()) {
            Toast.error('Failed to initialize database');
            return;
        }

        Modal.init();
        Toast.init();
        Alert.init();

        Auth.init();
        this.setupEventListeners();
        this.syncProtectedNavState();
        this.startClock();

        console.log('BreadHub ProofMaster initialized!');
    },

    async loadData() {
        try {
            await Suppliers.init();
            await IngredientPrices.init();

            await Promise.all([
                Ingredients.init(),
                PackagingMaterials.init(),
                Doughs.init(),
                Toppings.init(),
                Fillings.init(),
                Products.init(),
                PurchaseRequests.init(),
                Inventory.init()
            ]);

            if (Auth.hasPermission('users.manage')) {
                await Users.init();
            }

            if (Auth.hasPermission('fraud.view')) {
                await FraudReview.init();
            }

            Production.init();
            Timers.init();
            Production.loadProductSelect();

            this.showView(this.getDefaultView(), { silent: true });
            Toast.success('Application ready');
        } catch (error) {
            console.error('Error loading data:', error);
            Toast.error('Failed to load some data');
        }
    },

    setupEventListeners() {
        document.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.dataset.view;
                this.showView(view);
            });
        });

        const newProdBtn = document.getElementById('newProductionBtn');
        if (newProdBtn) {
            newProdBtn.addEventListener('click', () => this.showView('production'));
        }

        document.querySelectorAll('[data-section-toggle]').forEach((toggle) => {
            toggle.addEventListener('click', async (e) => {
                e.preventDefault();
                const sectionId = e.currentTarget.dataset.sectionToggle;
                await this.toggleProtectedSection(sectionId);
            });
        });
    },

    getDefaultView() {
        const preferredViews = ['dashboard', 'inventory', 'production', 'purchaseRequests', 'history'];
        return preferredViews.find((viewName) => Auth.canAccessView(viewName)) || 'dashboard';
    },

    showView(viewName, options = {}) {
        const protectedSectionId = this.getProtectedSectionForView(viewName);
        if (protectedSectionId && !options.skipProtectedSectionCheck && !this.isProtectedSectionUnlocked(protectedSectionId)) {
            this.promptProtectedSectionUnlock(protectedSectionId, viewName);
            return false;
        }

        if (!Auth.canAccessView(viewName)) {
            if (!options.silent) {
                Toast.error('You do not have permission to access this page');
            }

            const fallbackView = this.getDefaultView();
            if (viewName !== fallbackView) {
                return this.showView(fallbackView, { silent: true });
            }
            return false;
        }

        const targetView = document.getElementById(`${viewName}View`);
        if (!targetView) {
            console.warn(`View not found: ${viewName}`);
            return false;
        }

        this.currentView = viewName;
        this.closeMobileMenu();
        if (protectedSectionId) {
            this.setProtectedSectionCollapsed(protectedSectionId, false);
        }

        document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
        targetView.classList.add('active');

        document.querySelectorAll('.nav-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.view === viewName);
        });

        this.updateHeader(viewName);
        this.refreshView(viewName);
        return true;
    },

    getProtectedSectionConfig(sectionId) {
        return this.protectedSections[sectionId] || null;
    },

    getProtectedSectionElement(sectionId) {
        return document.querySelector(`.nav-section[data-protected-section="${sectionId}"]`);
    },

    getProtectedSectionForView(viewName) {
        const link = document.querySelector(`.nav-link[data-view="${viewName}"]`);
        const section = link?.closest('.nav-section[data-protected-section]');
        return section?.dataset.protectedSection || null;
    },

    isProtectedSectionUnlocked(sectionId) {
        const config = this.getProtectedSectionConfig(sectionId);
        if (!config) return true;
        return sessionStorage.getItem(config.sessionKey) === '1';
    },

    setProtectedSectionCollapsed(sectionId, collapsed) {
        const section = this.getProtectedSectionElement(sectionId);
        if (!section) return;

        section.classList.toggle('is-collapsed', collapsed);

        const toggle = section.querySelector('[data-section-toggle]');
        if (toggle) {
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        }
    },

    syncProtectedNavState() {
        document.querySelectorAll('.nav-section[data-protected-section]').forEach((section) => {
            const sectionId = section.dataset.protectedSection;
            this.setProtectedSectionCollapsed(sectionId, true);
        });
    },

    async toggleProtectedSection(sectionId) {
        const section = this.getProtectedSectionElement(sectionId);
        if (!section || section.style.display === 'none') return;

        if (!this.isProtectedSectionUnlocked(sectionId)) {
            await this.promptProtectedSectionUnlock(sectionId);
            return;
        }

        const isCollapsed = section.classList.contains('is-collapsed');
        this.setProtectedSectionCollapsed(sectionId, !isCollapsed);
    },

    async promptProtectedSectionUnlock(sectionId, targetView = null) {
        const config = this.getProtectedSectionConfig(sectionId);
        if (!config) return;

        Modal.open({
            title: 'Unlock Fraud Admin',
            saveText: 'Unlock',
            saveClass: 'btn-primary',
            width: '460px',
            content: `
                <form id="fraudUnlockForm">
                    <div class="form-group">
                        <label>Fraud Password</label>
                        <input type="password" id="fraudUnlockPassword" class="form-input" placeholder="Enter fraud password" autocomplete="current-password">
                    </div>
                    <p style="margin:0;color:var(--text-secondary);font-size:0.9rem;">
                        This unlock lasts only for the current browser tab.
                    </p>
                </form>
            `,
            onSave: async () => {
                const input = document.getElementById('fraudUnlockPassword');
                const password = input?.value || '';
                const isValid = await this.verifyProtectedSectionPassword(sectionId, password);

                if (!isValid) {
                    Toast.error('Incorrect fraud password');
                    if (input) input.focus();
                    return;
                }

                sessionStorage.setItem(config.sessionKey, '1');
                this.setProtectedSectionCollapsed(sectionId, false);
                Modal.close();
                Toast.success('Fraud admin unlocked');

                if (targetView) {
                    this.showView(targetView, { skipProtectedSectionCheck: true });
                }
            }
        });
    },

    async verifyProtectedSectionPassword(sectionId, password) {
        const config = this.getProtectedSectionConfig(sectionId);
        if (!config || !password || !window.crypto?.subtle) return false;

        const encoded = new TextEncoder().encode(password);
        const digest = await window.crypto.subtle.digest('SHA-256', encoded);
        const actualHash = Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');

        return actualHash === config.passwordHash;
    },

    updateHeader(viewName) {
        const titles = {
            dashboard: { title: 'Dashboard', subtitle: 'Production overview' },
            inventory: { title: 'Inventory', subtitle: 'Stock tracking & management' },
            inventoryReports: { title: 'Inventory Reports', subtitle: 'Daily performance, wastage & AI insights' },
            businessIntelligence: { title: 'Business Intelligence', subtitle: 'AI-Powered Analytics & Recommendations' },
            production: { title: 'New Production', subtitle: 'Plan your production run' },
            timers: { title: 'Active Timers', subtitle: 'Monitor proofing and baking' },
            suppliers: { title: 'Suppliers', subtitle: 'Manage suppliers with location & delivery' },
            ingredients: { title: 'Ingredients', subtitle: 'Master ingredients with multiple suppliers' },
            packaging: { title: 'Packaging Materials', subtitle: 'Cups, bags, pouches, boxes & more' },
            doughs: { title: 'Dough Recipes', subtitle: 'Manage dough recipes' },
            toppings: { title: 'Toppings', subtitle: 'Manage topping recipes' },
            fillings: { title: 'Fillings', subtitle: 'Manage filling recipes' },
            baseBreads: { title: 'Base Breads', subtitle: 'Manage base bread types for JIT Finishing' },
            products: { title: 'Products', subtitle: 'Manage product assembly' },
            finishingStation: { title: 'Finishing Station', subtitle: 'Convert base breads to finished products' },
            purchaseRequests: { title: 'Purchase Requests', subtitle: 'Create and manage purchase requests' },
            costs: { title: 'Cost Analysis', subtitle: 'Analyze production costs' },
            history: { title: 'Production History', subtitle: 'View past production runs' },
            fraudDetection: { title: 'Fraud Review', subtitle: 'Read-only CCTV and POS incident inbox' },
            users: { title: 'User Management', subtitle: 'Manage users and roles (Admin only)' }
        };

        const config = titles[viewName] || { title: viewName, subtitle: '' };
        document.getElementById('pageTitle').textContent = config.title;
        document.getElementById('pageSubtitle').textContent = config.subtitle;
    },

    refreshView(viewName) {
        switch (viewName) {
            case 'dashboard':
                this.refreshDashboard();
                break;
            case 'inventory':
                Inventory.render();
                break;
            case 'inventoryReports':
                InventoryReports.render();
                break;
            case 'businessIntelligence':
                BusinessIntelligence.render();
                break;
            case 'suppliers':
                Suppliers.render();
                break;
            case 'ingredients':
                Ingredients.render();
                break;
            case 'packaging':
                PackagingMaterials.render();
                break;
            case 'doughs':
                Doughs.render();
                break;
            case 'toppings':
                Toppings.render();
                break;
            case 'fillings':
                Fillings.render();
                break;
            case 'baseBreads':
                BaseBreads.render();
                break;
            case 'products':
                Products.render();
                break;
            case 'finishingStation':
                FinishingStation.render();
                break;
            case 'production':
                Production.loadProductSelect();
                break;
            case 'timers':
                Timers.render();
                break;
            case 'history':
                this.loadHistory();
                break;
            case 'fraudDetection':
                if (Auth.hasPermission('fraud.view')) {
                    FraudReview.render();
                }
                break;
            case 'users':
                if (Auth.hasPermission('users.manage')) {
                    Users.load().then(() => Users.render());
                }
                break;
        }
    },

    refreshDashboard() {
        this.updateDashboardStats();
        this.updateActiveProduction();
        Timers.renderDashboardTimers();
    },

    updateDashboardStats() {
        document.getElementById('statProduced').textContent = '0';
        document.getElementById('statBatches').textContent = '0';
    },

    updateActiveProduction() {
        const container = document.getElementById('activeProductionContent');
        const badge = document.getElementById('activeProductionBadge');
        const canRunProduction = Auth.hasPermission('production.run');

        if (Production.currentRun) {
            badge.textContent = Production.currentRun.runId;
            badge.classList.remove('badge-warning');
            badge.classList.add('badge-success');

            container.innerHTML = `
                <div class="recipe-stat">
                    <span>Status:</span>
                    <span>${Production.currentRun.status}</span>
                </div>
                <div class="recipe-stat">
                    <span>Products:</span>
                    <span>${Production.currentRun.productsPlanned.length}</span>
                </div>
                ${canRunProduction ? `
                    <button class="btn btn-primary" onclick="App.showView('production')">
                        Continue Production
                    </button>
                ` : `
                    <p class="empty-state">You can view dashboard data but cannot run production.</p>
                `}
            `;
        } else {
            badge.textContent = 'None';
            badge.classList.add('badge-warning');
            badge.classList.remove('badge-success');

            container.innerHTML = canRunProduction ? `
                <p class="empty-state">No active production run</p>
                <button class="btn btn-secondary" onclick="App.showView('production')">
                    Start Production
                </button>
            ` : `
                <p class="empty-state">No active production run</p>
            `;
        }
    },

    async loadHistory() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        try {
            const runs = await DB.getAll('productionRuns');
            runs.sort((a, b) => (b.startedAt?.toDate?.() || 0) - (a.startedAt?.toDate?.() || 0));

            if (runs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-state">No production history yet</td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = runs.map((run) => {
                const products = run.productsPlanned?.map((product) => product.name).join(', ') || '-';
                const totalPieces = run.productBatches?.reduce((sum, batch) => sum + (batch.piecesActual || batch.pieces), 0) || 0;

                return `
                    <tr>
                        <td>${Utils.formatDateTime(run.startedAt)}</td>
                        <td>${run.runId}</td>
                        <td>${products}</td>
                        <td>${totalPieces}</td>
                        <td>${run.doughBatch?.quality || '-'}</td>
                        <td>
                            <button class="btn btn-secondary" onclick="App.viewRunDetails('${run.id}')">
                                View
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading history:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">Failed to load history</td>
                </tr>
            `;
        }
    },

    viewRunDetails(runId) {
        Toast.info('Detail view coming soon');
    },

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-PH', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                hourCycle: 'h12'
            });
            const el = document.getElementById('currentTime');
            if (el) el.textContent = timeStr;
        };

        updateClock();
        setInterval(updateClock, 1000);
    },

    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    },

    closeMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
