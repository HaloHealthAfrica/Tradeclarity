import { createModuleLogger } from '../utils/logger';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import axios from 'axios';

const logger = createModuleLogger('NotificationService');

export interface NotificationConfig {
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromEmail: string;
    toEmail: string;
  };
  slack: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
  };
  preferences: {
    signalAlerts: boolean;
    tradeExecutions: boolean;
    performanceUpdates: boolean;
    errorAlerts: boolean;
    dailyReports: boolean;
  };
}

export interface SignalAlert {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  strategy: string;
  price: number;
  timestamp: number;
}

export interface TradeAlert {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'filled' | 'cancelled' | 'rejected';
  pnl?: number;
  timestamp: number;
}

export interface PerformanceAlert {
  totalPnL: number;
  dailyPnL: number;
  winRate: number;
  totalTrades: number;
  activePositions: number;
  timestamp: number;
}

export interface ErrorAlert {
  service: string;
  error: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}

export class NotificationService {
  private pool: Pool;
  private config: NotificationConfig;
  private emailTransporter: nodemailer.Transporter | null = null;
  private isInitialized = false;

  constructor() {
    // Initialize PostgreSQL connection
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'scanner_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Initialize default configuration
    this.config = {
      email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpUser: process.env.SMTP_USER || '',
        smtpPass: process.env.SMTP_PASS || '',
        fromEmail: process.env.FROM_EMAIL || 'noreply@tradingsystem.com',
        toEmail: process.env.TO_EMAIL || 'admin@tradingsystem.com'
      },
      slack: {
        enabled: process.env.SLACK_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#trading-alerts'
      },
      preferences: {
        signalAlerts: true,
        tradeExecutions: true,
        performanceUpdates: true,
        errorAlerts: true,
        dailyReports: true
      }
    };

