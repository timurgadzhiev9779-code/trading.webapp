// ==================== TRADING BOT V2.0 - APP.JS ====================

class TradingApp {
    constructor() {
        this.currentTab = 'overview';
        this.refreshInterval = null;
        this.charts = {};
        
        // Ждём загрузки DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('🚀 Trading Bot V2.0 initializing...');
        
        // Показываем loading
        this.showLoading();
        
        // Инициализация Telegram WebApp
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
        
        // Загружаем данные
        await this.loadAllData();
        
        // Скрываем loading
        this.hideLoading();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Автообновление каждые 30 секунд
        this.startAutoRefresh();
        
        console.log('✅ App initialized');
    }

    showLoading() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.style.display = 'flex';
    }

    hideLoading() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.style.display = 'none';
        const app = document.getElementById('app');
        if (app) app.style.display = 'block';
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.loadOverview(),
                this.loadPortfolio(),
                this.loadSignals(),
                this.loadHistory()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Ошибка загрузки данных');
        }
    }

    // ==================== OVERVIEW TAB ====================

    async loadOverview() {
        try {
            const portfolio = await window.API.getPortfolio();
            
            // AI статус
            const aiStatusEl = document.querySelector('.status-text');
            if (aiStatusEl) {
                aiStatusEl.textContent = portfolio.enabled ? 'AI Включен' : 'AI Выключен';
            }
            
            const statusDot = document.querySelector('.status-dot');
            if (statusDot) {
                statusDot.style.backgroundColor = portfolio.enabled ? '#0ECB81' : '#848E9C';
            }
            
            // Обновляем toggle кнопку
            const toggleBtn = document.getElementById('toggle-ai-btn');
            if (toggleBtn) {
                if (portfolio.enabled) {
                    toggleBtn.classList.add('active');
                } else {
                    toggleBtn.classList.remove('active');
                }
            }
            
            // Баланс
            const balanceEl = document.getElementById('balance-value');
            if (balanceEl) balanceEl.textContent = `$${portfolio.balance_usdt.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            
            const posValueEl = document.getElementById('positions-value');
            if (posValueEl) posValueEl.textContent = `$${portfolio.positions_value.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            
            const totalValueEl = document.getElementById('total-value');
            if (totalValueEl) totalValueEl.textContent = `$${portfolio.total_value.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            
            // P&L
            const pnlEl = document.getElementById('total-pnl');
            if (pnlEl) {
                const pnlClass = portfolio.total_pnl >= 0 ? 'profit' : 'loss';
                pnlEl.className = `balance-change ${pnlClass}`;
                pnlEl.textContent = `$${portfolio.total_pnl >= 0 ? '+' : ''}${portfolio.total_pnl.toFixed(2)} (${portfolio.total_pnl_pct >= 0 ? '+' : ''}${portfolio.total_pnl_pct.toFixed(2)}%)`;
            }
            
            // Positions count
            const posCountEl = document.getElementById('positions-count');
            if (posCountEl) {
                posCountEl.textContent = `${portfolio.positions_count || 0} позиций`;
            }
            
            // График
            await this.loadEquityCurve();
            
            // Статистика
            const history = await window.API.getHistory(100);
            
            const winrateEl = document.getElementById('stat-winrate');
            if (winrateEl) winrateEl.textContent = `${history.stats.winrate.toFixed(1)}%`;
            
            const tradesEl = document.getElementById('stat-total-trades');
            if (tradesEl) tradesEl.textContent = history.stats.total_trades;
            
            const winsEl = document.getElementById('stat-wins');
            if (winsEl) winsEl.textContent = history.stats.wins;
            
            const lossesEl = document.getElementById('stat-losses');
            if (lossesEl) lossesEl.textContent = history.stats.losses;
            
        } catch (error) {
            console.error('Error loading overview:', error);
        }
    }

    async loadEquityCurve() {
        try {
            const data = await window.API.getDailyStats();
            
            if (!data.equity_chart || data.equity_chart.length === 0) return;
            
            const labels = data.equity_chart.map(item => {
                const date = new Date(item.date);
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            
            const values = data.equity_chart.map(item => item.value);
            
            if (this.charts.equity) {
                this.charts.equity.destroy();
            }
            
            const ctx = document.getElementById('equity-chart');
            if (!ctx) return;
            
            this.charts.equity = new Chart(ctx.getContext('2d'), {
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
                        pointRadius: 3,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1E2329',
                            titleColor: '#EAECEF',
                            bodyColor: '#EAECEF',
                            borderColor: '#2B3139',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                                label: (context) => `$${context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2})}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: '#2B3139', drawBorder: false },
                            ticks: { color: '#848E9C', maxRotation: 0 }
                        },
                        y: {
                            grid: { color: '#2B3139', drawBorder: false },
                            ticks: {
                                color: '#848E9C',
                                callback: (value) => '$' + value.toLocaleString('en-US')
                            }
                        }
                    },
                    interaction: { intersect: false, mode: 'index' }
                }
            });
            
        } catch (error) {
            console.error('Error loading equity curve:', error);
        }
    }

    async loadPortfolio() {
        try {
            const portfolio = await window.API.getPortfolio();
            const container = document.getElementById('portfolio-list');
            if (!container) return;
            
            if (Object.keys(portfolio.positions).length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <div class="empty-title">Нет открытых позиций</div>
                        <div class="empty-text">Откройте позицию вручную или включите AI торговлю</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            for (const [symbol, pos] of Object.entries(portfolio.positions)) {
                const pnlClass = pos.pnl >= 0 ? 'profit' : 'loss';
                
                const card = document.createElement('div');
                card.className = 'position-card';
                card.innerHTML = `
                    <div class="position-header">
                        <div class="position-symbol">
                            <span class="coin-icon">💰</span>
                            ${symbol}
                        </div>
                        <div class="position-pnl ${pnlClass}">
                            ${pos.pnl >= 0 ? '📈' : '📉'} $${pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} (${pos.pnl_pct >= 0 ? '+' : ''}${pos.pnl_pct.toFixed(2)}%)
                        </div>
                    </div>
                    <div class="position-details">
                        <div class="detail-row">
                            <span class="detail-label">Количество:</span>
                            <span class="detail-value">${pos.amount.toFixed(6)} ${symbol}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Цена входа:</span>
                            <span class="detail-value">$${pos.entry_price.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Текущая цена:</span>
                            <span class="detail-value">$${(pos.current_value / pos.amount).toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Stop-Loss:</span>
                            <span class="detail-value loss">$${pos.stop_loss.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Take-Profit:</span>
                            <span class="detail-value profit">$${pos.take_profit.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="position-actions">
                        <button class="btn btn-sm btn-danger" onclick="app.closePosition('${symbol}')">
                            🔴 Закрыть позицию
                        </button>
                    </div>
                `;
                container.appendChild(card);
            }
            
        } catch (error) {
            console.error('Error loading portfolio:', error);
        }
    }

    async closePosition(symbol) {
        if (!confirm(`Закрыть позицию ${symbol}?`)) return;
        
        try {
            this.showLoading();
            const result = await window.API.request(`/trade/sell?symbol=${symbol}`, { method: 'POST' });
            
            if (result.success) {
                this.showNotification(result.message, 'success');
                await this.loadAllData();
            }
        } catch (error) {
            this.showError('Ошибка закрытия позиции');
        } finally {
            this.hideLoading();
        }
    }

    async loadSignals() {
        try {
            const data = await window.API.getSignals();
            const container = document.getElementById('signals-list');
            if (!container) return;
            
            if (!data.signals || data.signals.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📡</div>
                        <div class="empty-title">Нет сигналов</div>
                        <div class="empty-text">Добавьте монеты в мониторинг</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            for (const signal of data.signals) {
                const signalClass = signal.signal === 'BUY' ? 'buy' : signal.signal === 'SELL' ? 'sell' : 'hold';
                const trendClass = signal.trend === 'BULLISH' ? 'profit' : signal.trend === 'BEARISH' ? 'loss' : '';
                
                const card = document.createElement('div');
                card.className = 'signal-card';
                card.innerHTML = `
                    <div class="signal-header">
                        <div class="signal-symbol">
                            <span class="coin-icon">💎</span>
                            ${signal.symbol}
                        </div>
                        <div class="signal-badge ${signalClass}">${signal.signal}</div>
                    </div>
                    <div class="signal-details">
                        <div class="detail-row">
                            <span class="detail-label">Цена:</span>
                            <span class="detail-value">$${signal.price.toLocaleString('en-US')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Уверенность:</span>
                            <span class="detail-value">${signal.confidence}%</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Тренд:</span>
                            <span class="detail-value ${trendClass}">${signal.trend}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">RSI:</span>
                            <span class="detail-value">${signal.rsi}</span>
                        </div>
                    </div>
                    ${signal.signal !== 'HOLD' ? `
                        <button class="btn btn-sm btn-primary" onclick="app.buyCoin('${signal.symbol}', 100)">
                            💰 Купить
                        </button>
                    ` : ''}
                `;
                container.appendChild(card);
            }
            
        } catch (error) {
            console.error('Error loading signals:', error);
        }
    }

    async loadHistory() {
        try {
            const data = await window.API.getHistory(50);
            const container = document.getElementById('history-list');
            if (!container) return;
            
            if (!data.trades || data.trades.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📜</div>
                        <div class="empty-title">История пуста</div>
                        <div class="empty-text">Здесь появятся завершенные сделки</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            for (const trade of data.trades) {
                const pnlClass = trade.profit_usdt >= 0 ? 'profit' : 'loss';
                const emoji = trade.profit_usdt >= 0 ? '💚' : '❤️';
                
                const card = document.createElement('div');
                card.className = 'trade-card';
                card.innerHTML = `
                    <div class="trade-header">
                        <div class="trade-symbol">${emoji} ${trade.symbol}</div>
                        <div class="trade-pnl ${pnlClass}">
                            $${trade.profit_usdt >= 0 ? '+' : ''}${trade.profit_usdt.toFixed(2)}
                        </div>
                    </div>
                    <div class="trade-details">
                        <div class="detail-row">
                            <span class="detail-label">Вход:</span>
                            <span class="detail-value">$${trade.entry_price?.toFixed(2) || '—'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Выход:</span>
                            <span class="detail-value">$${trade.exit_price?.toFixed(2) || '—'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Прибыль:</span>
                            <span class="detail-value ${pnlClass}">${trade.profit_pct >= 0 ? '+' : ''}${trade.profit_pct?.toFixed(2) || '0.00'}%</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Время:</span>
                            <span class="detail-value">${this.formatTime(trade.close_time)}</span>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            }
            
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    async buyCoin(symbol, amount) {
        const amountInput = prompt(`Купить ${symbol}\nВведите сумму USDT:`, amount);
        if (!amountInput) return;
        
        try {
            this.showLoading();
            const result = await window.API.request('/trade/buy', {
                method: 'POST',
                body: JSON.stringify({
                    symbol: symbol,
                    amount_usdt: parseFloat(amountInput)
                })
            });
            
            if (result.success) {
                this.showNotification(result.message, 'success');
                await this.loadAllData();
            }
        } catch (error) {
            this.showError('Ошибка покупки');
        } finally {
            this.hideLoading();
        }
    }

    setupEventListeners() {
        // Tab switching
        const tabs = document.querySelectorAll('.nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                if (tabName) this.switchTab(tabName);
            });
        });
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadAllData();
                this.showNotification('Обновлено', 'success');
            });
        }
        
        // AI Toggle
        const aiToggleBtn = document.getElementById('toggle-ai-btn');
        if (aiToggleBtn) {
            aiToggleBtn.addEventListener('click', () => {
                this.toggleAI();
            });
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            const contentTab = content.id.replace('tab-', '');
            content.classList.toggle('active', contentTab === tabName);
        });
        
        // Load data for current tab
        this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
        const actions = {
            'overview': () => this.loadOverview(),
            'portfolio': () => this.loadPortfolio(),
            'signals': () => this.loadSignals(),
            'history': () => this.loadHistory()
        };
        
        if (actions[tabName]) {
            await actions[tabName]();
        }
    }

    async toggleAI() {
    try {
        // Сразу переключаем визуально
        const toggleBtn = document.getElementById('toggle-ai-btn');
        
        const result = await window.API.toggleAI();
        
        // Обновляем кнопку
        if (toggleBtn) {
            if (result.enabled) {
                toggleBtn.classList.add('active');
            } else {
                toggleBtn.classList.remove('active');
            }
        }
        
        this.showNotification(result.message, 'success');
        await this.loadOverview();
    } catch (error) {
        this.showError('Ошибка переключения AI');
    }
}

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadTabData(this.currentTab);
        }, 30000);
    }

    formatTime(timestamp) {
        if (!timestamp) return '—';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return `${diff} сек назад`;
        if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
        
        return date.toLocaleDateString('ru-RU');
    }

    showNotification(message, type = 'info') {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred(
                type === 'success' ? 'success' : type === 'error' ? 'error' : 'warning'
            );
        }
        alert(message);
    }

    showError(message) {
        this.showNotification(message, 'error');
        console.error(message);
    }
}

// Инициализация приложения
window.app = new TradingApp();
