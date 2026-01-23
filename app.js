// ==================== APP INITIALIZATION ====================

class TradingApp {
    constructor() {
        this.currentTab = 'overview';
        this.refreshInterval = null;
        this.chart = null;
        
        this.init();
    }

    async init() {
        console.log('🤖 Trading Bot V2.0 initializing...');
        
        // Initialize Telegram WebApp
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadTabData('overview');
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        console.log('✅ App initialized');
    }

    setupEventListeners() {
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadTabData(this.currentTab);
            });
        }
        
        // AI Toggle
        const toggleBtn = document.getElementById('toggle-ai-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleAI();
            });
        }
        
        // Chart period buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = e.target.dataset.period;
                this.loadEquityCurve(period);
                
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        this.currentTab = tabName;
        this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
        try {
            switch(tabName) {
                case 'overview':
                    await this.loadOverview();
                    break;
                case 'portfolio':
                    await this.loadPortfolio();
                    break;
                case 'signals':
                    await this.loadSignals();
                    break;
                case 'history':
                    await this.loadHistory();
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${tabName}:`, error);
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

    async loadEquityCurve(period = '7d') {
        try {
            const days = period === '7d' ? 7 : period === '30d' ? 30 : 365;
            const data = await window.API.getEquityCurve(days);
            
            const ctx = document.getElementById('equity-chart');
            if (!ctx) return;
            
            if (this.chart) {
                this.chart.destroy();
            }
            
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Equity',
                        data: data.values,
                        borderColor: '#0ECB81',
                        backgroundColor: 'rgba(14, 203, 129, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#848E9C',
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#848E9C'
                            }
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('Error loading equity curve:', error);
        }
    }

    // ==================== PORTFOLIO TAB ====================

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
            const result = await window.API.sellCoin(symbol);
            
            if (result.success) {
                alert(`✅ ${result.message}`);
                await this.loadPortfolio();
                await this.loadOverview();
            } else {
                alert(`❌ ${result.message}`);
            }
        } catch (error) {
            console.error('Error closing position:', error);
            alert('❌ Ошибка при закрытии позиции');
        }
    }

    // ==================== SIGNALS TAB ====================

    async loadSignals() {
        try {
            const data = await window.API.getSignals();
            const container = document.getElementById('signals-list');
            if (!container) return;
            
            if (!data.signals || data.signals.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📡</div>
                        <div class="empty-title">Нет активных сигналов</div>
                        <div class="empty-text">AI анализирует рынок и найдёт возможности для входа</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            for (const signal of data.signals) {
                const signalClass = signal.signal === 'BUY' ? 'signal-buy' : signal.signal === 'SELL' ? 'signal-sell' : 'signal-hold';
                const signalIcon = signal.signal === 'BUY' ? '🟢' : signal.signal === 'SELL' ? '🔴' : '🟡';
                
                const card = document.createElement('div');
                card.className = `signal-card ${signalClass}`;
                card.innerHTML = `
                    <div class="signal-header">
                        <div class="signal-symbol">
                            <span class="coin-icon">💎</span>
                            ${signal.symbol}
                        </div>
                        <div class="signal-badge">${signalIcon} ${signal.signal}</div>
                    </div>
                    <div class="signal-details">
                        <div class="detail-row">
                            <span class="detail-label">Цена:</span>
                            <span class="detail-value">$${signal.price.toLocaleString()}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Уверенность:</span>
                            <span class="detail-value">${signal.confidence}%</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Тренд:</span>
                            <span class="detail-value">${signal.trend} ${signal.trend_confirmed ? '✅' : '⚠️'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">RSI:</span>
                            <span class="detail-value">${signal.rsi.toFixed(2)}</span>
                        </div>
                    </div>
                    ${signal.signal === 'BUY' ? `
                    <div class="signal-actions">
                        <button class="btn btn-sm btn-primary" onclick="app.buyFromSignal('${signal.symbol}', ${signal.price})">
                            💰 Купить
                        </button>
                    </div>
                    ` : ''}
                `;
                container.appendChild(card);
            }
            
        } catch (error) {
            console.error('Error loading signals:', error);
        }
    }

    async buyFromSignal(symbol, price) {
        const amount = prompt(`Введите сумму в USDT для покупки ${symbol}:`, '100');
        if (!amount || isNaN(amount) || amount <= 0) return;
        
        try {
            const result = await window.API.buyCoin(symbol, parseFloat(amount));
            
            if (result.success) {
                alert(`✅ ${result.message}`);
                await this.loadPortfolio();
                await this.loadOverview();
            } else {
                alert(`❌ ${result.message}`);
            }
        } catch (error) {
            console.error('Error buying:', error);
            alert('❌ Ошибка при покупке');
        }
    }

    // ==================== HISTORY TAB ====================

    async loadHistory() {
        try {
            const data = await window.API.getHistory(50);
            const container = document.getElementById('history-list');
            if (!container) return;
            
            if (!data.history || data.history.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📜</div>
                        <div class="empty-title">История пуста</div>
                        <div class="empty-text">Здесь появится история ваших сделок</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            for (const trade of data.history) {
                const pnlClass = trade.pnl >= 0 ? 'profit' : 'loss';
                const emoji = trade.pnl >= 0 ? '📈' : '📉';
                
                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <div class="history-header">
                        <div class="history-symbol">
                            <span class="coin-icon">💰</span>
                            ${trade.symbol}
                        </div>
                        <div class="history-pnl ${pnlClass}">
                            ${emoji} $${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </div>
                    </div>
                    <div class="history-details">
                        <div class="detail-row">
                            <span class="detail-label">Дата:</span>
                            <span class="detail-value">${new Date(trade.timestamp).toLocaleString('ru-RU')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Вход:</span>
                            <span class="detail-value">$${trade.entry_price.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Выход:</span>
                            <span class="detail-value">$${trade.exit_price.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">P&L:</span>
                            <span class="detail-value ${pnlClass}">${trade.pnl_pct >= 0 ? '+' : ''}${trade.pnl_pct.toFixed(2)}%</span>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            }
            
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    // ==================== AI TOGGLE ====================

    async toggleAI() {
        try {
            const result = await window.API.toggleAI();
            
            if (result.success) {
                await this.loadOverview();
            }
        } catch (error) {
            console.error('Error toggling AI:', error);
        }
    }

    // ==================== AUTO REFRESH ====================

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadTabData(this.currentTab);
        }, 10000); // Обновление каждые 10 секунд
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize app
const app = new TradingApp();
