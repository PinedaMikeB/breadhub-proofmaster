/**
 * BreadHub ProofMaster - Base Breads Module
 * 
 * Manages base bread types for JIT (Just-In-Time) Finishing System
 * Base breads are pre-baked and stored, then finished with toppings on demand
 * 
 * Collections:
 * - baseBreads: Base bread definitions
 * - dailyBaseInventory: Daily tracking of base bread stock
 * - finishingLogs: Log of base → finished conversions
 */

const BaseBreads = {
    data: [],
    
    async init() {
        await this.load();
        await this.seedDefaults();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('baseBreads');
            this.data.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error loading base breads:', error);
        }
    },
    
    async seedDefaults() {
        // Only seed if empty
        if (this.data.length > 0) return;
        
        const defaults = [
            { 
                name: 'Donut Premium Base', 
                description: 'Large donut base for premium toppings',
                shelfLifeHours: 24,
                icon: '🍩',
                active: true
            },
            { 
                name: 'Donut Classic Base', 
                description: 'Smaller donut base for classic toppings',
                shelfLifeHours: 24,
                icon: '🍩',
                active: true
            },
            { 
                name: 'Cinnamon Base', 
                description: 'Cinnamon roll base for various toppings',
                shelfLifeHours: 24,
                icon: '🥮',
                active: true
            },
            { 
                name: 'Pork Floss Base', 
                description: 'Bread base for floss toppings',
                shelfLifeHours: 24,
                icon: '🥖',
                active: true
            },
            { 
                name: 'Cheese Roll Base', 
                description: 'Roll base for cheese toppings (Butter Melt, Milky)',
                shelfLifeHours: 24,
                icon: '🧀',
                active: true
            },
            { 
                name: 'Focaccia Base', 
                description: 'Flatbread base for pizza toppings',
                shelfLifeHours: 48,
                icon: '🍕',
                active: true
            },
            { 
                name: 'Ensaymada Base', 
                description: 'Ensaymada base for various toppings',
                shelfLifeHours: 24,
                icon: '🥯',
                active: true
            }
        ];
        
        for (const base of defaults) {
            await this.add(base);
        }
        
        console.log('Base breads seeded with defaults');
        await this.load();
    },
    
    async add(data) {
        try {
            const id = await DB.add('baseBreads', {
                ...data,
                active: data.active !== false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.load();
            return id;
        } catch (error) {
            console.error('Error adding base bread:', error);
            throw error;
        }
    },
    
    async update(id, data) {
        try {
            await DB.update('baseBreads', id, data);
            await this.load();
        } catch (error) {
            console.error('Error updating base bread:', error);
            throw error;
        }
    },
    
    async delete(id) {
        try {
            await DB.delete('baseBreads', id);
            await this.load();
        } catch (error) {
            console.error('Error deleting base bread:', error);
            throw error;
        }
    },
    
    getById(id) {
        return this.data.find(b => b.id === id);
    },
    
    getActive() {
        return this.data.filter(b => b.active);
    },
    
    // Get all products linked to a base bread
    async getLinkedProducts(baseBreedId) {
        const products = await DB.getAll('products');
        return products.filter(p => p.baseBreadId === baseBreedId);
    },

    // ===== RENDER UI =====
    render() {
        const container = document.getElementById('baseBreadsContent');
        if (!container) return;
        
        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div>
                    <span style="font-size:0.9rem;color:#666;">
                        ${this.data.length} base breads configured
                    </span>
                </div>
                <button class="btn btn-primary" onclick="BaseBreads.showAddModal()">
                    + Add Base Bread
                </button>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        `;
        
        if (this.data.length === 0) {
            html += `<p class="empty-state">No base breads configured. Click "Add Base Bread" to create one.</p>`;
        } else {
            this.data.forEach(base => {
                const statusColor = base.active ? '#4CAF50' : '#9E9E9E';
                const statusText = base.active ? 'Active' : 'Inactive';
                
                html += `
                    <div style="background:white;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
                            <div>
                                <span style="font-size:2rem;">${base.icon || '🍞'}</span>
                                <h3 style="margin:8px 0 4px 0;">${base.name}</h3>
                                <span style="font-size:0.8rem;color:${statusColor};font-weight:500;">${statusText}</span>
                            </div>
                        </div>
                        <p style="color:#666;font-size:0.9rem;margin-bottom:12px;">${base.description || 'No description'}</p>
                        <div style="font-size:0.85rem;color:#888;margin-bottom:16px;">
                            Shelf life: ${base.shelfLifeHours || 24} hours
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-secondary btn-sm" onclick="BaseBreads.showEditModal('${base.id}')">
                                ✏️ Edit
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="BaseBreads.viewLinkedProducts('${base.id}')" style="background:#E3F2FD;">
                                📋 Products
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="BaseBreads.confirmDelete('${base.id}')" style="background:#FFEBEE;color:#C62828;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        container.innerHTML = html;
    },
    
    showAddModal() {
        Modal.open({
            title: '➕ Add Base Bread',
            content: this.getFormHTML(),
            saveText: 'Add Base Bread',
            onSave: () => this.saveNew()
        });
    },
    
    showEditModal(id) {
        const base = this.getById(id);
        if (!base) return;
        
        Modal.open({
            title: '✏️ Edit Base Bread',
            content: this.getFormHTML(base),
            saveText: 'Save Changes',
            onSave: () => this.saveEdit(id)
        });
    },

    getFormHTML(base = {}) {
        const icons = ['🍩', '🥮', '🥖', '🧀', '🍕', '🥯', '🍞', '🥐', '🥪'];
        
        return `
            <div class="form-group">
                <label>Name *</label>
                <input type="text" id="baseName" class="form-input" 
                       value="${base.name || ''}" placeholder="e.g., Donut Premium Base">
            </div>
            
            <div class="form-group">
                <label>Icon</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${icons.map(icon => `
                        <button type="button" class="btn btn-secondary" 
                                style="font-size:1.5rem;padding:8px 12px;${base.icon === icon ? 'border:2px solid #8B4513;' : ''}"
                                onclick="document.getElementById('baseIcon').value='${icon}';this.parentNode.querySelectorAll('button').forEach(b=>b.style.border='');this.style.border='2px solid #8B4513';">
                            ${icon}
                        </button>
                    `).join('')}
                </div>
                <input type="hidden" id="baseIcon" value="${base.icon || '🍞'}">
            </div>
            
            <div class="form-group">
                <label>Description</label>
                <textarea id="baseDescription" class="form-input" rows="2" 
                          placeholder="Brief description of this base bread">${base.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>Shelf Life (hours)</label>
                <input type="number" id="baseShelfLife" class="form-input" 
                       value="${base.shelfLifeHours || 24}" min="1" max="168">
                <small style="color:#666;">How long the base can be stored before finishing</small>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="baseActive" ${base.active !== false ? 'checked' : ''}>
                    Active (available in Finishing Station)
                </label>
            </div>
        `;
    },
    
    async saveNew() {
        const name = document.getElementById('baseName').value.trim();
        if (!name) {
            Toast.error('Name is required');
            return;
        }
        
        try {
            await this.add({
                name,
                icon: document.getElementById('baseIcon').value,
                description: document.getElementById('baseDescription').value.trim(),
                shelfLifeHours: parseInt(document.getElementById('baseShelfLife').value) || 24,
                active: document.getElementById('baseActive').checked
            });
            
            Modal.close();
            Toast.success('Base bread added');
            this.render();
        } catch (error) {
            Toast.error('Failed to add base bread');
        }
    },
    
    async saveEdit(id) {
        const name = document.getElementById('baseName').value.trim();
        if (!name) {
            Toast.error('Name is required');
            return;
        }
        
        try {
            await this.update(id, {
                name,
                icon: document.getElementById('baseIcon').value,
                description: document.getElementById('baseDescription').value.trim(),
                shelfLifeHours: parseInt(document.getElementById('baseShelfLife').value) || 24,
                active: document.getElementById('baseActive').checked
            });
            
            Modal.close();
            Toast.success('Base bread updated');
            this.render();
        } catch (error) {
            Toast.error('Failed to update base bread');
        }
    },

    async confirmDelete(id) {
        const base = this.getById(id);
        if (!base) return;
        
        // Check for linked products
        const linked = await this.getLinkedProducts(id);
        
        if (linked.length > 0) {
            Toast.error(`Cannot delete: ${linked.length} products are linked to this base`);
            return;
        }
        
        if (confirm(`Delete "${base.name}"? This cannot be undone.`)) {
            try {
                await this.delete(id);
                Toast.success('Base bread deleted');
                this.render();
            } catch (error) {
                Toast.error('Failed to delete');
            }
        }
    },
    
    async viewLinkedProducts(id) {
        const base = this.getById(id);
        if (!base) return;
        
        const products = await this.getLinkedProducts(id);
        
        let content = '';
        if (products.length === 0) {
            content = `
                <p class="empty-state">No products linked to this base bread yet.</p>
                <p style="text-align:center;color:#666;">
                    Go to Products → Edit a product → Set "Base Bread" field
                </p>
            `;
        } else {
            content = `
                <p style="margin-bottom:16px;">${products.length} products use this base:</p>
                <div style="max-height:400px;overflow-y:auto;">
                    ${products.map(p => `
                        <div style="display:flex;justify-content:space-between;padding:12px;background:#f5f5f5;border-radius:8px;margin-bottom:8px;">
                            <div>
                                <strong>${p.name}</strong>
                                <div style="font-size:0.85rem;color:#666;">${p.category || ''}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:600;">₱${p.finalSRP || 0}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        Modal.open({
            title: `${base.icon} ${base.name} - Linked Products`,
            content,
            saveText: null
        });
    }
};

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BaseBreads.init());
} else {
    BaseBreads.init();
}
