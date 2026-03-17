/**
 * BreadHub ProofMaster - Authentication + Authorization Module
 * Handles signup, signin, signout, user sessions, and view permissions.
 */

const Auth = {
    currentUser: null,
    userProfile: null,

    // OWNER EMAIL - this email will always be admin
    ownerEmail: 'michael.marga@gmail.com',

    viewPermissions: {
        dashboard: 'dashboard.view',
        inventory: 'inventory.view',
        production: 'production.view',
        timers: 'timers.view',
        suppliers: 'suppliers.view',
        ingredients: 'ingredients.view',
        packaging: 'packaging.view',
        doughs: 'doughs.view',
        toppings: 'toppings.view',
        fillings: 'fillings.view',
        baseBreads: 'baseBreads.view',
        products: 'products.view',
        finishingStation: 'finishingStation.view',
        purchaseRequests: 'purchaseRequests.view',
        costs: 'costs.view',
        history: 'history.view',
        inventoryReports: 'inventoryReports.view',
        businessIntelligence: 'businessIntelligence.view',
        users: 'users.manage',
        fraudDetection: 'fraud.view'
    },

    // Available roles + centralized permission matrix
    roles: {
        admin: {
            name: 'Admin',
            level: 100,
            description: 'Full access to operations, users, and future fraud tools',
            permissions: ['*']
        },
        manager: {
            name: 'Manager',
            level: 50,
            description: 'Operations, recipes, reports, and business intelligence',
            permissions: [
                'dashboard.view',
                'inventory.view',
                'inventory.manage',
                'production.view',
                'production.run',
                'timers.view',
                'suppliers.view',
                'suppliers.manage',
                'ingredients.view',
                'ingredients.manage',
                'packaging.view',
                'packaging.manage',
                'doughs.view',
                'doughs.manage',
                'toppings.view',
                'toppings.manage',
                'fillings.view',
                'fillings.manage',
                'baseBreads.view',
                'baseBreads.manage',
                'products.view',
                'products.manage',
                'finishingStation.view',
                'finishingStation.use',
                'purchaseRequests.view',
                'purchaseRequests.manage',
                'costs.view',
                'history.view',
                'inventoryReports.view',
                'businessIntelligence.view'
            ]
        },
        purchaser: {
            name: 'Purchaser',
            level: 35,
            description: 'Purchase requests, suppliers, and purchasing support only',
            permissions: [
                'dashboard.view',
                'inventory.view',
                'suppliers.view',
                'suppliers.manage',
                'ingredients.view',
                'packaging.view',
                'purchaseRequests.view',
                'purchaseRequests.manage',
                'history.view'
            ]
        },
        baker: {
            name: 'Baker',
            level: 20,
            description: 'Production floor access without admin or analytics tools',
            permissions: [
                'dashboard.view',
                'inventory.view',
                'production.view',
                'production.run',
                'timers.view',
                'history.view'
            ]
        }
    },

    init() {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserProfile();
                this.onSignedIn();
            } else {
                this.currentUser = null;
                this.userProfile = null;
                this.onSignedOut();
            }
        });
    },

    async loadUserProfile() {
        if (!this.currentUser) return;

        try {
            const doc = await db.collection('users').doc(this.currentUser.uid).get();
            this.userProfile = doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.userProfile = null;
        }
    },

    onSignedIn() {
        if (!this.userProfile) {
            this.showAccessState(
                'Account Setup Incomplete',
                'Your account is missing a user profile. Please contact an admin before accessing BreadHub ProofMaster.'
            );
            return;
        }

        if (!this.isApproved()) {
            this.showAccessState(
                'Waiting for Approval',
                'Your account has been created but is not approved yet. An admin must approve it before you can enter the app.'
            );
            return;
        }

        this.showApp();
        this.updateUserDisplay();
        App.loadData();
    },

    onSignedOut() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        this.setAuthPanel('loginForm');
    },

    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
    },

    showAccessState(title, message) {
        const titleEl = document.getElementById('pendingApprovalTitle');
        const messageEl = document.getElementById('pendingApprovalMessage');
        const emailEl = document.getElementById('pendingApprovalEmail');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (emailEl) emailEl.textContent = this.currentUser?.email || '-';

        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        this.setAuthPanel('pendingApprovalCard');
    },

    setAuthPanel(activePanelId) {
        ['loginForm', 'signupForm', 'forgotPasswordForm', 'pendingApprovalCard'].forEach((panelId) => {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.style.display = panelId === activePanelId ? 'block' : 'none';
            }
        });
    },

    getRoleConfig(roleKey = this.userProfile?.role) {
        return this.roles[roleKey] || this.roles.baker;
    },

    isApproved() {
        if (!this.currentUser || !this.userProfile) return false;
        return this.userProfile.approved === true || this.userProfile.role === 'admin';
    },

    hasRole(minRole) {
        const userLevel = this.getRoleConfig().level || 0;
        const requiredLevel = this.roles[minRole]?.level || 0;
        return userLevel >= requiredLevel;
    },

    requireRole(minRole) {
        if (!this.hasRole(minRole)) {
            Toast.error('You do not have permission for this action');
            return false;
        }
        return true;
    },

    hasPermission(permission) {
        if (!this.currentUser || !this.userProfile) return false;

        const permissions = this.getRoleConfig().permissions || [];
        if (permissions.includes('*')) return true;

        return permissions.some((granted) => {
            if (granted === permission) return true;
            if (granted.endsWith('.*')) {
                return permission.startsWith(granted.slice(0, -1));
            }
            return false;
        });
    },

    requirePermission(permission, message = 'You do not have permission for this action') {
        if (!this.hasPermission(permission)) {
            Toast.error(message);
            return false;
        }
        return true;
    },

    getViewPermission(viewName) {
        return this.viewPermissions[viewName] || null;
    },

    canAccessView(viewName) {
        const permission = this.getViewPermission(viewName);
        return permission ? this.hasPermission(permission) : false;
    },

    updateUserDisplay() {
        const userNameEl = document.getElementById('currentUserName');
        const userRoleEl = document.getElementById('currentUserRole');
        const role = this.getRoleConfig();

        if (userNameEl && this.userProfile) {
            userNameEl.textContent = this.userProfile.displayName || this.currentUser.email;
        }
        if (userRoleEl) {
            userRoleEl.textContent = role.name;
        }

        this.updateNavVisibility();
        this.updateActionVisibility();
    },

    updateNavVisibility() {
        document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
            const canAccess = this.canAccessView(link.dataset.view);
            link.style.display = canAccess ? '' : 'none';
        });

        document.querySelectorAll('.nav-section').forEach((section) => {
            const hasVisibleLink = Array.from(section.querySelectorAll('.nav-link[data-view]'))
                .some((link) => link.style.display !== 'none');
            section.style.display = hasVisibleLink ? '' : 'none';
        });
    },

    updateActionVisibility() {
        const newProductionBtn = document.getElementById('newProductionBtn');
        if (newProductionBtn) {
            newProductionBtn.style.display = this.hasPermission('production.run') ? '' : 'none';
        }
    },

    showLoginForm() {
        this.setAuthPanel('loginForm');
    },

    showSignupForm() {
        this.setAuthPanel('signupForm');
    },

    showForgotPasswordForm() {
        this.setAuthPanel('forgotPasswordForm');
    },

    async signUp() {
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        if (!name || !email || !password) {
            Toast.error('Please fill all fields');
            return;
        }

        if (password.length < 6) {
            Toast.error('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            Toast.error('Passwords do not match');
            return;
        }

        try {
            this.setLoading(true, 'signup');

            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            const isOwner = email.toLowerCase() === this.ownerEmail.toLowerCase();

            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email,
                displayName: name,
                role: isOwner ? 'admin' : 'baker',
                approved: isOwner,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: isOwner ? 'system' : null
            });

            Toast.success(
                isOwner
                    ? 'Welcome! You are the admin.'
                    : 'Account created. Waiting for admin approval before access is granted.'
            );
        } catch (error) {
            console.error('Signup error:', error);
            if (error.code === 'auth/email-already-in-use') {
                Toast.error('Email already registered');
            } else if (error.code === 'auth/invalid-email') {
                Toast.error('Invalid email address');
            } else {
                Toast.error('Signup failed: ' + error.message);
            }
        } finally {
            this.setLoading(false, 'signup');
        }
    },

    async signIn() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            Toast.error('Please enter email and password');
            return;
        }

        try {
            this.setLoading(true, 'login');
            await firebase.auth().signInWithEmailAndPassword(email, password);
            Toast.success('Signed in successfully');
        } catch (error) {
            console.error('Login error:', error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                Toast.error('Invalid email or password');
            } else if (error.code === 'auth/invalid-email') {
                Toast.error('Invalid email address');
            } else {
                Toast.error('Login failed: ' + error.message);
            }
        } finally {
            this.setLoading(false, 'login');
        }
    },

    async signOut() {
        if (!confirm('Are you sure you want to sign out?')) return;

        try {
            await firebase.auth().signOut();
            Toast.success('Signed out');
        } catch (error) {
            console.error('Signout error:', error);
            Toast.error('Failed to sign out');
        }
    },

    async resetPassword() {
        const email = document.getElementById('resetEmail').value.trim();

        if (!email) {
            Toast.error('Please enter your email');
            return;
        }

        try {
            this.setLoading(true, 'reset');
            await firebase.auth().sendPasswordResetEmail(email);
            Toast.success('Password reset email sent! Check your inbox.');
            this.showLoginForm();
        } catch (error) {
            console.error('Password reset error:', error);
            if (error.code === 'auth/user-not-found') {
                Toast.error('No account found with this email');
            } else {
                Toast.error('Failed to send reset email');
            }
        } finally {
            this.setLoading(false, 'reset');
        }
    },

    setLoading(loading, formType) {
        const buttons = {
            login: document.getElementById('loginBtn'),
            signup: document.getElementById('signupBtn'),
            reset: document.getElementById('resetBtn')
        };

        const btn = buttons[formType];
        if (btn) {
            btn.disabled = loading;
            btn.textContent = loading ? 'Please wait...' : btn.dataset.originalText;
        }
    }
};
