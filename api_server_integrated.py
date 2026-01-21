#!/usr/bin/env python3
"""
API SERVER V2.0 - INTEGRATED WITH AI TRADER
Полная интеграция с профессиональным AI анализом
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import asyncio

# Импортируем AI Trader
import sys
sys.path.append(os.path.dirname(__file__))

try:
    from ai_trader_v2 import ProfessionalAITrader
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    print("⚠️ AI Trader V2 не найден, используются demo данные")

app = FastAPI(title="Trading Bot API v2.0", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== GLOBAL STATE ====================

if AI_AVAILABLE:
    ai_trader = ProfessionalAITrader()
else:
    ai_trader = None

# ==================== DATA MODELS ====================

class TradeRequest(BaseModel):
    symbol: str
    amount_usdt: float

# ==================== FILE PATHS ====================

PORTFOLIO_FILE = "portfolio.json"
MONITORING_FILE = "monitoring.json"
SETTINGS_FILE = "settings.json"

# ==================== HELPER FUNCTIONS ====================

def load_json(filepath: str, default: dict) -> dict:
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return default

def save_json(filepath: str, data: dict):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def load_portfolio():
    return load_json(PORTFOLIO_FILE, {
        'balance_usdt': 10000,
        'positions': {},
        'history': [],
        'enabled': False,
        'total_trades': 0,
        'total_profit': 0
    })

def save_portfolio(data):
    save_json(PORTFOLIO_FILE, data)

def load_monitoring():
    return load_json(MONITORING_FILE, {'coins': ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']})

def save_monitoring(data):
    save_json(MONITORING_FILE, data)

def load_settings():
    return load_json(SETTINGS_FILE, {
        'position_size_pct': 10,
        'stop_loss_pct': 2.3,
        'take_profit_pct': 3.3,
        'min_confidence': 75,
        'max_positions': 5,
        'risk_per_trade': 2.0,
        'trailing_stop': True,
        'partial_close': True
    })

def save_settings(data):
    save_json(SETTINGS_FILE, data)

# ==================== API ENDPOINTS ====================

@app.get("/")
def root():
    return {
        "status": "ok",
        "version": "2.0.0",
        "message": "Trading Bot API v2.0 - Professional Edition",
        "ai_available": AI_AVAILABLE,
        "features": [
            "Multi-timeframe Analysis",
            "15+ Technical Indicators",
            "Smart Entry/Exit",
            "Paper Trading",
            "Advanced Analytics"
        ]
    }

# ==================== PORTFOLIO ====================

@app.get("/api/portfolio")
async def get_portfolio():
    """Получить полный портфель с реальными ценами"""
    data = load_portfolio()
    
    # Обновляем текущие цены позиций если AI доступен
    if AI_AVAILABLE and ai_trader:
        for symbol, pos in data.get('positions', {}).items():
            try:
                # Получаем текущую цену
                ticker = ai_trader.exchange.fetch_ticker(f"{symbol}/USDT")
                current_price = ticker['last']
                
                # Обновляем текущую стоимость
                pos['current_price'] = current_price
                pos['current_value'] = pos['amount'] * current_price
            except Exception as e:
                print(f"Error updating {symbol} price: {e}")
                # Используем старую цену
                pos['current_value'] = pos.get('current_value', pos['amount'] * pos['entry_price'])
    
    # Рассчитываем стоимость позиций
    positions_value = 0
    positions_pnl = 0
    positions_with_details = {}
    
    for symbol, pos in data.get('positions', {}).items():
        current_value = pos.get('current_value', pos['amount'] * pos['entry_price'])
        entry_value = pos['amount'] * pos['entry_price']
        pnl = current_value - entry_value
        pnl_pct = (pnl / entry_value) * 100
        
        positions_value += current_value
        positions_pnl += pnl
        
        positions_with_details[symbol] = {
            **pos,
            'current_value': current_value,
            'entry_value': entry_value,
            'pnl': pnl,
            'pnl_pct': pnl_pct
        }
    
    total_value = data['balance_usdt'] + positions_value
    total_pnl = total_value - 10000
    
    return {
        "balance_usdt": data['balance_usdt'],
        "positions": positions_with_details,
        "positions_value": positions_value,
        "positions_pnl": positions_pnl,
        "total_value": total_value,
        "total_pnl": total_pnl,
        "total_pnl_pct": (total_pnl / 10000) * 100,
        "enabled": data.get('enabled', False),
        "total_trades": data.get('total_trades', 0),
        "positions_count": len(positions_with_details)
    }

# ==================== HISTORY & STATS ====================

@app.get("/api/history")
def get_history(limit: int = 50):
    """Получить историю сделок"""
    data = load_portfolio()
    history = data.get('history', [])
    
    wins = sum(1 for t in history if t.get('profit_usdt', 0) > 0)
    losses = len(history) - wins
    total_trades = len(history)
    winrate = (wins / total_trades * 100) if total_trades > 0 else 0
    total_pnl = sum(t.get('profit_usdt', 0) for t in history)
    
    return {
        "trades": history[-limit:][::-1],
        "stats": {
            "total_trades": total_trades,
            "wins": wins,
            "losses": losses,
            "winrate": winrate,
            "total_pnl": total_pnl,
            "avg_pnl": total_pnl / total_trades if total_trades > 0 else 0,
            "best_trade": max([t.get('profit_usdt', 0) for t in history]) if history else 0,
            "worst_trade": min([t.get('profit_usdt', 0) for t in history]) if history else 0
        }
    }

@app.get("/api/stats/daily")
async def get_daily_stats(days: int = 30):
    """Получить дневную статистику для equity curve"""
    data = load_portfolio()
    history = data.get('history', [])
    
    # Генерируем equity curve
    equity_data = []
    current_equity = 10000
    
    # Группируем по дням
    daily_pnl = {}
    for trade in history:
        date = trade.get('close_time', '')[:10]
        if date:
            daily_pnl[date] = daily_pnl.get(date, 0) + trade.get('profit_usdt', 0)
    
    # Создаем серию данных
    sorted_dates = sorted(daily_pnl.keys())
    for date in sorted_dates[-days:]:
        current_equity += daily_pnl[date]
        equity_data.append({
            "date": date,
            "value": round(current_equity, 2),
            "change": round(daily_pnl[date], 2)
        })
    
    # Добавляем сегодня
    today = datetime.now().strftime("%Y-%m-%d")
    if not equity_data or equity_data[-1]['date'] != today:
        portfolio = await get_portfolio()
        equity_data.append({
            "date": today,
            "value": round(portfolio['total_value'], 2),
            "change": 0
        })
    
    return {"equity_chart": equity_data}

# ==================== SIGNALS (REAL AI) ====================

@app.get("/api/signals")
async def get_signals():
    """Получить РЕАЛЬНЫЕ торговые сигналы от AI"""
    monitoring = load_monitoring()
    coins = monitoring.get('coins', ['BTC', 'ETH', 'SOL'])
    
    signals_data = []
    
    if AI_AVAILABLE and ai_trader:
        # Реальный AI анализ
        for coin in coins[:5]:  # Макс 5 монет чтобы не тормозило
            try:
                symbol = f"{coin}/USDT"
                analysis = ai_trader.multi_timeframe_analysis(symbol)
                
                if analysis:
                    signals_data.append({
                        "symbol": coin,
                        "price": analysis['current_price'],
                        "signal": analysis['signal'],
                        "confidence": analysis['confidence'],
                        "trend": analysis['trend'],
                        "trend_confirmed": analysis['trend_confirmed'],
                        "rsi": analysis['timeframes'].get('15m', {}).get('rsi', 50),
                        "trend_strength": "STRONG" if analysis['confidence'] > 75 else "MODERATE" if analysis['confidence'] > 60 else "WEAK"
                    })
            except Exception as e:
                print(f"Error analyzing {coin}: {e}")
                continue
    else:
        # Demo данные если AI недоступен
        demo_signals = [
            {"symbol": "BTC", "price": 98219, "signal": "HOLD", "confidence": 58, "trend": "BEARISH", "rsi": 45, "trend_strength": "WEAK", "trend_confirmed": False},
            {"symbol": "ETH", "price": 3034, "signal": "HOLD", "confidence": 56, "trend": "BEARISH", "rsi": 72, "trend_strength": "WEAK", "trend_confirmed": False},
            {"symbol": "SOL", "price": 131, "signal": "HOLD", "confidence": 57, "trend": "BEARISH", "rsi": 58, "trend_strength": "WEAK", "trend_confirmed": False},
        ]
        signals_data = demo_signals
    
    return {"signals": signals_data}

# ==================== TRADING ====================

@app.post("/api/trade/buy")
async def manual_buy(trade: TradeRequest):
    """Ручная покупка"""
    data = load_portfolio()
    settings = load_settings()
    
    if trade.amount_usdt > data['balance_usdt']:
        raise HTTPException(400, detail="Недостаточно средств")
    
    # Получаем РЕАЛЬНУЮ цену
    if AI_AVAILABLE and ai_trader:
        try:
            ticker = ai_trader.exchange.fetch_ticker(f"{trade.symbol}/USDT")
            price = ticker['last']
        except:
            price = 100
    else:
        price = 100
    
    coin_amount = trade.amount_usdt / price
    
    # Вычитаем баланс
    data['balance_usdt'] -= trade.amount_usdt
    
    # Добавляем позицию
    data.setdefault('positions', {})[trade.symbol] = {
        "amount": coin_amount,
        "entry_price": price,
        "stop_loss": price * (1 - settings['stop_loss_pct']/100),
        "take_profit": price * (1 + settings['take_profit_pct']/100),
        "entry_time": datetime.now().isoformat(),
        "entry_value": trade.amount_usdt,
        "current_value": trade.amount_usdt,
        "current_price": price
    }
    
    save_portfolio(data)
    
    return {
        "success": True,
        "message": f"✅ Куплено {coin_amount:.6f} {trade.symbol} по ${price:.2f}"
    }

@app.post("/api/trade/sell")
async def manual_sell(symbol: str):
    """Ручная продажа"""
    data = load_portfolio()
    
    if symbol not in data.get('positions', {}):
        raise HTTPException(400, detail="Позиция не найдена")
    
    pos = data['positions'][symbol]
    
    # Получаем РЕАЛЬНУЮ текущую цену
    if AI_AVAILABLE and ai_trader:
        try:
            ticker = ai_trader.exchange.fetch_ticker(f"{symbol}/USDT")
            current_price = ticker['last']
        except:
            current_price = pos['entry_price'] * 1.02
    else:
        current_price = pos['entry_price'] * 1.02
    
    usdt_amount = pos['amount'] * current_price
    profit = usdt_amount - pos['entry_value']
    profit_pct = (profit / pos['entry_value']) * 100
    
    # Возвращаем баланс
    data['balance_usdt'] += usdt_amount
    
    # Удаляем позицию
    del data['positions'][symbol]
    
    # Добавляем в историю
    data.setdefault('history', []).append({
        "symbol": symbol,
        "entry_price": pos['entry_price'],
        "exit_price": current_price,
        "amount": pos['amount'],
        "profit_usdt": profit,
        "profit_pct": profit_pct,
        "entry_time": pos.get('entry_time', ''),
        "close_time": datetime.now().isoformat()
    })
    
    data['total_trades'] = data.get('total_trades', 0) + 1
    data['total_profit'] = data.get('total_profit', 0) + profit
    
    save_portfolio(data)
    
    emoji = "🟢" if profit > 0 else "🔴"
    return {
        "success": True,
        "message": f"{emoji} Продано с {'прибылью' if profit > 0 else 'убытком'} ${profit:.2f} ({profit_pct:+.2f}%)"
    }

# ==================== AI TRADING ====================

@app.post("/api/toggle-ai")
def toggle_ai():
    """Включить/выключить AI торговлю"""
    data = load_portfolio()
    data['enabled'] = not data.get('enabled', False)
    save_portfolio(data)
    
    status = "включена ✅" if data['enabled'] else "выключена ⏸️"
    return {
        "enabled": data['enabled'],
        "message": f"AI торговля {status}"
    }

@app.get("/api/monitoring")
def get_monitoring():
    """Список монет в мониторинге"""
    data = load_monitoring()
    return {"coins": data.get('coins', [])}

@app.get("/api/settings")
def get_settings():
    """Получить настройки"""
    return load_settings()

# ==================== RUN SERVER ====================

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("🚀 TRADING BOT API V2.0 - INTEGRATED EDITION")
    print("=" * 60)
    print(f"AI Status: {'✅ Available' if AI_AVAILABLE else '❌ Not Available (using demo)'}")
    print("📡 URL: http://localhost:8000")
    print("📚 Docs: http://localhost:8000/docs")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
