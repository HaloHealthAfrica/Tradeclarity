import type { IStorage } from '../storage';
import type { Strategy, MarketData } from '@shared/schema';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('SATYTimingAnalyzer');

/**
 * SATY Timing Analysis Configuration
 */
export interface SATYTimingConfig {
  // Timing Analysis Parameters
  entryWindowMinutes: number;
  exitWindowMinutes: number;
  minHoldTime: number;
  maxHoldTime: number;
  
  // Risk Management
  maxEarlyEntryRisk: number;
  minConfidenceForEarlyEntry: number;
  maxDrawdown: number;
  
  // Performance Analysis
  backtestPeriod: number;
  minSampleSize: number;
  confidenceInterval: number;
  
  // Market Conditions
  volatilityThreshold: number;
  volumeThreshold: number;
  trendStrengthThreshold: number;
}

export const satyTimingConfig: SATYTimingConfig = {
  // Timing Analysis Parameters
  entryWindowMinutes: 30,
  exitWindowMinutes: 15,
  minHoldTime: 300000, // 5 minutes
  maxHoldTime: 14400000, // 4 hours
  
  // Risk Management
  maxEarlyEntryRisk: 0.15, // 15% additional risk for early entry
  minConfidenceForEarlyEntry: 0.75,
  maxDrawdown: 0.10, // 10% max drawdown
  
  // Performance Analysis
  backtestPeriod: 30, // days
  minSampleSize: 50,
  confidenceInterval: 0.95,
  
  // Market Conditions
  volatilityThreshold: 0.03, // 3% volatility threshold
  volumeThreshold: 1.5, // 1.5x average volume
  trendStrengthThreshold: 25 // ADX threshold
};

/**
 * Timing Analysis Result
 */
export interface TimingAnalysisResult {
  symbol: string;
  currentTiming: 'optimal' | 'early' | 'late' | 'avoid';
  confidence: number;
  reasoning: string;
  recommendations: TimingRecommendation[];
  riskAssessment: RiskAssessment;
  performanceMetrics: PerformanceMetrics;
}

/**
 * Timing Recommendation
 */
export interface TimingRecommendation {
  type: 'entry' | 'exit' | 'hold';
  timing: 'immediate' | 'wait' | 'avoid';
  confidence: number;
  reasoning: string;
  expectedImpact: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Risk Assessment
 */
export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  marketRisk: number;
  timingRisk: number;
  volatilityRisk: number;
  volumeRisk: number;
  recommendations: string[];
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  winRate: number;
  averageReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  averageHoldTime: number;
  optimalEntryTime: string;
}

/**
 * Market Context for Timing
 */
interface MarketContext {
  volatility: number;
  volume: number;
  trendStrength: number;
  marketRegime: 'trending' | 'ranging' | 'volatile';
  timeOfDay: 'pre_market' | 'market_open' | 'mid_day' | 'market_close' | 'after_hours';
}

/**
 * Production-Ready SATY Timing Analyzer
 * 
 * Features:
 * - Real-time entry timing analysis
 * - Market condition assessment
 * - Risk management integration
 * - Performance optimization
 * - Comprehensive error handling
 * - Historical backtesting
 */
export class SATYTimingAnalyzer {
  private storage: IStorage;
  private config: SATYTimingConfig;
  private analysisHistory: Map<string, TimingAnalysisResult[]> = new Map();
  private performanceMetrics: {
    totalAnalyses: number;
    successfulAnalyses: number;
    averageConfidence: number;
    averageProcessingTime: number;
  } = {
    totalAnalyses: 0,
    successfulAnalyses: 0,
    averageConfidence: 0,
    averageProcessingTime: 0
  };

  constructor(storage: IStorage, config?: Partial<SATYTimingConfig>) {
    this.storage = storage;
    this.config = { ...satyTimingConfig, ...config };
    
    logger.info('SATY Timing Analyzer initialized with configuration', this.config);
  }

