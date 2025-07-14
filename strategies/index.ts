// Strategy index - imports all strategies to ensure auto-registration
// Add new strategies here to make them available

// Import all strategies (this ensures they get registered)
import './EMAConfluence';
import './SqueezeStrategy';
import './ExampleStrategy';
import './ICTStrategy';
import './ABCDFibinachiStrategy';
import './BreakAndHoldStrategy';
import './RevStratStrategy';
import './OptimizedRevStratStrategy';
import './RevStratAnalyzer';
import './SATYSignalGenerator';
import './SATYTimingAnalyzer';
import './FVGStrategy';

// Export strategy loader functions
export { 
  loadAllStrategies, 
  loadStrategy, 
  registerStrategy, 
  getAvailableStrategies,
  getStrategyConfig,
  discoverStrategies,
  createStrategy
} from './StrategyLoader';

// Export base strategy for creating new strategies
export { BaseStrategy } from './BaseStrategy';

// Export individual strategies
export { EMAConfluence } from './EMAConfluence';
export { SqueezeStrategy } from './SqueezeStrategy';
export { ExampleStrategy } from './ExampleStrategy';
export { ICTStrategy } from './ICTStrategy';
export { ABCDFibinachiStrategy } from './ABCDFibinachiStrategy';
export { BreakAndHoldStrategy } from './BreakAndHoldStrategy';
export { RevStratStrategy } from './RevStratStrategy';
export { OptimizedRevStratStrategy } from './OptimizedRevStratStrategy';
export { RevStratAnalyzer } from './RevStratAnalyzer';
export { SATYSignalGenerator } from './SATYSignalGenerator';
export { SATYTimingAnalyzer } from './SATYTimingAnalyzer'; 