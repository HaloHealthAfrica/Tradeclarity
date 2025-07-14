import { Candle, TradeSignal, IndicatorBundle } from '../types';
import { getIndicatorBundle } from '../services/twelvedata';
import { isTradingHours } from '../utils/timeUtils';
import { calculatePositionSize } from '../riskManagement';

// --- Robust FVG Detection ---
interface FVG {
  high: number;
  low: number;
  startIdx: number;
  endIdx: number;
  filled: boolean;
  volume: number;
}

function detectFairValueGaps(history: Candle[], minGapSize = 0.1, lookback = 30): FVG[] {
  const gaps: FVG[] = [];
  for (let i = 2; i < Math.min(history.length, lookback); i++) {
    const c1 = history[i - 2];
    const c2 = history[i - 1];
    const c3 = history[i];
    if (c1.low > c2.high && c3.low > c2.high) {
      const gapSize = c1.low - c2.high;
      if (gapSize >= minGapSize) {
        gaps.push({ high: Math.max(c1.low, c3.low), low: c2.high, startIdx: i - 2, endIdx: i, filled: false, volume: c2.volume });
      }
    }
    if (c1.high < c2.low && c3.high < c2.low) {
      const gapSize = c2.low - c1.high;
      if (gapSize >= minGapSize) {
        gaps.push({ high: c2.low, low: Math.min(c1.high, c3.high), startIdx: i - 2, endIdx: i, filled: false, volume: c2.volume });
      }
    }
  }
  return gaps;
}

function updateGapFills(gaps: FVG[], history: Candle[]) {
  for (const gap of gaps) {
    for (let i = gap.endIdx + 1; i < history.length; i++) {
      const c = history[i];
      if (c.low <= gap.high && c.high >= gap.low) {
        gap.filled = true;
        break;
      }
    }
  }
}

function getBestUnfilledFVG(history: Candle[], minGapSize = 0.1, minVolumeRatio = 1.5): FVG | null {
  const gaps = detectFairValueGaps(history, minGapSize);
  updateGapFills(gaps, history);
  const avgVolume = history.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
  const unfilled = gaps.filter(gap => !gap.filled && gap.volume > avgVolume * minVolumeRatio);
  if (unfilled.length === 0) return null;
  return unfilled.reduce((best, gap) => (gap.volume > best.volume ? gap : best), unfilled[0]);
}

// --- Weighted Confidence Calculation ---
function calculateConfidence({
  volumeConfirmed,
  volatilityExpanded,
  momentumAligned,
  scenarioType
}: {
  volumeConfirmed: boolean;
  volatilityExpanded: boolean;
  momentumAligned: boolean;
  scenarioType: 'breakout' | 'reversal' | 'gap-fade' | 'vol-expansion';
}): number {
  const weights = { volume: 0.3, volatility: 0.2, momentum: 0.2, scenario: 0.3 };
  let score = 0;
  score += volumeConfirmed ? weights.volume : 0;
  score += volatilityExpanded ? weights.volatility : 0;
  score += momentumAligned ? weights.momentum : 0;
  switch (scenarioType) {
    case 'breakout': score += 0.25 * weights.scenario; break;
    case 'vol-expansion': score += 0.2 * weights.scenario; break;
    case 'gap-fade': score += 0.15 * weights.scenario; break;
    case 'reversal': score += 0.1 * weights.scenario; break;
  }
  return Math.max(0, Math.min(1, score));
}

// --- Main FVG Trade Signal Generator ---
export async function generateTradeSignal(candle: Candle, history: Candle[]): Promise<TradeSignal | null> {
  if (!isTradingHours(candle.timestamp)) return null;
  if (history.length < 30) return null;

  // Detect robust FVG
  const fvg = getBestUnfilledFVG(history);
  if (!fvg) return null;

  // Fetch indicators (should be cached)
  const indicators = await getIndicatorBundle(candle.symbol, candle.timestamp);
  const lastClose = candle.close;
  const volumeConfirmed = candle.volume > (indicators.volumeProfile?.average || 1) * 1.5;
  const volatilityExpanded = indicators.atr > indicators.atrAverage * 1.3;
  const momentumAligned = indicators.macd.histogram > 0 && indicators.rsi < 65;

  // Scenario selection (example: gap-fade)
  const scenarioType: 'gap-fade' = 'gap-fade';
  const entry = fvg.high;
  const stop = fvg.high + (indicators.atr * 0.4);
  const target = fvg.low - (indicators.atr * 1.2);

  // Weighted confidence
  const confidence = calculateConfidence({
    volumeConfirmed,
    volatilityExpanded,
    momentumAligned,
    scenarioType
  });

  if (confidence < 0.7) return null;

  const positionSize = calculatePositionSize(entry, stop, indicators.atr, 'bullish');

  return {
    id: `trade-${candle.timestamp.getTime()}`,
    symbol: candle.symbol,
    type: scenarioType,
    bias: 'bullish',
    entry: parseFloat(entry.toFixed(2)),
    stop: parseFloat(stop.toFixed(2)),
    target: parseFloat(target.toFixed(2)),
    rsi: indicators.rsi,
    atr: indicators.atr,
    volumeRatio: candle.volume / (indicators.volumeProfile?.average || 1),
    confidence,
    timestamp: candle.timestamp,
    positionSize,
    conditions: {
      volumeConfirmed,
      volatilityExpanded,
      momentumAligned
    }
  };
} 