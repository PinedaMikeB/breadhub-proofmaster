/**
 * BreadHub ProofMaster - Fraud Review Module
 *
 * Read-only incident inbox for correlated CCTV and POS review.
 * This view reads live Firestore documents and supports history browsing.
 */

const FraudReview = {
    initialized: false,
    refreshTimer: null,
    refreshIntervalMs: 60000,
    state: null,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.resetState();
        this.startAutoRefresh();
        console.log('Fraud Review module initialized');
    },

    resetState() {
        this.state = {
            fromDate: this.shiftDateString(this.getTodayString(), -2),
            toDate: this.getTodayString(),
            status: '',
            severity: '',
            limit: 200
        };
    },

    getTodayString() {
        const now = new Date();
        return [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0')
        ].join('-');
    },

    shiftDateString(dateString, dayDelta) {
        const date = new Date(`${dateString}T00:00:00`);
        date.setDate(date.getDate() + dayDelta);
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    },

    getStartOfDay(dateString) {
        return new Date(`${dateString}T00:00:00`);
    },

    getEndOfDay(dateString) {
        return new Date(`${dateString}T23:59:59.999`);
    },

    startAutoRefresh() {
        if (this.refreshTimer) window.clearInterval(this.refreshTimer);
        this.refreshTimer = window.setInterval(() => {
            if (window.App?.currentView === 'fraudDetection') {
                this.render({ silent: true });
            }
        }, this.refreshIntervalMs);
    },

    async loadData() {
        const [liveIncidents, legacyAlerts, monitorState] = await Promise.all([
            this.fetchFraudIncidents(this.state),
            this.fetchLegacyAlerts(this.state),
            this.fetchMonitorState()
        ]);

        if (liveIncidents.length > 0) {
            return {
                mode: 'live',
                source: 'fraudIncidents',
                incidents: liveIncidents,
                monitorState
            };
        }

        if (legacyAlerts.length > 0) {
            return {
                mode: 'legacy',
                source: 'fraudAlerts',
                incidents: legacyAlerts,
                monitorState
            };
        }

        return {
            mode: 'empty',
            source: 'fraudIncidents',
            incidents: [],
            monitorState
        };
    },

    async fetchFraudIncidents(filters) {
        try {
            let query = db.collection('fraudIncidents');
            const fromDate = filters.fromDate || '';
            const toDate = filters.toDate || '';

            if (fromDate) query = query.where('incidentAt', '>=', this.getStartOfDay(fromDate));
            if (toDate) query = query.where('incidentAt', '<=', this.getEndOfDay(toDate));

            query = query.orderBy('incidentAt', 'desc').limit(filters.limit || 200);

            const snapshot = await query.get();
            let incidents = snapshot.docs
                .map((doc) => this.normalizeIncident({ id: doc.id, ...doc.data() }))
                .sort((a, b) => this.getSortTime(b) - this.getSortTime(a));

            if (filters.status) incidents = incidents.filter((incident) => incident.status === filters.status);
            if (filters.severity) incidents = incidents.filter((incident) => incident.severity === filters.severity);

            return incidents;
        } catch (error) {
            console.error('Failed to load fraud incidents:', error);
            return [];
        }
    },

    async fetchLegacyAlerts(filters) {
        try {
            const snapshot = await db.collection('fraudAlerts').limit(filters.limit || 200).get();
            let alerts = snapshot.docs
                .map((doc) => this.normalizeLegacyAlert({ id: doc.id, ...doc.data() }))
                .sort((a, b) => this.getSortTime(b) - this.getSortTime(a));

            const fromTime = filters.fromDate ? this.getStartOfDay(filters.fromDate).getTime() : 0;
            const toTime = filters.toDate ? this.getEndOfDay(filters.toDate).getTime() : Number.MAX_SAFE_INTEGER;

            alerts = alerts.filter((incident) => {
                const time = this.getSortTime(incident);
                return time >= fromTime && time <= toTime;
            });

            if (filters.status) alerts = alerts.filter((incident) => incident.status === filters.status);
            if (filters.severity) alerts = alerts.filter((incident) => incident.severity === filters.severity);

            return alerts;
        } catch (error) {
            console.error('Failed to load legacy fraud alerts:', error);
            return [];
        }
    },

    async fetchMonitorState() {
        try {
            const snapshot = await db.collection('fraudMonitorState').doc('primary').get();
            if (!snapshot.exists) return null;
            return snapshot.data();
        } catch (error) {
            console.error('Failed to load fraud monitor state:', error);
            return null;
        }
    },

    normalizeIncident(raw) {
        return {
            id: raw.id,
            type: raw.type || 'incident',
            title: raw.title || this.getIncidentTitle(raw.type),
            severity: raw.severity || 'medium',
            status: raw.status || 'open',
            incidentAt: raw.incidentAt || raw.createdAt || null,
            incidentWindowStart: raw.incidentWindowStart || null,
            incidentWindowEnd: raw.incidentWindowEnd || null,
            cashierId: raw.cashierId || null,
            cashierName: raw.cashierName || raw.cashierId || 'Unassigned',
            matchedSaleId: raw.matchedSaleId || null,
            saleAmount: raw.saleAmount ?? null,
            regionTags: Array.isArray(raw.regionTags) ? raw.regionTags : [],
            posRegistered: raw.posRegistered === true,
            evidenceSummary: raw.evidenceSummary || 'No evidence summary recorded yet.',
            cameraName: raw.cameraName || 'Cashier Camera',
            clipLabel: raw.clipLabel || this.getClipLabel(raw),
            clipUrl: raw.clipUrl || null,
            clipPath: raw.clipPath || null,
            clipStart: raw.clipStart || null,
            clipEnd: raw.clipEnd || null,
            source: raw.source || 'correlation-engine'
        };
    },

    normalizeLegacyAlert(raw) {
        return {
            id: raw.id,
            type: raw.type || 'legacy_alert',
            title: raw.title || raw.label || 'Legacy Fraud Alert',
            severity: raw.severity || 'medium',
            status: raw.status || 'open',
            incidentAt: raw.incidentAt || raw.createdAt || raw.generatedAt || null,
            incidentWindowStart: raw.incidentWindowStart || null,
            incidentWindowEnd: raw.incidentWindowEnd || null,
            cashierId: raw.cashierId || null,
            cashierName: raw.cashierName || raw.cashierId || 'Unknown',
            matchedSaleId: raw.matchedSaleId || null,
            saleAmount: raw.saleAmount ?? null,
            regionTags: Array.isArray(raw.regionTags) ? raw.regionTags : [],
            posRegistered: raw.posRegistered === true,
            evidenceSummary: raw.evidenceSummary || raw.message || 'Imported from legacy fraudAlerts collection.',
            cameraName: raw.cameraName || 'Cashier Camera',
            clipLabel: this.getClipLabel(raw),
            clipUrl: raw.clipUrl || null,
            clipPath: raw.clipPath || null,
            clipStart: raw.clipStart || null,
            clipEnd: raw.clipEnd || null,
            source: 'legacy-alerts'
        };
    },

    getIncidentTitle(type = '') {
        const titles = {
            drawer_without_sale: 'Drawer Opened Without Matching Sale',
            handoff_without_sale: 'Customer Handoff Without POS Registration',
            customer_sale_mismatch: 'Customer Interaction With Suspicious Sale Pattern',
            drawer_without_customer: 'Drawer Opened Without Customer Presence',
            extended_customer_interaction_without_sale: 'Extended Customer Interaction Without Sale'
        };
        return titles[type] || 'Suspicious Cashier Incident';
    },

    getClipLabel(raw) {
        if (raw.clipStart && raw.clipEnd) {
            return `${this.formatShortTime(raw.clipStart)} - ${this.formatShortTime(raw.clipEnd)}`;
        }
        const monitorId = raw.shinobiMonitorId || raw.monitorId || raw.mid;
        return monitorId ? `Monitor ${monitorId}` : 'Shinobi clip pending';
    },

    getSortTime(incident) {
        const value = this.coerceDate(incident.incidentAt);
        return value ? value.getTime() : 0;
    },

    coerceDate(value) {
        if (!value) return null;
        if (typeof value.toDate === 'function') return value.toDate();
        if (value instanceof Date) return value;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    },

    formatTimestamp(value) {
        const date = this.coerceDate(value);
        if (!date) return '-';
        return date.toLocaleString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            hourCycle: 'h12'
        });
    },

    formatShortTime(value) {
        const date = this.coerceDate(value);
        if (!date) return '-';
        return date.toLocaleTimeString('en-PH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            hourCycle: 'h12'
        });
    },

    formatRelativeTime(value) {
        const date = this.coerceDate(value);
        if (!date) return 'No run yet';
        const diffMs = Date.now() - date.getTime();
        const diffMinutes = Math.max(Math.round(diffMs / 60000), 0);

        if (diffMinutes < 1) return 'just now';
        if (diffMinutes < 60) return `${diffMinutes} min ago`;

        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hr ago`;

        const diffDays = Math.round(diffHours / 24);
        return `${diffDays} day(s) ago`;
    },

    escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    renderSeverityBadge(severity = 'medium') {
        const palette = {
            low: { bg: '#E8F5E9', fg: '#2E7D32' },
            medium: { bg: '#FFF3E0', fg: '#EF6C00' },
            high: { bg: '#FFEBEE', fg: '#C62828' },
            critical: { bg: '#4A1111', fg: '#FFD7D7' }
        };
        const style = palette[severity] || palette.medium;
        return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${style.bg};color:${style.fg};font-weight:700;font-size:0.78rem;text-transform:uppercase;">${this.escapeHtml(severity)}</span>`;
    },

    renderStatusBadge(status = 'open') {
        const palette = {
            open: { bg: '#E3F2FD', fg: '#1565C0' },
            reviewing: { bg: '#FFF8E1', fg: '#F9A825' },
            resolved: { bg: '#E8F5E9', fg: '#2E7D32' },
            dismissed: { bg: '#ECEFF1', fg: '#455A64' }
        };
        const style = palette[status] || palette.open;
        return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${style.bg};color:${style.fg};font-weight:600;font-size:0.78rem;text-transform:uppercase;">${this.escapeHtml(status)}</span>`;
    },

    renderFilterBar() {
        return `
            <form id="fraudReviewFilters" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;align-items:end;margin-bottom:20px;padding:16px;border:1px solid #E5EAF3;border-radius:12px;background:#F9FBFF;">
                <div>
                    <label style="display:block;font-size:0.82rem;font-weight:700;color:#5f6368;margin-bottom:6px;">From Date</label>
                    <input type="date" id="fraudFilterFromDate" class="form-input" value="${this.escapeHtml(this.state.fromDate)}">
                </div>
                <div>
                    <label style="display:block;font-size:0.82rem;font-weight:700;color:#5f6368;margin-bottom:6px;">To Date</label>
                    <input type="date" id="fraudFilterToDate" class="form-input" value="${this.escapeHtml(this.state.toDate)}">
                </div>
                <div>
                    <label style="display:block;font-size:0.82rem;font-weight:700;color:#5f6368;margin-bottom:6px;">Status</label>
                    <select id="fraudFilterStatus" class="form-input">
                        <option value="">All statuses</option>
                        <option value="open" ${this.state.status === 'open' ? 'selected' : ''}>Open</option>
                        <option value="reviewing" ${this.state.status === 'reviewing' ? 'selected' : ''}>Reviewing</option>
                        <option value="resolved" ${this.state.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                        <option value="dismissed" ${this.state.status === 'dismissed' ? 'selected' : ''}>Dismissed</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:0.82rem;font-weight:700;color:#5f6368;margin-bottom:6px;">Severity</label>
                    <select id="fraudFilterSeverity" class="form-input">
                        <option value="">All severities</option>
                        <option value="critical" ${this.state.severity === 'critical' ? 'selected' : ''}>Critical</option>
                        <option value="high" ${this.state.severity === 'high' ? 'selected' : ''}>High</option>
                        <option value="medium" ${this.state.severity === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="low" ${this.state.severity === 'low' ? 'selected' : ''}>Low</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:0.82rem;font-weight:700;color:#5f6368;margin-bottom:6px;">Max Rows</label>
                    <select id="fraudFilterLimit" class="form-input">
                        <option value="100" ${this.state.limit === 100 ? 'selected' : ''}>100</option>
                        <option value="200" ${this.state.limit === 200 ? 'selected' : ''}>200</option>
                        <option value="500" ${this.state.limit === 500 ? 'selected' : ''}>500</option>
                    </select>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="submit" class="btn btn-primary">Apply</button>
                    <button type="button" class="btn btn-secondary" data-fraud-preset="today">Today</button>
                    <button type="button" class="btn btn-secondary" data-fraud-preset="last24h">24 Hours</button>
                    <button type="button" class="btn btn-secondary" data-fraud-preset="last7d">7 Days</button>
                </div>
            </form>
        `;
    },

    renderMonitorStateCard(monitorState) {
        if (!monitorState) {
            return `
                <div style="background:#FFF8E1;border:1px solid #FBC02D;color:#6D4C41;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
                    Fraud monitor status not available yet. Run the correlation writer once to start historical incident generation.
                </div>
            `;
        }

        const lastRunAt = monitorState.lastRunAt || null;
        const status = monitorState.status || 'unknown';
        const statusPalette = {
            healthy: { bg: '#E8F5E9', border: '#81C784', fg: '#1B5E20' },
            error: { bg: '#FFEBEE', border: '#EF9A9A', fg: '#B71C1C' },
            running: { bg: '#E3F2FD', border: '#64B5F6', fg: '#0D47A1' },
            unknown: { bg: '#FFF8E1', border: '#FBC02D', fg: '#6D4C41' }
        };
        const style = statusPalette[status] || statusPalette.unknown;

        return `
            <div style="background:${style.bg};border:1px solid ${style.border};color:${style.fg};border-radius:12px;padding:14px 16px;margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                        <strong>Fraud Monitor: ${this.escapeHtml(status)}</strong>
                        <div style="margin-top:4px;font-size:0.9rem;">
                            Last run ${this.escapeHtml(this.formatRelativeTime(lastRunAt))} (${this.escapeHtml(this.formatTimestamp(lastRunAt))})
                        </div>
                    </div>
                    <div style="font-size:0.9rem;">
                        Lookback ${this.escapeHtml(String(monitorState.hours || '-'))}h | Persisted ${this.escapeHtml(String(monitorState.persistedCount || 0))} | Generated ${this.escapeHtml(String(monitorState.generatedCount || 0))}
                    </div>
                </div>
                ${monitorState.lastError ? `<div style="margin-top:10px;font-size:0.9rem;">Last error: ${this.escapeHtml(monitorState.lastError)}</div>` : ''}
            </div>
        `;
    },

    renderSummaryCards(incidents) {
        const openCount = incidents.filter((incident) => incident.status === 'open').length;
        const criticalCount = incidents.filter((incident) => incident.severity === 'critical').length;
        const noSaleCount = incidents.filter((incident) => !incident.matchedSaleId).length;
        const withCustomerCount = incidents.filter((incident) => incident.regionTags.includes('Customer')).length;
        const latestIncident = incidents[0]?.incidentAt || null;

        const cards = [
            { label: 'Open Incidents', value: openCount, color: '#1565C0', bg: '#E3F2FD' },
            { label: 'Critical Incidents', value: criticalCount, color: '#B71C1C', bg: '#FFEBEE' },
            { label: 'No Matching Sale', value: noSaleCount, color: '#EF6C00', bg: '#FFF3E0' },
            { label: 'Latest Incident', value: latestIncident ? this.formatShortTime(latestIncident) : '-', color: '#2E7D32', bg: '#E8F5E9' },
            { label: 'Customer-Involved', value: withCustomerCount, color: '#6A1B9A', bg: '#F3E5F5' }
        ];

        return `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:20px;">
                ${cards.map((card) => `
                    <div style="background:${card.bg};border-radius:12px;padding:16px;">
                        <div style="font-size:0.85rem;color:#5f6368;">${card.label}</div>
                        <div style="font-size:1.7rem;font-weight:700;color:${card.color};">${card.value}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderModeBanner(result) {
        if (result.mode === 'live') {
            return `
                <div style="background:#E8F5E9;border:1px solid #81C784;color:#1B5E20;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
                    Reading incidents from <code>${this.escapeHtml(result.source)}</code>. Historical filters are applied to the live incident archive.
                </div>
            `;
        }

        if (result.mode === 'legacy') {
            return `
                <div style="background:#FFF3E0;border:1px solid #FFB74D;color:#6D4C41;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
                    No live <code>fraudIncidents</code> matched this range. Showing legacy <code>fraudAlerts</code> instead.
                </div>
            `;
        }

        return `
            <div style="background:#F5F7FA;border:1px solid #DCE3F0;color:#44546A;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
                No incidents found for the selected date range. This is a real empty result, not sample data.
            </div>
        `;
    },

    renderEmptyState() {
        return `
            <div style="background:#fff;border:1px dashed #DCE3F0;border-radius:12px;padding:28px;text-align:center;color:#5f6368;">
                <div style="font-size:1.1rem;font-weight:700;color:#334155;margin-bottom:8px;">No fraud incidents found</div>
                <div>Try widening the date range or rerun the correlation writer to backfill more history.</div>
            </div>
        `;
    },

    renderTable(incidents) {
        if (!incidents.length) return this.renderEmptyState();

        return `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Incident</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Cashier</th>
                            <th>POS Match</th>
                            <th>Regions</th>
                            <th>Evidence</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${incidents.map((incident) => `
                            <tr>
                                <td>${this.formatTimestamp(incident.incidentAt)}</td>
                                <td>
                                    <strong>${this.escapeHtml(incident.title)}</strong>
                                    <div style="font-size:0.82rem;color:#5f6368;margin-top:4px;">
                                        ${this.escapeHtml(incident.cameraName)} | ${this.escapeHtml(incident.clipLabel)}
                                    </div>
                                    ${incident.clipUrl ? `
                                        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                                            <a href="${this.escapeHtml(incident.clipUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 10px;border-radius:999px;background:#E8F0FE;color:#1A73E8;font-size:0.8rem;font-weight:700;">
                                                Preview Video
                                            </a>
                                            <a href="http://192.168.51.226:8080" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 10px;border-radius:999px;background:#EEF7EE;color:#2E7D32;font-size:0.8rem;font-weight:700;">
                                                Open Live Camera
                                            </a>
                                        </div>
                                    ` : ''}
                                </td>
                                <td>${this.renderSeverityBadge(incident.severity)}</td>
                                <td>${this.renderStatusBadge(incident.status)}</td>
                                <td>${this.escapeHtml(incident.cashierName)}</td>
                                <td>
                                    ${incident.matchedSaleId
                                        ? `<strong>${this.escapeHtml(incident.matchedSaleId)}</strong><div style="font-size:0.82rem;color:#5f6368;">${incident.saleAmount != null ? `PHP ${Number(incident.saleAmount).toFixed(2)}` : 'Sale matched'}</div>`
                                        : '<span style="color:#C62828;font-weight:700;">No sale found</span>'}
                                </td>
                                <td>${incident.regionTags.length ? incident.regionTags.map((tag) => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;background:#EEF2FF;border-radius:999px;font-size:0.78rem;color:#3949AB;">${this.escapeHtml(tag)}</span>`).join('') : '-'}</td>
                                <td style="max-width:340px;">
                                    <div>${this.escapeHtml(incident.evidenceSummary)}</div>
                                    <div style="font-size:0.78rem;color:#5f6368;margin-top:6px;">Source: ${this.escapeHtml(incident.source)}</div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    attachFilterListeners() {
        const form = document.getElementById('fraudReviewFilters');
        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this.applyFilters();
            });
        }

        document.querySelectorAll('[data-fraud-preset]').forEach((button) => {
            button.addEventListener('click', async (event) => {
                const preset = event.currentTarget.dataset.fraudPreset;
                this.applyPresetRange(preset);
                await this.render();
            });
        });
    },

    async applyFilters() {
        const fromDate = document.getElementById('fraudFilterFromDate')?.value || '';
        const toDate = document.getElementById('fraudFilterToDate')?.value || '';
        const status = document.getElementById('fraudFilterStatus')?.value || '';
        const severity = document.getElementById('fraudFilterSeverity')?.value || '';
        const limit = parseInt(document.getElementById('fraudFilterLimit')?.value || '200', 10);

        this.state = {
            fromDate,
            toDate,
            status,
            severity,
            limit: Number.isFinite(limit) ? limit : 200
        };

        await this.render();
    },

    applyPresetRange(preset) {
        const today = this.getTodayString();
        if (preset === 'today') {
            this.state.fromDate = today;
            this.state.toDate = today;
            return;
        }

        if (preset === 'last24h') {
            this.state.fromDate = this.shiftDateString(today, -1);
            this.state.toDate = today;
            return;
        }

        if (preset === 'last7d') {
            this.state.fromDate = this.shiftDateString(today, -6);
            this.state.toDate = today;
        }
    },

    async render(options = {}) {
        const container = document.getElementById('fraudDetectionContent');
        if (!container) return;

        if (!options.silent) {
            container.innerHTML = '<p class="empty-state">Loading fraud review inbox...</p>';
        }

        const result = await this.loadData();

        container.innerHTML = `
            ${this.renderMonitorStateCard(result.monitorState)}
            ${this.renderFilterBar()}
            ${this.renderModeBanner(result)}
            ${this.renderSummaryCards(result.incidents)}
            ${this.renderTable(result.incidents)}
        `;

        this.attachFilterListeners();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FraudReview.init());
} else {
    FraudReview.init();
}
