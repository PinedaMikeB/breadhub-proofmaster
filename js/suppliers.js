/**
 * BreadHub ProofMaster - Suppliers Management
 */

const Suppliers = {
    data: [],
    
    async init() {
        await this.load();
        this.render();
    },
    
    async load() {
        try {
            this.data = await DB.getAll('suppliers');
            this.data.sort((a, b) => a.companyName.localeCompare(b.companyName));
        } catch (error) {
            console.error('Error loading suppliers:', error);
            Toast.error('Failed to load suppliers');
        }
    },
    
    render() {
        const grid = document.getElementById('suppliersGrid');
        if (!grid) return;
        
        if (this.data.length === 0) {
            grid.innerHTML = `
                <p class="empty-state">
                    No suppliers yet. Click "Add Supplier" to get started.
                </p>
            `;
            return;
        }
        
        grid.innerHTML = this.data.map(supplier => `
            <div class="recipe-card" data-id="${supplier.id}">
                <div class="recipe-card-header" style="background: linear-gradient(135deg, #3498DB 0%, #2980B9 100%);">
                    <h3>${supplier.companyName}</h3>
                    <span class="version">${supplier.contactName || ''}</span>
                </div>
                <div class="recipe-card-body">
                    ${supplier.mobile ? `
                        <div class="recipe-stat">
                            <span>📱 Mobile:</span>
                            <span><a href="tel:${supplier.mobile}">${supplier.mobile}</a></span>
                        </div>
                    ` : ''}
                    ${supplier.email ? `
                        <div class="recipe-stat">
                            <span>📧 Email:</span>
                            <span><a href="mailto:${supplier.email}">${supplier.email}</a></span>
                        </div>
                    ` : ''}
                    ${supplier.facebook ? `
                        <div class="recipe-stat">
                            <span>📘 Facebook:</span>
                            <span><a href="${supplier.facebook}" target="_blank">View Page</a></span>
                        </div>
                    ` : ''}
                    ${supplier.website ? `
                        <div class="recipe-stat">
                            <span>🌐 Website:</span>
                            <span><a href="${supplier.website}" target="_blank">Visit</a></span>
                        </div>
                    ` : ''}
                    <div class="recipe-stat">
                        <span>📦 Products:</span>
                        <span>${this.getIngredientCount(supplier.id)} ingredients</span>
                    </div>
                </div>
                <div class="recipe-card-actions">
                    <button class="btn btn-secondary" onclick="Suppliers.view('${supplier.id}')">View</button>
                    <button class="btn btn-secondary" onclick="Suppliers.edit('${supplier.id}')">Edit</button>
                    <button class="btn btn-danger" onclick="Suppliers.delete('${supplier.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    },
    
    getIngredientCount(supplierId) {
        return Ingredients.data.filter(i => i.supplierId === supplierId).length;
    },
    
    showAddModal() {
        Modal.open({
            title: 'Add Supplier',
            content: this.getFormHTML(),
            saveText: 'Add Supplier',
            onSave: () => this.save()
        });
    },
    
    async edit(id) {
        const supplier = this.data.find(s => s.id === id);
        if (!supplier) return;
        
        Modal.open({
            title: 'Edit Supplier',
            content: this.getFormHTML(supplier),
            saveText: 'Update',
            onSave: () => this.save(id)
        });
    },
    
    async view(id) {
        const supplier = this.data.find(s => s.id === id);
        if (!supplier) return;
        
        // Get ingredients from this supplier
        const ingredients = Ingredients.data.filter(i => i.supplierId === id);
        
        Modal.open({
            title: supplier.companyName,
            content: `
                <div style="padding: 16px 0;">
                    ${supplier.contactName ? `
                        <div class="recipe-stat">
                            <span>Contact Person:</span>
                            <span>${supplier.contactName}</span>
                        </div>
                    ` : ''}
                    ${supplier.mobile ? `
                        <div class="recipe-stat">
                            <span>📱 Mobile:</span>
                            <span><a href="tel:${supplier.mobile}">${supplier.mobile}</a></span>
                        </div>
                    ` : ''}
                    ${supplier.email ? `
                        <div class="recipe-stat">
                            <span>📧 Email:</span>
                            <span><a href="mailto:${supplier.email}">${supplier.email}</a></span>
                        </div>
                    ` : ''}
                    ${supplier.facebook ? `
                        <div class="recipe-stat">
                            <span>📘 Facebook:</span>
                            <span><a href="${supplier.facebook}" target="_blank">${supplier.facebook}</a></span>
                        </div>
                    ` : ''}
                    ${supplier.website ? `
                        <div class="recipe-stat">
                            <span>🌐 Website:</span>
                            <span><a href="${supplier.website}" target="_blank">${supplier.website}</a></span>
                        </div>
                    ` : ''}
                    ${supplier.address ? `
                        <div class="recipe-stat">
                            <span>📍 Address:</span>
                            <span>${supplier.address}</span>
                        </div>
                    ` : ''}
                    ${supplier.notes ? `
                        <div style="margin-top: 16px; padding: 12px; background: var(--bg-input); border-radius: 8px;">
                            <strong>Notes:</strong><br>
                            ${supplier.notes}
                        </div>
                    ` : ''}
                    
                    <h4 style="margin: 20px 0 12px;">📦 Ingredients from this Supplier (${ingredients.length}):</h4>
                    ${ingredients.length > 0 ? `
                        <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--bg-input); border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead style="background: var(--bg-input); position: sticky; top: 0;">
                                    <tr>
                                        <th style="padding: 10px; text-align: left;">Ingredient</th>
                                        <th style="padding: 10px; text-align: right;">Package</th>
                                        <th style="padding: 10px; text-align: right;">Cost/gram</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ingredients.map(ing => `
                                        <tr style="border-bottom: 1px solid var(--bg-input);">
                                            <td style="padding: 10px;">${ing.name}</td>
                                            <td style="padding: 10px; text-align: right;">
                                                ${Utils.formatCurrency(ing.purchasePrice || 0)} / ${ing.packageSize || 0}g
                                            </td>
                                            <td style="padding: 10px; text-align: right; font-weight: bold; color: var(--primary);">
                                                ${Utils.formatCurrency(ing.costPerGram || 0)}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="empty-state">No ingredients yet. Tag this supplier when adding ingredients.</p>'}
                </div>
            `,
            showFooter: false,
            width: '600px'
        });
    },

    getFormHTML(supplier = {}) {
        return `
            <form id="supplierForm">
                <div class="form-group">
                    <label>Company Name *</label>
                    <input type="text" name="companyName" class="form-input" 
                           value="${supplier.companyName || ''}" required
                           placeholder="e.g., Champion Flour Mills">
                </div>
                
                <div class="form-group">
                    <label>Contact Person</label>
                    <input type="text" name="contactName" class="form-input" 
                           value="${supplier.contactName || ''}"
                           placeholder="e.g., Juan Dela Cruz">
                </div>
                
                <div class="form-group">
                    <label>Mobile Number</label>
                    <input type="tel" name="mobile" class="form-input" 
                           value="${supplier.mobile || ''}"
                           placeholder="e.g., 09171234567">
                </div>
                
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" class="form-input" 
                           value="${supplier.email || ''}"
                           placeholder="e.g., supplier@email.com">
                </div>
                
                <div class="form-group">
                    <label>Facebook Page</label>
                    <input type="url" name="facebook" class="form-input" 
                           value="${supplier.facebook || ''}"
                           placeholder="e.g., https://facebook.com/suppliername">
                </div>
                
                <div class="form-group">
                    <label>Website</label>
                    <input type="url" name="website" class="form-input" 
                           value="${supplier.website || ''}"
                           placeholder="e.g., https://supplier.com">
                </div>
                
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" name="address" class="form-input" 
                           value="${supplier.address || ''}"
                           placeholder="e.g., 123 Main St, Taytay, Rizal">
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" class="form-textarea" 
                              placeholder="Delivery schedule, payment terms, etc.">${supplier.notes || ''}</textarea>
                </div>
            </form>
        `;
    },
    
    async save(id = null) {
        const data = Modal.getFormData();
        
        if (!data.companyName) {
            Toast.error('Please enter company name');
            return;
        }
        
        try {
            if (id) {
                await DB.update('suppliers', id, data);
                Toast.success('Supplier updated');
            } else {
                await DB.add('suppliers', data);
                Toast.success('Supplier added');
            }
            
            Modal.close();
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error saving supplier:', error);
            Toast.error('Failed to save supplier');
        }
    },
    
    async delete(id) {
        // Check if supplier has ingredients
        const ingredientCount = this.getIngredientCount(id);
        if (ingredientCount > 0) {
            Toast.warning(`Cannot delete: ${ingredientCount} ingredients linked to this supplier`);
            return;
        }
        
        if (!confirm('Delete this supplier?')) return;
        
        try {
            await DB.delete('suppliers', id);
            Toast.success('Supplier deleted');
            await this.load();
            this.render();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            Toast.error('Failed to delete supplier');
        }
    },
    
    getById(id) {
        return this.data.find(s => s.id === id);
    },
    
    // Get options for select dropdown
    getSelectOptions(selectedId = null) {
        return this.data.map(s => 
            `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${s.companyName}</option>`
        ).join('');
    }
};
