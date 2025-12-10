/**
 * BreadHub ProofMaster - Modal & Toast Manager
 */

const Modal = {
    overlay: null,
    modal: null,
    title: null,
    body: null,
    footer: null,
    saveBtn: null,
    onSave: null,
    
    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.modal = document.getElementById('modal');
        this.title = document.getElementById('modalTitle');
        this.body = document.getElementById('modalBody');
        this.footer = document.getElementById('modalFooter');
        this.saveBtn = document.getElementById('modalSaveBtn');
        
        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.close();
            }
        });
        
        // Save button handler
        this.saveBtn.addEventListener('click', () => {
            if (this.onSave) {
                this.onSave();
            }
        });
    },
    
    open(options = {}) {
        const {
            title = 'Modal',
            content = '',
            saveText = 'Save',
            saveClass = 'btn-primary',
            showFooter = true,
            onSave = null,
            width = '600px'
        } = options;
        
        this.title.textContent = title;
        this.body.innerHTML = content;
        this.saveBtn.textContent = saveText;
        this.onSave = onSave;
        this.modal.style.maxWidth = width;
        
        // Reset button classes and apply new one
        this.saveBtn.className = `btn ${saveClass}`;
        
        this.footer.style.display = showFooter ? 'flex' : 'none';
        this.overlay.classList.add('active');
    },
    
    close() {
        this.overlay.classList.remove('active');
        this.body.innerHTML = '';
        this.onSave = null;
    },
    
    // Get form data from modal
    getFormData() {
        const form = this.body.querySelector('form');
        if (!form) return {};
        
        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            // Handle number inputs
            const input = form.querySelector(`[name="${key}"]`);
            if (input && input.type === 'number') {
                data[key] = parseFloat(value) || 0;
            } else {
                data[key] = value;
            }
        }
        
        return data;
    }
};


// Toast Notifications
const Toast = {
    container: null,
    
    init() {
        this.container = document.getElementById('toastContainer');
    },
    
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;
        
        this.container.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'toastSlide 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    },
    
    success(message) {
        this.show(message, 'success');
    },
    
    error(message) {
        this.show(message, 'error', 5000);
    },
    
    warning(message) {
        this.show(message, 'warning', 4000);
    },
    
    info(message) {
        this.show(message, 'info');
    }
};

// Critical Alert Modal
const Alert = {
    overlay: null,
    title: null,
    message: null,
    sound: null,
    
    init() {
        this.overlay = document.getElementById('alertOverlay');
        this.title = document.getElementById('alertTitle');
        this.message = document.getElementById('alertMessage');
        
        // Create audio for alarm
        this.sound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdGKjr5JxXoR2jaKygWVrh3WMo5l0YHeAdZKfi3Bkfn2IlY9wYHl/g46Rfm1+goWJjn1tcX2CiYqAcHCBgYaEfXFyhX6BfX91dHl6eXt4eHh5eHp5d3d6e3p5eXp6enp6enp6');
    },
    
    show(title, message) {
        this.title.textContent = title;
        this.message.textContent = message;
        this.overlay.classList.add('active');
        
        // Play alert sound
        try {
            this.sound.play();
        } catch (e) {
            console.log('Could not play alert sound');
        }
    },
    
    dismiss() {
        this.overlay.classList.remove('active');
    }
};