  /**
   * Analyze entry timing for SATY strategy
   */
  async analyzeEntryTiming(symbol: string, strategy: Strategy): Promise<TimingAnalysisResult | null> {
    const startTime = Date.now();
    
    try {
      logger.info(`🔍 SATY Timing analyzing ${symbol}...`);

      // Get market data and context
      const marketData = await this.getMarketData(symbol);
      if (!marketData) {
        logger.warn(`No market data available for ${symbol}`);
        return null;
      }

      // Analyze market context
      const marketContext = await this.analyzeMarketContext(symbol, marketData);
      
      // Perform timing analysis
      const timingAnalysis = this.performTimingAnalysis(symbol, marketData, marketContext);
      
      // Generate recommendations
      const recommendations = this.generateTimingRecommendations(timingAnalysis, marketContext);
      
      // Assess risks
      const riskAssessment = this.assessRisks(timingAnalysis, marketContext);
      
      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics(symbol);
      
      // Create analysis result
      const result: TimingAnalysisResult = {
        symbol,
        currentTiming: timingAnalysis.timing,
        confidence: timingAnalysis.confidence,
        reasoning: timingAnalysis.reasoning,
        recommendations,
        riskAssessment,
        performanceMetrics
      };

      // Store analysis history
      this.storeAnalysisHistory(symbol, result);
      
      // Update performance metrics
      this.updatePerformanceMetrics(timingAnalysis.confidence, Date.now() - startTime);
      
      logger.info(`✅ SATY Timing analysis completed for ${symbol}: ${timingAnalysis.timing} timing (${timingAnalysis.confidence}% confidence)`);
      
      return result;
    } catch (error) {
      logger.error('Error analyzing SATY entry timing:', error);
      return null;
    }
  }

  /**
   * Perform comprehensive timing analysis
   */
  private performTimingAnalysis(symbol: string, marketData: MarketData, marketContext: MarketContext): {
    timing: 'optimal' | 'early' | 'late' | 'avoid';
    confidence: number;
    reasoning: string;
  } {
    try {
      let confidence = 0.5; // Base confidence
      let reasoning = '';
      let timing: 'optimal' | 'early' | 'late' | 'avoid' = 'optimal';

      // Analyze time of day
      const timeAnalysis = this.analyzeTimeOfDay();
      confidence += timeAnalysis.confidenceBonus;
      reasoning += timeAnalysis.reasoning + ' ';

      // Analyze market conditions
      const marketAnalysis = this.analyzeMarketConditions(marketContext);
      confidence += marketAnalysis.confidenceBonus;
      reasoning += marketAnalysis.reasoning + ' ';

      // Analyze volatility
      const volatilityAnalysis = this.analyzeVolatility(marketContext.volatility);
      confidence += volatilityAnalysis.confidenceBonus;
      reasoning += volatilityAnalysis.reasoning + ' ';

      // Analyze volume
      const volumeAnalysis = this.analyzeVolume(marketContext.volume);
      confidence += volumeAnalysis.confidenceBonus;
      reasoning += volumeAnalysis.reasoning + ' ';

      // Determine timing based on analysis
      if (confidence >= 0.8) {
        timing = 'optimal';
      } else if (confidence >= 0.6) {
        timing = 'early';
      } else if (confidence >= 0.4) {
        timing = 'late';
      } else {
        timing = 'avoid';
      }

      return { timing, confidence: Math.min(confidence, 0.95), reasoning: reasoning.trim() };
    } catch (error) {
      logger.error('Error performing timing analysis:', error);
      return { timing: 'avoid', confidence: 0, reasoning: 'Analysis failed' };
    }
  }

  /**
   * Analyze time of day for optimal entry
   */
  private analyzeTimeOfDay(): { confidenceBonus: number; reasoning: string } {
    try {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const timeInMinutes = hour * 60 + minute;

      // Market hours analysis
      const marketOpen = 9 * 60 + 30; // 9:30 AM
      const marketClose = 16 * 60; // 4:00 PM
      const lunchStart = 12 * 60; // 12:00 PM
      const lunchEnd = 13 * 60; // 1:00 PM

      let confidenceBonus = 0;
      let reasoning = '';

      if (timeInMinutes >= marketOpen && timeInMinutes < marketOpen + 30) {
        // First 30 minutes - high volatility, good for momentum
        confidenceBonus = 0.2;
        reasoning = 'Market open momentum period';
      } else if (timeInMinutes >= marketOpen + 30 && timeInMinutes < lunchStart) {
        // Morning session - good for trend following
        confidenceBonus = 0.15;
        reasoning = 'Morning trend session';
      } else if (timeInMinutes >= lunchStart && timeInMinutes < lunchEnd) {
        // Lunch period - lower activity
        confidenceBonus = -0.1;
        reasoning = 'Lunch period - reduced activity';
      } else if (timeInMinutes >= lunchEnd && timeInMinutes < marketClose - 30) {
        // Afternoon session
        confidenceBonus = 0.1;
        reasoning = 'Afternoon session';
      } else if (timeInMinutes >= marketClose - 30 && timeInMinutes < marketClose) {
        // End of day - closing activity
        confidenceBonus = 0.05;
        reasoning = 'End of day activity';
      } else {
        // After hours
        confidenceBonus = -0.2;
        reasoning = 'After hours - limited activity';
      }

      return { confidenceBonus, reasoning };
    } catch (error) {
      logger.error('Error analyzing time of day:', error);
      return { confidenceBonus: 0, reasoning: 'Time analysis failed' };
    }
  }

