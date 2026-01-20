#!/usr/bin/env python3
"""
API Server for Telegram Mini App
Provides endpoints for the trading bot web interface
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional
import json
import os
from datetime import datetime
import sqlite3

app = FastAPI(title="Trading Bot API", version="1.0.0")

# CORS для Telegram Mini App
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Telegram WebApp
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Пути к файлам
PORTFOLIO_FILE = "portfolio.json"
DB_FILE = "portfolio.db"

# ==================== HELPER FUNCTIONS ====================

def load_portfolio():
    """Загрузить виртуальный портфель"""
    try:
        if os.path.exists(PORTFOLIO_FILE):
            with open(PORTFOLIO_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading portfolio: {e}")
    
    return {
        'balance_usdt': 10000,
        'positions': {},
        'history': [],
        'enabled': False
    }

def get_db_connection():
    """Получить соединение с БД"""
    return sqlite3.connect(DB_FILE)

def verify_telegram_user(init_data: str):
    """Проверить подлинность пользователя Telegram"""
    # TODO: Добавить реальную проверку через Telegram WebApp
    # Пока просто парсим user_id
    try:
        params = dict(x.split('=') for x in init_data.split('&'))
        user_id = params.get('user_id', '1')
        return int(user_id)
    except:
        return 1  # Default user для тестирования

# ==================== API ENDPOINTS ====================

@app.get("/")
async def root():
    """Health check"""
    return {"status": "ok", "message": "Trading Bot API is running"}

@app.get("/api/portfolio")
async def get_portfolio(x_telegram_init_data: Optional[str] = Header(None)):
    """
    Получить данные портфеля
    
    Returns:
        {
            "balance_usdt": float,
            "positions": {...},
            "total_value": float,
            "total_pnl": float,
            "total_pnl_pct": float,
            "enabled": bool
        }
    """
    try:
        portfolio = load_portfolio()
        
        # Рассчитываем общую стоимость
        total_position_value = 0
        positions_with_pnl = {}
        
        # Импортируем market для получения текущих цен
        try:
            from market_core import market
            
            for symbol, pos in portfolio['positions'].items():
                try:
                    price_data = market.get_price(symbol)
                    if price_data:
                        current_price = price_data['price']
                        current_value = pos['amount'] * current_price
                        entry_value = pos['amount'] * pos['entry_price']
                        pnl = current_value - entry_value
                        pnl_pct = (pnl / entry_value) * 100
                        
                        total_position_value += current_value
                        
                        positions_with_pnl[symbol] = {
                            **pos,
                            'current_price': current_price,
                            'current_value': current_value,
                            'pnl': pnl,
                            'pnl_pct': pnl_pct
                        }
                except Exception as e:
                    print(f"Error getting price for {symbol}: {e}")
                    positions_with_pnl[symbol] = pos
        except ImportError:
            positions_with_pnl = portfolio['positions']
        
        total_value = portfolio['balance_usdt'] + total_position_value
        total_pnl = total_value - 10000  # INITIAL_BALANCE
        total_pnl_pct = (total_pnl / 10000) * 100
        
        return {
            "balance_usdt": portfolio['balance_usdt'],
            "positions": positions_with_pnl,
            "positions_value": total_position_value,
            "total_value": total_value,
            "total_pnl": total_pnl,
            "total_pnl_pct": total_pnl_pct,
            "enabled": portfolio.get('enabled', False)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def get_history(limit: int = 20):
    """
    Получить историю сделок
    
    Args:
        limit: Количество последних сделок (default: 20)
    
    Returns:
        {
            "trades": [...],
            "stats": {
                "total_trades": int,
                "wins": int,
                "losses": int,
                "winrate": float,
                "total_pnl": float,
                "avg_pnl": float,
                "best_trade": float,
                "worst_trade": float
            }
        }
    """
    try:
        portfolio = load_portfolio()
        history = portfolio.get('history', [])
        
        # Последние N сделок
        recent_trades = history[-limit:] if len(history) > limit else history
        recent_trades.reverse()  # Новые сначала
        
        # Статистика
        if history:
            wins = sum(1 for t in history if t['profit_usdt'] > 0)
            losses = sum(1 for t in history if t['profit_usdt'] <= 0)
            total_trades = len(history)
            winrate = (wins / total_trades * 100) if total_trades > 0 else 0
            total_pnl = sum(t['profit_usdt'] for t in history)
            avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
            best_trade = max(t['profit_usdt'] for t in history)
            worst_trade = min(t['profit_usdt'] for t in history)
        else:
            wins = losses = total_trades = 0
            winrate = total_pnl = avg_pnl = best_trade = worst_trade = 0
        
        return {
            "trades": recent_trades,
            "stats": {
                "total_trades": total_trades,
                "wins": wins,
                "losses": losses,
                "winrate": winrate,
                "total_pnl": total_pnl,
                "avg_pnl": avg_pnl,
                "best_trade": best_trade,
                "worst_trade": worst_trade
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals")
async def get_signals(symbols: str = "BTC,ETH,BNB,SOL,XRP"):
    """
    Получить текущие торговые сигналы
    
    Args:
        symbols: Список символов через запятую
    
    Returns:
        {
            "signals": [
                {
                    "symbol": str,
                    "price": float,
                    "signal": "BUY|SELL|HOLD",
                    "confidence": int,
                    "trend": str,
                    "rsi": float
                }
            ]
        }
    """
    try:
        from market_core import market
        
        symbol_list = [s.strip() for s in symbols.split(',')]
        signals = []
        
        for symbol in symbol_list:
            try:
                analysis = market.analyze_market(symbol)
                if analysis:
                    signals.append({
                        "symbol": symbol,
                        "price": analysis['price'],
                        "signal": analysis['signal'],
                        "confidence": analysis['confidence'],
                        "trend": analysis['trend'],
                        "trend_strength": analysis['trend_strength'],
                        "rsi": analysis['indicators'].get('rsi', 0)
                    })
            except Exception as e:
                print(f"Error analyzing {symbol}: {e}")
                continue
        
        return {"signals": signals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chart/{symbol}")
async def get_chart_data(symbol: str, timeframe: str = "4h", limit: int = 100):
    """
    Получить данные для графика
    
    Args:
        symbol: Символ монеты (BTC, ETH, etc)
        timeframe: Таймфрейм (1h, 4h, 1d)
        limit: Количество свечей
    
    Returns:
        {
            "candles": [
                {
                    "timestamp": str,
                    "open": float,
                    "high": float,
                    "low": float,
                    "close": float,
                    "volume": float
                }
            ]
        }
    """
    try:
        from market_core import market
        
        df = market.get_candles(symbol, timeframe, limit)
        
        if df is None:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        
        # Конвертируем DataFrame в список словарей
        candles = []
        for idx, row in df.iterrows():
            candles.append({
                "timestamp": idx.isoformat(),
                "open": float(row['open']),
                "high": float(row['high']),
                "low": float(row['low']),
                "close": float(row['close']),
                "volume": float(row['volume'])
            })
        
        return {"candles": candles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/settings")
async def get_settings():
    """
    Получить настройки AI Trading
    
    Returns:
        {
            "position_size_pct": float,
            "stop_loss_pct": float,
            "take_profit_pct": float,
            "min_confidence": int,
            "enabled": bool
        }
    """
    try:
        portfolio = load_portfolio()
        
        return {
            "position_size_pct": 10,
            "stop_loss_pct": 2.3,
            "take_profit_pct": 3.3,
            "min_confidence": 75,
            "enabled": portfolio.get('enabled', False)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/toggle-ai")
async def toggle_ai_trading():
    """
    Включить/выключить AI Trading
    
    Returns:
        {
            "enabled": bool,
            "message": str
        }
    """
    try:
        portfolio = load_portfolio()
        portfolio['enabled'] = not portfolio.get('enabled', False)
        
        # Сохраняем
        with open(PORTFOLIO_FILE, 'w') as f:
            json.dump(portfolio, f, indent=2)
        
        status = "включена" if portfolio['enabled'] else "выключена"
        
        return {
            "enabled": portfolio['enabled'],
            "message": f"AI торговля {status}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats/daily")
async def get_daily_stats(days: int = 30):
    """
    Получить дневную статистику для графика equity
    
    Returns:
        {
            "equity_chart": [
                {"date": str, "value": float}
            ]
        }
    """
    try:
        portfolio = load_portfolio()
        history = portfolio.get('history', [])
        
        # Группируем сделки по дням
        daily_pnl = {}
        for trade in history:
            try:
                date = trade.get('close_time', '')[:10]  # YYYY-MM-DD
                if date:
                    if date not in daily_pnl:
                        daily_pnl[date] = 0
                    daily_pnl[date] += trade['profit_usdt']
            except:
                continue
        
        # Создаём equity curve
        equity_chart = []
        current_equity = 10000  # INITIAL_BALANCE
        
        sorted_dates = sorted(daily_pnl.keys())
        for date in sorted_dates:
            current_equity += daily_pnl[date]
            equity_chart.append({
                "date": date,
                "value": current_equity
            })
        
        # Добавляем текущее значение
        portfolio_data = load_portfolio()
        total_position_value = 0
        
        try:
            from market_core import market
            for symbol, pos in portfolio_data['positions'].items():
                price_data = market.get_price(symbol)
                if price_data:
                    total_position_value += pos['amount'] * price_data['price']
        except:
            pass
        
        current_total = portfolio_data['balance_usdt'] + total_position_value
        
        equity_chart.append({
            "date": datetime.now().strftime("%Y-%m-%d"),
            "value": current_total
        })
        
        return {"equity_chart": equity_chart}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== RUN SERVER ====================

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("🚀 Starting Trading Bot API Server")
    print("=" * 50)
    print("📡 URL: http://localhost:8000")
    print("📚 Docs: http://localhost:8000/docs")
    print("=" * 50)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
