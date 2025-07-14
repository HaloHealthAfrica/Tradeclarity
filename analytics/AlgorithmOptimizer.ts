import { createModuleLogger } from '../utils/logger';
import { backtester, BacktestConfig, BacktestResult } from './Backtester';
import { marketDataStorage } from './MarketDataStorage';

const logger = createModuleLogger('AlgorithmOptimizer');

export interface OptimizationConfig {
  strategy: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  parameters: Record<string, number[]>;
  optimizationMethod: 'grid' | 'genetic' | 'bayesian';
  fitnessMetric: 'sharpe' | 'returns' | 'calmar' | 'custom';
  maxIterations: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
}

export interface OptimizationResult {
  strategy: string;
  bestParameters: Record<string, number>;
  bestResult: BacktestResult;
  optimizationHistory: OptimizationStep[];
  statistics: {
    totalIterations: number;
    bestFitness: number;
    averageFitness: number;
    convergenceRate: number;
    executionTime: number;
  };
}

export interface OptimizationStep {
  iteration: number;
  parameters: Record<string, number>;
  fitness: number;
  result: BacktestResult;
  timestamp: string;
}

export interface ParameterRange {
  min: number;
  max: number;
  step: number;
  type: 'integer' | 'float';
}

export class AlgorithmOptimizer {
  private isOptimizing = false;
  private optimizationHistory: OptimizationStep[] = [];

  constructor() {
    logger.info('AlgorithmOptimizer initialized');
  }

