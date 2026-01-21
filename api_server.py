from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PORTFOLIO_FILE = "portfolio.json"

def load_portfolio():
    if os.path.exists(PORTFOLIO_FILE):
        with open(PORTFOLIO_FILE, 'r') as f:
            return json.load(f)
    return {'balance_usdt': 10000, 'positions': {}, 'history': [], 'enabled': False}

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/api/portfolio")
def get_portfolio():
    data = load_portfolio()
    total_value = data['balance_usdt']
    total_pnl = total_value - 10000
    return {
        "balance_usdt": data['balance_usdt'],
        "positions": data.get('positions', {}),
        "positions_value": 0,
        "total_value": total_value,
        "total_pnl": total_pnl,
        "total_pnl_pct": (total_pnl / 10000) * 100,
        "enabled": data.get('enabled', False)
    }

@app.get("/api/history")
def get_history():
    data = load_portfolio()
    history = data.get('history', [])
    return {"trades": history[-20:][::-1], "stats": {"total_trades": len(history), "wins": 0, "losses": 0, "winrate": 0, "total_pnl": 0, "avg_pnl": 0, "best_trade": 0, "worst_trade": 0}}

@app.get("/api/signals")
def get_signals():
    return {"signals": []}

@app.get("/api/stats/daily")
def get_daily_stats():
    return {"equity_chart": [{"date": "2026-01-21", "value": 10000}]}
