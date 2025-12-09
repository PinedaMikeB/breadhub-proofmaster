/**
 * BreadHub ProofMaster - Timer Management
 * Handles multiple concurrent timers for proofing and baking
 */

const Timers = {
    activeTimers: new Map(),
    timerIntervals: new Map(),
    
    init() {
        this.render();
    },
    
    createTimer(config) {
        const timer = {
            id: config.id,
            productId: config.productId,
            name: config.name,
            type: config.type, // 'proofing' or 'baking'
            duration: config.duration, // total duration in seconds
            startedAt: config.startedAt,
            rotateAt: config.rotateAt || null, // for baking timers
            rotateNotified: false,
            onComplete: config.onComplete || null
        };
        
        this.activeTimers.set(timer.id, timer);
        
        // Start interval
        const interval = setInterval(() => this.updateTimer(timer.id), 1000);
        this.timerIntervals.set(timer.id, interval);
        
        this.render();
        Toast.info(`Timer started: ${timer.name} (${timer.type})`);
        
        return timer;
    },
    
    updateTimer(timerId) {
        const timer = this.activeTimers.get(timerId);
        if (!timer) return;
        
        const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
        const remaining = timer.duration - elapsed;
        
        // Check for rotation reminder (baking only)
        if (timer.type === 'baking' && timer.rotateAt && !timer.rotateNotified) {
            if (elapsed >= timer.rotateAt) {
                timer.rotateNotified = true;
                Alert.show('Rotate Trays!', `${timer.name}: Time to rotate trays`);
            }
        }
        
        // Check for completion
        if (remaining <= 0) {
            this.completeTimer(timerId);
            return;
        }
        
        // Check for warning
        if (remaining <= CONFIG.alerts.warning * 60 && remaining > CONFIG.alerts.critical * 60) {
            timer.status = 'warning';
        } else if (remaining <= CONFIG.alerts.critical * 60) {
            timer.status = 'urgent';
        }
        
        this.render();
    },
    
    completeTimer(timerId) {
        const timer = this.activeTimers.get(timerId);
        if (!timer) return;
        
        // Clear interval
        const interval = this.timerIntervals.get(timerId);
        if (interval) {
            clearInterval(interval);
            this.timerIntervals.delete(timerId);
        }
        
        // Call completion callback
        if (timer.onComplete) {
            timer.onComplete();
        }
        
        // Remove timer
        this.activeTimers.delete(timerId);
        this.render();
    },
    
    stopTimer(timerId) {
        const timer = this.activeTimers.get(timerId);
        if (!timer) return;
        
        if (!confirm(`Stop timer for ${timer.name}?`)) return;
        
        const interval = this.timerIntervals.get(timerId);
        if (interval) {
            clearInterval(interval);
            this.timerIntervals.delete(timerId);
        }
        
        this.activeTimers.delete(timerId);
        this.render();
        Toast.info(`Timer stopped: ${timer.name}`);
    },
    
    addTime(timerId, seconds) {
        const timer = this.activeTimers.get(timerId);
        if (!timer) return;
        
        timer.duration += seconds;
        Toast.info(`Added ${seconds / 60} minutes to ${timer.name}`);
        this.render();
    },

    render() {
        this.renderTimersView();
        this.renderDashboardTimers();
        this.updateTimerCount();
    },
    
    renderTimersView() {
        const grid = document.getElementById('timersGrid');
        if (!grid) return;
        
        if (this.activeTimers.size === 0) {
            grid.innerHTML = '<p class="empty-state">No active timers</p>';
            return;
        }
        
        grid.innerHTML = Array.from(this.activeTimers.values()).map(timer => {
            const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
            const remaining = Math.max(0, timer.duration - elapsed);
            const progress = ((timer.duration - remaining) / timer.duration) * 100;
            
            let headerClass = timer.type;
            if (timer.status === 'urgent') headerClass = 'urgent';
            
            return `
                <div class="timer-card" data-id="${timer.id}">
                    <div class="timer-card-header ${headerClass}">
                        <span>${timer.type === 'proofing' ? '🍞' : '🔥'} ${timer.name}</span>
                        <span>${timer.type.toUpperCase()}</span>
                    </div>
                    <div class="timer-card-body">
                        <div class="timer-card-time">${Utils.formatTime(remaining)}</div>
                        <div class="timer-card-progress">
                            <div class="timer-card-progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${Math.floor(remaining / 60)} minutes remaining
                        </div>
                        <div class="timer-card-actions">
                            <button class="btn btn-secondary" onclick="Timers.addTime('${timer.id}', 120)">
                                +2 min
                            </button>
                            <button class="btn btn-secondary" onclick="Timers.addTime('${timer.id}', 300)">
                                +5 min
                            </button>
                            <button class="btn btn-danger" onclick="Timers.stopTimer('${timer.id}')">
                                Stop
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    renderDashboardTimers() {
        const container = document.getElementById('activeTimersContent');
        if (!container) return;
        
        if (this.activeTimers.size === 0) {
            container.innerHTML = '<p class="empty-state">No active timers</p>';
            return;
        }
        
        container.innerHTML = Array.from(this.activeTimers.values()).map(timer => {
            const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
            const remaining = Math.max(0, timer.duration - elapsed);
            
            return `
                <div class="recipe-stat">
                    <span>${timer.type === 'proofing' ? '🍞' : '🔥'} ${timer.name}</span>
                    <span>${Utils.formatTime(remaining)}</span>
                </div>
            `;
        }).join('');
    },
    
    updateTimerCount() {
        const badge = document.getElementById('timerCount');
        if (badge) {
            badge.textContent = this.activeTimers.size;
        }
    },
    
    viewTimer(productId) {
        // Find timer for this product
        for (const timer of this.activeTimers.values()) {
            if (timer.productId === productId) {
                App.showView('timers');
                return;
            }
        }
        Toast.info('No active timer for this product');
    },
    
    // Get next timer to complete
    getNextTimer() {
        let earliest = null;
        let earliestTime = Infinity;
        
        for (const timer of this.activeTimers.values()) {
            const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
            const remaining = timer.duration - elapsed;
            
            if (remaining < earliestTime) {
                earliestTime = remaining;
                earliest = timer;
            }
        }
        
        return earliest;
    }
};
