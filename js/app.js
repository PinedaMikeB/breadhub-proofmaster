/**
 * BreadHub ProofMaster - Main Application Controller
 */

const App = {
    currentView: 'dashboard',
    
    async init() {
        console.log('Initializing BreadHub ProofMaster...');
        
        // Initialize Firebase
        if (!initFirebase()) {
            Toast.error('Failed to initialize database');
            return;
        }
        
        // Initialize UI components
        Modal.init();
        Toast.init();
        Alert.init();
        
        // Initialize Auth (this will trigger loadData after login)
        Auth.init();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start clock
        this.startClock();
        
        console.log('BreadHub ProofMaster initialized!');
    },
    
    async loadData() {
        try {
            // Load suppliers first (ingredients depend on it)
            await Suppliers.init();
            
            // Load all other data in parallel
            await Promise.all([
                Ingredients.init(),
                Doughs.init(),
                Toppings.init(),
                Fillings.init(),
                Products.init()
            ]);
            
            // Load users if admin
            if (Auth.hasRole('admin')) {
                await Users.init();
            }
            
            // Initialize modules
            Production.init();
            Timers.init();
            
            // Refresh production after products loaded
            Production.loadProductSelect();
            
            // Show dashboard
            this.showView('dashboard');
            
            Toast.success('Application ready');
            
        } catch (error) {
            console.error('Error loading data:', error);
            Toast.error('Failed to load some data');
        }
    },
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.dataset.view;
                this.showView(view);
            });
        });
        
        // New Production button
        const newProdBtn = document.getElementById('newProductionBtn');
        if (newProdBtn) {
            newProdBtn.addEventListener('click', () => this.showView('production'));
        }
    },
    
    showView(viewName) {
        // Update current view
        this.currentView = viewName;
        
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        // Show target view
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.add('active');
        }
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === viewName) {
                link.classList.add('active');
            }
        });
        
        // Update header
        this.updateHeader(viewName);
        
        // Refresh view-specific content
        this.refreshView(viewName);
    },
    
    updateHeader(viewName) {
        const titles = {
            dashboard: { title: 'Dashboard', subtitle: 'Production overview' },
            production: { title: 'New Production', subtitle: 'Plan your production run' },
            timers: { title: 'Active Timers', subtitle: 'Monitor proofing and baking' },
            suppliers: { title: 'Suppliers', subtitle: 'Manage your ingredient suppliers' },
            ingredients: { title: 'Ingredients', subtitle: 'Master ingredients with costs (all in grams)' },
            doughs: { title: 'Dough Recipes', subtitle: 'Manage dough recipes' },
            toppings: { title: 'Toppings', subtitle: 'Manage topping recipes' },
            fillings: { title: 'Fillings', subtitle: 'Manage filling recipes' },
            products: { title: 'Products', subtitle: 'Manage product assembly' },
            costs: { title: 'Cost Analysis', subtitle: 'Analyze production costs' },
            history: { title: 'Production History', subtitle: 'View past production runs' },
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
            case 'suppliers':
                Suppliers.render();
                break;
            case 'ingredients':
                Ingredients.render();
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
            case 'products':
                Products.render();
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
            case 'users':
                if (Auth.hasRole('admin')) {
                    Users.load().then(() => Users.render());
                }
                break;
        }
    },
    
    refreshDashboard() {
        // Update stats
        this.updateDashboardStats();
        
        // Update active production
        this.updateActiveProduction();
        
        // Update timers
        Timers.renderDashboardTimers();
    },
    
    updateDashboardStats() {
        // These would typically come from the database
        // For now, show placeholder values
        document.getElementById('statProduced').textContent = '0';
        document.getElementById('statBatches').textContent = '0';
    },
    
    updateActiveProduction() {
        const container = document.getElementById('activeProductionContent');
        const badge = document.getElementById('activeProductionBadge');
        
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
                <button class="btn btn-primary" onclick="App.showView('production')">
                    Continue Production
                </button>
            `;
        } else {
            badge.textContent = 'None';
            badge.classList.add('badge-warning');
            badge.classList.remove('badge-success');
            
            container.innerHTML = `
                <p class="empty-state">No active production run</p>
                <button class="btn btn-secondary" onclick="App.showView('production')">
                    Start Production
                </button>
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
            
            tbody.innerHTML = runs.map(run => {
                const products = run.productsPlanned?.map(p => p.name).join(', ') || '-';
                const totalPieces = run.productBatches?.reduce((sum, b) => sum + (b.piecesActual || b.pieces), 0) || 0;
                
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
        // TODO: Implement detailed view of production run
        Toast.info('Detail view coming soon');
    },
    
    startClock() {
        const updateClock = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-PH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const el = document.getElementById('currentTime');
            if (el) el.textContent = timeStr;
        };
        
        updateClock();
        setInterval(updateClock, 1000);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
