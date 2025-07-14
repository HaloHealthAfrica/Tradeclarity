/**
 * Scanner Configuration for Eastern Standard Time
 * 
 * This configuration optimizes scanning for different market sessions
 * based on Eastern Standard Time (EST) market hours.
 */

export interface ESTScannerConfig {
  // Session Configuration (Eastern Standard Time)
  enableSessionBasedScanning: boolean;
  premarketStartTime: string; // "04:00" EST
  premarketEndTime: string;   // "09:30" EST
  marketOpenTime: string;     // "09:30" EST
  marketCloseTime: string;    // "16:00" EST
  afterHoursEndTime: string;  // "20:00" EST
  
  // Session-Specific Intervals (in milliseconds)
  premarketScanInterval: number; // 2 minutes
  intradayScanInterval: number;  // 1 minute
  afterHoursScanInterval: number; // 5 minutes
  
  // Session-Specific Risk Management
  premarketRiskMultiplier: number; // 0.7 (lower risk for premarket)
  intradayRiskMultiplier: number;  // 1.0 (normal risk)
  afterHoursRiskMultiplier: number; // 0.5 (much lower risk)
  
  // Session-Specific Pattern Detection
  enablePremarketGapAnalysis: boolean;
  enableIntradayMomentum: boolean;
  enableAfterHoursReversal: boolean;
  
  // API Configuration
  twelvedataApiKey: string;
  twelvedataBaseUrl: string;
  twelvedataWsUrl: string;
  
  // Rate Limiting by Session
  premarketApiCallsPerMinute: number; // 30 (lower activity)
  intradayApiCallsPerMinute: number;  // 60 (high activity)
  afterHoursApiCallsPerMinute: number; // 15 (minimal activity)
  
  // Pattern Parameters
  gapThreshold: number;
  breakoutThreshold: number;
  volumeSpikeMultiplier: number;
  minVolumeThreshold: number;
  
  // Technical Indicators
  atrPeriod: number;
  atrStopMultiplier: number;
  emaShort: number;
  emaLong: number;
  rsiPeriod: number;
}

/**
 * Default configuration for Eastern Standard Time scanner
 */
export const estScannerConfig: ESTScannerConfig = {
  // Session Configuration (Eastern Standard Time)
  enableSessionBasedScanning: true,
  premarketStartTime: "04:00", // 4:00 AM EST
  premarketEndTime: "09:30",   // 9:30 AM EST
  marketOpenTime: "09:30",     // 9:30 AM EST
  marketCloseTime: "16:00",    // 4:00 PM EST
  afterHoursEndTime: "20:00",  // 8:00 PM EST
  
  // Session-Specific Intervals
  premarketScanInterval: 2 * 60 * 1000, // 2 minutes
  intradayScanInterval: 60 * 1000,       // 1 minute
  afterHoursScanInterval: 5 * 60 * 1000, // 5 minutes
  
  // Session-Specific Risk Management
  premarketRiskMultiplier: 0.7, // 70% of normal risk (lower liquidity)
  intradayRiskMultiplier: 1.0,  // 100% normal risk
  afterHoursRiskMultiplier: 0.5, // 50% of normal risk (much lower liquidity)
  
  // Session-Specific Pattern Detection
  enablePremarketGapAnalysis: true,
  enableIntradayMomentum: true,
  enableAfterHoursReversal: true,
  
  // API Configuration
  twelvedataApiKey: process.env.TWELVEDATA_API_KEY || '',
  twelvedataBaseUrl: 'https://api.twelvedata.com',
  twelvedataWsUrl: 'wss://ws.twelvedata.com/v1/quotes/price',
  
  // Rate Limiting by Session
  premarketApiCallsPerMinute: 30,  // Lower activity
  intradayApiCallsPerMinute: 60,   // High activity
  afterHoursApiCallsPerMinute: 15, // Minimal activity
  
  // Pattern Parameters
  gapThreshold: 0.005,
  breakoutThreshold: 0.001,
  volumeSpikeMultiplier: 1.5,
  minVolumeThreshold: 100000,
  
  // Technical Indicators
  atrPeriod: 14,
  atrStopMultiplier: 1.5,
  emaShort: 20,
  emaLong: 50,
  rsiPeriod: 14
};

/**
 * Session-specific pattern priorities for EST
 */
