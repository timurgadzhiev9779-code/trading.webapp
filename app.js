// ==================== TRADING BOT V2.0 - APP.JS ====================

import API from './api.js';

class TradingApp {
    constructor() {
        this.currentTab = 'overview';
        this.refreshInterval = null;
        this.charts = {};
        this.init();
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
            const portfolio = await API.getPortfolio();
            
            // AI статус
            const aiStatusEl = document.getElementById('ai-status');
            aiStatusEl.className = portfolio.enabled ? 'status-badge active' : 'status-badge inactive';
            aiStatusEl.textContent = portfolio.enabled ? '🟢 AI Включен' : '⚪ AI Выключен';
            
            // Баланс
            document.getElementById('balance-usdt').textContent = `$${portfolio.balance_usdt.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            document.getElementById('positions-value').textContent = `$${portfolio.positions_value.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            document.getElementById('total-value').textContent = `$${portfolio.total_value.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            
            // P&L
            const pnlEl = document.getElementById('total-pnl');
            pnlEl.className = portfolio.total_pnl >= 0 ? 'stat-value profit' : 'stat-value loss';
            pnlEl.textContent = `$${portfolio.total_pnl >= 0 ? '+' : ''}${portfolio.total_pnl.toFixed(2)} (${portfolio.total_pnl_pct >= 0 ? '+' : ''}${portfolio.total_pnl_pct.toFixed(2)}%)`;
            
            // График
            await this.loadEquityCurve();
            
            // Статистика
            const history = await API.getHistory(100);
            document.getElementById('stat-winrate').textContent = `${history.stats.winrate.toFixed(1)}%`;
            document.getElementById('stat-trades').textContent = history.stats.total_trades;
            document.getElementById('stat-wins').textContent = history.stats.wins;
            document.getElementById('stat-losses').textContent = history.stats.losses;
            
        } catch (error) {
            console.error('Error loading overview:', error);
        }
    }

    async loadEquityCurve() {
        try {
            const data = await API.getDailyStats();
            
            if (!data.equity_chart || data.equity_chart.length === 0) return;
            
            const labels = data.equity_chart.map(item => {
                const date = new Date(item.date);
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            
            const values = data.equity_chart.map(item => item.value);
            
            if (this.charts.equity) {
                this.charts.equity.destroy();
            }
            
            const ctx = document.getElementById('equity-chart').getContext('2d');
            this.charts.equity = new Chart(ctx, {
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
            const portfolio = await API.getPortfolio();
            const container = document.getElementById('positions-list');
            
            if (Object.keys(portfolio.positions).length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <div class="empty-text">Нет открытых позиций</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = '';
            
            for (const [symbol, pos] of Object.entries(portfolio.positions)) {
                const pnlClass = pos.pnl >= 0 ? 'profit' : 'loss';
                
                const card = document.createElement('div');
                card.className = `position-card ${pnlClass}`;
                card.innerHTML = `
                    <div class="position-header">
                        <div class="position-symbol">💰 ${symbol}</div>
                        <div class="position-pnl ${pnlClass}">
                            ${pos.pnl >= 0 ? '📈' : '📉'} $${pos.pnl.toFixed(2)} (${pos.pnl_pct.toFixed(2)}%)
                        </div>
                    </div>
                    <div class="position-details">
                        <div class="detail-row">
                            <span>Количество:</span>
                            <span>${pos.amount.toFixed(6)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Вход:</span>
                            <span>$${pos.entry_price.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Текущая:</span>
                            <span>$${(pos.current_value / pos.amount).toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span>SL:</span>
                            <span class="loss">$${pos.stop_loss.toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span>TP:</span>
                            <span class="profit">$${pos.take_profit.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="position-actions">
                        <button class="btn btn-small btn-danger" onclick="app.closePosition('${symbol}')">
                            🔴 Закрыть
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
            const result = await API.sellCoin(symbol);
            
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
            const data = await API.getSignals();
            const container = document.getElementById('signals-list');
            
            if (!data.signals || data.signals.length === 0) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">📡</div><div class="empty-text">Нет сигналов</div></div>`;
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
                        <div class="signal-symbol">💎 ${signal.symbol}</div>
                        <div class="signal-badge ${signalClass}">${signal.signal}</div>
                    </div>
                    <div class="signal-details">
                        <div class="detail-row"><span>Цена:</span><span>$${signal.price.toLocaleString('en-US')}</span></div>
                        <div class="detail-row"><span>Уверенность:</span><span>${signal.confidence}%</span></div>
                        <div class="detail-row"><span>Тренд:</span><span class="${trendClass}">${signal.trend}</span></div>
                        <div class="detail-row"><span>RSI:</span><span>${signal.rsi}</span></div>
                    </div>
                    ${signal.signal !== 'HOLD' ? `<button class="btn btn-small btn-primary" onclick="app.buyCoin('${signal.symbol}', 100)">💰 Купить</button>` : ''}
                `;
                container.appendChild(card);
            }
            
        } catch (error) {
            console.error('Error loading signals:', error);
        }
    }

    async loadHistory() {
        try {
            const data = await API.getHistory(50);
            const container = document.getElementById('history-list');
            
            if (!data.trades || data.trades.length === 0) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-text">История пуста</div></div>`;
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
                        <div>${emoji} ${trade.symbol}</div>
                        <div class="${pnlClass}">$${trade.profit_usdt.toFixed(2)}</div>
                    </div>
                    <div class="trade-details">
                        <div class="detail-row"><span>Вход:</span><span>$${trade.entry_price?.toFixed(2) || '—'}</span></div>
                        <div class="detail-row"><span>Выход:</span><span>$${trade.exit_price?.toFixed(2) || '—'}</span></div>
                        <div class="detail-row"><span>Прибыль:</span><span class="${pnlClass}">${trade.profit_pct?.toFixed(2) || '0'}%</span></div>
                        <div class="detail-row"><span>Время:</span><span>${this.formatTime(trade.close_time)}</span></div>
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
            const result = await API.buyCoin(symbol, parseFloat(amountInput));
            
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
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadAllData();
            this.showNotification('Обновлено', 'success');
        });
        
        document.getElementById('ai-toggle-btn').addEventListener('click', () => {
            this.toggleAI();
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
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
            const result = await API.toggleAI();
            this.showNotification(result.message, 'success');
            await this.loadOverview();
        } catch (error) {
            this.showError('Ошибка AI');
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
    }
}

window.app = new TradingApp();
