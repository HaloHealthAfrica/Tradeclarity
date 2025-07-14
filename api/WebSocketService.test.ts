import { WebSocketService } from './WebSocketService';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

// Mock dependencies
jest.mock('./DatabaseService');
jest.mock('./NotificationService');

const mockDatabaseService = DatabaseService as jest.MockedClass<typeof DatabaseService>;
const mockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;

describe('WebSocketService', () => {
  let wsService: WebSocketService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockNotification: jest.Mocked<NotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      getConnection: jest.fn(),
      close: jest.fn(),
    } as any;
    
    mockNotification = {
      sendNotification: jest.fn(),
      sendEmail: jest.fn(),
      sendSlackMessage: jest.fn(),
    } as any;

    mockDatabaseService.mockImplementation(() => mockDb);
    mockNotificationService.mockImplementation(() => mockNotification);
    
    wsService = new WebSocketService();
  });

  describe('initialize', () => {
    it('should initialize WebSocket server', async () => {
      const mockServer = {
        on: jest.fn(),
        listen: jest.fn(),
      };

      jest.spyOn(require('ws'), 'WebSocketServer').mockImplementation(() => mockServer);

      await wsService.initialize(8080);

      expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockServer.listen).toHaveBeenCalledWith(8080);
    });

    it('should handle initialization errors', async () => {
      jest.spyOn(require('ws'), 'WebSocketServer').mockImplementation(() => {
        throw new Error('WebSocket initialization failed');
      });

      await expect(wsService.initialize(8080)).rejects.toThrow('WebSocket initialization failed');
    });
  });

  describe('handleConnection', () => {
    it('should handle new WebSocket connections', async () => {
      const mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        readyState: 1, // OPEN
      };

      const mockRequest = {
        url: '/ws?userId=123&token=abc123',
      };

      await wsService.handleConnection(mockWs, mockRequest);

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should reject connections with invalid tokens', async () => {
      const mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };

      const mockRequest = {
        url: '/ws?userId=123&token=invalid',
      };

      await wsService.handleConnection(mockWs, mockRequest);

      expect(mockWs.close).toHaveBeenCalled();
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to all connected clients', async () => {
      const mockWs1 = {
        readyState: 1,
        send: jest.fn(),
      };

      const mockWs2 = {
        readyState: 1,
        send: jest.fn(),
      };

      wsService.clients.set('user1', mockWs1);
      wsService.clients.set('user2', mockWs2);

      const message = { type: 'trade_update', data: { symbol: 'AAPL', pnl: 500 } };

      await wsService.broadcast('trade_update', message.data);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should skip disconnected clients', async () => {
      const mockWs1 = {
        readyState: 3, // CLOSED
        send: jest.fn(),
      };

      const mockWs2 = {
        readyState: 1, // OPEN
        send: jest.fn(),
      };

      wsService.clients.set('user1', mockWs1);
      wsService.clients.set('user2', mockWs2);

      const message = { type: 'performance_update', data: { totalPnL: 600 } };

      await wsService.broadcast('performance_update', message.data);

      expect(mockWs1.send).not.toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('sendToUser', () => {
    it('should send message to specific user', async () => {
      const mockWs = {
        readyState: 1,
        send: jest.fn(),
      };

      wsService.clients.set('user123', mockWs);

      const message = { type: 'alert', data: { message: 'Risk threshold exceeded' } };

      await wsService.sendToUser('user123', 'alert', message.data);

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should handle user not connected', async () => {
      const message = { type: 'alert', data: { message: 'Test alert' } };

      await wsService.sendToUser('nonexistent', 'alert', message.data);

      // Should not throw error, just log
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    it('should handle incoming WebSocket messages', async () => {
      const mockWs = {
        readyState: 1,
        send: jest.fn(),
      };

      const message = JSON.stringify({
        type: 'subscribe',
        data: { channels: ['trades', 'performance'] }
      });

      await wsService.handleMessage(mockWs, message);

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'subscribed',
        data: { channels: ['trades', 'performance'] }
      }));
    });

    it('should handle invalid message format', async () => {
      const mockWs = {
        readyState: 1,
        send: jest.fn(),
      };

      const invalidMessage = 'invalid json';

      await wsService.handleMessage(mockWs, invalidMessage);

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'error',
        data: { message: 'Invalid message format' }
      }));
    });
  });

  describe('subscribeToChannels', () => {
    it('should subscribe user to channels', async () => {
      const userId = 'user123';
      const channels = ['trades', 'performance', 'alerts'];

      await wsService.subscribeToChannels(userId, channels);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_subscriptions'),
        expect.arrayContaining([userId, channels])
      );
    });

    it('should handle subscription errors', async () => {
      const userId = 'user123';
      const channels = ['trades'];

      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(wsService.subscribeToChannels(userId, channels)).rejects.toThrow('Database error');
    });
  });

  describe('unsubscribeFromChannels', () => {
    it('should unsubscribe user from channels', async () => {
      const userId = 'user123';
      const channels = ['alerts'];

      await wsService.unsubscribeFromChannels(userId, channels);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_subscriptions'),
        expect.arrayContaining([userId, channels])
      );
    });
  });

  describe('getUserSubscriptions', () => {
    it('should get user subscriptions from database', async () => {
      const mockSubscriptions = [
        { channel: 'trades', created_at: '2024-01-15T10:00:00Z' },
        { channel: 'performance', created_at: '2024-01-15T10:00:00Z' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockSubscriptions });

      const subscriptions = await wsService.getUserSubscriptions('user123');

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0]).toBe('trades');
      expect(subscriptions[1]).toBe('performance');
    });

    it('should return empty array for user with no subscriptions', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const subscriptions = await wsService.getUserSubscriptions('user123');

      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('broadcastToChannel', () => {
    it('should broadcast message to users subscribed to channel', async () => {
      const mockSubscriptions = [
        { user_id: 'user1', channel: 'trades' },
        { user_id: 'user2', channel: 'trades' },
        { user_id: 'user3', channel: 'performance' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockSubscriptions });

      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      wsService.clients.set('user1', mockWs1);
      wsService.clients.set('user2', mockWs2);

      const message = { type: 'trade_update', data: { symbol: 'AAPL', pnl: 500 } };

      await wsService.broadcastToChannel('trades', 'trade_update', message.data);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('handleDisconnection', () => {
    it('should handle client disconnection', async () => {
      const mockWs = {
        readyState: 3, // CLOSED
        send: jest.fn(),
      };

      wsService.clients.set('user123', mockWs);

      await wsService.handleDisconnection('user123');

      expect(wsService.clients.has('user123')).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should validate JWT token', async () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE2NzM4NzIwMDB9.test';

      const isValid = await wsService.validateToken(validToken);

      expect(isValid).toBe(true);
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      const isValid = await wsService.validateToken(invalidToken);

      expect(isValid).toBe(false);
    });
  });

  describe('getConnectionStats', () => {
    it('should return connection statistics', async () => {
      const mockWs1 = { readyState: 1 };
      const mockWs2 = { readyState: 1 };
      const mockWs3 = { readyState: 3 }; // CLOSED

      wsService.clients.set('user1', mockWs1);
      wsService.clients.set('user2', mockWs2);
      wsService.clients.set('user3', mockWs3);

      const stats = wsService.getConnectionStats();

      expect(stats).toHaveProperty('totalConnections', 3);
      expect(stats).toHaveProperty('activeConnections', 2);
      expect(stats).toHaveProperty('inactiveConnections', 1);
    });
  });

  describe('cleanupInactiveConnections', () => {
    it('should remove inactive connections', async () => {
      const mockWs1 = { readyState: 1 };
      const mockWs2 = { readyState: 3 }; // CLOSED
      const mockWs3 = { readyState: 2 }; // CLOSING

      wsService.clients.set('user1', mockWs1);
      wsService.clients.set('user2', mockWs2);
      wsService.clients.set('user3', mockWs3);

      await wsService.cleanupInactiveConnections();

      expect(wsService.clients.has('user1')).toBe(true);
      expect(wsService.clients.has('user2')).toBe(false);
      expect(wsService.clients.has('user3')).toBe(false);
    });
  });

  describe('sendHeartbeat', () => {
    it('should send heartbeat to all active connections', async () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      wsService.clients.set('user1', mockWs1);
      wsService.clients.set('user2', mockWs2);

      await wsService.sendHeartbeat();

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify({ type: 'heartbeat', timestamp: expect.any(Number) }));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify({ type: 'heartbeat', timestamp: expect.any(Number) }));
    });
  });

  describe('close', () => {
    it('should close all connections and cleanup', async () => {
      const mockWs1 = { readyState: 1, close: jest.fn() };
      const mockWs2 = { readyState: 1, close: jest.fn() };

      wsService.clients.set('user1', mockWs1);
      wsService.clients.set('user2', mockWs2);

      await wsService.close();

      expect(mockWs1.close).toHaveBeenCalled();
      expect(mockWs2.close).toHaveBeenCalled();
      expect(wsService.clients.size).toBe(0);
    });
  });
}); 