export const estSessionPatterns = {
  premarket: {
    high: ['gap_up_continuation', 'volume_explosion', 'premarket_gap_analysis'],
    medium: ['news_momentum', 'overnight_unwinding'],
    low: ['technical_breakout']
  },
  intraday: {
    high: ['momentum_continuation', 'volume_breakout', 'inside_bar_breakout'],
    medium: ['technical_level_break', 'reversal', 'outside_bar_follow_through'],
    low: ['consolidation_break']
  },
  afterhours: {
    high: ['end_of_day_reversal', 'position_unwinding'],
    medium: ['low_volume_breakout'],
    low: ['technical_breakout']
  }
};

/**
 * EST Market Session Information
 */
export const estMarketSessions = {
  premarket: {
    start: "04:00",
    end: "09:30",
    description: "Premarket trading session",
    characteristics: [
      "Lower liquidity",
      "Gap analysis focus",
      "News-driven moves",
      "Overnight position unwinding"
    ]
  },
  intraday: {
    start: "09:30",
    end: "16:00",
    description: "Regular market hours",
    characteristics: [
      "High liquidity",
      "Momentum patterns",
      "Technical breakouts",
      "Volume-based signals"
    ]
  },
  afterhours: {
    start: "16:00",
    end: "20:00",
    description: "After-hours trading",
    characteristics: [
      "Reduced liquidity",
      "Reversal patterns",
      "Position unwinding",
      "Lower volume activity"
    ]
  }
};

/**
 * Get current EST session information
 */
export function getCurrentESTSession(): {
  session: 'premarket' | 'intraday' | 'afterhours' | 'closed';
  time: string;
  description: string;
} {
  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  const currentTime = estTime.toTimeString().slice(0, 5);
  
  if (currentTime >= "04:00" && currentTime < "09:30") {
    return {
      session: 'premarket',
      time: currentTime,
      description: 'Premarket trading session'
    };
  } else if (currentTime >= "09:30" && currentTime < "16:00") {
    return {
      session: 'intraday',
      time: currentTime,
      description: 'Regular market hours'
    };
  } else if (currentTime >= "16:00" && currentTime < "20:00") {
    return {
      session: 'afterhours',
      time: currentTime,
      description: 'After-hours trading'
    };
  } else {
    return {
      session: 'closed',
      time: currentTime,
      description: 'Market closed'
    };
  }
}

/**
 * Validate EST scanner configuration
 */
export function validateESTScannerConfig(config: Partial<ESTScannerConfig>): string[] {
  const errors: string[] = [];
  
  // Validate time format (HH:MM)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (config.premarketStartTime && !timeRegex.test(config.premarketStartTime)) {
    errors.push('Invalid premarket start time format. Use HH:MM format.');
  }
  
  if (config.premarketEndTime && !timeRegex.test(config.premarketEndTime)) {
    errors.push('Invalid premarket end time format. Use HH:MM format.');
  }
  
  if (config.marketOpenTime && !timeRegex.test(config.marketOpenTime)) {
    errors.push('Invalid market open time format. Use HH:MM format.');
  }
  
  if (config.marketCloseTime && !timeRegex.test(config.marketCloseTime)) {
    errors.push('Invalid market close time format. Use HH:MM format.');
  }
  
  if (config.afterHoursEndTime && !timeRegex.test(config.afterHoursEndTime)) {
    errors.push('Invalid after hours end time format. Use HH:MM format.');
  }
  
  // Validate risk multipliers
  if (config.premarketRiskMultiplier && (config.premarketRiskMultiplier < 0 || config.premarketRiskMultiplier > 1)) {
    errors.push('Premarket risk multiplier must be between 0 and 1.');
  }
  
  if (config.intradayRiskMultiplier && (config.intradayRiskMultiplier < 0 || config.intradayRiskMultiplier > 1)) {
    errors.push('Intraday risk multiplier must be between 0 and 1.');
  }
  
  if (config.afterHoursRiskMultiplier && (config.afterHoursRiskMultiplier < 0 || config.afterHoursRiskMultiplier > 1)) {
    errors.push('After hours risk multiplier must be between 0 and 1.');
  }
  
  // Validate scan intervals
  if (config.premarketScanInterval && config.premarketScanInterval < 30000) {
    errors.push('Premarket scan interval must be at least 30 seconds.');
  }
  
  if (config.intradayScanInterval && config.intradayScanInterval < 10000) {
    errors.push('Intraday scan interval must be at least 10 seconds.');
  }
  
  if (config.afterHoursScanInterval && config.afterHoursScanInterval < 60000) {
    errors.push('After hours scan interval must be at least 1 minute.');
  }
  
  return errors;
} 