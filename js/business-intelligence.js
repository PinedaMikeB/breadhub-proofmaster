/**
 * BreadHub ProofMaster - Business Intelligence Module
 * 
 * AI-Powered Analytics for:
 * - Period comparisons (day vs day, week vs week, month vs month)
 * - Product performance analysis & recommendations
 * - Cost analysis with ingredient/supplier insights
 * - Actionable recommendations (adjust price, find suppliers, variants)
 */

const BusinessIntelligence = {
    cache: {},
    
    // ===== INITIALIZATION =====
    init() {
        console.log('Business Intelligence module initialized');
    },

    // ===== PERIOD HELPERS =====
    getDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    },

    getPeriodDates(period, offset = 0) {
        const today = new Date();
        let start, end;
        
        if (period === 'day') {
            const date = new Date(today);
            date.setDate(date.getDate() - offset);
            const dateStr = date.toISOString().split('T')[0];
            return { start: dateStr, end: dateStr, label: this.formatDateLabel(dateStr) };
        }
        
        if (period === 'week') {
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() - (offset * 7));
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);
            return {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0],
                label: `Week of ${this.formatDateShort(startDate)}`
            };
        }
        
        if (period === 'month') {
            const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            return {
                start: date.toISOString().split('T')[0],
                end: lastDay.toISOString().split('T')[0],
                label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            };
        }
        
        return null;
    },

    formatDateLabel(dateStr) {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric'
        });
    },

    formatDateShort(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    // ===== DATA LOADING =====
    async loadPeriodData(startDate, endDate) {
        const cacheKey = `${startDate}_${endDate}`;
        if (this.cache[cacheKey]) return this.cache[cacheKey];

        // Load inventory records
        const inventorySnapshot = await db.collection('dailyInventory')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();
        
        const inventoryRecords = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Load products with cost data
        const productsSnapshot = await db.collection('products').get();
        const products = {};
        productsSnapshot.docs.forEach(doc => {
            products[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Load ingredients
        const ingredientsSnapshot = await db.collection('ingredients').get();
        const ingredients = {};
        ingredientsSnapshot.docs.forEach(doc => {
            ingredients[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Load suppliers
        const suppliersSnapshot = await db.collection('suppliers').get();
        const suppliers = {};
        suppliersSnapshot.docs.forEach(doc => {
            suppliers[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Load dough recipes
        const doughsSnapshot = await db.collection('doughRecipes').get();
        const doughs = {};
        doughsSnapshot.docs.forEach(doc => {
            doughs[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Aggregate by product
        const productStats = {};
        inventoryRecords.forEach(record => {
            if (!productStats[record.productId]) {
                const product = products[record.productId] || {};
                productStats[record.productId] = {
                    productId: record.productId,
                    productName: record.productName || product.name,
                    category: record.category || product.category,
                    product: product,
                    totalProduced: 0,
                    totalSold: 0,
                    totalAvailable: 0,
                    totalWastage: 0,
                    totalRevenue: 0,
                    totalCost: 0,
                    daysTracked: 0,
                    dailyData: []
                };
            }

            const stats = productStats[record.productId];
            const produced = record.newProductionQty || 0;
            const sold = record.soldQty || 0;
            const available = record.totalAvailable || 0;
            const price = products[record.productId]?.finalSRP || 0;
            const cost = products[record.productId]?.estimatedCost || 0;

            stats.totalProduced += produced;
            stats.totalSold += sold;
            stats.totalAvailable += available;
            stats.totalRevenue += sold * price;
            stats.totalCost += available * cost;
            stats.daysTracked += 1;
            stats.dailyData.push({
                date: record.date,
                produced, sold, available, price, cost
            });
        });

        // Calculate derived metrics
        Object.values(productStats).forEach(stats => {
            stats.sellRate = stats.totalAvailable > 0 
                ? Math.round((stats.totalSold / stats.totalAvailable) * 100) : 0;
            stats.avgDailySold = stats.daysTracked > 0 
                ? Math.round(stats.totalSold / stats.daysTracked) : 0;
            stats.avgDailyProduced = stats.daysTracked > 0 
                ? Math.round(stats.totalProduced / stats.daysTracked) : 0;
            stats.profit = stats.totalRevenue - stats.totalCost;
            stats.profitMargin = stats.totalRevenue > 0 
                ? Math.round((stats.profit / stats.totalRevenue) * 100) : 0;
        });

        const result = {
            startDate, endDate,
            products: Object.values(productStats),
            allProducts: products,
            ingredients, suppliers, doughs,
            totals: {
                totalProduced: Object.values(productStats).reduce((sum, p) => sum + p.totalProduced, 0),
                totalSold: Object.values(productStats).reduce((sum, p) => sum + p.totalSold, 0),
                totalRevenue: Object.values(productStats).reduce((sum, p) => sum + p.totalRevenue, 0),
                totalCost: Object.values(productStats).reduce((sum, p) => sum + p.totalCost, 0),
                totalProfit: Object.values(productStats).reduce((sum, p) => sum + p.profit, 0)
            }
        };

        this.cache[cacheKey] = result;
        return result;
    },

    // ===== COMPARISON ANALYSIS =====
    async comparePeriods(period, currentOffset = 0, previousOffset = 1) {
        const current = this.getPeriodDates(period, currentOffset);
        const previous = this.getPeriodDates(period, previousOffset);

        const [currentData, previousData] = await Promise.all([
            this.loadPeriodData(current.start, current.end),
            this.loadPeriodData(previous.start, previous.end)
        ]);

        return this.analyzeComparison(currentData, previousData, current, previous);
    },

    analyzeComparison(currentData, previousData, currentPeriod, previousPeriod) {
        const comparison = {
            currentPeriod, previousPeriod,
            current: currentData, previous: previousData,
            changes: {},
            productComparisons: [],
            insights: [],
            recommendations: []
        };

        // Overall changes
        comparison.changes = {
            revenue: this.calculateChange(currentData.totals.totalRevenue, previousData.totals.totalRevenue),
            sold: this.calculateChange(currentData.totals.totalSold, previousData.totals.totalSold),
            profit: this.calculateChange(currentData.totals.totalProfit, previousData.totals.totalProfit),
            produced: this.calculateChange(currentData.totals.totalProduced, previousData.totals.totalProduced)
        };

        // Product-level comparison
        const allProductIds = new Set([
            ...currentData.products.map(p => p.productId),
            ...previousData.products.map(p => p.productId)
        ]);

        allProductIds.forEach(productId => {
            const current = currentData.products.find(p => p.productId === productId) || this.emptyProductStats(productId);
            const previous = previousData.products.find(p => p.productId === productId) || this.emptyProductStats(productId);
            
            comparison.productComparisons.push({
                productId,
                productName: current.productName || previous.productName,
                category: current.category || previous.category,
                current, previous,
                changes: {
                    sold: this.calculateChange(current.totalSold, previous.totalSold),
                    revenue: this.calculateChange(current.totalRevenue, previous.totalRevenue),
                    sellRate: this.calculateChange(current.sellRate, previous.sellRate),
                    profit: this.calculateChange(current.profit, previous.profit)
                }
            });
        });

        // Generate insights
        comparison.insights = this.generateComparisonInsights(comparison);
        comparison.recommendations = this.generateRecommendations(comparison);

        return comparison;
    },

    calculateChange(current, previous) {
        const diff = current - previous;
        const percent = previous > 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0);
        return { current, previous, diff, percent };
    },

    emptyProductStats(productId) {
        return {
            productId,
            productName: 'Unknown',
            totalProduced: 0, totalSold: 0, totalAvailable: 0,
            totalRevenue: 0, totalCost: 0, profit: 0,
            sellRate: 0, avgDailySold: 0, daysTracked: 0
        };
    },

    // ===== INSIGHT GENERATION =====
    generateComparisonInsights(comparison) {
        const insights = [];
        const changes = comparison.changes;

        // Overall performance
        if (changes.revenue.percent > 10) {
            insights.push({
                type: 'success', icon: '📈',
                title: 'Revenue Up!',
                message: `Revenue increased by ${changes.revenue.percent}% (₱${changes.revenue.diff.toFixed(0)}) compared to previous period.`
            });
        } else if (changes.revenue.percent < -10) {
            insights.push({
                type: 'warning', icon: '📉',
                title: 'Revenue Down',
                message: `Revenue decreased by ${Math.abs(changes.revenue.percent)}% (₱${Math.abs(changes.revenue.diff).toFixed(0)}) compared to previous period.`
            });
        }

        // Top movers
        const sortedByGrowth = [...comparison.productComparisons]
            .filter(p => p.previous.totalSold > 0)
            .sort((a, b) => b.changes.sold.percent - a.changes.sold.percent);

        if (sortedByGrowth.length > 0) {
            const topGrower = sortedByGrowth[0];
            if (topGrower.changes.sold.percent > 20) {
                insights.push({
                    type: 'success', icon: '🚀',
                    title: `Rising Star: ${topGrower.productName}`,
                    message: `Sales up ${topGrower.changes.sold.percent}% (${topGrower.changes.sold.diff} more units). Consider increasing production.`
                });
            }

            const worstPerformer = sortedByGrowth[sortedByGrowth.length - 1];
            if (worstPerformer.changes.sold.percent < -20) {
                insights.push({
                    type: 'warning', icon: '⚠️',
                    title: `Declining: ${worstPerformer.productName}`,
                    message: `Sales down ${Math.abs(worstPerformer.changes.sold.percent)}% (${Math.abs(worstPerformer.changes.sold.diff)} fewer units). Review pricing or consider variants.`
                });
            }
        }

        // Products with low sell rate
        const lowSellRate = comparison.productComparisons
            .filter(p => p.current.sellRate < 70 && p.current.totalAvailable > 10);
        
        if (lowSellRate.length > 0) {
            insights.push({
                type: 'alert', icon: '🗑️',
                title: `${lowSellRate.length} Products with Low Sell-Through`,
                message: `${lowSellRate.map(p => p.productName).join(', ')} have <70% sell rate. Reduce production or run promotions.`
            });
        }

        return insights;
    },

    // ===== RECOMMENDATIONS ENGINE =====
    generateRecommendations(comparison) {
        const recommendations = [];
        const products = comparison.current.allProducts;
        const ingredients = comparison.current.ingredients;
        const suppliers = comparison.current.suppliers;

        comparison.productComparisons.forEach(pc => {
            const product = products[pc.productId];
            if (!product) return;

            // 1. HIGH COST ANALYSIS
            const costRatio = product.estimatedCost && product.finalSRP 
                ? (product.estimatedCost / product.finalSRP) * 100 : 0;
            
            if (costRatio > 60) {
                // Cost is more than 60% of SRP - low margin
                const targetCost = product.finalSRP * 0.5; // Ideal 50% margin
                const reduction = product.estimatedCost - targetCost;
                
                recommendations.push({
                    type: 'cost',
                    priority: 'high',
                    icon: '💰',
                    product: pc.productName,
                    title: 'High Production Cost',
                    issue: `Cost (₱${product.estimatedCost?.toFixed(2)}) is ${costRatio.toFixed(0)}% of SRP (₱${product.finalSRP}).`,
                    actions: [
                        `Increase price by ₱${(product.finalSRP * 0.15).toFixed(0)} to improve margin`,
                        `Find cheaper ingredients - need to reduce cost by ₱${reduction.toFixed(2)}`,
                        `Review portion sizes`
                    ],
                    ingredientAnalysis: this.analyzeIngredientCosts(product, ingredients, suppliers)
                });
            }

            // 2. POOR PERFORMERS - Consider removal or variant
            if (pc.current.sellRate < 50 && pc.current.daysTracked >= 5) {
                recommendations.push({
                    type: 'performance',
                    priority: 'high',
                    icon: '🔄',
                    product: pc.productName,
                    title: 'Poor Sell-Through Rate',
                    issue: `Only ${pc.current.sellRate}% sell rate over ${pc.current.daysTracked} days.`,
                    actions: [
                        'REDUCE: Cut production by 50%',
                        'REPLACE: Try a new variant or flavor',
                        'REMOVE: Discontinue if no improvement in 2 weeks',
                        'PROMO: Run bundle deal to clear stock'
                    ]
                });
            }

            // 3. DECLINING SALES
            if (pc.changes.sold.percent < -30 && pc.previous.totalSold > 10) {
                recommendations.push({
                    type: 'trend',
                    priority: 'medium',
                    icon: '📉',
                    product: pc.productName,
                    title: 'Significant Sales Decline',
                    issue: `Sales dropped ${Math.abs(pc.changes.sold.percent)}% vs previous period.`,
                    actions: [
                        'Survey customers about the product',
                        'Check if competitors have similar offerings',
                        'Consider seasonal factors',
                        'Try limited-time variant to refresh interest'
                    ]
                });
            }

            // 4. OVERPRODUCTION
            if (pc.current.sellRate < 80 && pc.current.avgDailyProduced > pc.current.avgDailySold * 1.3) {
                const idealProduction = Math.ceil(pc.current.avgDailySold * 1.1);
                recommendations.push({
                    type: 'production',
                    priority: 'medium',
                    icon: '📦',
                    product: pc.productName,
                    title: 'Overproduction',
                    issue: `Producing ${pc.current.avgDailyProduced}/day but selling ${pc.current.avgDailySold}/day.`,
                    actions: [
                        `REDUCE to ${idealProduction}/day (10% buffer above average sales)`,
                        `Current waste: ~${pc.current.avgDailyProduced - pc.current.avgDailySold} units/day`
                    ]
                });
            }

            // 5. TOP PERFORMERS - Expand
            if (pc.current.sellRate >= 95 && pc.current.totalSold > 20) {
                recommendations.push({
                    type: 'opportunity',
                    priority: 'low',
                    icon: '🌟',
                    product: pc.productName,
                    title: 'Star Product - Expansion Opportunity',
                    issue: `${pc.current.sellRate}% sell rate - selling out consistently!`,
                    actions: [
                        `INCREASE production by 20-30%`,
                        'Test slight price increase (₱1-2)',
                        'Consider premium variant at higher price',
                        'Feature in marketing materials'
                    ]
                });
            }
        });

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return recommendations;
    },

    // ===== INGREDIENT COST ANALYSIS =====
    analyzeIngredientCosts(product, ingredients, suppliers) {
        const analysis = [];
        
        // This would need to trace through the product's recipe
        // For now, return placeholder - will enhance when we have recipe data structure
        if (product.doughRecipeId) {
            analysis.push({
                component: 'Dough',
                suggestion: 'Review flour supplier for bulk pricing'
            });
        }

        return analysis;
    },

    // ===== RENDER UI =====
    async render() {
        const container = document.getElementById('businessIntelligenceContent');
        if (!container) return;

        container.innerHTML = '<p class="empty-state">Loading Business Intelligence...</p>';

        // Default to week comparison
        const comparison = await this.comparePeriods('week', 0, 1);
        
        let html = `
            <!-- Period Selector -->
            <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="BusinessIntelligence.loadComparison('day')">📅 Day vs Day</button>
                <button class="btn btn-secondary" onclick="BusinessIntelligence.loadComparison('week')">📆 Week vs Week</button>
                <button class="btn btn-secondary" onclick="BusinessIntelligence.loadComparison('month')">📅 Month vs Month</button>
            </div>

            <!-- Period Info -->
            <div style="background:#E3F2FD;padding:16px;border-radius:12px;margin-bottom:20px;">
                <h3 style="margin:0 0 8px 0;">📊 ${comparison.currentPeriod.label} vs ${comparison.previousPeriod.label}</h3>
            </div>

            <!-- Overall Changes -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
                ${this.renderChangeCard('Revenue', comparison.changes.revenue, '₱')}
                ${this.renderChangeCard('Units Sold', comparison.changes.sold)}
                ${this.renderChangeCard('Profit', comparison.changes.profit, '₱')}
                ${this.renderChangeCard('Produced', comparison.changes.produced)}
            </div>
        `;

        // Insights
        if (comparison.insights.length > 0) {
            html += `
                <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:12px;padding:20px;margin-bottom:24px;color:white;">
                    <h3 style="margin:0 0 16px 0;">🤖 AI Insights</h3>
                    <div style="display:grid;gap:12px;">
            `;
            comparison.insights.forEach(insight => {
                const bgColor = insight.type === 'success' ? 'rgba(76,175,80,0.2)' 
                    : insight.type === 'warning' ? 'rgba(255,152,0,0.2)'
                    : 'rgba(244,67,54,0.2)';
                html += `
                    <div style="background:${bgColor};padding:12px 16px;border-radius:8px;">
                        <div style="font-weight:600;">${insight.icon} ${insight.title}</div>
                        <div style="font-size:0.9rem;opacity:0.9;">${insight.message}</div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        // Recommendations
        if (comparison.recommendations.length > 0) {
            html += `
                <div style="background:#FFF;border:2px solid #FF5722;border-radius:12px;padding:20px;margin-bottom:24px;">
                    <h3 style="margin:0 0 16px 0;color:#FF5722;">🎯 Action Items & Recommendations</h3>
                    <div style="display:grid;gap:16px;">
            `;
            comparison.recommendations.forEach(rec => {
                const borderColor = rec.priority === 'high' ? '#F44336' : rec.priority === 'medium' ? '#FF9800' : '#4CAF50';
                html += `
                    <div style="border-left:4px solid ${borderColor};padding:12px 16px;background:#FAFAFA;border-radius:0 8px 8px 0;">
                        <div style="font-weight:600;color:#333;margin-bottom:4px;">
                            ${rec.icon} ${rec.product}: ${rec.title}
                            <span style="background:${borderColor};color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;margin-left:8px;">${rec.priority}</span>
                        </div>
                        <div style="font-size:0.9rem;color:#666;margin-bottom:8px;">${rec.issue}</div>
                        <div style="font-size:0.85rem;">
                            ${rec.actions.map(a => `<div style="padding:4px 0;">• ${a}</div>`).join('')}
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        // Product Comparison Table
        html += `
            <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;overflow-x:auto;">
                <h4 style="margin:0 0 12px 0;">📋 Product Performance Comparison</h4>
                <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                    <thead>
                        <tr style="background:#f5f5f5;">
                            <th style="padding:12px;text-align:left;">Product</th>
                            <th style="padding:12px;text-align:center;">Current Sold</th>
                            <th style="padding:12px;text-align:center;">Previous Sold</th>
                            <th style="padding:12px;text-align:center;">Change</th>
                            <th style="padding:12px;text-align:center;">Sell Rate</th>
                            <th style="padding:12px;text-align:right;">Revenue Change</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Sort by sell rate ascending (worst performers visible)
        const sorted = [...comparison.productComparisons].sort((a, b) => a.current.sellRate - b.current.sellRate);
        
        sorted.forEach((pc, idx) => {
            const changeColor = pc.changes.sold.percent >= 0 ? '#2E7D32' : '#C62828';
            const changeIcon = pc.changes.sold.percent >= 0 ? '↑' : '↓';
            const sellRateColor = pc.current.sellRate >= 90 ? '#2E7D32' : pc.current.sellRate >= 70 ? '#F57C00' : '#C62828';
            
            html += `
                <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
                    <td style="padding:10px;"><strong>${pc.productName}</strong></td>
                    <td style="padding:10px;text-align:center;">${pc.current.totalSold}</td>
                    <td style="padding:10px;text-align:center;color:#888;">${pc.previous.totalSold}</td>
                    <td style="padding:10px;text-align:center;color:${changeColor};font-weight:600;">
                        ${changeIcon} ${Math.abs(pc.changes.sold.percent)}%
                    </td>
                    <td style="padding:10px;text-align:center;">
                        <span style="background:${sellRateColor};color:white;padding:4px 8px;border-radius:12px;font-size:0.8rem;">
                            ${pc.current.sellRate}%
                        </span>
                    </td>
                    <td style="padding:10px;text-align:right;color:${pc.changes.revenue.diff >= 0 ? '#2E7D32' : '#C62828'};">
                        ${pc.changes.revenue.diff >= 0 ? '+' : ''}₱${pc.changes.revenue.diff.toFixed(0)}
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    },

    renderChangeCard(label, change, prefix = '') {
        const isPositive = change.diff >= 0;
        const bgColor = isPositive ? '#E8F5E9' : '#FFEBEE';
        const textColor = isPositive ? '#2E7D32' : '#C62828';
        const icon = isPositive ? '↑' : '↓';
        
        return `
            <div style="background:${bgColor};padding:16px;border-radius:12px;text-align:center;">
                <div style="font-size:0.85rem;color:#666;">${label}</div>
                <div style="font-size:1.8rem;font-weight:bold;color:${textColor};">
                    ${prefix}${change.current.toLocaleString()}
                </div>
                <div style="font-size:0.9rem;color:${textColor};">
                    ${icon} ${Math.abs(change.percent)}% (${isPositive ? '+' : ''}${prefix}${change.diff.toFixed(0)})
                </div>
            </div>
        `;
    },

    async loadComparison(period) {
        const comparison = await this.comparePeriods(period, 0, 1);
        await this.render();
    }
};

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BusinessIntelligence.init());
} else {
    BusinessIntelligence.init();
}
