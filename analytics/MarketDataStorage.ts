import { createModuleLogger } from '../utils/logger';
import { Candle } from '../types';
import fs from 'fs/promises';
import path from 'path';

const logger = createModuleLogger('MarketDataStorage');

export interface MarketDataRecord {
  symbol: string;
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  interval: string;
  source: string;
  createdAt: string;
}

export interface MarketDataQuery {
  symbol: string;
  startDate: string;
  endDate: string;
  interval?: string;
  limit?: number;
}

export interface MarketDataStats {
  symbol: string;
  totalRecords: number;
  dateRange: {
    start: string;
    end: string;
  };
  intervals: string[];
  lastUpdated: string;
  dataQuality: {
    completeness: number;
    accuracy: number;
    gaps: number;
  };
}

export class MarketDataStorage {
  private dataDir: string;
  private cache: Map<string, MarketDataRecord[]> = new Map();
  private isInitialized = false;

  constructor(dataDir: string = './data/market') {
    this.dataDir = dataDir;
  }

  /**
   * Initialize storage
   */
  async initialize(): Promise<void> {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Create subdirectories for different data types
      await fs.mkdir(path.join(this.dataDir, 'daily'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'intraday'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'backtest'), { recursive: true });
      
      this.isInitialized = true;
      logger.info('Market data storage initialized', { dataDir: this.dataDir });
    } catch (error) {
      logger.error('Error initializing market data storage:', error);
      throw error;
    }
  }

  /**
   * Store market data
   */
  async storeMarketData(data: MarketDataRecord[]): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('Storing market data', { 
        records: data.length, 
        symbols: [...new Set(data.map(d => d.symbol))] 
      });

      // Group data by symbol and date
      const groupedData = this.groupDataBySymbolAndDate(data);

      for (const [symbol, symbolData] of groupedData) {
        for (const [date, dateData] of symbolData) {
          const filename = this.getDataFilename(symbol, date, dateData[0].interval);
          const filepath = path.join(this.dataDir, filename);

          // Write data to file
          await fs.writeFile(filepath, JSON.stringify(dateData, null, 2));
          
          // Update cache
          const cacheKey = `${symbol}_${date}_${dateData[0].interval}`;
          this.cache.set(cacheKey, dateData);
        }
      }

      logger.info('Market data stored successfully');
    } catch (error) {
      logger.error('Error storing market data:', error);
      throw error;
    }
  }

  /**
   * Retrieve market data
   */
  async getMarketData(query: MarketDataQuery): Promise<MarketDataRecord[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('Retrieving market data', query);

      const results: MarketDataRecord[] = [];
      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Try to get from cache first
        const cacheKey = `${query.symbol}_${dateStr}_${query.interval || '1d'}`;
        let data = this.cache.get(cacheKey);

        if (!data) {
          // Try to load from file
          const filename = this.getDataFilename(query.symbol, dateStr, query.interval || '1d');
          const filepath = path.join(this.dataDir, filename);

          try {
            const fileData = await fs.readFile(filepath, 'utf-8');
            data = JSON.parse(fileData);
            this.cache.set(cacheKey, data);
          } catch (error) {
            // File doesn't exist, skip this date
            logger.debug(`No data found for ${query.symbol} on ${dateStr}`);
          }
        }

        if (data) {
          results.push(...data);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Apply limit if specified
      if (query.limit && results.length > query.limit) {
        results.splice(query.limit);
      }

      logger.info('Market data retrieved successfully', { 
        symbol: query.symbol, 
        records: results.length 
      });

      return results;
    } catch (error) {
      logger.error('Error retrieving market data:', error);
      throw error;
    }
  }

  /**
   * Store daily market data
   */
  async storeDailyData(symbol: string, data: Candle[]): Promise<void> {
    try {
      const records: MarketDataRecord[] = data.map(candle => ({
        symbol: candle.symbol,
        date: new Date(candle.timestamp).toISOString().split('T')[0],
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        interval: candle.interval,
        source: 'twelvedata',
        createdAt: new Date().toISOString()
      }));

      await this.storeMarketData(records);
    } catch (error) {
      logger.error('Error storing daily data:', error);
      throw error;
    }
  }

  /**
   * Store intraday market data
   */
  async storeIntradayData(symbol: string, data: Candle[]): Promise<void> {
    try {
      const records: MarketDataRecord[] = data.map(candle => ({
        symbol: candle.symbol,
        date: new Date(candle.timestamp).toISOString().split('T')[0],
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        interval: candle.interval,
        source: 'twelvedata',
        createdAt: new Date().toISOString()
      }));

      await this.storeMarketData(records);
    } catch (error) {
      logger.error('Error storing intraday data:', error);
      throw error;
    }
  }

  /**
   * Get market data statistics
   */
  async getMarketDataStats(symbol: string): Promise<MarketDataStats> {
    try {
      const symbolDir = path.join(this.dataDir, symbol);
      const files = await fs.readdir(symbolDir).catch(() => []);

      const stats: MarketDataStats = {
        symbol,
        totalRecords: 0,
        dateRange: {
          start: '',
          end: ''
        },
        intervals: [],
        lastUpdated: '',
        dataQuality: {
          completeness: 0,
          accuracy: 0,
          gaps: 0
        }
      };

      const dates: string[] = [];
      const intervals = new Set<string>();

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(symbolDir, file);
            const data = JSON.parse(await fs.readFile(filepath, 'utf-8'));
            
            stats.totalRecords += data.length;
            dates.push(...data.map((d: MarketDataRecord) => d.date));
            data.forEach((d: MarketDataRecord) => intervals.add(d.interval));
            
            // Update last updated
            const lastRecord = data[data.length - 1];
            if (lastRecord && lastRecord.createdAt > stats.lastUpdated) {
              stats.lastUpdated = lastRecord.createdAt;
            }
          } catch (error) {
            logger.warn(`Error reading file ${file}:`, error);
          }
        }
      }

      if (dates.length > 0) {
        dates.sort();
        stats.dateRange.start = dates[0];
        stats.dateRange.end = dates[dates.length - 1];
        stats.intervals = Array.from(intervals);

        // Calculate data quality
        const expectedDays = Math.ceil((new Date(stats.dateRange.end).getTime() - new Date(stats.dateRange.start).getTime()) / (1000 * 60 * 60 * 24));
        stats.dataQuality.completeness = (dates.length / expectedDays) * 100;
        stats.dataQuality.accuracy = 95; // Mock accuracy
        stats.dataQuality.gaps = Math.max(0, expectedDays - dates.length);
      }

      return stats;
    } catch (error) {
      logger.error('Error getting market data stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(daysToKeep: number = 365): Promise<void> {
    try {
      logger.info('Cleaning up old market data', { daysToKeep });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const files = await this.getAllDataFiles();
      let deletedCount = 0;

      for (const file of files) {
        try {
          const data = JSON.parse(await fs.readFile(file, 'utf-8'));
          const oldestRecord = data[0];
          
          if (oldestRecord && new Date(oldestRecord.date) < cutoffDate) {
            await fs.unlink(file);
            deletedCount++;
          }
        } catch (error) {
          logger.warn(`Error processing file ${file}:`, error);
        }
      }

      // Clear cache entries for deleted files
      this.cache.clear();

      logger.info('Cleanup completed', { deletedFiles: deletedCount });
    } catch (error) {
      logger.error('Error cleaning up old data:', error);
      throw error;
    }
  }

  /**
   * Export market data
   */
  async exportMarketData(query: MarketDataQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const data = await this.getMarketData(query);
      
      if (format === 'csv') {
        return this.convertToCSV(data);
      } else {
        return JSON.stringify(data, null, 2);
      }
    } catch (error) {
      logger.error('Error exporting market data:', error);
      throw error;
    }
  }

  /**
   * Import market data
   */
  async importMarketData(data: MarketDataRecord[]): Promise<void> {
    try {
      await this.storeMarketData(data);
      logger.info('Market data imported successfully', { records: data.length });
    } catch (error) {
      logger.error('Error importing market data:', error);
      throw error;
    }
  }

  /**
   * Get all available symbols
   */
  async getAvailableSymbols(): Promise<string[]> {
    try {
      const symbols = new Set<string>();
      const files = await this.getAllDataFiles();

      for (const file of files) {
        try {
          const data = JSON.parse(await fs.readFile(file, 'utf-8'));
          data.forEach((record: MarketDataRecord) => symbols.add(record.symbol));
        } catch (error) {
          logger.warn(`Error reading file ${file}:`, error);
        }
      }

      return Array.from(symbols);
    } catch (error) {
      logger.error('Error getting available symbols:', error);
      throw error;
    }
  }

  /**
   * Get data quality report
   */
  async getDataQualityReport(symbol: string): Promise<{
    symbol: string;
    completeness: number;
    accuracy: number;
    gaps: string[];
    recommendations: string[];
  }> {
    try {
      const stats = await this.getMarketDataStats(symbol);
      
      const gaps: string[] = [];
      const recommendations: string[] = [];

      // Identify gaps in data
      if (stats.dateRange.start && stats.dateRange.end) {
        const startDate = new Date(stats.dateRange.start);
        const endDate = new Date(stats.dateRange.end);
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const filename = this.getDataFilename(symbol, dateStr, '1d');
          const filepath = path.join(this.dataDir, filename);

          try {
            await fs.access(filepath);
          } catch {
            gaps.push(dateStr);
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Generate recommendations
      if (stats.dataQuality.completeness < 90) {
        recommendations.push('Data completeness is below 90%. Consider fetching missing data.');
      }

      if (stats.dataQuality.gaps > 0) {
        recommendations.push(`Found ${stats.dataQuality.gaps} gaps in data. Fill missing dates.`);
      }

      if (stats.intervals.length === 0) {
        recommendations.push('No data intervals found. Verify data source.');
      }

      return {
        symbol,
        completeness: stats.dataQuality.completeness,
        accuracy: stats.dataQuality.accuracy,
        gaps,
        recommendations
      };
    } catch (error) {
      logger.error('Error getting data quality report:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private groupDataBySymbolAndDate(data: MarketDataRecord[]): Map<string, Map<string, MarketDataRecord[]>> {
    const grouped = new Map<string, Map<string, MarketDataRecord[]>>();

    for (const record of data) {
      if (!grouped.has(record.symbol)) {
        grouped.set(record.symbol, new Map());
      }

      const symbolData = grouped.get(record.symbol)!;
      if (!symbolData.has(record.date)) {
        symbolData.set(record.date, []);
      }

      symbolData.get(record.date)!.push(record);
    }

    return grouped;
  }

  private getDataFilename(symbol: string, date: string, interval: string): string {
    return `${symbol}_${date}_${interval}.json`;
  }

  private async getAllDataFiles(): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(this.dataDir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isFile() && item.name.endsWith('.json')) {
          files.push(path.join(this.dataDir, item.name));
        } else if (item.isDirectory()) {
          const subFiles = await fs.readdir(path.join(this.dataDir, item.name));
          subFiles.forEach(file => {
            if (file.endsWith('.json')) {
              files.push(path.join(this.dataDir, item.name, file));
            }
          });
        }
      }
    } catch (error) {
      logger.warn('Error reading data directory:', error);
    }

    return files;
  }

  private convertToCSV(data: MarketDataRecord[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const record of data) {
      const row = headers.map(header => {
        const value = record[header as keyof MarketDataRecord];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}

// Export singleton instance
export const marketDataStorage = new MarketDataStorage(); 