  /**
   * Run parameter optimization
   */
  async optimizeAlgorithm(config: OptimizationConfig): Promise<OptimizationResult> {
    try {
      if (this.isOptimizing) {
        throw new Error('Optimization already in progress');
      }

      this.isOptimizing = true;
      this.optimizationHistory = [];
      
      const startTime = Date.now();
      logger.info('Starting algorithm optimization', { 
        strategy: config.strategy, 
        method: config.optimizationMethod 
      });

      let bestResult: OptimizationResult | null = null;

      switch (config.optimizationMethod) {
        case 'grid':
          bestResult = await this.gridSearch(config);
          break;
        case 'genetic':
          bestResult = await this.geneticAlgorithm(config);
          break;
        case 'bayesian':
          bestResult = await this.bayesianOptimization(config);
          break;
        default:
          throw new Error(`Unknown optimization method: ${config.optimizationMethod}`);
      }

      const executionTime = Date.now() - startTime;
      
      if (bestResult) {
        bestResult.statistics.executionTime = executionTime;
        bestResult.statistics.totalIterations = this.optimizationHistory.length;
        
        // Calculate statistics
        const fitnessValues = this.optimizationHistory.map(step => step.fitness);
        bestResult.statistics.bestFitness = Math.max(...fitnessValues);
        bestResult.statistics.averageFitness = fitnessValues.reduce((sum, val) => sum + val, 0) / fitnessValues.length;
        bestResult.statistics.convergenceRate = this.calculateConvergenceRate();
      }

      logger.info('Algorithm optimization completed', {
        strategy: config.strategy,
        bestFitness: bestResult?.statistics.bestFitness,
        iterations: bestResult?.statistics.totalIterations,
        executionTime
      });

      return bestResult!;
    } catch (error) {
      logger.error('Error optimizing algorithm:', error);
      throw error;
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Grid search optimization
   */
  private async gridSearch(config: OptimizationConfig): Promise<OptimizationResult> {
    try {
      logger.info('Starting grid search optimization');

      const parameterCombinations = this.generateParameterCombinations(config.parameters);
      let bestStep: OptimizationStep | null = null;
      let bestFitness = -Infinity;

      for (let i = 0; i < Math.min(config.maxIterations, parameterCombinations.length); i++) {
        const parameters = parameterCombinations[i];
        
        try {
          const backtestConfig: BacktestConfig = {
            strategy: config.strategy,
            symbols: config.symbols,
            startDate: config.startDate,
            endDate: config.endDate,
            initialCapital: config.initialCapital,
            commission: 0.1,
            slippage: 0.05,
            positionSize: 1000,
            riskManagement: {
              maxPositionSize: 5000,
              maxDailyLoss: 1000,
              stopLoss: 2,
              takeProfit: 4
            },
            ...parameters
          };

          const result = await backtester.runBacktest(backtestConfig);
          const fitness = this.calculateFitness(result, config.fitnessMetric);

          const step: OptimizationStep = {
            iteration: i + 1,
            parameters,
            fitness,
            result,
            timestamp: new Date().toISOString()
          };

          this.optimizationHistory.push(step);

          if (fitness > bestFitness) {
            bestFitness = fitness;
            bestStep = step;
          }

          logger.debug(`Grid search iteration ${i + 1}`, { 
            parameters, 
            fitness, 
            bestFitness 
          });
        } catch (error) {
          logger.warn(`Error in grid search iteration ${i + 1}:`, error);
        }
      }

      if (!bestStep) {
        throw new Error('No valid optimization results found');
      }

      return {
        strategy: config.strategy,
        bestParameters: bestStep.parameters,
        bestResult: bestStep.result,
        optimizationHistory: this.optimizationHistory,
        statistics: {
          totalIterations: 0,
          bestFitness: 0,
          averageFitness: 0,
          convergenceRate: 0,
          executionTime: 0
        }
      };
    } catch (error) {
      logger.error('Error in grid search:', error);
      throw error;
    }
  }

  /**
   * Genetic algorithm optimization
   */
  private async geneticAlgorithm(config: OptimizationConfig): Promise<OptimizationResult> {
    try {
      logger.info('Starting genetic algorithm optimization');

      const populationSize = config.populationSize || 50;
      const mutationRate = config.mutationRate || 0.1;
      const crossoverRate = config.crossoverRate || 0.8;

      // Initialize population
      let population = this.initializePopulation(config.parameters, populationSize);
      let bestStep: OptimizationStep | null = null;
      let bestFitness = -Infinity;

      for (let generation = 0; generation < config.maxIterations; generation++) {
        // Evaluate population
        const evaluatedPopulation = await this.evaluatePopulation(population, config);
        
        // Find best individual
        const bestIndividual = evaluatedPopulation.reduce((best, current) => 
          current.fitness > best.fitness ? current : best
        );

        if (bestIndividual.fitness > bestFitness) {
          bestFitness = bestIndividual.fitness;
          bestStep = bestIndividual;
        }

        // Selection
        const selected = this.selection(evaluatedPopulation, populationSize);

        // Crossover
        const offspring = this.crossover(selected, crossoverRate);

        // Mutation
        const mutated = this.mutation(offspring, mutationRate, config.parameters);

        // Update population
        population = mutated;

        logger.debug(`Generation ${generation + 1}`, { 
          bestFitness: bestIndividual.fitness, 
          averageFitness: this.calculateAverageFitness(evaluatedPopulation) 
        });
      }

      if (!bestStep) {
        throw new Error('No valid optimization results found');
      }

      return {
        strategy: config.strategy,
        bestParameters: bestStep.parameters,
        bestResult: bestStep.result,
        optimizationHistory: this.optimizationHistory,
        statistics: {
          totalIterations: 0,
          bestFitness: 0,
          averageFitness: 0,
          convergenceRate: 0,
          executionTime: 0
        }
      };
    } catch (error) {
      logger.error('Error in genetic algorithm:', error);
      throw error;
    }
  }

  /**
   * Bayesian optimization
   */
  private async bayesianOptimization(config: OptimizationConfig): Promise<OptimizationResult> {
    try {
      logger.info('Starting Bayesian optimization');

      let bestStep: OptimizationStep | null = null;
      let bestFitness = -Infinity;

      // Initialize with random points
      const initialPoints = this.generateRandomParameters(config.parameters, Math.min(10, config.maxIterations));
      
      for (let i = 0; i < initialPoints.length; i++) {
        const parameters = initialPoints[i];
        
        try {
          const backtestConfig: BacktestConfig = {
            strategy: config.strategy,
            symbols: config.symbols,
            startDate: config.startDate,
            endDate: config.endDate,
            initialCapital: config.initialCapital,
            commission: 0.1,
            slippage: 0.05,
            positionSize: 1000,
            riskManagement: {
              maxPositionSize: 5000,
              maxDailyLoss: 1000,
              stopLoss: 2,
              takeProfit: 4
            },
            ...parameters
          };

          const result = await backtester.runBacktest(backtestConfig);
          const fitness = this.calculateFitness(result, config.fitnessMetric);

          const step: OptimizationStep = {
            iteration: i + 1,
            parameters,
            fitness,
            result,
            timestamp: new Date().toISOString()
          };

          this.optimizationHistory.push(step);

          if (fitness > bestFitness) {
            bestFitness = fitness;
            bestStep = step;
          }
        } catch (error) {
          logger.warn(`Error in Bayesian optimization iteration ${i + 1}:`, error);
        }
      }

      // Continue with acquisition function optimization
      for (let i = initialPoints.length; i < config.maxIterations; i++) {
        // Generate next point using acquisition function
        const nextParameters = this.generateNextPoint(config.parameters);
        
        try {
          const backtestConfig: BacktestConfig = {
            strategy: config.strategy,
            symbols: config.symbols,
            startDate: config.startDate,
            endDate: config.endDate,
            initialCapital: config.initialCapital,
            commission: 0.1,
            slippage: 0.05,
            positionSize: 1000,
            riskManagement: {
              maxPositionSize: 5000,
              maxDailyLoss: 1000,
              stopLoss: 2,
              takeProfit: 4
            },
            ...nextParameters
          };

          const result = await backtester.runBacktest(backtestConfig);
          const fitness = this.calculateFitness(result, config.fitnessMetric);

          const step: OptimizationStep = {
            iteration: i + 1,
            parameters: nextParameters,
            fitness,
            result,
            timestamp: new Date().toISOString()
          };

          this.optimizationHistory.push(step);

          if (fitness > bestFitness) {
            bestFitness = fitness;
            bestStep = step;
          }
        } catch (error) {
          logger.warn(`Error in Bayesian optimization iteration ${i + 1}:`, error);
        }
      }

      if (!bestStep) {
        throw new Error('No valid optimization results found');
      }

      return {
        strategy: config.strategy,
        bestParameters: bestStep.parameters,
        bestResult: bestStep.result,
        optimizationHistory: this.optimizationHistory,
        statistics: {
          totalIterations: 0,
          bestFitness: 0,
          averageFitness: 0,
          convergenceRate: 0,
          executionTime: 0
        }
      };
    } catch (error) {
      logger.error('Error in Bayesian optimization:', error);
      throw error;
    }
  }

  /**
   * Calculate fitness score
   */
  private calculateFitness(result: BacktestResult, metric: string): number {
    try {
      switch (metric) {
        case 'sharpe':
          return result.sharpeRatio;
        case 'returns':
          return result.totalReturn;
        case 'calmar':
          return result.riskMetrics.calmarRatio;
        case 'custom':
          // Custom fitness function combining multiple metrics
          return (result.sharpeRatio * 0.4) + 
                 (result.totalReturn * 0.3) + 
                 (result.winRate * 0.2) + 
                 ((1 - result.maxDrawdown) * 0.1);
        default:
          return result.totalReturn;
      }
    } catch (error) {
      logger.error('Error calculating fitness:', error);
      return -Infinity;
    }
  }

  /**
   * Generate parameter combinations
   */
  private generateParameterCombinations(parameters: Record<string, number[]>): Record<string, number>[] {
    const keys = Object.keys(parameters);
    const combinations: Record<string, number>[] = [];

    const generateCombinations = (index: number, current: Record<string, number>) => {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      const key = keys[index];
      const values = parameters[key];

      for (const value of values) {
        current[key] = value;
        generateCombinations(index + 1, current);
      }
    };

    generateCombinations(0, {});
    return combinations;
  }

  /**
   * Initialize population for genetic algorithm
   */
  private initializePopulation(parameters: Record<string, number[]>, size: number): Record<string, number>[] {
    const population: Record<string, number>[] = [];

    for (let i = 0; i < size; i++) {
      const individual: Record<string, number> = {};
      
      for (const [key, values] of Object.entries(parameters)) {
        individual[key] = values[Math.floor(Math.random() * values.length)];
      }
      
      population.push(individual);
    }

    return population;
  }

  /**
   * Evaluate population
   */
  private async evaluatePopulation(
    population: Record<string, number>[], 
    config: OptimizationConfig
  ): Promise<OptimizationStep[]> {
    const evaluated: OptimizationStep[] = [];

    for (let i = 0; i < population.length; i++) {
      const parameters = population[i];
      
      try {
        const backtestConfig: BacktestConfig = {
          strategy: config.strategy,
          symbols: config.symbols,
          startDate: config.startDate,
          endDate: config.endDate,
          initialCapital: config.initialCapital,
          commission: 0.1,
          slippage: 0.05,
          positionSize: 1000,
          riskManagement: {
            maxPositionSize: 5000,
            maxDailyLoss: 1000,
            stopLoss: 2,
            takeProfit: 4
          },
          ...parameters
        };

        const result = await backtester.runBacktest(backtestConfig);
        const fitness = this.calculateFitness(result, config.fitnessMetric);

        const step: OptimizationStep = {
          iteration: this.optimizationHistory.length + i + 1,
          parameters,
          fitness,
          result,
          timestamp: new Date().toISOString()
        };

        evaluated.push(step);
        this.optimizationHistory.push(step);
      } catch (error) {
        logger.warn(`Error evaluating individual ${i + 1}:`, error);
      }
    }

    return evaluated;
  }

  /**
   * Selection for genetic algorithm
   */
  private selection(population: OptimizationStep[], size: number): Record<string, number>[] {
    // Tournament selection
    const selected: Record<string, number>[] = [];

    for (let i = 0; i < size; i++) {
      const tournamentSize = 3;
      let best: OptimizationStep | null = null;

      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        const candidate = population[randomIndex];

        if (!best || candidate.fitness > best.fitness) {
          best = candidate;
        }
      }

      if (best) {
        selected.push(best.parameters);
      }
    }

    return selected;
  }

  /**
   * Crossover for genetic algorithm
   */
  private crossover(population: Record<string, number>[], rate: number): Record<string, number>[] {
    const offspring: Record<string, number>[] = [];

    for (let i = 0; i < population.length; i += 2) {
      if (i + 1 < population.length && Math.random() < rate) {
        const parent1 = population[i];
        const parent2 = population[i + 1];
        const keys = Object.keys(parent1);

        const child1: Record<string, number> = {};
        const child2: Record<string, number> = {};

        for (const key of keys) {
          if (Math.random() < 0.5) {
            child1[key] = parent1[key];
            child2[key] = parent2[key];
          } else {
            child1[key] = parent2[key];
            child2[key] = parent1[key];
          }
        }

        offspring.push(child1, child2);
      } else {
        offspring.push(population[i]);
        if (i + 1 < population.length) {
          offspring.push(population[i + 1]);
        }
      }
    }

    return offspring;
  }

  /**
   * Mutation for genetic algorithm
   */
  private mutation(
    population: Record<string, number>[], 
    rate: number, 
    parameterRanges: Record<string, number[]>
  ): Record<string, number>[] {
    const mutated = population.map(individual => {
      const newIndividual: Record<string, number> = { ...individual };

      for (const [key, values] of Object.entries(parameterRanges)) {
        if (Math.random() < rate) {
          newIndividual[key] = values[Math.floor(Math.random() * values.length)];
        }
      }

      return newIndividual;
    });

    return mutated;
  }

  /**
   * Generate random parameters
   */
  private generateRandomParameters(parameters: Record<string, number[]>, count: number): Record<string, number>[] {
    const randomParams: Record<string, number>[] = [];

    for (let i = 0; i < count; i++) {
      const individual: Record<string, number> = {};
      
      for (const [key, values] of Object.entries(parameters)) {
        individual[key] = values[Math.floor(Math.random() * values.length)];
      }
      
      randomParams.push(individual);
    }

    return randomParams;
  }

  /**
   * Generate next point for Bayesian optimization
   */
  private generateNextPoint(parameters: Record<string, number[]>): Record<string, number> {
    const nextPoint: Record<string, number> = {};
    
    for (const [key, values] of Object.entries(parameters)) {
      nextPoint[key] = values[Math.floor(Math.random() * values.length)];
    }
    
    return nextPoint;
  }

  /**
   * Calculate average fitness
   */
  private calculateAverageFitness(population: OptimizationStep[]): number {
    if (population.length === 0) return 0;
    
    const totalFitness = population.reduce((sum, individual) => sum + individual.fitness, 0);
    return totalFitness / population.length;
  }

  /**
   * Calculate convergence rate
   */
  private calculateConvergenceRate(): number {
    if (this.optimizationHistory.length < 10) return 0;

    const recentFitness = this.optimizationHistory.slice(-10).map(step => step.fitness);
    const bestFitness = Math.max(...recentFitness);
    const averageFitness = recentFitness.reduce((sum, val) => sum + val, 0) / recentFitness.length;

    return (averageFitness / bestFitness) * 100;
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): OptimizationStep[] {
    return [...this.optimizationHistory];
  }

  /**
   * Export optimization results
   */
  exportResults(result: OptimizationResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * Compare multiple optimization runs
   */
  async compareOptimizations(
    configs: OptimizationConfig[]
  ): Promise<{ config: OptimizationConfig; result: OptimizationResult }[]> {
    try {
      logger.info('Starting comparison of multiple optimizations', { count: configs.length });

      const results = [];

      for (const config of configs) {
        try {
          const result = await this.optimizeAlgorithm(config);
          results.push({ config, result });
        } catch (error) {
          logger.error(`Error in optimization for ${config.strategy}:`, error);
        }
      }

      // Sort by best fitness
      results.sort((a, b) => b.result.statistics.bestFitness - a.result.statistics.bestFitness);

      logger.info('Optimization comparison completed', {
        successful: results.length,
        bestStrategy: results[0]?.config.strategy
      });

      return results;
    } catch (error) {
      logger.error('Error comparing optimizations:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const algorithmOptimizer = new AlgorithmOptimizer(); 