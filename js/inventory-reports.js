/**
 * BreadHub ProofMaster - Inventory Reports Module
 * 
 * Features:
 * - Daily summary report
 * - Wastage breakdown
 * - Profit analysis
 * - AI insights and recommendations
 * - Sell-out time tracking
 */

const InventoryReports = {
    selectedDate: null,
    reportData: null,

    init() {
        this.selectedDate = this.getTodayString();
    },

    getTodayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    },

    formatTime(timestamp) {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    },

    // ===== DATA LOADING =====
    async loadReportData(date) {
        this.selectedDate = date;
        
        try {
            // Load daily inventory records
            const inventorySnapshot = await db.collection('dailyInventory')
                .where('date', '==', date)
                .get();
            
            const inventoryRecords = inventorySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load stock movements for adjustments
            const movementsSnapshot = await db.collection('stockMovements')
                .where('date', '==', date)
                .get();
            
            const movements = movementsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load products for cost data
            const productsSnapshot = await db.collection('products').get();
            const products = {};
            productsSnapshot.docs.forEach(doc => {
                products[doc.id] = doc.data();
            });

            // Process data
            this.reportData = this.processReportData(inventoryRecords, movements, products);
            
            return this.reportData;
        } catch (error) {
            console.error('Error loading report data:', error);
            Toast.error('Failed to load report data');
            return null;
        }
    },

    processReportData(inventoryRecords, movements, products) {
        const report = {
            date: this.selectedDate,
            products: [],
            totals: {
                totalProduced: 0,
                totalCarryover: 0,
                totalAvailable: 0,
                totalSold: 0,
                totalRemaining: 0,
                totalWastage: 0,
                totalRecycled: 0,
                totalGiveaways: 0,
                estimatedRevenue: 0,
                estimatedCost: 0,
                wastageCost: 0,
                estimatedProfit: 0
            },
            wastageBreakdown: {},
            recycledBreakdown: {},
            giveawayBreakdown: {},
            insights: [],
            sellOutTimes: []
        };

        // Group movements by product and type
        const movementsByProduct = {};
        movements.forEach(m => {
            if (!movementsByProduct[m.productId]) {
                movementsByProduct[m.productId] = [];
            }
            movementsByProduct[m.productId].push(m);
        });

        // Process each inventory record
        inventoryRecords.forEach(record => {
            const product = products[record.productId] || {};
            const productMovements = movementsByProduct[record.productId] || [];
            
            // Calculate stock values
            const carryover = record.carryoverQty || 0;
            const produced = record.newProductionQty || 0;
            const totalAvailable = record.totalAvailable || 0;
            const sold = record.soldQty || 0;
            const reserved = record.reservedQty || 0;
            const remaining = totalAvailable - sold - reserved;
            
            // Get product cost and price
            const costPerUnit = product.estimatedCost || 0;
            const pricePerUnit = product.price || 0;

            // Calculate adjustments by category
            let wastage = 0;
            let recycled = 0;
            let giveaways = 0;
            
            productMovements.forEach(m => {
                if (m.type === 'adjustment' && m.qty < 0) {
                    const reason = m.notes || m.reason || '';
                    const qty = Math.abs(m.qty);
                    
                    if (reason.includes('Stale') || reason.includes('Expired') || reason.includes('Breakage') || reason.includes('damaged')) {
                        wastage += qty;
                        report.wastageBreakdown[reason] = (report.wastageBreakdown[reason] || 0) + qty;
                    } else if (reason.includes('Recycled')) {
                        recycled += qty;
                        report.recycledBreakdown[reason] = (report.recycledBreakdown[reason] || 0) + qty;
                    } else if (reason.includes('Employee') || reason.includes('Taste') || reason.includes('Given') || reason.includes('Donation')) {
                        giveaways += qty;
                        report.giveawayBreakdown[reason] = (report.giveawayBreakdown[reason] || 0) + qty;
                    }
                }
            });

            // Product report entry
            const productReport = {
                productId: record.productId,
                productName: record.productName,
                category: record.category,
                carryover,
                produced,
                totalAvailable,
                sold,
                remaining,
                wastage,
                recycled,
                giveaways,
                soldOutAt: record.soldOutAt,
                revenue: sold * pricePerUnit,
                cost: totalAvailable * costPerUnit,
                wastageCost: wastage * costPerUnit,
                profit: (sold * pricePerUnit) - (totalAvailable * costPerUnit),
                sellRate: totalAvailable > 0 ? Math.round((sold / totalAvailable) * 100) : 0
            };

            report.products.push(productReport);

            // Update totals
            report.totals.totalCarryover += carryover;
            report.totals.totalProduced += produced;
            report.totals.totalAvailable += totalAvailable;
            report.totals.totalSold += sold;
            report.totals.totalRemaining += remaining;
            report.totals.totalWastage += wastage;
            report.totals.totalRecycled += recycled;
            report.totals.totalGiveaways += giveaways;
            report.totals.estimatedRevenue += productReport.revenue;
            report.totals.estimatedCost += productReport.cost;
            report.totals.wastageCost += productReport.wastageCost;
            report.totals.estimatedProfit += productReport.profit;

            // Track sell-out times
            if (record.soldOutAt) {
                report.sellOutTimes.push({
                    productName: record.productName,
                    soldOutAt: record.soldOutAt,
                    totalAvailable: totalAvailable,
                    sold: sold
                });
            }
        });

        // Generate insights
        report.insights = this.generateInsights(report);

        return report;
    },

    // ===== AI INSIGHTS GENERATION =====
    generateInsights(report) {
        const insights = [];
        const today = new Date();
        const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

        // 1. Sell-out warnings with time recommendations
        report.sellOutTimes.forEach(item => {
            const sellOutTime = item.soldOutAt?.toDate ? item.soldOutAt.toDate() : new Date(item.soldOutAt);
            const hour = sellOutTime.getHours();
            
            if (hour < 14) { // Sold out before 2 PM
                const additionalNeeded = Math.ceil(item.sold * 0.3); // Suggest 30% more
                insights.push({
                    type: 'warning',
                    icon: '⚠️',
                    title: `${item.productName} sold out early`,
                    message: `Sold out at ${this.formatTime(item.soldOutAt)}. Consider adding ${additionalNeeded} more tomorrow to serve afternoon customers.`,
                    priority: 'high'
                });
            }
        });

        // 2. High wastage products
        report.products.forEach(p => {
            const wastageRate = p.totalAvailable > 0 ? (p.wastage / p.totalAvailable) * 100 : 0;
            if (wastageRate > 15) {
                insights.push({
                    type: 'alert',
                    icon: '🗑️',
                    title: `High wastage: ${p.productName}`,
                    message: `${wastageRate.toFixed(0)}% wastage rate (${p.wastage} of ${p.totalAvailable}). Consider reducing production by ${Math.ceil(p.wastage * 0.7)}.`,
                    priority: 'high'
                });
            }
        });

        // 3. Products with lots of carryover
        report.products.forEach(p => {
            if (p.carryover > 0 && p.remaining > p.carryover) {
                insights.push({
                    type: 'info',
                    icon: '📦',
                    title: `Excess stock: ${p.productName}`,
                    message: `Started with ${p.carryover} carryover and still has ${p.remaining} remaining. Reduce tomorrow's production.`,
                    priority: 'medium'
                });
            }
        });

        // 4. Best sellers
        const sortedBySales = [...report.products].sort((a, b) => b.sold - a.sold);
        if (sortedBySales.length > 0 && sortedBySales[0].sold > 0) {
            insights.push({
                type: 'success',
                icon: '🏆',
                title: `Top seller: ${sortedBySales[0].productName}`,
                message: `Sold ${sortedBySales[0].sold} units with ${sortedBySales[0].sellRate}% sell-through rate.`,
                priority: 'low'
            });
        }

        // 5. Overall performance
        const overallSellRate = report.totals.totalAvailable > 0 
            ? Math.round((report.totals.totalSold / report.totals.totalAvailable) * 100) 
            : 0;
        
        if (overallSellRate >= 90) {
            insights.push({
                type: 'success',
                icon: '🎉',
                title: 'Excellent performance!',
                message: `${overallSellRate}% sell-through rate today. Great inventory management!`,
                priority: 'low'
            });
        } else if (overallSellRate < 70) {
            insights.push({
                type: 'warning',
                icon: '📉',
                title: 'Low sell-through rate',
                message: `Only ${overallSellRate}% of stock sold. Consider reducing overall production or running promotions.`,
                priority: 'medium'
            });
        }

        // 6. Wastage cost impact
        if (report.totals.wastageCost > 0) {
            const wastagePercent = report.totals.estimatedRevenue > 0 
                ? ((report.totals.wastageCost / report.totals.estimatedRevenue) * 100).toFixed(1)
                : 0;
            insights.push({
                type: 'info',
                icon: '💸',
                title: 'Wastage cost impact',
                message: `₱${report.totals.wastageCost.toFixed(2)} lost to wastage (${wastagePercent}% of revenue).`,
                priority: 'medium'
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return insights;
    },

    // ===== RENDER REPORT =====
    async render() {
        const container = document.getElementById('inventoryReportsContent');
        if (!container) return;

        // Show loading
        container.innerHTML = '<p class="empty-state">Loading report...</p>';

        // Load data
        await this.loadReportData(this.selectedDate);
        
        if (!this.reportData) {
            container.innerHTML = '<p class="empty-state">Failed to load report data</p>';
            return;
        }

        const report = this.reportData;
        
        let html = `
            <!-- Date Selector -->
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <button class="btn btn-secondary" onclick="InventoryReports.previousDay()" style="padding:8px 12px;">◀</button>
                    <input type="date" id="reportDatePicker" value="${this.selectedDate}" 
                           onchange="InventoryReports.changeDate(this.value)" class="form-input" style="width:auto;">
                    <button class="btn btn-secondary" onclick="InventoryReports.nextDay()" style="padding:8px 12px;">▶</button>
                    <button class="btn btn-secondary" onclick="InventoryReports.goToToday()">Today</button>
                </div>
                <button class="btn btn-primary" onclick="InventoryReports.exportPDF()">📄 Export PDF</button>
            </div>

            <h3 style="margin-bottom:16px;">📅 ${this.formatDate(this.selectedDate)}</h3>
        `;

        // Check if we have data
        if (report.products.length === 0) {
            html += `<p class="empty-state">No inventory data for this date</p>`;
            container.innerHTML = html;
            return;
        }

        // AI Insights Section
        if (report.insights.length > 0) {
            html += `
                <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:12px;padding:20px;margin-bottom:24px;color:white;">
                    <h3 style="margin:0 0 16px 0;display:flex;align-items:center;gap:8px;">
                        🤖 AI Insights & Recommendations
                    </h3>
                    <div style="display:grid;gap:12px;">
            `;
            
            report.insights.forEach(insight => {
                const bgColor = insight.type === 'warning' ? 'rgba(255,152,0,0.2)' 
                    : insight.type === 'alert' ? 'rgba(244,67,54,0.2)'
                    : insight.type === 'success' ? 'rgba(76,175,80,0.2)'
                    : 'rgba(255,255,255,0.1)';
                
                html += `
                    <div style="background:${bgColor};padding:12px 16px;border-radius:8px;">
                        <div style="font-weight:600;margin-bottom:4px;">${insight.icon} ${insight.title}</div>
                        <div style="font-size:0.9rem;opacity:0.9;">${insight.message}</div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }

        // Summary Cards
        html += `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px;">
                <div style="background:#E3F2FD;padding:16px;border-radius:12px;text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:#1565C0;">${report.totals.totalAvailable}</div>
                    <div style="color:#666;font-size:0.85rem;">Total Available</div>
                    <div style="font-size:0.75rem;color:#888;margin-top:4px;">
                        ${report.totals.totalCarryover} carryover + ${report.totals.totalProduced} new
                    </div>
                </div>
                <div style="background:#E8F5E9;padding:16px;border-radius:12px;text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:#2E7D32;">${report.totals.totalSold}</div>
                    <div style="color:#666;font-size:0.85rem;">Total Sold</div>
                    <div style="font-size:0.75rem;color:#888;margin-top:4px;">
                        ${report.totals.totalAvailable > 0 ? Math.round((report.totals.totalSold / report.totals.totalAvailable) * 100) : 0}% sell-through
                    </div>
                </div>
                <div style="background:#FFF3E0;padding:16px;border-radius:12px;text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:#E65100;">${report.totals.totalRemaining}</div>
                    <div style="color:#666;font-size:0.85rem;">Remaining</div>
                    <div style="font-size:0.75rem;color:#888;margin-top:4px;">For carryover tomorrow</div>
                </div>
                <div style="background:#FFEBEE;padding:16px;border-radius:12px;text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:#C62828;">${report.totals.totalWastage}</div>
                    <div style="color:#666;font-size:0.85rem;">Wastage</div>
                    <div style="font-size:0.75rem;color:#888;margin-top:4px;">₱${report.totals.wastageCost.toFixed(2)} lost</div>
                </div>
                <div style="background:#E8F5E9;padding:16px;border-radius:12px;text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:#2E7D32;">₱${report.totals.estimatedRevenue.toFixed(0)}</div>
                    <div style="color:#666;font-size:0.85rem;">Est. Revenue</div>
                </div>
                <div style="background:#F3E5F5;padding:16px;border-radius:12px;text-align:center;">
                    <div style="font-size:2rem;font-weight:bold;color:#7B1FA2;">₱${report.totals.estimatedProfit.toFixed(0)}</div>
                    <div style="color:#666;font-size:0.85rem;">Est. Profit</div>
                    <div style="font-size:0.75rem;color:#888;margin-top:4px;">After wastage</div>
                </div>
            </div>
        `;

        // Breakdown Section
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:24px;">`;

        // Wastage Breakdown
        if (Object.keys(report.wastageBreakdown).length > 0) {
            html += `
                <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;">
                    <h4 style="margin:0 0 12px 0;color:#C62828;">🗑️ Wastage Breakdown</h4>
                    <div style="display:grid;gap:8px;">
            `;
            Object.entries(report.wastageBreakdown).forEach(([reason, qty]) => {
                html += `
                    <div style="display:flex;justify-content:space-between;padding:8px;background:#FFEBEE;border-radius:6px;">
                        <span>${reason}</span>
                        <strong>${qty}</strong>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        // Recycled Breakdown
        if (Object.keys(report.recycledBreakdown).length > 0) {
            html += `
                <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;">
                    <h4 style="margin:0 0 12px 0;color:#388E3C;">♻️ Recycled Items</h4>
                    <div style="display:grid;gap:8px;">
            `;
            Object.entries(report.recycledBreakdown).forEach(([reason, qty]) => {
                html += `
                    <div style="display:flex;justify-content:space-between;padding:8px;background:#E8F5E9;border-radius:6px;">
                        <span>${reason}</span>
                        <strong>${qty}</strong>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        // Giveaways Breakdown
        if (Object.keys(report.giveawayBreakdown).length > 0) {
            html += `
                <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;">
                    <h4 style="margin:0 0 12px 0;color:#1976D2;">🎁 Giveaways</h4>
                    <div style="display:grid;gap:8px;">
            `;
            Object.entries(report.giveawayBreakdown).forEach(([reason, qty]) => {
                html += `
                    <div style="display:flex;justify-content:space-between;padding:8px;background:#E3F2FD;border-radius:6px;">
                        <span>${reason}</span>
                        <strong>${qty}</strong>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        html += `</div>`;

        // Sell-Out Times
        if (report.sellOutTimes.length > 0) {
            html += `
                <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:24px;">
                    <h4 style="margin:0 0 12px 0;color:#E65100;">⏰ Sell-Out Times</h4>
                    <div style="display:grid;gap:8px;">
            `;
            
            // Sort by sell-out time
            const sortedSellouts = [...report.sellOutTimes].sort((a, b) => {
                const timeA = a.soldOutAt?.toDate ? a.soldOutAt.toDate() : new Date(a.soldOutAt);
                const timeB = b.soldOutAt?.toDate ? b.soldOutAt.toDate() : new Date(b.soldOutAt);
                return timeA - timeB;
            });
            
            sortedSellouts.forEach(item => {
                const sellOutTime = item.soldOutAt?.toDate ? item.soldOutAt.toDate() : new Date(item.soldOutAt);
                const hour = sellOutTime.getHours();
                const isEarly = hour < 14;
                
                html += `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:${isEarly ? '#FFF3E0' : '#E8F5E9'};border-radius:8px;">
                        <div>
                            <strong>${item.productName}</strong>
                            <div style="font-size:0.85rem;color:#666;">Sold ${item.sold} of ${item.totalAvailable}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.2rem;font-weight:bold;color:${isEarly ? '#E65100' : '#2E7D32'};">
                                ${this.formatTime(item.soldOutAt)}
                            </div>
                            ${isEarly ? '<div style="font-size:0.75rem;color:#E65100;">⚠️ Early sell-out</div>' : ''}
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }

        // Product Performance Table
        html += `
            <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;overflow-x:auto;">
                <h4 style="margin:0 0 12px 0;">📋 Product Performance</h4>
                <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                    <thead>
                        <tr style="background:#f5f5f5;">
                            <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Product</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;">Carryover</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;">Produced</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;">Available</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;">Sold</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;">Remaining</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;">Wastage</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;">Sell Rate</th>
                            <th style="padding:12px;text-align:right;border-bottom:2px solid #ddd;">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Sort products by sold quantity (best sellers first)
        const sortedProducts = [...report.products].sort((a, b) => b.sold - a.sold);
        
        sortedProducts.forEach((p, index) => {
            const rowBg = index % 2 === 0 ? '#fff' : '#fafafa';
            const sellRateColor = p.sellRate >= 90 ? '#2E7D32' : p.sellRate >= 70 ? '#F57C00' : '#C62828';
            
            html += `
                <tr style="background:${rowBg};">
                    <td style="padding:10px;border-bottom:1px solid #eee;">
                        <strong>${p.productName}</strong>
                        <div style="font-size:0.75rem;color:#888;">${p.category || ''}</div>
                    </td>
                    <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;color:#666;">${p.carryover}</td>
                    <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;color:#1565C0;font-weight:600;">${p.produced}</td>
                    <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;">${p.totalAvailable}</td>
                    <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;color:#2E7D32;font-weight:600;">${p.sold}</td>
                    <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;color:#E65100;">${p.remaining}</td>
                    <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;color:#C62828;">${p.wastage > 0 ? p.wastage : '-'}</td>
                    <td style="padding:10px;text-align:center;border-bottom:1px solid #eee;">
                        <span style="background:${sellRateColor};color:white;padding:4px 8px;border-radius:12px;font-size:0.8rem;">${p.sellRate}%</span>
                    </td>
                    <td style="padding:10px;text-align:right;border-bottom:1px solid #eee;font-weight:600;">₱${p.revenue.toFixed(0)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    },

    // ===== DATE NAVIGATION =====
    changeDate(dateStr) {
        this.selectedDate = dateStr;
        this.render();
    },
    
    previousDay() {
        const date = new Date(this.selectedDate + 'T00:00:00');
        date.setDate(date.getDate() - 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        this.changeDate(`${year}-${month}-${day}`);
    },
    
    nextDay() {
        const date = new Date(this.selectedDate + 'T00:00:00');
        date.setDate(date.getDate() + 1);
        const today = this.getTodayString();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const newDate = `${year}-${month}-${day}`;
        
        if (newDate <= today) {
            this.changeDate(newDate);
        }
    },
    
    goToToday() {
        this.changeDate(this.getTodayString());
    },

    // ===== EXPORT =====
    async exportPDF() {
        Toast.info('Generating PDF report...');
        // TODO: Implement PDF export using jsPDF or similar
        Toast.warning('PDF export coming soon!');
    }
};
