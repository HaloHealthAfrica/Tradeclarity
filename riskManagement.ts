import { RiskManagement } from './types';

class RiskManager implements RiskManagement {
  calculatePositionSize(price: number, entry: number, stopLoss: number): number {
    const riskAmount = Math.abs(entry - stopLoss);
    const positionSize = 1000 / riskAmount; // $1000 risk per trade
    return Math.floor(positionSize);
  }

  calculateStopLoss(entry: number, riskPercent: number): number {
    return entry * (1 - riskPercent / 100);
  }

  calculateTakeProfit(entry: number, rewardPercent: number): number {
    return entry * (1 + rewardPercent / 100);
  }
}

export const riskManager = new RiskManager();

// Export the function directly
export const calculatePositionSize = (price: number, entry: number, stopLoss: number): number => {
  const riskAmount = Math.abs(entry - stopLoss);
  const positionSize = 1000 / riskAmount; // $1000 risk per trade
  return Math.floor(positionSize);
}; 