/**
 * BreadHub ProofMaster - Fraud Review Module
 *
 * Read-only incident inbox for correlating CCTV and POS evidence.
 * Live data should eventually come from `fraudIncidents`.
 */

const FraudReview = {
    async init() {
        console.log('Fraud Review module initialized');
    },

    async loadIncidents(limit = 50) {
        const liveIncidents = await this.fetchFraudIncidents(limit);
        if (liveIncidents.length > 0) {
            return {
                mode: 'live',
                source: 'fraudIncidents',
                incidents: liveIncidents
            };
        }

        const legacyAlerts = await this.fetchLegacyAlerts(limit);
        if (legacyAlerts.length > 0) {
            return {
                mode: 'live',
                source: 'fraudAlerts',
                incidents: legacyAlerts
            };
        }

        return {
            mode: 'sample',
            source: 'sample',
            incidents: this.getSampleIncidents()
        };
    },

    async fetchFraudIncidents(limit) {
        try {
            const snapshot = await db.collection('fraudIncidents').limit(limit).get();
            return snapshot.docs
                .map((doc) => this.normalizeIncident({ id: doc.id, ...doc.data() }))
                .sort((a, b) => this.getSortTime(b) - this.getSortTime(a));
        } catch (error) {
            console.error('Failed to load fraud incidents:', error);
            return [];
        }
    },

    async fetchLegacyAlerts(limit) {
        try {
            const snapshot = await db.collection('fraudAlerts').limit(limit).get();
            return snapshot.docs
                .map((doc) => this.normalizeLegacyAlert({ id: doc.id, ...doc.data() }))
                .sort((a, b) => this.getSortTime(b) - this.getSortTime(a));
        } catch (error) {
            console.error('Failed to load legacy fraud alerts:', error);
            return [];
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
            cashierName: raw.cashierName || raw.cashierId || 'Unassigned',
            matchedSaleId: raw.matchedSaleId || null,
            saleAmount: raw.saleAmount ?? null,
            regionTags: Array.isArray(raw.regionTags) ? raw.regionTags : [],
            posRegistered: raw.posRegistered === true,
            evidenceSummary: raw.evidenceSummary || 'No evidence summary recorded yet.',
            cameraName: raw.cameraName || 'Cashier Camera',
            clipLabel: raw.clipLabel || this.getClipLabel(raw),
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
            cashierName: raw.cashierName || raw.cashierId || 'Unknown',
            matchedSaleId: raw.matchedSaleId || null,
            saleAmount: raw.saleAmount ?? null,
            regionTags: Array.isArray(raw.regionTags) ? raw.regionTags : [],
            posRegistered: raw.posRegistered === true,
            evidenceSummary: raw.evidenceSummary || raw.message || 'Imported from legacy fraudAlerts collection.',
            cameraName: raw.cameraName || 'Cashier Camera',
            clipLabel: this.getClipLabel(raw),
            source: 'legacy-alerts'
        };
    },

    getSampleIncidents() {
        return [
            {
                id: 'sample-1',
                type: 'drawer_without_sale',
                title: 'Drawer Opened Without Matching Sale',
                severity: 'high',
                status: 'open',
                incidentAt: new Date(Date.now() - (9 * 60 * 1000)).toISOString(),
                incidentWindowStart: new Date(Date.now() - (10 * 60 * 1000)).toISOString(),
                incidentWindowEnd: new Date(Date.now() - (8 * 60 * 1000)).toISOString(),
                cashierName: 'Cashier A',
                matchedSaleId: null,
                saleAmount: null,
                regionTags: ['Drawer', 'Cashier'],
                posRegistered: false,
                evidenceSummary: 'Drawer motion detected with cashier presence but no customer region and no POS transaction in the review window.',
                cameraName: 'Cashier Camera',
                clipLabel: 'Review around 14:02',
                source: 'sample'
            },
            {
                id: 'sample-2',
                type: 'handoff_without_sale',
                title: 'Customer Handoff Without POS Registration',
                severity: 'critical',
                status: 'open',
                incidentAt: new Date(Date.now() - (32 * 60 * 1000)).toISOString(),
                incidentWindowStart: new Date(Date.now() - (34 * 60 * 1000)).toISOString(),
                incidentWindowEnd: new Date(Date.now() - (30 * 60 * 1000)).toISOString(),
                cashierName: 'Cashier B',
                matchedSaleId: null,
                saleAmount: null,
                regionTags: ['Customer', 'Handoff', 'Cashier'],
                posRegistered: false,
                evidenceSummary: 'Customer and handoff activity overlapped, but no sale was found and no drawer event was recorded.',
                cameraName: 'Cashier Camera',
                clipLabel: 'Review around 13:39',
                source: 'sample'
            },
            {
                id: 'sample-3',
                type: 'customer_sale_mismatch',
                title: 'Customer Present But Sale Amount Mismatch',
                severity: 'medium',
                status: 'reviewing',
                incidentAt: new Date(Date.now() - (58 * 60 * 1000)).toISOString(),
                incidentWindowStart: new Date(Date.now() - (60 * 60 * 1000)).toISOString(),
                incidentWindowEnd: new Date(Date.now() - (56 * 60 * 1000)).toISOString(),
                cashierName: 'Cashier A',
                matchedSaleId: 'POS-20260317-1042',
                saleAmount: 28,
                regionTags: ['Customer', 'Handoff', 'Drawer', 'Cashier'],
                posRegistered: true,
                evidenceSummary: 'All expected motion regions fired, but the sale amount was unusually low for the interaction duration and drawer activity pattern.',
                cameraName: 'Cashier Camera',
                clipLabel: 'Review around 13:13',
                source: 'sample'
            }
        ];
    },

    getIncidentTitle(type = '') {
        const titles = {
            drawer_without_sale: 'Drawer Opened Without Matching Sale',
            handoff_without_sale: 'Customer Handoff Without POS Registration',
            customer_sale_mismatch: 'Customer Interaction With Suspicious Sale Pattern',
            drawer_without_customer: 'Drawer Opened Without Customer Presence'
        };
        return titles[type] || 'Suspicious Cashier Incident';
    },

    getClipLabel(raw) {
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
            minute: '2-digit'
        });
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

    renderSummaryCards(incidents) {
        const openCount = incidents.filter((incident) => incident.status === 'open').length;
        const criticalCount = incidents.filter((incident) => incident.severity === 'critical').length;
        const noSaleCount = incidents.filter((incident) => !incident.matchedSaleId).length;
        const withCustomerCount = incidents.filter((incident) => incident.regionTags.includes('Customer')).length;

        const cards = [
            { label: 'Open Incidents', value: openCount, color: '#1565C0', bg: '#E3F2FD' },
            { label: 'Critical Incidents', value: criticalCount, color: '#B71C1C', bg: '#FFEBEE' },
            { label: 'No Matching Sale', value: noSaleCount, color: '#EF6C00', bg: '#FFF3E0' },
            { label: 'Customer-Involved', value: withCustomerCount, color: '#2E7D32', bg: '#E8F5E9' }
        ];

        return `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:20px;">
                ${cards.map((card) => `
                    <div style="background:${card.bg};border-radius:12px;padding:16px;">
                        <div style="font-size:0.85rem;color:#5f6368;">${card.label}</div>
                        <div style="font-size:1.9rem;font-weight:700;color:${card.color};">${card.value}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderSchemaCard() {
        return `
            <div style="background:#F7F9FC;border:1px solid #DCE3F0;border-radius:12px;padding:16px;margin-bottom:20px;">
                <h3 style="margin:0 0 8px 0;">Target Incident Schema</h3>
                <p style="margin:0 0 12px 0;color:#5f6368;">
                    Store future correlated fraud-review documents in <code>fraudIncidents</code>.
                </p>
                <div style="font-family:monospace;font-size:0.85rem;white-space:pre-wrap;background:#fff;border:1px solid #E5EAF3;border-radius:10px;padding:12px;">{
  type,
  title,
  severity,
  status,
  incidentAt,
  incidentWindowStart,
  incidentWindowEnd,
  cashierId,
  cashierName,
  matchedSaleId,
  saleAmount,
  posRegistered,
  regionTags,
  evidenceSummary,
  cameraName,
  shinobiMonitorId,
  createdAt,
  updatedAt
}</div>
            </div>
        `;
    },

    renderTable(incidents) {
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

    async render() {
        const container = document.getElementById('fraudDetectionContent');
        if (!container) return;

        container.innerHTML = '<p class="empty-state">Loading fraud review inbox...</p>';

        const result = await this.loadIncidents();
        const modeBanner = result.mode === 'sample'
            ? `
                <div style="background:#FFF8E1;border:1px solid #FBC02D;color:#6D4C41;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
                    No live incident documents found yet. Showing starter sample incidents so the admin inbox has a concrete target for later POS and Shinobi ingestion.
                </div>
            `
            : `
                <div style="background:#E8F5E9;border:1px solid #81C784;color:#1B5E20;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
                    Reading incidents from <code>${this.escapeHtml(result.source)}</code>.
                </div>
            `;

        container.innerHTML = `
            ${modeBanner}
            ${this.renderSummaryCards(result.incidents)}
            ${this.renderSchemaCard()}
            ${this.renderTable(result.incidents)}
        `;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FraudReview.init());
} else {
    FraudReview.init();
}
