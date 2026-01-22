#!/usr/bin/env python3
"""
AI TRADER V2.0 - PROFESSIONAL EDITION
Расширенный AI анализ с 15+ индикаторами и multi-timeframe подходом
"""

import ccxt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import os
from typing import Dict, List, Tuple

class ProfessionalAITrader:
    """
    Профессиональный AI трейдер с продвинутой аналитикой
    """
    
    def __init__(self):
        self.exchange = ccxt.binance({
            'enableRateLimit': True,
            'options': {'defaultType': 'future'}
        })
        
        # Параметры анализа
        self.timeframes = ['15m', '1h', '4h', '1d']
        self.min_confidence = 75  # Минимальная уверенность для сигнала
        
    # ==================== ТЕХНИЧЕСКИЕ ИНДИКАТОРЫ ====================
    
    def calculate_rsi(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """RSI - Relative Strength Index"""
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))
    
    def calculate_macd(self, df: pd.DataFrame) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """MACD - Moving Average Convergence Divergence"""
        exp1 = df['close'].ewm(span=12, adjust=False).mean()
        exp2 = df['close'].ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=9, adjust=False).mean()
        histogram = macd - signal
        return macd, signal, histogram
    
    def calculate_bollinger_bands(self, df: pd.DataFrame, period: int = 20) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """Bollinger Bands"""
        sma = df['close'].rolling(window=period).mean()
        std = df['close'].rolling(window=period).std()
        upper = sma + (std * 2)
        lower = sma - (std * 2)
        return upper, sma, lower
    
    def calculate_fibonacci_levels(self, df: pd.DataFrame, lookback: int = 50) -> Dict[str, float]:
        """Fibonacci Retracement Levels"""
        recent = df.tail(lookback)
        high = recent['high'].max()
        low = recent['low'].min()
        diff = high - low
        
        return {
            'level_0': high,
            'level_236': high - (diff * 0.236),
            'level_382': high - (diff * 0.382),
            'level_500': high - (diff * 0.500),
            'level_618': high - (diff * 0.618),
            'level_786': high - (diff * 0.786),
            'level_100': low
        }
    
    def calculate_support_resistance(self, df: pd.DataFrame, window: int = 20) -> Tuple[List[float], List[float]]:
        """Support and Resistance Levels"""
        highs = df['high'].rolling(window=window, center=True).max()
        lows = df['low'].rolling(window=window, center=True).min()
        
        # Находим локальные максимумы и минимумы
        resistance_levels = []
        support_levels = []
        
        for i in range(window, len(df) - window):
            if df['high'].iloc[i] == highs.iloc[i]:
                resistance_levels.append(df['high'].iloc[i])
            if df['low'].iloc[i] == lows.iloc[i]:
                support_levels.append(df['low'].iloc[i])
        
        # Убираем дубликаты и сортируем
        resistance_levels = sorted(list(set(resistance_levels)))[-3:]
        support_levels = sorted(list(set(support_levels)))[-3:]
        
        return support_levels, resistance_levels
    
    def calculate_volume_profile(self, df: pd.DataFrame) -> Dict:
        """Volume Profile Analysis"""
        avg_volume = df['volume'].mean()
        current_volume = df['volume'].iloc[-1]
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 0
        
        return {
            'avg_volume': avg_volume,
            'current_volume': current_volume,
            'volume_ratio': volume_ratio,
            'high_volume': volume_ratio > 1.5,
            'low_volume': volume_ratio < 0.5
        }
    
    def detect_candlestick_patterns(self, df: pd.DataFrame) -> List[str]:
        """Candlestick Pattern Recognition"""
        patterns = []
        
        if len(df) < 5:
            return patterns
        
        last = df.iloc[-1]
        prev = df.iloc[-2]
        
        # Doji
        body = abs(last['close'] - last['open'])
        range_size = last['high'] - last['low']
        if body < range_size * 0.1:
            patterns.append('DOJI')
        
        # Hammer
        lower_shadow = min(last['open'], last['close']) - last['low']
        upper_shadow = last['high'] - max(last['open'], last['close'])
        if lower_shadow > body * 2 and upper_shadow < body * 0.3:
            patterns.append('HAMMER')
        
        # Shooting Star
        if upper_shadow > body * 2 and lower_shadow < body * 0.3:
            patterns.append('SHOOTING_STAR')
        
        # Engulfing
        if last['close'] > last['open'] and prev['close'] < prev['open']:
            if last['open'] <= prev['close'] and last['close'] >= prev['open']:
                patterns.append('BULLISH_ENGULFING')
        
        if last['close'] < last['open'] and prev['close'] > prev['open']:
            if last['open'] >= prev['close'] and last['close'] <= prev['open']:
                patterns.append('BEARISH_ENGULFING')
        
        return patterns
    
    def calculate_ichimoku(self, df: pd.DataFrame) -> Dict:
        """Ichimoku Cloud"""
        # Tenkan-sen (Conversion Line): (9-period high + 9-period low)/2
        period9_high = df['high'].rolling(window=9).max()
        period9_low = df['low'].rolling(window=9).min()
        tenkan_sen = (period9_high + period9_low) / 2
        
        # Kijun-sen (Base Line): (26-period high + 26-period low)/2
        period26_high = df['high'].rolling(window=26).max()
        period26_low = df['low'].rolling(window=26).min()
        kijun_sen = (period26_high + period26_low) / 2
        
        # Senkou Span A (Leading Span A): (Conversion Line + Base Line)/2
        senkou_span_a = ((tenkan_sen + kijun_sen) / 2).shift(26)
        
        # Senkou Span B (Leading Span B): (52-period high + 52-period low)/2
        period52_high = df['high'].rolling(window=52).max()
        period52_low = df['low'].rolling(window=52).min()
        senkou_span_b = ((period52_high + period52_low) / 2).shift(26)
        
        current_price = df['close'].iloc[-1]
        cloud_top = max(senkou_span_a.iloc[-1], senkou_span_b.iloc[-1])
        cloud_bottom = min(senkou_span_a.iloc[-1], senkou_span_b.iloc[-1])
        
        return {
            'tenkan_sen': tenkan_sen.iloc[-1],
            'kijun_sen': kijun_sen.iloc[-1],
            'above_cloud': current_price > cloud_top,
            'below_cloud': current_price < cloud_bottom,
            'in_cloud': cloud_bottom <= current_price <= cloud_top,
            'bullish_cloud': senkou_span_a.iloc[-1] > senkou_span_b.iloc[-1]
        }
    
    def calculate_adx(self, df: pd.DataFrame, period: int = 14) -> float:
        """ADX - Average Directional Index (Trend Strength)"""
        high = df['high']
        low = df['low']
        close = df['close']
        
        plus_dm = high.diff()
        minus_dm = low.diff().abs()
        
        plus_dm[plus_dm < 0] = 0
        minus_dm[minus_dm < 0] = 0
        
        tr1 = high - low
        tr2 = (high - close.shift()).abs()
        tr3 = (low - close.shift()).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        atr = tr.rolling(window=period).mean()
        
        plus_di = 100 * (plus_dm.rolling(window=period).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(window=period).mean() / atr)
        
        dx = 100 * (abs(plus_di - minus_di) / (plus_di + minus_di))
        adx = dx.rolling(window=period).mean()
        
        return adx.iloc[-1]
    
    # ==================== MULTI-TIMEFRAME АНАЛИЗ ====================
    
    def analyze_timeframe(self, symbol: str, timeframe: str) -> Dict:
        """Анализ одного таймфрейма"""
        try:
            # Получаем данные
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, limit=200)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            # Рассчитываем все индикаторы
            current_price = df['close'].iloc[-1]
            
            # RSI
            rsi = self.calculate_rsi(df)
            rsi_value = rsi.iloc[-1]
            
            # MACD
            macd, signal, histogram = self.calculate_macd(df)
            macd_bullish = macd.iloc[-1] > signal.iloc[-1]
            
            # Bollinger Bands
            bb_upper, bb_middle, bb_lower = self.calculate_bollinger_bands(df)
            bb_position = (current_price - bb_lower.iloc[-1]) / (bb_upper.iloc[-1] - bb_lower.iloc[-1])
            
            # Volume
            volume_data = self.calculate_volume_profile(df)
            
            # Fibonacci
            fib_levels = self.calculate_fibonacci_levels(df)
            
            # Support/Resistance
            support, resistance = self.calculate_support_resistance(df)
            
            # Candlestick Patterns
            patterns = self.detect_candlestick_patterns(df)
            
            # Ichimoku
            ichimoku = self.calculate_ichimoku(df)
            
            # ADX (Trend Strength)
            adx = self.calculate_adx(df)
            
            # EMA Trend
            ema_20 = df['close'].ewm(span=20).mean().iloc[-1]
            ema_50 = df['close'].ewm(span=50).mean().iloc[-1]
            ema_200 = df['close'].ewm(span=200).mean().iloc[-1] if len(df) >= 200 else None
            
            trend = "BULLISH" if current_price > ema_20 > ema_50 else "BEARISH" if current_price < ema_20 < ema_50 else "NEUTRAL"
            
            # Scoring
            score = 0
            max_score = 100
            
            # RSI Score (20 points)
            if 30 < rsi_value < 70:
                score += 20
            elif 40 < rsi_value < 60:
                score += 15
            elif rsi_value < 30:  # Oversold
                score += 10
            elif rsi_value > 70:  # Overbought
                score += 5
            
            # MACD Score (15 points)
            if macd_bullish:
                score += 15
            
            # Trend Score (20 points)
            if trend == "BULLISH":
                score += 20
            elif trend == "NEUTRAL":
                score += 10
            
            # Volume Score (15 points)
            if volume_data['high_volume']:
                score += 15
            elif not volume_data['low_volume']:
                score += 10
            
            # Bollinger Score (10 points)
            if 0.2 < bb_position < 0.8:
                score += 10
            elif bb_position < 0.2:  # Near lower band
                score += 15
            
            # Ichimoku Score (10 points)
            if ichimoku['above_cloud']:
                score += 10
            elif ichimoku['below_cloud']:
                score += 5
            
            # ADX Score (10 points)
            if adx > 25:  # Strong trend
                score += 10
            elif adx > 20:
                score += 7
            else:
                score += 3
            
            return {
                'timeframe': timeframe,
                'price': current_price,
                'trend': trend,
                'rsi': rsi_value,
                'macd_bullish': macd_bullish,
                'bb_position': bb_position,
                'volume': volume_data,
                'fib_levels': fib_levels,
                'support': support,
                'resistance': resistance,
                'patterns': patterns,
                'ichimoku': ichimoku,
                'adx': adx,
                'ema_20': ema_20,
                'ema_50': ema_50,
                'ema_200': ema_200,
                'score': score
            }
            
        except Exception as e:
            print(f"Error analyzing {symbol} on {timeframe}: {e}")
            return None
    
    def multi_timeframe_analysis(self, symbol: str) -> Dict:
        """Анализ по всем таймфреймам"""
        results = {}
        
        for tf in self.timeframes:
            analysis = self.analyze_timeframe(symbol, tf)
            if analysis:
                results[tf] = analysis
        
        if not results:
            return None
        
        # Общий скор (среднее по всем таймфреймам)
        total_score = sum(r['score'] for r in results.values()) / len(results)
        
        # Подтверждение тренда
        bullish_count = sum(1 for r in results.values() if r['trend'] == 'BULLISH')
        bearish_count = sum(1 for r in results.values() if r['trend'] == 'BEARISH')
        
        trend_confirmed = bullish_count >= 3 or bearish_count >= 3
        overall_trend = "BULLISH" if bullish_count > bearish_count else "BEARISH" if bearish_count > bullish_count else "NEUTRAL"
        
        # Финальный сигнал
        signal = "HOLD"
        if total_score >= 75 and trend_confirmed and overall_trend == "BULLISH":
            signal = "BUY"
        elif total_score <= 40 and trend_confirmed and overall_trend == "BEARISH":
            signal = "SELL"
        
        return {
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'signal': signal,
            'confidence': int(total_score),
            'trend': overall_trend,
            'trend_confirmed': trend_confirmed,
            'timeframes': results,
            'current_price': results['15m']['price']
        }
    
    # ==================== SMART ENTRY/EXIT ====================
    
    def calculate_entry_price(self, symbol: str, signal: str) -> Dict:
        """Умный вход в позицию (ждет pullback)"""
        analysis = self.analyze_timeframe(symbol, '15m')
        
        if not analysis:
            return None
        
        current_price = analysis['price']
        support = analysis['support']
        resistance = analysis['resistance']
        
        if signal == "BUY":
            # Ждем откат к поддержке или EMA
            entry_price = min(support[-1] if support else current_price * 0.98, analysis['ema_20'])
            stop_loss = entry_price * 0.977  # -2.3%
            take_profit_1 = entry_price * 1.02  # +2%
            take_profit_2 = entry_price * 1.04  # +4%
            
            return {
                'entry_price': entry_price,
                'stop_loss': stop_loss,
                'take_profit_1': take_profit_1,
                'take_profit_2': take_profit_2,
                'risk_reward': 1.7
            }
        
        elif signal == "SELL":
            # Для продажи (если будет short)
            entry_price = max(resistance[-1] if resistance else current_price * 1.02, analysis['ema_20'])
            stop_loss = entry_price * 1.023
            take_profit_1 = entry_price * 0.98
            take_profit_2 = entry_price * 0.96
            
            return {
                'entry_price': entry_price,
                'stop_loss': stop_loss,
                'take_profit_1': take_profit_1,
                'take_profit_2': take_profit_2,
                'risk_reward': 1.7
            }
        
        return None
    
    # ==================== ГЛАВНАЯ ФУНКЦИЯ ====================
    
    def analyze_coin(self, symbol: str) -> Dict:
        """Полный профессиональный анализ монеты"""
        print(f"\n🔍 Analyzing {symbol}...")
        
        # Multi-timeframe анализ
        mtf_analysis = self.multi_timeframe_analysis(symbol)
        
        if not mtf_analysis:
            return None
        
        # Smart entry/exit
        if mtf_analysis['signal'] in ['BUY', 'SELL']:
            entry_data = self.calculate_entry_price(symbol, mtf_analysis['signal'])
            mtf_analysis['entry_strategy'] = entry_data
        
        # Explanation
        explanation = self.generate_explanation(mtf_analysis)
        mtf_analysis['explanation'] = explanation
        
        return mtf_analysis
    
    def generate_explanation(self, analysis: Dict) -> str:
        """Генерация объяснения для трейдера"""
        signal = analysis['signal']
        confidence = analysis['confidence']
        trend = analysis['trend']
        
        explanation = f"📊 Сигнал: {signal} ({confidence}% уверенность)\n\n"
        explanation += f"📈 Тренд: {trend} {'✅ Подтвержден' if analysis['trend_confirmed'] else '⚠️ Не подтвержден'}\n\n"
        explanation += "🔍 Анализ по таймфреймам:\n"
        
        for tf, data in analysis['timeframes'].items():
            explanation += f"  • {tf}: {data['trend']} (Score: {data['score']}/100)\n"
            explanation += f"    RSI: {data['rsi']:.1f}, ADX: {data['adx']:.1f}\n"
            if data['patterns']:
                explanation += f"    Паттерны: {', '.join(data['patterns'])}\n"
        
        if 'entry_strategy' in analysis:
            entry = analysis['entry_strategy']
            explanation += f"\n💡 Стратегия входа:\n"
            explanation += f"  Вход: ${entry['entry_price']:.2f}\n"
            explanation += f"  Stop-Loss: ${entry['stop_loss']:.2f}\n"
            explanation += f"  TP1 (50%): ${entry['take_profit_1']:.2f}\n"
            explanation += f"  TP2 (50%): ${entry['take_profit_2']:.2f}\n"
            explanation += f"  Risk/Reward: 1:{entry['risk_reward']}\n"
        
        return explanation


# ==================== ТЕСТИРОВАНИЕ ====================

if __name__ == "__main__":
    print("=" * 60)
    print("🤖 AI TRADER V2.0 - PROFESSIONAL EDITION")
    print("=" * 60)
    
    trader = ProfessionalAITrader()
    
    # Тестируем на нескольких монетах
    test_coins = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']
    
    for coin in test_coins:
        analysis = trader.analyze_coin(coin)
        
        if analysis:
            print(f"\n{'='*60}")
            print(f"📊 {analysis['symbol']}")
            print(f"💰 Цена: ${analysis['current_price']:.2f}")
            print(f"🎯 Сигнал: {analysis['signal']} ({analysis['confidence']}%)")
            print(f"📈 Тренд: {analysis['trend']}")
            print(f"\n{analysis['explanation']}")
            print(f"{'='*60}")
