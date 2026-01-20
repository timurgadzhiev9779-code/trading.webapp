/**
 * Main App Logic for Trading Bot Mini App
 */

// ==================== STATE ====================
const state = {
    currentTab: 'overview',
    portfolio: null,
    history: null,
    signals: null,
    equityChart: null,
    loading: false
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 App initializing...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial data
    await loadAllData();
    
    // Hide loading screen
    hideLoadingScreen();
    
    // Start auto-refresh
    startAutoRefresh();
    
    console.log('✅ App ready!');
});

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        api.vibrate('light');
        await loadAllData();
    });
    
    // Toggle AI button
    document.getElementById('toggle-ai-btn').addEventListener('click', async () => {
        await toggleAITrading();
    });
    
    // Chart period buttons
    document.querySelectorAll('.chart-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // TODO: Filter equity chart data
        });
    });
}

// ==================== TAB SWITCHING ====================
function switchTab(tabName) {
    // Update navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    
    state.currentTab = tabName;
    
    // Load tab-specific data if needed
    if (tabName === 'signals' && !state.signals) {
        loadSignals();
    }
}

// ==================== DATA LOADING ====================
async function loadAllData() {
    showLoading();
    
    try {
        await Promise.all([
            loadPortfolio(),
            loadHistory(),
            loadEquityCurve()
        ]);
    } catch (error) {
        console.error('Error loading data:', error);
        api.showNotification('❌ Ошибка загрузки данных');
    } finally {
        hideLoading();
    }
}

async function loadPortfolio() {
    try {
        const data = await api.getPortfolio();
        state.portfolio = data;
        renderPortfolio(data);
    } catch (error) {
        console.error('Error loading portfolio:', error);
    }
}