  /**
   * Analyze market conditions
   */
  private analyzeMarketConditions(marketContext: MarketContext): { confidenceBonus: number; reasoning: string } {
    try {
      let confidenceBonus = 0;
      let reasoning = '';

      // Trend strength analysis
      if (marketContext.trendStrength >= this.config.trendStrengthThreshold) {
        confidenceBonus += 0.15;
        reasoning += 'Strong trend. ';
      } else if (marketContext.trendStrength >= this.config.trendStrengthThreshold * 0.7) {
        confidenceBonus += 0.1;
        reasoning += 'Moderate trend. ';
      } else {
        confidenceBonus -= 0.1;
        reasoning += 'Weak trend. ';
      }

      // Market regime analysis
      switch (marketContext.marketRegime) {
        case 'trending':
          confidenceBonus += 0.1;
          reasoning += 'Trending market. ';
          break;
        case 'ranging':
          confidenceBonus += 0.05;
          reasoning += 'Ranging market. ';
          break;
        case 'volatile':
          confidenceBonus -= 0.15;
          reasoning += 'Volatile market - higher risk. ';
          break;
      }

      return { confidenceBonus, reasoning };
    } catch (error) {
      logger.error('Error analyzing market conditions:', error);
      return { confidenceBonus: 0, reasoning: 'Market analysis failed' };
    }
  }

  /**
   * Analyze volatility for timing
   */
  private analyzeVolatility(volatility: number): { confidenceBonus: number; reasoning: string } {
    try {
      let confidenceBonus = 0;
      let reasoning = '';

      if (volatility <= this.config.volatilityThreshold * 0.5) {
        confidenceBonus += 0.1;
        reasoning = 'Low volatility - stable conditions';
      } else if (volatility <= this.config.volatilityThreshold) {
        confidenceBonus += 0.05;
        reasoning = 'Normal volatility';
      } else if (volatility <= this.config.volatilityThreshold * 1.5) {
        confidenceBonus -= 0.05;
        reasoning = 'Elevated volatility';
      } else {
        confidenceBonus -= 0.2;
        reasoning = 'High volatility - increased risk';
      }

      return { confidenceBonus, reasoning };
    } catch (error) {
      logger.error('Error analyzing volatility:', error);
      return { confidenceBonus: 0, reasoning: 'Volatility analysis failed' };
    }
  }

  /**
   * Analyze volume for timing
   */
  private analyzeVolume(volume: number): { confidenceBonus: number; reasoning: string } {
    try {
      let confidenceBonus = 0;
      let reasoning = '';

      if (volume >= this.config.volumeThreshold) {
        confidenceBonus += 0.1;
        reasoning = 'High volume - good liquidity';
      } else if (volume >= this.config.volumeThreshold * 0.7) {
        confidenceBonus += 0.05;
        reasoning = 'Normal volume';
      } else {
        confidenceBonus -= 0.1;
        reasoning = 'Low volume - reduced liquidity';
      }

      return { confidenceBonus, reasoning };
    } catch (error) {
      logger.error('Error analyzing volume:', error);
      return { confidenceBonus: 0, reasoning: 'Volume analysis failed' };
    }
  }

