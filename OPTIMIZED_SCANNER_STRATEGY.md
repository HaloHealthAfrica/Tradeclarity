# Optimized Scanner Strategy: Premarket + Intraday

## Overview

This document outlines the best approach to optimize your scanning system for both premarket and intraday sessions, maximizing efficiency while maintaining accuracy.

## Current System Analysis

Your current scanner has:
- ✅ Fixed pattern detection logic
- ✅ Real TwelveData API integration
- ✅ Comprehensive error handling
- ✅ Rate limiting and connection pooling
- ❌ No session-based scanning
- ❌ No premarket-specific patterns
- ❌ No adaptive scanning intervals

## Optimal Scanning Strategy

### 1. **Session-Based Scanning Architecture**

```typescript
interface SessionConfig {
  session: 'premarket' | 'intraday' | 'afterhours' | 'closed';
  scanInterval: number;
  riskMultiplier: number;
  patternTypes: string[];
  maxSignals: number;
}
```

### 2. **Session-Specific Optimizations**

#### **Premarket Session (4:00 AM - 9:30 AM)**
- **Scan Interval**: 2-3 minutes (less frequent due to lower liquidity)
- **Pattern Focus**: Gap analysis, volume spikes, news-driven moves
- **Risk Management**: 70% of normal risk (lower liquidity)
- **Key Patterns**:
  - Gap up/down continuation
  - Premarket volume explosions
  - News-driven momentum
  - Overnight position unwinding

#### **Intraday Session (9:30 AM - 4:00 PM)**
- **Scan Interval**: 1 minute (high frequency for momentum)
- **Pattern Focus**: Momentum continuation, breakouts, reversals
- **Risk Management**: 100% normal risk
- **Key Patterns**:
  - Inside/Outside bar breakouts
  - Momentum continuation
  - Volume-based reversals
  - Technical level breaks

#### **After Hours Session (4:00 PM - 8:00 PM)**
- **Scan Interval**: 5 minutes (low activity)
- **Pattern Focus**: Reversals, position unwinding
- **Risk Management**: 50% of normal risk (much lower liquidity)
- **Key Patterns**:
  - End-of-day reversals
  - Position unwinding
  - Low volume breakouts

### 3. **Implementation Strategy**

#### **Phase 1: Session Detection**
```typescript
class SessionManager {
  getCurrentSession(): SessionConfig {
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    
    if (time >= "04:00" && time < "09:30") {
      return {
        session: 'premarket',
        scanInterval: 2 * 60 * 1000,
        riskMultiplier: 0.7,
        patternTypes: ['gap', 'volume', 'news'],
        maxSignals: 5
      };
    }
    // ... other sessions
  }
}
```

#### **Phase 2: Session-Specific Pattern Detection**
```typescript
class SessionPatternDetector {
  detectPremarketPatterns(data: MarketData[]): Pattern[] {
    // Gap analysis
    // Volume spike detection
    // News correlation
  }
  
  detectIntradayPatterns(data: MarketData[]): Pattern[] {
    // Momentum continuation
    // Breakout patterns
    // Technical level breaks
  }
}
```

#### **Phase 3: Adaptive Scanning**
```typescript
class AdaptiveScanner {
  private sessionManager: SessionManager;
  private patternDetector: SessionPatternDetector;
  
  async scan(): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    const patterns = this.patternDetector.detectForSession(session);
    
    // Apply session-specific risk management
    // Use session-specific scan intervals
    // Focus on session-relevant patterns
  }
}
```

### 4. **Performance Optimizations**

#### **Rate Limiting by Session**
- **Premarket**: 30 API calls/minute (lower activity)
- **Intraday**: 60 API calls/minute (high activity)
- **After Hours**: 15 API calls/minute (minimal activity)

#### **Caching Strategy**
- **Premarket**: Cache overnight data, focus on gaps
- **Intraday**: Real-time data, minimal caching
- **After Hours**: Cache day's data, focus on reversals

#### **Signal Prioritization**
```typescript
interface SignalPriority {
  premarket: {
    high: ['gap_up_continuation', 'volume_explosion'],
    medium: ['news_momentum', 'overnight_unwinding'],
    low: ['technical_breakout']
  },
  intraday: {
    high: ['momentum_continuation', 'volume_breakout'],
    medium: ['technical_level_break', 'reversal'],
    low: ['consolidation_break']
  }
}
```

### 5. **Risk Management by Session**