async function loadHistory() {
    try {
        const data = await api.getHistory(20);
        state.history = data;
        renderHistory(data);
        renderStats(data.stats);
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

async function loadSignals() {
    try {
        const data = await api.getSignals();
        state.signals = data;
        renderSignals(data);
    } catch (error) {
        console.error('Error loading signals:', error);
    }
}

async function loadEquityCurve() {
    try {
        const data = await api.getDailyStats(30);
        renderEquityChart(data.equity_chart);
    } catch (error) {
        console.error('Error loading equity curve:', error);
    }
}

// ==================== RENDERING ====================

/**
 * Render Portfolio Overview
 */
function renderPortfolio(data) {
    // AI Status
    const aiIndicator = document.getElementById('ai-status-indicator');
    const aiCard = document.querySelector('.ai-status-card');
    const toggleBtn = document.getElementById('toggle-ai-btn');
    
    if (data.enabled) {
        aiIndicator.querySelector('.status-text').textContent = 'AI Включен';
        aiCard.classList.add('active');
        toggleBtn.classList.add('active');
    } else {
        aiIndicator.querySelector('.status-text').textContent = 'AI Выключен';
        aiCard.classList.remove('active');
        toggleBtn.classList.remove('active');
    }
    
    // Balance
    document.getElementById('balance-value').textContent = formatMoney(data.balance_usdt);
    document.getElementById('positions-value').textContent = formatMoney(data.positions_value);
    
    const positionsCount = Object.keys(data.positions).length;
    document.getElementById('positions-count').textContent = 
        positionsCount === 0 ? 'Нет позиций' : 
        positionsCount === 1 ? '1 позиция' : 
        `${positionsCount} позиций`;
    
    // Total value
    document.getElementById('total-value').textContent = formatMoney(data.total_value);
    
    const pnlElement = document.getElementById('total-pnl');
    const pnlText = `${formatMoney(data.total_pnl)} (${formatPercent(data.total_pnl_pct)})`;
    pnlElement.textContent = pnlText;
    pnlElement.classList.toggle('positive', data.total_pnl >= 0);
    pnlElement.classList.toggle('negative', data.total_pnl < 0);
    
    // Render positions list
    renderPositionsList(data.positions);
}

/**
 * Render Positions List
 */
function renderPositionsList(positions) {
    const container = document.getElementById('portfolio-list');
    const noPositions = document.getElementById('no-positions');
    
    if (Object.keys(positions).length === 0) {
        container.style.display = 'none';
        noPositions.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    noPositions.style.display = 'none';
    container.innerHTML = '';
    
    Object.entries(positions).forEach(([symbol, pos]) => {
        const pnl = pos.pnl || 0;
        const pnlPct = pos.pnl_pct || 0;
        const isProfit = pnl >= 0;
        
        const card = document.createElement('div');
        card.className = `position-card ${isProfit ? 'profit' : 'loss'}`;
        card.innerHTML = `
            <div class="position-header">
                <div class="position-symbol">${symbol}/USDT</div>
                <div class="position-pnl ${isProfit ? 'positive' : 'negative'}">
                    ${formatMoney(pnl)} (${formatPercent(pnlPct)})
                </div>
            </div>
            <div class="position-details">
                <div class="detail-item">
                    <div class="detail-label">Вход</div>
                    <div class="detail-value">${formatPrice(pos.entry_price)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Сейчас</div>
                    <div class="detail-value">${formatPrice(pos.current_price)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Stop-Loss</div>
                    <div class="detail-value text-red">${formatPrice(pos.stop_loss)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Take-Profit</div>
                    <div class="detail-value text-green">${formatPrice(pos.take_profit)}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * Render History
 */
function renderHistory(data) {
    const container = document.getElementById('history-list');
    const noHistory = document.getElementById('no-history');
    
    if (!data.trades || data.trades.length === 0) {
        container.style.display = 'none';
        noHistory.style.display = 'block';
        return;
    }
    
    container.style.display = 'flex';
    noHistory.style.display = 'none';
    container.innerHTML = '';
    
    data.trades.forEach(trade => {
        const isProfit = trade.profit_usdt > 0;
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-icon ${isProfit ? 'profit' : 'loss'}">
                ${isProfit ? '💚' : '❤️'}
            </div>
            <div class="history-content">
                <div class="history-symbol">${trade.symbol}/USDT</div>
                <div class="history-date">${formatDate(trade.close_time)}</div>
            </div>
            <div class="history-pnl">
                <div class="history-amount ${isProfit ? 'positive' : 'negative'}">
                    ${formatMoney(trade.profit_usdt)}
                </div>
                <div class="history-percent">${formatPercent(trade.profit_pct)}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

/**
 * Render Stats
 */
function renderStats(stats) {
    document.getElementById('stat-winrate').textContent = formatPercent(stats.winrate);
    document.getElementById('stat-total-trades').textContent = stats.total_trades;
    document.getElementById('stat-wins').textContent = stats.wins;
    document.getElementById('stat-losses').textContent = stats.losses;
}

/**
 * Render Signals
 */
function renderSignals(data) {
    const container = document.getElementById('signals-list');
    container.innerHTML = '';
    
    if (!data.signals || data.signals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📡</div>
                <div class="empty-title">Нет сигналов</div>
                <div class="empty-text">Анализ монет в процессе...</div>
            </div>
        `;
        return;
    }
    
    data.signals.forEach(signal => {
        const card = document.createElement('div');
        card.className = 'signal-card';
        card.innerHTML = `
            <div class="signal-badge ${signal.signal.toLowerCase()}">
                <div>${signal.signal}</div>
                <div style="font-size: 10px;">${signal.confidence}%</div>
            </div>
            <div class="signal-info">
                <div class="signal-symbol">${signal.symbol}/USDT</div>
                <div class="signal-price">${formatPrice(signal.price)}</div>
                <span class="signal-confidence">
                    ${signal.trend} · RSI ${signal.rsi.toFixed(0)}
                </span>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * Render Equity Chart
 */
function renderEquityChart(chartData) {
    const ctx = document.getElementById('equity-chart').getContext('2d');
    
    // Destroy previous chart if exists
    if (state.equityChart) {
        state.equityChart.destroy();
    }
    
    if (!chartData || chartData.length === 0) {
        return;
    }
    
    const labels = chartData.map(d => d.date);
    const values = chartData.map(d => d.value);
    
    state.equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Equity',
                data: values,
                borderColor: '#F0B90B',
                backgroundColor: 'rgba(240, 185, 11, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1E2329',
                    titleColor: '#EAECEF',
                    bodyColor: '#EAECEF',
                    borderColor: '#2B3139',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return formatMoney(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#848E9C',
                        maxTicksLimit: 6
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: '#2B3139'
                    },
                    ticks: {
                        color: '#848E9C',
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// ==================== ACTIONS ====================

/**
 * Toggle AI Trading
 */
async function toggleAITrading() {
    try {
        api.vibrate('medium');
        showLoading();
        
        const response = await api.toggleAI();
        
        api.vibrate('success');
        api.showPopup(response.message, 'success');
        
        // Reload portfolio to update UI
        await loadPortfolio();
        
    } catch (error) {
        console.error('Error toggling AI:', error);
        api.vibrate('error');
        api.showNotification('❌ Ошибка при переключении AI');
    } finally {
        hideLoading();
    }
}

// ==================== UI HELPERS ====================

function showLoading() {
    state.loading = true;
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.style.opacity = '0.5';
    refreshBtn.style.pointerEvents = 'none';
}

function hideLoading() {
    state.loading = false;
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.style.opacity = '1';
    refreshBtn.style.pointerEvents = 'auto';
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        app.style.display = 'flex';
    }, 300);
}

// ==================== AUTO REFRESH ====================

function startAutoRefresh() {
    // Обновляем данные каждые 30 секунд
    setInterval(async () => {
        if (!state.loading && document.visibilityState === 'visible') {
            console.log('🔄 Auto-refreshing data...');
            await loadAllData();
        }
    }, 30000); // 30 seconds
}

// ==================== FORMATTERS ====================

function formatMoney(value) {
    const num = parseFloat(value) || 0;
    return '$' + num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatPrice(value) {
    const num = parseFloat(value) || 0;
    return '$' + num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatPercent(value) {
    const num = parseFloat(value) || 0;
    const sign = num >= 0 ? '+' : '';
    return sign + num.toFixed(2) + '%';
}

function formatDate(isoString) {
    if (!isoString) return '-';
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ==================== ERROR HANDLING ====================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// ==================== EXPORTS ====================

// For debugging
window.app = {
    state,
    api,
    loadAllData,
    switchTab
};

console.log('📱 App script loaded');
