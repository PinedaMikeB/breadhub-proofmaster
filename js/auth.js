/**
 * BreadHub ProofMaster - Authentication Module
 * Handles signup, signin, signout, and user session
 */

const Auth = {
    currentUser: null,
    userProfile: null,
    
    // Available roles
    roles: {
        admin: { name: 'Admin', level: 100, description: 'Full access to everything' },
        manager: { name: 'Manager', level: 50, description: 'Manage recipes, products, view costs' },
        baker: { name: 'Baker', level: 20, description: 'Production runs, view recipes only' }
    },
    
    init() {
        // Listen for auth state changes
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
            if (doc.exists) {
                this.userProfile = doc.data();
            } else {
                // First time user - should not happen if signup worked
                console.warn('User profile not found');
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    },
    
    onSignedIn() {
        // Hide login screen, show app
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        
        // Update user display
        this.updateUserDisplay();
        
        // Initialize app data
        App.loadData();
        
        // Check if user is approved
        if (this.userProfile && !this.userProfile.approved) {
            Toast.warning('Your account is pending approval by admin');
        }
    },
    
    onSignedOut() {
        // Show login screen, hide app
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    },
    
    updateUserDisplay() {
        const userNameEl = document.getElementById('currentUserName');
        const userRoleEl = document.getElementById('currentUserRole');
        
        if (userNameEl && this.userProfile) {
            userNameEl.textContent = this.userProfile.displayName || this.currentUser.email;
        }
        if (userRoleEl && this.userProfile) {
            const role = this.roles[this.userProfile.role] || this.roles.baker;
            userRoleEl.textContent = role.name;
        }
        
        // Update nav visibility based on role
        this.updateNavVisibility();
    },
    
    updateNavVisibility() {
        const role = this.userProfile?.role || 'baker';
        const level = this.roles[role]?.level || 0;
        
        // Hide admin-only items for non-admins
        document.querySelectorAll('[data-min-role="admin"]').forEach(el => {
            el.style.display = level >= 100 ? '' : 'none';
        });
        
        // Hide manager+ items for bakers
        document.querySelectorAll('[data-min-role="manager"]').forEach(el => {
            el.style.display = level >= 50 ? '' : 'none';
        });
    },
    
    // Check if current user has required role level
    hasRole(minRole) {
        const userLevel = this.roles[this.userProfile?.role]?.level || 0;
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

    // Show login form
    showLoginForm() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('forgotPasswordForm').style.display = 'none';
    },
    
    // Show signup form
    showSignupForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
        document.getElementById('forgotPasswordForm').style.display = 'none';
    },
    
    // Show forgot password form
    showForgotPasswordForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('forgotPasswordForm').style.display = 'block';
    },
    
    // Sign up with email/password
    async signUp() {
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        
        // Validation
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
            
            // Create user in Firebase Auth
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Check if this is the first user (make them admin)
            const usersSnapshot = await db.collection('users').get();
            const isFirstUser = usersSnapshot.empty;
            
            // Create user profile in Firestore
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: email,
                displayName: name,
                role: isFirstUser ? 'admin' : 'baker', // First user is admin
                approved: isFirstUser ? true : false,  // First user auto-approved
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: isFirstUser ? 'system' : null
            });
            
            Toast.success(isFirstUser 
                ? 'Account created! You are the admin.' 
                : 'Account created! Waiting for admin approval.');
            
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
    
    // Sign in with email/password
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
    
    // Sign out
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
    
    // Send password reset email
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