#### **Position Sizing**
- **Premarket**: 70% of normal position size
- **Intraday**: 100% of normal position size
- **After Hours**: 50% of normal position size

#### **Stop Loss Adjustments**
- **Premarket**: Wider stops (lower liquidity)
- **Intraday**: Normal stops
- **After Hours**: Tighter stops (higher volatility)

### 6. **Implementation Steps**

#### **Step 1: Add Session Configuration**
```typescript
// Add to ScannerConfig
interface ScannerConfig {
  // ... existing config
  enableSessionBasedScanning: boolean;
  premarketStartTime: string;
  premarketEndTime: string;
  marketOpenTime: string;
  marketCloseTime: string;
  afterHoursEndTime: string;
  
  // Session-specific intervals
  premarketScanInterval: number;
  intradayScanInterval: number;
  afterHoursScanInterval: number;
  
  // Session-specific risk
  premarketRiskMultiplier: number;
  intradayRiskMultiplier: number;
  afterHoursRiskMultiplier: number;
}
```

#### **Step 2: Implement Session Detection**
```typescript
class Scanner {
  private getCurrentSession(): SessionInfo {
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    
    if (time >= this.config.premarketStartTime && 
        time < this.config.premarketEndTime) {
      return { session: 'premarket', confidence: 0.9 };
    }
    // ... other sessions
  }
}
```

#### **Step 3: Add Session-Specific Pattern Detection**
```typescript
class Scanner {
  private detectPatternsForSession(data: MarketData[], session: string): Pattern[] {
    const basePatterns = this.detectPatterns(data);
    
    switch (session) {
      case 'premarket':
        return [...basePatterns, ...this.detectPremarketPatterns(data)];
      case 'intraday':
        return [...basePatterns, ...this.detectIntradayPatterns(data)];
      case 'afterhours':
        return [...basePatterns, ...this.detectAfterHoursPatterns(data)];
      default:
        return basePatterns;
    }
  }
}
```

#### **Step 4: Implement Adaptive Scanning**
```typescript
class Scanner {
  async startScanning(): Promise<void> {
    while (this.running) {
      const session = this.getCurrentSession();
      const interval = this.getScanIntervalForSession(session);
      
      await this.scanAllSymbols(session);
      await this.delay(interval);
    }
  }
}
```

### 7. **Benefits of This Approach**

#### **Efficiency Gains**
- **Reduced API calls** during low-activity periods
- **Focused pattern detection** per session
- **Optimized resource usage** based on market conditions

#### **Accuracy Improvements**
- **Session-specific patterns** increase signal quality
- **Adaptive risk management** reduces losses
- **Context-aware scanning** improves timing

#### **Performance Benefits**
- **Faster scanning** during high-activity periods
- **Lower resource usage** during low-activity periods
- **Better signal-to-noise ratio** with focused detection

### 8. **Configuration Example**

```json
{
  "enableSessionBasedScanning": true,
  "premarketStartTime": "04:00",
  "premarketEndTime": "09:30",
  "marketOpenTime": "09:30",
  "marketCloseTime": "16:00",
  "afterHoursEndTime": "20:00",
  
  "premarketScanInterval": 120000,
  "intradayScanInterval": 60000,
  "afterHoursScanInterval": 300000,
  
  "premarketRiskMultiplier": 0.7,
  "intradayRiskMultiplier": 1.0,
  "afterHoursRiskMultiplier": 0.5,
  
  "enablePremarketGapAnalysis": true,
  "enableIntradayMomentum": true,
  "enableAfterHoursReversal": true
}
```

### 9. **Monitoring and Metrics**

#### **Session-Specific Metrics**
- Signals generated per session
- Win rate by session
- Average processing time by session
- API call efficiency by session

#### **Performance Tracking**
```typescript
interface SessionMetrics {
  premarket: {
    signalsGenerated: number;
    winRate: number;
    averageProcessingTime: number;
    apiCallsPerMinute: number;
  };
  intraday: { /* same structure */ };
  afterhours: { /* same structure */ };
}
```

### 10. **Next Steps**

1. **Implement session detection** in your Scanner class
2. **Add session-specific pattern detection** methods
3. **Update scanning logic** to use adaptive intervals
4. **Add session-specific risk management**
5. **Test with historical data** to validate improvements
6. **Monitor performance** and adjust parameters

This approach will give you the best of both worlds: efficient premarket scanning for early opportunities and high-frequency intraday scanning for momentum trades, all while maintaining optimal resource usage and risk management. 