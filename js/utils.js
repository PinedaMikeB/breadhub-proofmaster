/**
 * BreadHub ProofMaster - Utility Functions
 */

const Utils = {
    // Format currency
    formatCurrency(amount) {
        return `${CONFIG.app.currency}${amount.toFixed(2)}`;
    },
    
    // Format weight
    formatWeight(grams) {
        if (grams >= 1000) {
            return `${(grams / 1000).toFixed(2)}kg`;
        }
        return `${grams}g`;
    },
    
    // Format time from seconds
    formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    
    // Format date
    formatDate(date) {
        if (!date) return '-';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },
    
    // Format datetime
    formatDateTime(date) {
        if (!date) return '-';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Generate unique ID
    generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
    },
    
    // Generate production run ID
    generateRunId() {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `PR-${dateStr}-${sequence}`;
    },
    
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Deep clone object
    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    // Check if object is empty
    isEmpty(obj) {
        return Object.keys(obj).length === 0;
    }
};
