/**
 * API Client for Trading Bot Mini App
 * Handles all communication with the backend
 */

const API_BASE_URL = 'http://localhost:8000/api';

class TradingAPI {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.initData = null;
        
        // Инициализация Telegram WebApp
        if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
            this.tg = Telegram.WebApp;
            this.tg.ready();
            this.tg.expand();
            this.initData = this.tg.initData;
            
            // Настройка темы
            this.tg.setHeaderColor('#181A20');
            this.tg.setBackgroundColor('#0B0E11');
        }
    }

    /**
     * Базовый метод для запросов
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
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
     * Получить историю сделок
     */
    async getHistory(limit = 20) {
        return this.request(`/history?limit=${limit}`);
    }

    /**
     * Получить торговые сигналы
     */
    async getSignals(symbols = 'BTC,ETH,BNB,SOL,XRP,ADA,AVAX,DOT') {
        return this.request(`/signals?symbols=${symbols}`);
    }

    /**
     * Получить данные для графика
     */
    async getChartData(symbol, timeframe = '4h', limit = 100) {
        return this.request(`/chart/${symbol}?timeframe=${timeframe}&limit=${limit}`);
    }

    /**
     * Получить настройки
     */
    async getSettings() {
        return this.request('/settings');
    }

    /**
     * Переключить AI Trading
     */
    async toggleAI() {
        return this.request('/toggle-ai', {
            method: 'POST'
        });
    }

    /**
     * Получить дневную статистику для equity curve
     */
    async getDailyStats(days = 30) {
        return this.request(`/stats/daily?days=${days}`);
    }

    /**
     * Показать уведомление через Telegram
     */
    showNotification(message) {
        if (this.tg && this.tg.showAlert) {
            this.tg.showAlert(message);
        } else {
            alert(message);
        }
    }

    /**
     * Показать всплывающее уведомление
     */
    showPopup(message, type = 'info') {
        if (this.tg && this.tg.showPopup) {
            this.tg.showPopup({
                title: type === 'success' ? '✅ Успешно' : 'ℹ️ Информация',
                message: message,
                buttons: [{type: 'ok'}]
            });
        } else {
            this.showNotification(message);
        }
    }

    /**
     * Вибрация (если поддерживается)
     */
    vibrate(style = 'medium') {
        if (this.tg && this.tg.HapticFeedback) {
            this.tg.HapticFeedback.impactOccurred(style);
        }
    }
}

// Создаём глобальный экземпляр API
window.API = new TradingAPI();