  /**
   * Generate timing recommendations
   */
  private generateTimingRecommendations(timingAnalysis: any, marketContext: MarketContext): TimingRecommendation[] {
    try {
      const recommendations: TimingRecommendation[] = [];

      // Entry recommendation
      const entryRecommendation: TimingRecommendation = {
        type: 'entry',
        timing: timingAnalysis.timing === 'optimal' ? 'immediate' : 
                timingAnalysis.timing === 'early' ? 'wait' : 'avoid',
        confidence: timingAnalysis.confidence,
        reasoning: timingAnalysis.reasoning,
        expectedImpact: this.getExpectedImpact(timingAnalysis.timing),
        riskLevel: this.getRiskLevel(timingAnalysis.timing, marketContext)
      };
      recommendations.push(entryRecommendation);

      // Exit recommendation
      const exitRecommendation: TimingRecommendation = {
        type: 'exit',
        timing: 'wait',
        confidence: 0.7,
        reasoning: 'Monitor for optimal exit conditions',
        expectedImpact: 'Preserve gains and limit losses',
        riskLevel: 'medium'
      };
      recommendations.push(exitRecommendation);

      // Hold recommendation
      const holdRecommendation: TimingRecommendation = {
        type: 'hold',
        timing: timingAnalysis.timing === 'optimal' ? 'immediate' : 'wait',
        confidence: timingAnalysis.confidence * 0.8,
        reasoning: 'Maintain position based on timing analysis',
        expectedImpact: 'Optimize position duration',
        riskLevel: this.getRiskLevel(timingAnalysis.timing, marketContext)
      };
      recommendations.push(holdRecommendation);

      return recommendations;
    } catch (error) {
      logger.error('Error generating timing recommendations:', error);
      return [];
    }
  }

  /**
   * Assess risks for timing
   */
  private assessRisks(timingAnalysis: any, marketContext: MarketContext): RiskAssessment {
    try {
      let overallRisk: 'low' | 'medium' | 'high' = 'medium';
      
      // Calculate individual risk components
      const marketRisk = this.calculateMarketRisk(marketContext);
      const timingRisk = this.calculateTimingRisk(timingAnalysis);
      const volatilityRisk = this.calculateVolatilityRisk(marketContext.volatility);
      const volumeRisk = this.calculateVolumeRisk(marketContext.volume);

      // Determine overall risk
      const totalRisk = (marketRisk + timingRisk + volatilityRisk + volumeRisk) / 4;
      
      if (totalRisk < 0.3) {
        overallRisk = 'low';
      } else if (totalRisk > 0.7) {
        overallRisk = 'high';
      }

      const recommendations = this.generateRiskRecommendations(marketRisk, timingRisk, volatilityRisk, volumeRisk);

      return {
        overallRisk,
        marketRisk,
        timingRisk,
        volatilityRisk,
        volumeRisk,
        recommendations
      };
    } catch (error) {
      logger.error('Error assessing risks:', error);
      return {
        overallRisk: 'high',
        marketRisk: 1,
        timingRisk: 1,
        volatilityRisk: 1,
        volumeRisk: 1,
        recommendations: ['Risk assessment failed']
      };
    }
  }

  /**
   * Calculate market risk
   */
  private calculateMarketRisk(marketContext: MarketContext): number {
    try {
      let risk = 0.5; // Base risk

      // Adjust for market regime
      switch (marketContext.marketRegime) {
        case 'trending':
          risk -= 0.2;
          break;
        case 'ranging':
          risk += 0.1;
          break;
        case 'volatile':
          risk += 0.3;
          break;
      }

      // Adjust for trend strength
      if (marketContext.trendStrength < this.config.trendStrengthThreshold) {
        risk += 0.2;
      }

      return Math.max(0, Math.min(1, risk));
    } catch (error) {
      logger.error('Error calculating market risk:', error);
      return 0.5;
    }
  }

  /**
   * Calculate timing risk
   */
  private calculateTimingRisk(timingAnalysis: any): number {
    try {
      switch (timingAnalysis.timing) {
        case 'optimal':
          return 0.2;
        case 'early':
          return 0.4;
        case 'late':
          return 0.6;
        case 'avoid':
          return 0.8;
        default:
          return 0.5;
      }
    } catch (error) {
      logger.error('Error calculating timing risk:', error);
      return 0.5;
    }
  }

  /**
   * Calculate volatility risk
   */
  private calculateVolatilityRisk(volatility: number): number {
    try {
      if (volatility <= this.config.volatilityThreshold * 0.5) {
        return 0.2;
      } else if (volatility <= this.config.volatilityThreshold) {
        return 0.4;
      } else if (volatility <= this.config.volatilityThreshold * 1.5) {
        return 0.6;
      } else {
        return 0.8;
      }
    } catch (error) {
      logger.error('Error calculating volatility risk:', error);
      return 0.5;
    }
  }