    logger.info('NotificationService initialized with database connection');
  }

  /**
   * Initialize notification service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize email transporter
      if (this.config.email.enabled && this.config.email.smtpUser && this.config.email.smtpPass) {
        this.emailTransporter = nodemailer.createTransporter({
          host: this.config.email.smtpHost,
          port: this.config.email.smtpPort,
          secure: false,
          auth: {
            user: this.config.email.smtpUser,
            pass: this.config.email.smtpPass
          }
        });

        // Verify connection
        await this.emailTransporter.verify();
        logger.info('Email transporter initialized successfully');
      }

      // Load user preferences from database
      await this.loadUserPreferences();

      this.isInitialized = true;
      logger.info('NotificationService initialized successfully');
    } catch (error) {
      logger.error('Error initializing NotificationService:', error as Error);
      // Continue without email if initialization fails
    }
  }

  /**
   * Load user preferences from database
   */
  private async loadUserPreferences(): Promise<void> {
    try {
      const query = `
        SELECT 
          email_enabled, slack_enabled,
          signal_alerts, trade_executions, performance_updates, 
          error_alerts, daily_reports
        FROM user_preferences 
        WHERE user_id = 'system'
        LIMIT 1
      `;

      const result = await this.pool.query(query);
      
      if (result.rows.length > 0) {
        const prefs = result.rows[0];
        this.config.email.enabled = prefs.email_enabled || this.config.email.enabled;
        this.config.slack.enabled = prefs.slack_enabled || this.config.slack.enabled;
        this.config.preferences.signalAlerts = prefs.signal_alerts !== false;
        this.config.preferences.tradeExecutions = prefs.trade_executions !== false;
        this.config.preferences.performanceUpdates = prefs.performance_updates !== false;
        this.config.preferences.errorAlerts = prefs.error_alerts !== false;
        this.config.preferences.dailyReports = prefs.daily_reports !== false;
      }

      logger.info('User preferences loaded from database');
    } catch (error) {
      logger.error('Error loading user preferences:', error as Error);
      // Continue with default preferences
    }
  }

  /**
   * Send signal alert
   */
  async sendSignalAlert(alert: SignalAlert): Promise<void> {
    try {
      if (!this.config.preferences.signalAlerts) {
        logger.debug('Signal alerts disabled, skipping notification');
        return;
      }

      const message = `🚨 SIGNAL ALERT\n\n` +
        `Symbol: ${alert.symbol}\n` +
        `Direction: ${alert.direction}\n` +
        `Strategy: ${alert.strategy}\n` +
        `Confidence: ${alert.confidence.toFixed(1)}%\n` +
        `Price: $${alert.price.toFixed(2)}\n` +
        `Time: ${new Date(alert.timestamp).toLocaleString()}`;

      await this.sendNotification('Signal Alert', message, 'high');
      
      // Store alert in database
      await this.storeAlert('signal', alert);
      
      logger.info(`Signal alert sent for ${alert.symbol}`);
    } catch (error) {
      logger.error('Error sending signal alert:', error as Error);
    }
  }

  /**
   * Send trade execution alert
   */
  async sendTradeAlert(alert: TradeAlert): Promise<void> {
    try {
      if (!this.config.preferences.tradeExecutions) {
        logger.debug('Trade execution alerts disabled, skipping notification');
        return;
      }

      const pnlText = alert.pnl ? `\nPnL: $${alert.pnl.toFixed(2)}` : '';
      const message = `📊 TRADE EXECUTED\n\n` +
        `Symbol: ${alert.symbol}\n` +
        `Side: ${alert.side}\n` +
        `Quantity: ${alert.quantity}\n` +
        `Price: $${alert.price.toFixed(2)}\n` +
        `Status: ${alert.status.toUpperCase()}${pnlText}\n` +
        `Time: ${new Date(alert.timestamp).toLocaleString()}`;

      await this.sendNotification('Trade Executed', message, 'medium');
      
      // Store alert in database
      await this.storeAlert('trade', alert);
      
      logger.info(`Trade alert sent for ${alert.symbol}`);
    } catch (error) {
      logger.error('Error sending trade alert:', error as Error);
    }
  }

  /**
   * Send performance update
   */
  async sendPerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      if (!this.config.preferences.performanceUpdates) {
        logger.debug('Performance updates disabled, skipping notification');
        return;
      }

      const message = `📈 PERFORMANCE UPDATE\n\n` +
        `Total PnL: $${alert.totalPnL.toFixed(2)}\n` +
        `Daily PnL: $${alert.dailyPnL.toFixed(2)}\n` +
        `Win Rate: ${alert.winRate.toFixed(1)}%\n` +
        `Total Trades: ${alert.totalTrades}\n` +
        `Active Positions: ${alert.activePositions}\n` +
        `Time: ${new Date(alert.timestamp).toLocaleString()}`;

      await this.sendNotification('Performance Update', message, 'low');
      
      // Store alert in database
      await this.storeAlert('performance', alert);
      
      logger.info('Performance alert sent');
    } catch (error) {
      logger.error('Error sending performance alert:', error as Error);
    }
  }

  /**
   * Send error alert
   */
  async sendErrorAlert(alert: ErrorAlert): Promise<void> {
    try {
      if (!this.config.preferences.errorAlerts) {
        logger.debug('Error alerts disabled, skipping notification');
        return;
      }

      const severityEmoji = alert.severity === 'high' ? '🚨' : alert.severity === 'medium' ? '⚠️' : 'ℹ️';
      const message = `${severityEmoji} ERROR ALERT\n\n` +
        `Service: ${alert.service}\n` +
        `Error: ${alert.error}\n` +
        `Severity: ${alert.severity.toUpperCase()}\n` +
        `Time: ${new Date(alert.timestamp).toLocaleString()}`;

      await this.sendNotification('Error Alert', message, alert.severity);
      
      // Store alert in database
      await this.storeAlert('error', alert);
      
      logger.info(`Error alert sent for ${alert.service}`);
    } catch (error) {
      logger.error('Error sending error alert:', error as Error);
    }
  }

  /**
   * Send daily report
   */
  async sendDailyReport(report: any): Promise<void> {
    try {
      if (!this.config.preferences.dailyReports) {
        logger.debug('Daily reports disabled, skipping notification');
        return;
      }

      const message = `📊 DAILY TRADING REPORT\n\n` +
        `Date: ${report.date}\n` +
        `Total PnL: $${report.performance.totalPnL.toFixed(2)}\n` +
        `Win Rate: ${report.performance.winRate.toFixed(1)}%\n` +
        `Total Trades: ${report.performance.totalTrades}\n` +
        `Active Positions: ${report.performance.activePositions}\n` +
        `Risk Level: ${report.riskAssessment.riskLevel.toUpperCase()}\n` +
        `Market Bias: ${report.nextDayOutlook.marketBias.toUpperCase()}`;

      await this.sendNotification('Daily Trading Report', message, 'low');
      
      // Store report in database
      await this.storeAlert('daily_report', report);
      
      logger.info('Daily report sent');
    } catch (error) {
      logger.error('Error sending daily report:', error as Error);
    }
  }

  /**
   * Send notification through all enabled channels
   */
  private async sendNotification(title: string, message: string, priority: 'low' | 'medium' | 'high'): Promise<void> {
    const promises: Promise<void>[] = [];

    // Send email notification
    if (this.config.email.enabled && this.emailTransporter) {
      promises.push(this.sendEmailNotification(title, message, priority));
    }

    // Send Slack notification
    if (this.config.slack.enabled && this.config.slack.webhookUrl) {
      promises.push(this.sendSlackNotification(title, message, priority));
    }

    // Wait for all notifications to complete
    await Promise.allSettled(promises);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(title: string, message: string, priority: 'low' | 'medium' | 'high'): Promise<void> {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email transporter not initialized');
      }

      const priorityColor = priority === 'high' ? '#ff4444' : priority === 'medium' ? '#ffaa00' : '#44aa44';
      
      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${priorityColor}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">${title}</h1>
          </div>
          <div style="padding: 20px; background-color: #f9f9f9;">
            <pre style="white-space: pre-wrap; font-family: monospace; margin: 0;">${message}</pre>
          </div>
          <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
            <p>Sent by Paper Trading System</p>
            <p>Time: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `;

      await this.emailTransporter.sendMail({
        from: this.config.email.fromEmail,
        to: this.config.email.toEmail,
        subject: `[${priority.toUpperCase()}] ${title}`,
        text: message,
        html: htmlMessage
      });

      logger.info('Email notification sent successfully');
    } catch (error) {
      logger.error('Error sending email notification:', error as Error);
      throw error;
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(title: string, message: string, priority: 'low' | 'medium' | 'high'): Promise<void> {
    try {
      const priorityEmoji = priority === 'high' ? '🚨' : priority === 'medium' ? '⚠️' : 'ℹ️';
      const color = priority === 'high' ? '#ff4444' : priority === 'medium' ? '#ffaa00' : '#44aa44';

      const slackMessage = {
        channel: this.config.slack.channel,
        attachments: [
          {
            color: color,
            title: `${priorityEmoji} ${title}`,
            text: message,
            footer: 'Paper Trading System',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      await axios.post(this.config.slack.webhookUrl, slackMessage, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      logger.info('Slack notification sent successfully');
    } catch (error) {
      logger.error('Error sending Slack notification:', error as Error);
      throw error;
    }
  }

  /**
   * Store alert in database
   */
  private async storeAlert(type: string, data: any): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO notifications (
          type, data, created_at
        ) VALUES (
          $1, $2, NOW()
        )
      `;

      await this.pool.query(insertQuery, [
        type,
        JSON.stringify(data)
      ]);

      logger.debug(`Alert stored in database: ${type}`);
    } catch (error) {
      logger.error('Error storing alert in database:', error as Error);
      // Don't throw error to avoid breaking notification flow
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(limit: number = 50): Promise<Array<{
    id: string;
    type: string;
    data: any;
    created_at: string;
  }>> {
    try {
      const query = `
        SELECT id, type, data, created_at
        FROM notifications 
        ORDER BY created_at DESC 
        LIMIT $1
      `;

      const result = await this.pool.query(query, [limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        data: JSON.parse(row.data),
        created_at: row.created_at
      }));
    } catch (error) {
      logger.error('Error getting notification history:', error as Error);
      return [];
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: Partial<NotificationConfig['preferences']>): Promise<boolean> {
    try {
      const updateQuery = `
        INSERT INTO user_preferences (
          user_id, signal_alerts, trade_executions, performance_updates, 
          error_alerts, daily_reports, updated_at
        ) VALUES (
          'system', $1, $2, $3, $4, $5, NOW()
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
          signal_alerts = EXCLUDED.signal_alerts,
          trade_executions = EXCLUDED.trade_executions,
          performance_updates = EXCLUDED.performance_updates,
          error_alerts = EXCLUDED.error_alerts,
          daily_reports = EXCLUDED.daily_reports,
          updated_at = NOW()
      `;

      await this.pool.query(updateQuery, [
        preferences.signalAlerts,
        preferences.tradeExecutions,
        preferences.performanceUpdates,
        preferences.errorAlerts,
        preferences.dailyReports
      ]);

      // Update local config
      Object.assign(this.config.preferences, preferences);

      logger.info('Notification preferences updated');
      return true;
    } catch (error) {
      logger.error('Error updating notification preferences:', error as Error);
      return false;
    }
  }

  /**
   * Test notification channels
   */
  async testNotifications(): Promise<{
    email: boolean;
    slack: boolean;
  }> {
    const results = {
      email: false,
      slack: false
    };

    try {
      // Test email
      if (this.config.email.enabled && this.emailTransporter) {
        await this.sendEmailNotification(
          'Test Notification',
          'This is a test notification from the Paper Trading System.',
          'low'
        );
        results.email = true;
      }

      // Test Slack
      if (this.config.slack.enabled && this.config.slack.webhookUrl) {
        await this.sendSlackNotification(
          'Test Notification',
          'This is a test notification from the Paper Trading System.',
          'low'
        );
        results.slack = true;
      }

      logger.info('Notification test completed', results);
    } catch (error) {
      logger.error('Error testing notifications:', error as Error);
    }

    return results;
  }

  /**
   * Get service status
   */
  getStatus(): {
    isInitialized: boolean;
    emailEnabled: boolean;
    slackEnabled: boolean;
    preferences: NotificationConfig['preferences'];
  } {
    return {
      isInitialized: this.isInitialized,
      emailEnabled: this.config.email.enabled && !!this.emailTransporter,
      slackEnabled: this.config.slack.enabled && !!this.config.slack.webhookUrl,
      preferences: this.config.preferences
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('NotificationService database connection closed');
  }
}

// Export singleton instance
export const notificationService = new NotificationService(); 