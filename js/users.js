/**
 * BreadHub ProofMaster - Users Management
 * Admin module for managing users and roles
 */

const Users = {
    data: [],
    
    async init() {
        if (!Auth.hasRole('admin')) return;
        await this.load();
    },
    
    async load() {
        try {
            const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
            this.data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error loading users:', error);
        }
    },
    
    render() {
        const container = document.getElementById('usersTableBody');
        if (!container) return;
        
        if (!Auth.hasRole('admin')) {
            container.innerHTML = '<tr><td colspan="6">Admin access required</td></tr>';
            return;
        }
        
        if (this.data.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
            return;
        }
        
        container.innerHTML = this.data.map(user => {
            const isCurrentUser = user.uid === Auth.currentUser?.uid;
            const roleInfo = Auth.roles[user.role] || Auth.roles.baker;
            
            return `
                <tr data-id="${user.id}">
                    <td>
                        <strong>${user.displayName || 'No name'}</strong>
                        ${isCurrentUser ? '<span style="color: var(--primary);"> (You)</span>' : ''}
                    </td>
                    <td>${user.email}</td>
                    <td>
                        <span class="role-badge role-${user.role}">${roleInfo.name}</span>
                    </td>
                    <td>
                        ${user.approved 
                            ? '<span style="color: var(--success);">✓ Approved</span>' 
                            : '<span style="color: var(--warning);">⏳ Pending</span>'}
                    </td>
                    <td>${user.createdAt ? Utils.formatDate(user.createdAt.toDate()) : '-'}</td>
                    <td>
                        ${!isCurrentUser ? `
                            <button class="btn btn-secondary btn-sm" onclick="Users.editRole('${user.id}')">
                                Change Role
                            </button>
                            ${!user.approved ? `
                                <button class="btn btn-primary btn-sm" onclick="Users.approve('${user.id}')">
                                    Approve
                                </button>
                            ` : ''}
                            <button class="btn btn-danger btn-sm" onclick="Users.remove('${user.id}')">
                                Remove
                            </button>
                        ` : `
                            <span style="color: var(--text-secondary);">-</span>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    async approve(userId) {
        if (!Auth.requireRole('admin')) return;
        
        try {
            await db.collection('users').doc(userId).update({
                approved: true,
                approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                approvedBy: Auth.currentUser.uid
            });
            Toast.success('User approved');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error approving user:', error);
            Toast.error('Failed to approve user');
        }
    },
    
    editRole(userId) {
        if (!Auth.requireRole('admin')) return;
        
        const user = this.data.find(u => u.id === userId);
        if (!user) return;
        
        Modal.open({
            title: 'Change User Role',
            content: `
                <form id="roleForm">
                    <p style="margin-bottom: 16px;">
                        <strong>${user.displayName}</strong><br>
                        <span style="color: var(--text-secondary);">${user.email}</span>
                    </p>
                    
                    <div class="form-group">
                        <label>Role</label>
                        <select name="role" class="form-select">
                            ${Object.entries(Auth.roles).map(([key, role]) => `
                                <option value="${key}" ${user.role === key ? 'selected' : ''}>
                                    ${role.name} - ${role.description}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div style="background: var(--bg-input); padding: 12px; border-radius: 8px; margin-top: 12px;">
                        <strong>Role Permissions:</strong>
                        <ul style="margin: 8px 0 0 20px; font-size: 0.9rem;">
                            <li><strong>Admin:</strong> Full access, manage users</li>
                            <li><strong>Manager:</strong> Edit recipes & products, view costs</li>
                            <li><strong>Baker:</strong> Production runs only, view recipes</li>
                        </ul>
                    </div>
                </form>
            `,
            saveText: 'Update Role',
            onSave: () => this.saveRole(userId)
        });
    },

    async saveRole(userId) {
        const form = document.getElementById('roleForm');
        const formData = new FormData(form);
        const newRole = formData.get('role');
        
        try {
            await db.collection('users').doc(userId).update({
                role: newRole,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: Auth.currentUser.uid
            });
            Toast.success('Role updated');
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error updating role:', error);
            Toast.error('Failed to update role');
        }
    },
    
    async remove(userId) {
        if (!Auth.requireRole('admin')) return;
        
        const user = this.data.find(u => u.id === userId);
        if (!user) return;
        
        if (!confirm(`Remove user "${user.displayName || user.email}"? This will delete their account.`)) {
            return;
        }
        
        try {
            // Delete from Firestore (Auth deletion requires Admin SDK)
            await db.collection('users').doc(userId).delete();
            Toast.success('User removed from system');
            await this.load();
            this.render();
            
            // Note: The Firebase Auth account still exists but they can't access data
            Toast.warning('Note: User may need to be deleted from Firebase Console > Authentication');
        } catch (error) {
            console.error('Error removing user:', error);
            Toast.error('Failed to remove user');
        }
    },
    
    // Get user by ID
    getById(id) {
        return this.data.find(u => u.id === id);
    },
    
    // Get display name for a user ID
    getDisplayName(uid) {
        const user = this.data.find(u => u.uid === uid);
        return user?.displayName || 'Unknown';
    }
};