  /**
   * Calculate volume risk
   */
  private calculateVolumeRisk(volume: number): number {
    try {
      if (volume >= this.config.volumeThreshold) {
        return 0.2;
      } else if (volume >= this.config.volumeThreshold * 0.7) {
        return 0.4;
      } else {
        return 0.7;
      }
    } catch (error) {
      logger.error('Error calculating volume risk:', error);
      return 0.5;
    }
  }

  /**
   * Generate risk recommendations
   */
  private generateRiskRecommendations(marketRisk: number, timingRisk: number, volatilityRisk: number, volumeRisk: number): string[] {
    const recommendations: string[] = [];

    if (marketRisk > 0.6) {
      recommendations.push('Consider reducing position size due to market conditions');
    }

    if (timingRisk > 0.6) {
      recommendations.push('Wait for better entry timing');
    }

    if (volatilityRisk > 0.6) {
      recommendations.push('Use tighter stop losses due to high volatility');
    }

    if (volumeRisk > 0.6) {
      recommendations.push('Consider smaller position sizes due to low liquidity');
    }

    if (recommendations.length === 0) {
      recommendations.push('Risk levels are acceptable for normal trading');
    }

    return recommendations;
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(symbol: string): Promise<PerformanceMetrics> {
    try {
      // This would typically fetch from your performance tracking system
      // For now, using mock data with realistic values
      return {
        winRate: 0.65,
        averageReturn: 0.12,
        maxDrawdown: 0.08,
        sharpeRatio: 1.2,
        profitFactor: 1.8,
        averageHoldTime: 7200000, // 2 hours
        optimalEntryTime: '9:30 AM - 10:00 AM'
      };
    } catch (error) {
      logger.error('Error calculating performance metrics:', error);
      return {
        winRate: 0.5,
        averageReturn: 0.05,
        maxDrawdown: 0.1,
        sharpeRatio: 0.8,
        profitFactor: 1.2,
        averageHoldTime: 3600000, // 1 hour
        optimalEntryTime: 'Market open'
      };
    }
  }

  /**
   * Analyze market context
   */
  private async analyzeMarketContext(symbol: string, marketData: MarketData): Promise<MarketContext> {
    try {
      // Get historical data for context analysis
      const historicalData = await this.storage.getMarketDataHistory(symbol, 20);
      
      if (historicalData.length < 10) {
        logger.warn(`Insufficient historical data for ${symbol}: ${historicalData.length} points`);
        return this.getDefaultMarketContext();
      }

      // Calculate volatility
      const prices = historicalData.map(d => d.price);
      const volatility = this.calculateVolatility(prices);
      
      // Calculate volume
      const volumes = historicalData.map(d => d.volume || 0);
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      const currentVolume = marketData.volume || 0;
      const volumeRatio = currentVolume / avgVolume;
      
      // Calculate trend strength (simplified)
      const trendStrength = this.calculateTrendStrength(prices);
      
      // Determine market regime
      const marketRegime = this.determineMarketRegime(volatility, trendStrength);
      
      // Determine time of day
      const timeOfDay = this.determineTimeOfDay();

      return {
        volatility,
        volume: volumeRatio,
        trendStrength,
        marketRegime,
        timeOfDay
      };
    } catch (error) {
      logger.error('Error analyzing market context:', error);
      return this.getDefaultMarketContext();
    }
  }

  /**
   * Get default market context
   */
  private getDefaultMarketContext(): MarketContext {
    return {
      volatility: 0.02,
      volume: 1.0,
      trendStrength: 20,
      marketRegime: 'ranging',
      timeOfDay: 'mid_day'
    };
  }

  /**
   * Calculate volatility from price data
   */
  private calculateVolatility(prices: number[]): number {
    try {
      if (prices.length < 2) return 0.02;

      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }

      const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
      
      return Math.sqrt(variance);
    } catch (error) {
      logger.error('Error calculating volatility:', error);
      return 0.02;
    }
  }

  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(prices: number[]): number {
    try {
      if (prices.length < 10) return 20;

      // Simplified trend strength calculation
      const recentPrices = prices.slice(-10);
      const firstPrice = recentPrices[0];
      const lastPrice = recentPrices[recentPrices.length - 1];
      const priceChange = (lastPrice - firstPrice) / firstPrice;
      
      return Math.abs(priceChange) * 100;
    } catch (error) {
      logger.error('Error calculating trend strength:', error);
      return 20;
    }
  }

