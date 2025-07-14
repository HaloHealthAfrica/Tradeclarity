import { NotificationService } from './NotificationService';
import { DatabaseService } from './DatabaseService';

// Mock dependencies
jest.mock('./DatabaseService');
jest.mock('nodemailer');
jest.mock('@slack/web-api');

const mockDatabaseService = DatabaseService as jest.MockedClass<typeof DatabaseService>;

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      getConnection: jest.fn(),
      close: jest.fn(),
    } as any;

    mockDatabaseService.mockImplementation(() => mockDb);
    
    notificationService = new NotificationService();
  });

  describe('sendNotification', () => {
    it('should send notification based on user preferences', async () => {
      const mockPreferences = {
        email_enabled: true,
        slack_enabled: true,
        email_address: 'user@example.com',
        slack_channel: '#trading-alerts'
      };

      mockDb.query.mockResolvedValue({ rows: [mockPreferences] });

      const notification = {
        userId: 'user123',
        type: 'trade_alert',
        title: 'New Trade Signal',
        message: 'AAPL buy signal detected',
        priority: 'high'
      };

      jest.spyOn(notificationService, 'sendEmail').mockResolvedValue(true);
      jest.spyOn(notificationService, 'sendSlackMessage').mockResolvedValue(true);

      const result = await notificationService.sendNotification(notification);

      expect(result).toBe(true);
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        'user@example.com',
        'New Trade Signal',
        'AAPL buy signal detected'
      );
      expect(notificationService.sendSlackMessage).toHaveBeenCalledWith(
        '#trading-alerts',
        'New Trade Signal',
        'AAPL buy signal detected'
      );
    });

    it('should handle user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const notification = {
        userId: 'nonexistent',
        type: 'trade_alert',
        title: 'Test Alert',
        message: 'Test message',
        priority: 'medium'
      };

      const result = await notificationService.sendNotification(notification);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const notification = {
        userId: 'user123',
        type: 'trade_alert',
        title: 'Test Alert',
        message: 'Test message',
        priority: 'medium'
      };

      await expect(notificationService.sendNotification(notification)).rejects.toThrow('Database error');
    });
  });

  describe('sendEmail', () => {
    it('should send email notification successfully', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
      };

      jest.spyOn(require('nodemailer'), 'createTransporter').mockReturnValue(mockTransporter);

      const result = await notificationService.sendEmail(
        'user@example.com',
        'Trade Alert',
        'AAPL buy signal detected'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'user@example.com',
        subject: 'Trade Alert',
        html: expect.stringContaining('AAPL buy signal detected')
      });
    });

    it('should handle email sending errors', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP error'))
      };

      jest.spyOn(require('nodemailer'), 'createTransporter').mockReturnValue(mockTransporter);

      const result = await notificationService.sendEmail(
        'user@example.com',
        'Trade Alert',
        'AAPL buy signal detected'
      );

      expect(result).toBe(false);
    });
  });

  describe('sendSlackMessage', () => {
    it('should send Slack message successfully', async () => {
      const mockWeb = {
        chat: {
          postMessage: jest.fn().mockResolvedValue({ ok: true })
        }
      };

      jest.spyOn(require('@slack/web-api'), 'WebClient').mockImplementation(() => mockWeb);

      const result = await notificationService.sendSlackMessage(
        '#trading-alerts',
        'Trade Alert',
        'AAPL buy signal detected'
      );

      expect(result).toBe(true);
      expect(mockWeb.chat.postMessage).toHaveBeenCalledWith({
        channel: '#trading-alerts',
        text: 'Trade Alert',
        attachments: expect.arrayContaining([
          expect.objectContaining({
            text: 'AAPL buy signal detected'
          })
        ])
      });
    });

    it('should handle Slack API errors', async () => {
      const mockWeb = {
        chat: {
          postMessage: jest.fn().mockRejectedValue(new Error('Slack API error'))
        }
      };

      jest.spyOn(require('@slack/web-api'), 'WebClient').mockImplementation(() => mockWeb);

      const result = await notificationService.sendSlackMessage(
        '#trading-alerts',
        'Trade Alert',
        'AAPL buy signal detected'
      );

      expect(result).toBe(false);
    });
  });

  describe('setUserPreferences', () => {
    it('should set user notification preferences', async () => {
      const preferences = {
        userId: 'user123',
        emailEnabled: true,
        slackEnabled: false,
        emailAddress: 'user@example.com',
        slackChannel: '#trading-alerts',
        tradeAlerts: true,
        performanceAlerts: true,
        riskAlerts: false
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await notificationService.setUserPreferences(preferences);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_notification_preferences'),
        expect.arrayContaining([preferences.userId, preferences.emailEnabled])
      );
    });

    it('should update existing preferences', async () => {
      const preferences = {
        userId: 'user123',
        emailEnabled: false,
        slackEnabled: true,
        emailAddress: 'updated@example.com',
        slackChannel: '#alerts',
        tradeAlerts: false,
        performanceAlerts: true,
        riskAlerts: true
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await notificationService.setUserPreferences(preferences);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_notification_preferences'),
        expect.arrayContaining([preferences.emailEnabled, preferences.userId])
      );
    });
  });

  describe('getUserPreferences', () => {
    it('should get user notification preferences', async () => {
      const mockPreferences = {
        user_id: 'user123',
        email_enabled: true,
        slack_enabled: false,
        email_address: 'user@example.com',
        slack_channel: '#trading-alerts',
        trade_alerts: true,
        performance_alerts: true,
        risk_alerts: false
      };

      mockDb.query.mockResolvedValue({ rows: [mockPreferences] });

      const preferences = await notificationService.getUserPreferences('user123');

      expect(preferences).toHaveProperty('userId', 'user123');
      expect(preferences).toHaveProperty('emailEnabled', true);
      expect(preferences).toHaveProperty('slackEnabled', false);
      expect(preferences).toHaveProperty('emailAddress', 'user@example.com');
    });

    it('should return null for user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const preferences = await notificationService.getUserPreferences('nonexistent');

      expect(preferences).toBeNull();
    });
  });

  describe('sendTradeAlert', () => {
    it('should send trade alert notification', async () => {
      const trade = {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100,
        price: 150.0,
        pnl: 500,
        strategy: 'EMAConfluence'
      };

      jest.spyOn(notificationService, 'sendNotification').mockResolvedValue(true);

      const result = await notificationService.sendTradeAlert('user123', trade);

      expect(result).toBe(true);
      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'trade_alert',
        title: 'Trade Executed',
        message: expect.stringContaining('AAPL'),
        priority: 'high'
      });
    });
  });

  describe('sendPerformanceAlert', () => {
    it('should send performance alert notification', async () => {
      const performance = {
        totalPnL: -1000,
        dailyLoss: -500,
        winRate: 0.3,
        maxDrawdown: 0.15
      };

      jest.spyOn(notificationService, 'sendNotification').mockResolvedValue(true);

      const result = await notificationService.sendPerformanceAlert('user123', performance);

      expect(result).toBe(true);
      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'performance_alert',
        title: 'Performance Alert',
        message: expect.stringContaining('Daily loss'),
        priority: 'high'
      });
    });
  });

  describe('sendRiskAlert', () => {
    it('should send risk alert notification', async () => {
      const riskMetrics = {
        maxDrawdown: 0.2,
        var95: -1000,
        sharpeRatio: 0.5
      };

      jest.spyOn(notificationService, 'sendNotification').mockResolvedValue(true);

      const result = await notificationService.sendRiskAlert('user123', riskMetrics);

      expect(result).toBe(true);
      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'risk_alert',
        title: 'Risk Alert',
        message: expect.stringContaining('Risk threshold'),
        priority: 'high'
      });
    });
  });

  describe('sendSystemAlert', () => {
    it('should send system alert notification', async () => {
      const alert = {
        type: 'system_error',
        message: 'Database connection failed',
        severity: 'critical'
      };

      jest.spyOn(notificationService, 'sendNotification').mockResolvedValue(true);

      const result = await notificationService.sendSystemAlert('user123', alert);

      expect(result).toBe(true);
      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'system_alert',
        title: 'System Alert',
        message: 'Database connection failed',
        priority: 'critical'
      });
    });
  });

  describe('saveNotification', () => {
    it('should save notification to database', async () => {
      const notification = {
        userId: 'user123',
        type: 'trade_alert',
        title: 'Trade Executed',
        message: 'AAPL buy signal executed',
        priority: 'high',
        sent: true
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await notificationService.saveNotification(notification);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([notification.userId, notification.type])
      );
    });
  });

  describe('getNotificationHistory', () => {
    it('should get user notification history', async () => {
      const mockHistory = [
        {
          id: 1,
          user_id: 'user123',
          type: 'trade_alert',
          title: 'Trade Executed',
          message: 'AAPL buy signal executed',
          priority: 'high',
          sent: true,
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 2,
          user_id: 'user123',
          type: 'performance_alert',
          title: 'Performance Alert',
          message: 'Daily loss exceeded',
          priority: 'medium',
          sent: true,
          created_at: '2024-01-15T11:00:00Z'
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockHistory });

      const history = await notificationService.getNotificationHistory('user123', 10);

      expect(history).toHaveLength(2);
      expect(history[0]).toHaveProperty('type', 'trade_alert');
      expect(history[1]).toHaveProperty('type', 'performance_alert');
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await notificationService.markNotificationAsRead(1);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET read = true'),
        expect.arrayContaining([1])
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await notificationService.deleteNotification(1);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications'),
        expect.arrayContaining([1])
      );
    });
  });

  describe('getNotificationStats', () => {
    it('should get notification statistics', async () => {
      const mockStats = {
        total: 100,
        sent: 95,
        failed: 5,
        by_type: { trade_alert: 50, performance_alert: 30, risk_alert: 20 },
        by_priority: { high: 40, medium: 35, low: 25 }
      };

      mockDb.query.mockResolvedValue({ rows: [mockStats] });

      const stats = await notificationService.getNotificationStats('user123');

      expect(stats).toHaveProperty('total', 100);
      expect(stats).toHaveProperty('sent', 95);
      expect(stats).toHaveProperty('failed', 5);
    });
  });
}); 