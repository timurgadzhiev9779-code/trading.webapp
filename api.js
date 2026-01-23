// API Configuration
const API_BASE_URL_DEV = "https://твой-ngrok.ngrok-free.dev/api"; // Замени на свой ngrok URL
const API_BASE_URL_PROD = "https://trading-api-h3iq.onrender.com/api";

// Автоопределение окружения
const API_BASE_URL = window.Telegram?.WebApp ? API_BASE_URL_PROD : API_BASE_URL_DEV;

class TradingAPI {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.initData = window.Telegram?.WebApp?.initData || null;
    }

    /**
     * Generic request method
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            ...(this.initData && { 'X-Telegram-Init-Data': this.initData }),
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    /**
     * Получить данные портфеля
     */
    async getPortfolio() {
        return this.request('/portfolio');
    }

    /**
     * Получить сигналы
     */
    async getSignals() {
        return this.request('/signals');
    }

    /**
     * Получить историю сделок
     */
    async getHistory(limit = 50) {
        return this.request(`/history?limit=${limit}`);
    }

    /**
     * Получить equity curve
     */
    async getEquityCurve(days = 7) {
        return this.request(`/stats/daily?days=${days}`);
    }

    /**
     * Купить монету
     */
    async buyСoin(symbol, amountUsdt) {
        return this.request('/trade/buy', {
            method: 'POST',
            body: JSON.stringify({
                symbol,
                amount_usdt: amountUsdt
            })
        });
    }

    /**
     * Продать монету
     */
    async sellCoin(symbol) {
        return this.request(`/trade/sell?symbol=${symbol}`, {
            method: 'POST'
        });
    }

    /**
     * Переключить AI торговлю
     */
    async toggleAI() {
        return this.request('/toggle-ai', {
            method: 'POST'
        });
    }
}

// Экспортируем API
window.API = new TradingAPI(API_BASE_URL);

console.log('🚀 Trading Bot V2.0 initializing...');
console.log(`📡 API URL: ${API_BASE_URL}`);
