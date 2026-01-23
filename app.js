// ==================== TRADING BOT V2.0 - APP.JS ====================

let selectedSymbol = null;

class TradingApp {
    constructor() {
        this.currentTab = 'overview';
        this.refreshInterval = null;
        this.charts = {};

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        this.showLoading();

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }

        await this.loadAllData();
        this.hideLoading();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    showLoading() {
        document.getElementById('loading-screen')?.style.setProperty('display', 'flex');
    }

    hideLoading() {
        document.getElementById('loading-screen')?.style.setProperty('display', 'none');
        document.getElementById('app')?.style.setProperty('display', 'block');
    }

    async loadAllData() {
        await Promise.all([
            this.loadOverview(),
            this.loadPortfolio(),
            this.loadSignals(),
            this.loadHistory()
        ]);
    }

    // ==================== OVERVIEW ====================

    async loadOverview() {
        try {
            const portfolio = await window.API.getPortfolio();

            document.querySelector('.status-text').textContent = portfolio.enabled ? 'AI Включен' : 'AI Выключен';
            document.querySelector('.status-dot').style.backgroundColor = portfolio.enabled ? '#0ECB81' : '#848E9C';

            document.getElementById('toggle-ai-btn').classList.toggle('active', portfolio.enabled);

            document.getElementById('balance-value').textContent = `$${portfolio.balance_usdt.toFixed(2)}`;
            document.getElementById('positions-value').textContent = `$${portfolio.positions_value.toFixed(2)}`;
            document.getElementById('total-value').textContent = `$${portfolio.total_value.toFixed(2)}`;

            document.getElementById('positions-count').textContent = `${portfolio.positions_count} позиций`;

            await this.loadEquityCurve();

            const history = await window.API.getHistory(100);
            document.getElementById('stat-winrate').textContent = `${history.stats.winrate.toFixed(1)}%`;
            document.getElementById('stat-total-trades').textContent = history.stats.total_trades;
            document.getElementById('stat-wins').textContent = history.stats.wins;
            document.getElementById('stat-losses').textContent = history.stats.losses;

        } catch (e) {
            console.error(e);
        }
    }

    async loadEquityCurve() {
        try {
            const data = await window.API.getDailyStats();
            if (!data?.equity_chart?.length) return;

            const ctx = document.getElementById('equity-chart');
            if (!ctx) return;

            if (this.charts.equity) this.charts.equity.destroy();

            this.charts.equity = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.equity_chart.map(i => i.date),
                    datasets: [{
                        data: data.equity_chart.map(i => i.value),
                        borderColor: '#F0B90B',
                        fill: true
                    }]
                }
            });

        } catch (e) {
            console.error(e);
        }
    }

    // ==================== PORTFOLIO ====================

    async loadPortfolio() {
        const data = await window.API.getPortfolio();

        const list = document.getElementById('portfolio-list');
        const empty = document.getElementById('no-positions');

        list.innerHTML = '';

        if (!data.positions || Object.keys(data.positions).length === 0) {
            empty.style.display = 'flex';
            return;
        }

        empty.style.display = 'none';

        for (const [symbol, pos] of Object.entries(data.positions)) {
            const card = document.createElement('div');
            card.className = 'position-card';
            card.innerHTML = `
                <div class="position-symbol">💰 ${symbol}</div>
                <div>$${pos.pnl.toFixed(2)}</div>
            `;
            list.appendChild(card);
        }
    }

    // ==================== SIGNALS ====================

    async loadSignals() {
        const data = await window.API.getSignals();
        const list = document.getElementById('signals-list');

        list.innerHTML = '';

        if (!data.signals?.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📡</div>
                    <div class="empty-title">Нет сигналов</div>
                    <div class="empty-text">Добавьте монеты в мониторинг</div>
                </div>`;
            return;
        }

        data.signals.forEach(s => {
            const card = document.createElement('div');
            card.className = 'signal-card';
            card.innerHTML = `💎 ${s.symbol} — ${s.signal}`;
            list.appendChild(card);
        });
    }

    // ==================== HISTORY ====================

    async loadHistory() {
        const data = await window.API.getHistory(50);

        const list = document.getElementById('history-list');
        const empty = document.getElementById('no-history');

        list.innerHTML = '';

        if (!data.trades?.length) {
            empty.style.display = 'flex';
            return;
        }

        empty.style.display = 'none';

        data.trades.forEach(t => {
            const card = document.createElement('div');
            card.className = 'trade-card';
            card.innerHTML = `📜 ${t.symbol} — $${t.profit_usdt}`;
            list.appendChild(card);
        });
    }

    // ==================== UI ====================

    setupEventListeners() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', e => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        document.getElementById('refresh-btn')
            .addEventListener('click', () => this.loadAllData());
    }

    switchTab(tab) {
        document.querySelectorAll('.nav-tab').forEach(b =>
            b.classList.toggle('active', b.dataset.tab === tab)
        );

        document.querySelectorAll('.tab-content').forEach(c =>
            c.classList.toggle('active', c.id === `tab-${tab}`)
        );

        this.loadTabData(tab);
    }

    loadTabData(tab) {
        if (tab === 'portfolio') this.loadPortfolio();
        if (tab === 'signals') this.loadSignals();
        if (tab === 'history') this.loadHistory();
        if (tab === 'overview') this.loadOverview();
    }

    startAutoRefresh() {
        setInterval(() => this.loadTabData(this.currentTab), 10000);
    }
}

// ========== START ==========
window.app = new TradingApp();
