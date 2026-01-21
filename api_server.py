#!/usr/bin/env python3
"""
API SERVER V2.0 - PROFESSIONAL EDITION
Расширенный API для управления торговлей и аналитикой
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import asyncio

app = FastAPI(title="Trading Bot API v2.0", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== DATA MODELS ====================

class TradeRequest(BaseModel):
    symbol: str
    amount_usdt: float
    
class MonitoringCoin(BaseModel):
    symbol: str
    enabled: bool = True

class PositionUpdate(BaseModel):
    symbol: str
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

# ==================== FILE PATHS ====================

PORTFOLIO_FILE = "portfolio.json"
MONITORING_FILE = "monitoring.json"
SETTINGS_FILE = "settings.json"
SIGNALS_LOG_FILE = "signals_log.json"

# ==================== HELPER FUNCTIONS ====================

def load_json(filepath: str, default: dict) -> dict:
    """Загрузить JSON файл"""
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return default

def save_json(filepath: str, data: dict):
    """Сохранить JSON файл"""
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
    return load_json(MONITORING_FILE, {'coins': []})

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

def load_signals_log():
    return load_json(SIGNALS_LOG_FILE, {'signals': []})

def save_signals_log(data):
    save_json(SIGNALS_LOG_FILE, data)

# ==================== API ENDPOINTS ====================

@app.get("/")
def root():
    return {
        "status": "ok",
        "version": "2.0.0",
        "message": "Trading Bot API v2.0 - Professional Edition",
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
def get_portfolio():
    """Получить полный портфель"""
    data = load_portfolio()
    
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
    
    # Группировка по дням
    daily_stats = {}
    for trade in history:
        date = trade.get('close_time', '')[:10]
        if date:
            if date not in daily_stats:
                daily_stats[date] = {'trades': 0, 'profit': 0}
            daily_stats[date]['trades'] += 1
            daily_stats[date]['profit'] += trade.get('profit_usdt', 0)
    
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
            "worst_trade": min([t.get('profit_usdt', 0) for t in history]) if history else 0,
            "avg_win": sum([t.get('profit_usdt', 0) for t in history if t.get('profit_usdt', 0) > 0]) / wins if wins > 0 else 0,
            "avg_loss": sum([t.get('profit_usdt', 0) for t in history if t.get('profit_usdt', 0) < 0]) / losses if losses > 0 else 0
        },
        "daily_stats": daily_stats
    }

@app.get("/api/stats/daily")
def get_daily_stats(days: int = 30):
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
        portfolio = get_portfolio()
        equity_data.append({
            "date": today,
            "value": round(portfolio['total_value'], 2),
            "change": 0
        })
    
    return {"equity_chart": equity_data}

@app.get("/api/stats/advanced")
def get_advanced_stats():
    """Расширенная статистика"""
    data = load_portfolio()
    history = data.get('history', [])
    
    if not history:
        return {
            "sharpe_ratio": 0,
            "max_drawdown": 0,
            "profit_factor": 0,
            "avg_trade_duration": 0,
            "best_coin": None,
            "worst_coin": None
        }
    
    # Sharpe Ratio (упрощенный)
    returns = [t.get('profit_pct', 0) for t in history]
    avg_return = sum(returns) / len(returns)
    std_return = (sum([(r - avg_return)**2 for r in returns]) / len(returns)) ** 0.5
    sharpe_ratio = (avg_return / std_return) if std_return > 0 else 0
    
    # Max Drawdown
    equity = 10000
    peak = 10000
    max_dd = 0
    for trade in history:
        equity += trade.get('profit_usdt', 0)
        if equity > peak:
            peak = equity
        dd = ((peak - equity) / peak) * 100
        max_dd = max(max_dd, dd)
    
    # Profit Factor
    gross_profit = sum([t.get('profit_usdt', 0) for t in history if t.get('profit_usdt', 0) > 0])
    gross_loss = abs(sum([t.get('profit_usdt', 0) for t in history if t.get('profit_usdt', 0) < 0]))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    # Анализ по монетам
    coin_stats = {}
    for trade in history:
        symbol = trade.get('symbol', 'UNKNOWN')
        if symbol not in coin_stats:
            coin_stats[symbol] = {'trades': 0, 'profit': 0}
        coin_stats[symbol]['trades'] += 1
        coin_stats[symbol]['profit'] += trade.get('profit_usdt', 0)
    
    best_coin = max(coin_stats.items(), key=lambda x: x[1]['profit'])[0] if coin_stats else None
    worst_coin = min(coin_stats.items(), key=lambda x: x[1]['profit'])[0] if coin_stats else None
    
    return {
        "sharpe_ratio": round(sharpe_ratio, 2),
        "max_drawdown": round(max_dd, 2),
        "profit_factor": round(profit_factor, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "best_coin": best_coin,
        "worst_coin": worst_coin,
        "coin_stats": coin_stats
    }

# ==================== SIGNALS ====================

@app.get("/api/signals")
def get_signals():
    """Получить текущие торговые сигналы"""
    monitoring = load_monitoring()
    coins = monitoring.get('coins', [])
    
    # Пример сигналов (заменить на реальные)
    signals_data = []
    
    demo_signals = [
        {"symbol": "BTC", "price": 95450, "signal": "BUY", "confidence": 82, "trend": "BULLISH", "rsi": 45, "trend_strength": "STRONG"},
        {"symbol": "ETH", "price": 2380, "signal": "SELL", "confidence": 76, "trend": "BEARISH", "rsi": 72, "trend_strength": "MODERATE"},
        {"symbol": "SOL", "price": 112.5, "signal": "HOLD", "confidence": 55, "trend": "NEUTRAL", "rsi": 58, "trend_strength": "WEAK"},
        {"symbol": "BNB", "price": 315, "signal": "BUY", "confidence": 78, "trend": "BULLISH", "rsi": 42, "trend_strength": "STRONG"},
        {"symbol": "XRP", "price": 0.58, "signal": "HOLD", "confidence": 62, "trend": "NEUTRAL", "rsi": 51, "trend_strength": "WEAK"},
    ]
    
    for signal in demo_signals:
        if not coins or signal['symbol'] in coins:
            signals_data.append(signal)
    
    return {"signals": signals_data}

@app.get("/api/signals/history")
def get_signals_history(limit: int = 50):
    """История всех сигналов"""
    log = load_signals_log()
    signals = log.get('signals', [])
    return {"signals": signals[-limit:][::-1]}

# ==================== MONITORING ====================

@app.get("/api/monitoring")
def get_monitoring():
    """Список монет в мониторинге"""
    data = load_monitoring()
    return {"coins": data.get('coins', [])}

@app.post("/api/monitoring/add")
def add_monitoring_coin(coin: MonitoringCoin):
    """Добавить монету в мониторинг"""
    data = load_monitoring()
    coins = data.get('coins', [])
    
    if coin.symbol not in coins:
        coins.append(coin.symbol)
        data['coins'] = coins
        save_monitoring(data)
    
    return {"success": True, "coins": coins}

@app.post("/api/monitoring/remove")
def remove_monitoring_coin(symbol: str):
    """Удалить монету из мониторинга"""
    data = load_monitoring()
    coins = data.get('coins', [])
    
    if symbol in coins:
        coins.remove(symbol)
        data['coins'] = coins
        save_monitoring(data)
    
    return {"success": True, "coins": coins}

# ==================== TRADING ====================

@app.post("/api/trade/buy")
def manual_buy(trade: TradeRequest):
    """Ручная покупка"""
    data = load_portfolio()
    
    if trade.amount_usdt > data['balance_usdt']:
        raise HTTPException(400, detail="Недостаточно средств")
    
    # Симуляция цены (заменить на реальную)
    price_map = {'BTC': 95450, 'ETH': 2380, 'SOL': 112.5, 'BNB': 315, 'XRP': 0.58}
    price = price_map.get(trade.symbol, 100)
    
    coin_amount = trade.amount_usdt / price
    
    # Вычитаем баланс
    data['balance_usdt'] -= trade.amount_usdt
    
    # Добавляем позицию
    settings = load_settings()
    data.setdefault('positions', {})[trade.symbol] = {
        "amount": coin_amount,
        "entry_price": price,
        "stop_loss": price * (1 - settings['stop_loss_pct']/100),
        "take_profit": price * (1 + settings['take_profit_pct']/100),
        "entry_time": datetime.now().isoformat(),
        "entry_value": trade.amount_usdt
    }
    
    save_portfolio(data)
    
    return {
        "success": True,
        "message": f"✅ Куплено {coin_amount:.6f} {trade.symbol} по ${price:.2f}"
    }

@app.post("/api/trade/sell")
def manual_sell(symbol: str):
    """Ручная продажа"""
    data = load_portfolio()
    
    if symbol not in data.get('positions', {}):
        raise HTTPException(400, detail="Позиция не найдена")
    
    pos = data['positions'][symbol]
    
    # Симуляция текущей цены
    price_map = {'BTC': 96500, 'ETH': 2420, 'SOL': 115, 'BNB': 320, 'XRP': 0.60}
    current_price = price_map.get(symbol, pos['entry_price'] * 1.02)
    
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

@app.post("/api/position/update")
def update_position(update: PositionUpdate):
    """Обновить Stop-Loss / Take-Profit"""
    data = load_portfolio()
    
    if update.symbol not in data.get('positions', {}):
        raise HTTPException(400, detail="Позиция не найдена")
    
    pos = data['positions'][update.symbol]
    
    if update.stop_loss is not None:
        pos['stop_loss'] = update.stop_loss
    
    if update.take_profit is not None:
        pos['take_profit'] = update.take_profit
    
    save_portfolio(data)
    
    return {"success": True, "message": "✅ Позиция обновлена"}

# ==================== SETTINGS ====================

@app.get("/api/settings")
def get_settings():
    """Получить настройки"""
    return load_settings()

@app.post("/api/settings")
def update_settings(settings: dict):
    """Обновить настройки"""
    current = load_settings()
    current.update(settings)
    save_settings(current)
    return {"success": True, "settings": current}

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

# ==================== EXPORT ====================

@app.get("/api/export/trades")
def export_trades():
    """Экспорт сделок в CSV формат"""
    data = load_portfolio()
    history = data.get('history', [])
    
    csv_data = "Symbol,Entry Price,Exit Price,Amount,Profit USDT,Profit %,Entry Time,Exit Time\n"
    
    for trade in history:
        csv_data += f"{trade.get('symbol','')},{trade.get('entry_price',0)},{trade.get('exit_price',0)},"
        csv_data += f"{trade.get('amount',0)},{trade.get('profit_usdt',0)},{trade.get('profit_pct',0)},"
        csv_data += f"{trade.get('entry_time','')},{trade.get('close_time','')}\n"
    
    return {"csv": csv_data, "filename": f"trades_{datetime.now().strftime('%Y%m%d')}.csv"}

# ==================== RUN SERVER ====================

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("🚀 TRADING BOT API V2.0 - PROFESSIONAL EDITION")
    print("=" * 60)
    print("📡 URL: http://localhost:8000")
    print("📚 Docs: http://localhost:8000/docs")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