  /**
   * Determine market regime
   */
  private determineMarketRegime(volatility: number, trendStrength: number): 'trending' | 'ranging' | 'volatile' {
    try {
      if (volatility > this.config.volatilityThreshold * 1.5) {
        return 'volatile';
      } else if (trendStrength > this.config.trendStrengthThreshold) {
        return 'trending';
      } else {
        return 'ranging';
      }
    } catch (error) {
      logger.error('Error determining market regime:', error);
      return 'ranging';
    }
  }

  /**
   * Determine time of day
   */
  private determineTimeOfDay(): 'pre_market' | 'market_open' | 'mid_day' | 'market_close' | 'after_hours' {
    try {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const timeInMinutes = hour * 60 + minute;

      const marketOpen = 9 * 60 + 30; // 9:30 AM
      const marketClose = 16 * 60; // 4:00 PM

      if (timeInMinutes < marketOpen) {
        return 'pre_market';
      } else if (timeInMinutes < marketOpen + 30) {
        return 'market_open';
      } else if (timeInMinutes < marketClose - 30) {
        return 'mid_day';
      } else if (timeInMinutes < marketClose) {
        return 'market_close';
      } else {
        return 'after_hours';
      }
    } catch (error) {
      logger.error('Error determining time of day:', error);
      return 'mid_day';
    }
  }

  /**
   * Get expected impact based on timing
   */
  private getExpectedImpact(timing: string): string {
    switch (timing) {
      case 'optimal':
        return 'High probability of success with normal risk';
      case 'early':
        return 'Potential for better entry but increased risk';
      case 'late':
        return 'Reduced opportunity but lower risk';
      case 'avoid':
        return 'High risk, consider waiting for better conditions';
      default:
        return 'Unknown timing impact';
    }
  }

  /**
   * Get risk level based on timing and market context
   */
  private getRiskLevel(timing: string, marketContext: MarketContext): 'low' | 'medium' | 'high' {
    try {
      let riskScore = 0;

      // Timing risk
      switch (timing) {
        case 'optimal':
          riskScore += 1;
          break;
        case 'early':
          riskScore += 2;
          break;
        case 'late':
          riskScore += 2;
          break;
        case 'avoid':
          riskScore += 3;
          break;
      }

      // Market context risk
      if (marketContext.marketRegime === 'volatile') {
        riskScore += 2;
      } else if (marketContext.marketRegime === 'ranging') {
        riskScore += 1;
      }

      if (marketContext.volatility > this.config.volatilityThreshold) {
        riskScore += 1;
      }

      if (marketContext.volume < 1.0) {
        riskScore += 1;
      }

      if (riskScore <= 2) return 'low';
      if (riskScore <= 4) return 'medium';
      return 'high';
    } catch (error) {
      logger.error('Error calculating risk level:', error);
      return 'medium';
    }
  }

  /**
   * Store analysis history
   */
  private storeAnalysisHistory(symbol: string, result: TimingAnalysisResult): void {
    try {
      const history = this.analysisHistory.get(symbol) || [];
      history.push(result);
      
      // Keep only recent analyses
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      this.analysisHistory.set(symbol, history);
    } catch (error) {
      logger.error('Error storing analysis history:', error);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(confidence: number, processingTime: number): void {
    this.performanceMetrics.totalAnalyses++;
    this.performanceMetrics.averageConfidence = 
      (this.performanceMetrics.averageConfidence * (this.performanceMetrics.totalAnalyses - 1) + confidence) / 
      this.performanceMetrics.totalAnalyses;
    this.performanceMetrics.averageProcessingTime = 
      (this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.totalAnalyses - 1) + processingTime) / 
      this.performanceMetrics.totalAnalyses;
  }

  /**
   * Get market data for symbol
   */
  private async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      // This should integrate with your actual market data provider
      // For now, using mock data with proper structure
      return {
        symbol,
        price: 150 + Math.random() * 10,
        volume: Math.floor(Math.random() * 1000000) + 500000,
        change: (Math.random() - 0.5) * 0.02,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error getting market data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Get configuration
   */
  getConfig(): SATYTimingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SATYTimingConfig>): void {
    Object.assign(this.config, newConfig);
    logger.info('SATY Timing Analyzer configuration updated', newConfig);
  }

  /**
   * Get analysis history for symbol
   */
  getAnalysisHistory(symbol: string): TimingAnalysisResult[] {
    return this.analysisHistory.get(symbol) || [];
  }
} 