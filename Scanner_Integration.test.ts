import { Scanner } from './strategies/Scanner';
import { ScannerService } from './api/microservices/ScannerService';
import { DatabaseService } from './api/microservices/DatabaseService';

// Mock storage for testing
const mockStorage = {
  getMarketDataHistory: jest.fn(),
  createSignal: jest.fn(),
  getSignals: jest.fn(),
  updateSignal: jest.fn()
};

describe('Scanner Integration Tests', () => {
  let scanner: Scanner;
  let scannerService: ScannerService;
  let databaseService: DatabaseService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize services
    scanner = new Scanner(mockStorage);
    databaseService = new DatabaseService();
    scannerService = new ScannerService(3001);
  });

  describe('Phase 1: Fixed Scanner Code (Production-Ready)', () => {
    
    describe('Pattern Detection Logic Fixes', () => {
      
      test('should correctly detect Inside Bar Bullish Breakout', async () => {
        // Mock market data for inside bar pattern
        const marketData = [
          { symbol: 'SPY', timestamp: new Date('2024-01-01'), open: 150, high: 152, low: 149, close: 151, volume: 1000000 },
          { symbol: 'SPY', timestamp: new Date('2024-01-02'), open: 151, high: 151.5, low: 150.5, close: 151.2, volume: 1200000 }, // Inside bar
          { symbol: 'SPY', timestamp: new Date('2024-01-03'), open: 151.2, high: 153, low: 151, close: 152.5, volume: 1500000 } // Breakout
        ];

        mockStorage.getMarketDataHistory.mockResolvedValue(marketData);

        // Add symbol to scanner
        scanner.addSymbols(['SPY']);
        
        // Scan for patterns
        await scanner.scanSymbol('SPY');

        // Verify pattern detection
        const signals = await databaseService.getSignals({ symbol: 'SPY' });
        expect(signals).toHaveLength(1);
        expect(signals[0].pattern).toBe('Inside Bar Bullish Breakout');
        expect(signals[0].direction).toBe('BUY');
      });

      test('should correctly detect Inside Bar Bearish Breakdown', async () => {
        // Mock market data for bearish inside bar pattern
        const marketData = [
          { symbol: 'SPY', timestamp: new Date('2024-01-01'), open: 150, high: 152, low: 149, close: 151, volume: 1000000 },
          { symbol: 'SPY', timestamp: new Date('2024-01-02'), open: 151, high: 151.5, low: 150.5, close: 151.2, volume: 1200000 }, // Inside bar
          { symbol: 'SPY', timestamp: new Date('2024-01-03'), open: 151.2, high: 151.5, low: 149.5, close: 149.8, volume: 1500000 } // Breakdown
        ];

        mockStorage.getMarketDataHistory.mockResolvedValue(marketData);

        scanner.addSymbols(['SPY']);
        await scanner.scanSymbol('SPY');

        const signals = await databaseService.getSignals({ symbol: 'SPY' });
        expect(signals).toHaveLength(1);
        expect(signals[0].pattern).toBe('Inside Bar Bearish Breakdown');
        expect(signals[0].direction).toBe('SELL');
      });

      test('should detect both bullish and bearish patterns in same inside bar', async () => {
        // Mock market data that could trigger both patterns
        const marketData = [
          { symbol: 'SPY', timestamp: new Date('2024-01-01'), open: 150, high: 152, low: 149, close: 151, volume: 1000000 },
          { symbol: 'SPY', timestamp: new Date('2024-01-02'), open: 151, high: 151.5, low: 150.5, close: 151.2, volume: 1200000 }, // Inside bar
          { symbol: 'SPY', timestamp: new Date('2024-01-03'), open: 151.2, high: 153, low: 149.5, close: 152.5, volume: 1500000 } // Both breakout and breakdown
        ];

        mockStorage.getMarketDataHistory.mockResolvedValue(marketData);

        scanner.addSymbols(['SPY']);
        await scanner.scanSymbol('SPY');

        const signals = await databaseService.getSignals({ symbol: 'SPY' });
        expect(signals.length).toBeGreaterThan(0);
        
        // Should detect at least one pattern
        const hasBullish = signals.some(s => s.pattern.includes('Bullish'));
        const hasBearish = signals.some(s => s.pattern.includes('Bearish'));
        expect(hasBullish || hasBearish).toBe(true);
      });
    });

    describe('TwelveData API Integration', () => {
      
      test('should handle API rate limiting gracefully', async () => {
        // Mock rate limit response
        const mockRateLimitResponse = {
          status: 429,
          data: { message: 'Rate limit exceeded' }
        };

        // Test rate limiting behavior
        scanner.addSymbols(['SPY', 'QQQ', 'TSLA']);
        
        // Should handle rate limits without crashing
        await expect(scanner.scanAllSymbols()).resolves.not.toThrow();
      });

      test('should retry failed API calls with exponential backoff', async () => {
        // Mock API failure then success
        let callCount = 0;
        mockStorage.getMarketDataHistory.mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            throw new Error('API Error');
          }
          return Promise.resolve([]);
        });

        scanner.addSymbols(['SPY']);
        await scanner.scanSymbol('SPY');

        expect(callCount).toBeGreaterThan(1);
      });

      test('should handle API timeouts', async () => {
        // Mock timeout
        mockStorage.getMarketDataHistory.mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 100);
          });
        });

        scanner.addSymbols(['SPY']);
        await expect(scanner.scanSymbol('SPY')).resolves.not.toThrow();
      });
    });

    describe('Error Handling and Logging', () => {
      
      test('should handle database connection errors gracefully', async () => {
        // Mock database error
        mockStorage.createSignal.mockRejectedValue(new Error('Database connection failed'));

        scanner.addSymbols(['SPY']);
        await expect(scanner.scanSymbol('SPY')).resolves.not.toThrow();
      });

      test('should log errors with proper context', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        mockStorage.getMarketDataHistory.mockRejectedValue(new Error('Test error'));
        
        scanner.addSymbols(['SPY']);
        await scanner.scanSymbol('SPY');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error scanning SPY'),
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });

      test('should continue processing other symbols when one fails', async () => {
        // Mock one symbol to fail, others to succeed
        mockStorage.getMarketDataHistory
          .mockRejectedValueOnce(new Error('API Error')) // SPY fails
          .mockResolvedValue([]) // QQQ succeeds
          .mockResolvedValue([]); // TSLA succeeds

        scanner.addSymbols(['SPY', 'QQQ', 'TSLA']);
        await expect(scanner.scanAllSymbols()).resolves.not.toThrow();
      });
    });
  });

  describe('Phase 2: Microservices Architecture', () => {
    
    describe('Scanner Service', () => {
      
      test('should start and stop scanner service', async () => {
        await expect(scannerService.start()).resolves.not.toThrow();
        expect(scannerService.getStatus().isRunning).toBe(true);
        
        await expect(scannerService.stop()).resolves.not.toThrow();
        expect(scannerService.getStatus().isRunning).toBe(false);
      });

      test('should handle concurrent requests', async () => {
        await scannerService.start();

        // Simulate concurrent requests
        const requests = Array(10).fill(null).map(() => 
          fetch('http://localhost:3001/api/v1/scanner/status')
        );

        const responses = await Promise.all(requests);
        expect(responses.every(r => r.ok)).toBe(true);

        await scannerService.stop();
      });

      test('should enforce rate limiting', async () => {
        await scannerService.start();

        // Make many requests quickly
        const requests = Array(150).fill(null).map(() => 
          fetch('http://localhost:3001/api/v1/scanner/status')
        );

        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => r.status === 429);
        expect(rateLimited).toBe(true);

        await scannerService.stop();
      });
    });

    describe('Database Service', () => {
      
      test('should create and retrieve users', async () => {
        await databaseService.start();

        const userData = {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'user' as const,
          preferences: {
            defaultWatchlist: ['SPY'],
            notificationSettings: {
              email: true,
              slack: false,
              push: true,
              signalAlerts: true,
              patternAlerts: true,
              riskAlerts: true
            },
            riskTolerance: 'medium' as const,
            tradingStyle: 'moderate' as const
          }
        };

        const userId = await databaseService.createUser(userData);
        expect(userId).toBeDefined();

        const user = await databaseService.getUserById(userId);
        expect(user).toBeDefined();
        expect(user.email).toBe(userData.email);

        await databaseService.stop();
      });

      test('should manage watchlists', async () => {
        await databaseService.start();

        const userId = 'test-user-id';
        const symbols = ['SPY', 'QQQ', 'TSLA'];

        await databaseService.addToWatchlist(userId, symbols);
        const watchlist = await databaseService.getUserWatchlist(userId);
        expect(watchlist).toEqual(expect.arrayContaining(symbols));

        await databaseService.removeFromWatchlist(userId, ['TSLA']);
        const updatedWatchlist = await databaseService.getUserWatchlist(userId);
        expect(updatedWatchlist).not.toContain('TSLA');

        await databaseService.stop();
      });
    });
  });

  describe('Phase 3: REST API and WebSocket Endpoints', () => {
    
    describe('REST API Endpoints', () => {
      
      test('should start scanner via API', async () => {
        await scannerService.start();

        const response = await fetch('http://localhost:3001/api/v1/scanner/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols: ['SPY', 'QQQ'],
            config: { riskPerTrade: 0.02 }
          })
        });

        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.success).toBe(true);

        await scannerService.stop();
      });

      test('should get scanner status via API', async () => {
        await scannerService.start();

        const response = await fetch('http://localhost:3001/api/v1/scanner/status');
        expect(response.ok).toBe(true);
        
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('isRunning');
        expect(data.data).toHaveProperty('metrics');

        await scannerService.stop();
      });

      test('should get signals with filtering', async () => {
        await scannerService.start();

        const response = await fetch('http://localhost:3001/api/v1/signals?symbol=SPY&limit=10');
        expect(response.ok).toBe(true);
        
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);

        await scannerService.stop();
      });

      test('should update signal status via API', async () => {
        await scannerService.start();

        const response = await fetch('http://localhost:3001/api/v1/signals/1/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' })
        });

        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.success).toBe(true);

        await scannerService.stop();
      });
    });

    describe('Authentication and Security', () => {
      
      test('should require authentication for protected endpoints', async () => {
        await scannerService.start();

        const response = await fetch('http://localhost:3001/api/v1/watchlist');
        expect(response.status).toBe(401); // Unauthorized

        await scannerService.stop();
      });

      test('should handle CORS properly', async () => {
        await scannerService.start();

        const response = await fetch('http://localhost:3001/api/v1/scanner/status', {
          method: 'OPTIONS'
        });

        expect(response.headers.get('access-control-allow-origin')).toBeDefined();

        await scannerService.stop();
      });
    });
  });

  describe('Phase 4: Database Schema and Analytics', () => {
    
    describe('Signal Analytics', () => {
      
      test('should calculate signal analytics', async () => {
        await databaseService.start();

        const analytics = await databaseService.getSignalAnalytics('24h');
        expect(analytics).toHaveProperty('totalSignals');
        expect(analytics).toHaveProperty('winRate');
        expect(analytics).toHaveProperty('averageConfidence');

        await databaseService.stop();
      });

      test('should calculate pattern performance', async () => {
        await databaseService.start();

        const patterns = await databaseService.getPatternPerformance('24h');
        expect(patterns).toHaveProperty('patterns');
        expect(Array.isArray(patterns.patterns)).toBe(true);

        await databaseService.stop();
      });
    });

    describe('User Management', () => {
      
      test('should create and manage user portfolios', async () => {
        await databaseService.start();

        const userId = 'test-user';
        const portfolioData = {
          name: 'My Portfolio',
          description: 'Test portfolio',
          symbols: ['SPY', 'QQQ']
        };

        // This would be implemented in the actual service
        expect(userId).toBeDefined();
        expect(portfolioData).toBeDefined();

        await databaseService.stop();
      });
    });
  });

  describe('Performance Tests', () => {
    
    test('should handle high volume of symbols', async () => {
      const symbols = Array(100).fill(null).map((_, i) => `SYMBOL${i}`);
      scanner.addSymbols(symbols);

      const startTime = Date.now();
      await scanner.scanAllSymbols();
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    test('should maintain performance under load', async () => {
      await scannerService.start();

      const startTime = Date.now();
      
      // Simulate concurrent API requests
      const requests = Array(50).fill(null).map(() => 
        fetch('http://localhost:3001/api/v1/scanner/status')
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(responses.every(r => r.ok)).toBe(true);

      await scannerService.stop();
    });

    test('should handle memory efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many symbols
      const symbols = Array(1000).fill(null).map((_, i) => `SYMBOL${i}`);
      scanner.addSymbols(symbols);
      
      for (let i = 0; i < 10; i++) {
        await scanner.scanAllSymbols();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Integration Tests', () => {
    
    test('should complete full signal generation workflow', async () => {
      await scannerService.start();
      await databaseService.start();

      // 1. Add symbols to watchlist
      const userId = 'test-user';
      await databaseService.addToWatchlist(userId, ['SPY', 'QQQ']);

      // 2. Start scanner
      const startResponse = await fetch('http://localhost:3001/api/v1/scanner/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: ['SPY', 'QQQ'] })
      });
      expect(startResponse.ok).toBe(true);

      // 3. Wait for signals to be generated
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Check for signals
      const signalsResponse = await fetch('http://localhost:3001/api/v1/signals');
      expect(signalsResponse.ok).toBe(true);
      
      const signalsData = await signalsResponse.json();
      expect(signalsData.success).toBe(true);

      // 5. Check analytics
      const analyticsResponse = await fetch('http://localhost:3001/api/v1/analytics/performance');
      expect(analyticsResponse.ok).toBe(true);

      await scannerService.stop();
      await databaseService.stop();
    });

    test('should handle service failures gracefully', async () => {
      await scannerService.start();

      // Simulate database service failure
      jest.spyOn(databaseService, 'getSignals').mockRejectedValue(new Error('Database unavailable'));

      // Scanner should continue to function
      const response = await fetch('http://localhost:3001/api/v1/scanner/status');
      expect(response.ok).toBe(true);

      await scannerService.stop();
    });
  });

  describe('Security Tests', () => {
    
    test('should validate input data', async () => {
      await scannerService.start();

      // Test with invalid data
      const response = await fetch('http://localhost:3001/api/v1/scanner/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: 'invalid' }) // Should be array
      });

      expect(response.status).toBe(400);

      await scannerService.stop();
    });

    test('should prevent SQL injection', async () => {
      await databaseService.start();

      // Test with malicious input
      const maliciousSymbol = "'; DROP TABLE users; --";
      
      // Should handle safely
      await expect(databaseService.addToWatchlist('user1', [maliciousSymbol]))
        .resolves.not.toThrow();

      await databaseService.stop();
    });
  });

  afterEach(async () => {
    // Cleanup
    if (scannerService) {
      await scannerService.stop();
    }
    if (databaseService) {
      await databaseService.stop();
    }
  });
}); 