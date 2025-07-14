import express from 'express';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { Pool } from 'pg';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('NotificationService');

interface EmailConfig {
  smtpServer: string;
  smtpPort: number;
  emailUser: string;
  emailPass: string;
}

interface SlackConfig {
  webhookUrl: string;
}

interface NotificationPreferences {
  email: {
    enabled: boolean;
    frequency: string;
    types: string[];
  };
  slack: {
    enabled: boolean;
    channel: string;
    types: string[];
  };
  sms: {
    enabled: boolean;
    frequency: string;
    types: string[];
  };
}

export class NotificationService {
  private app: express.Application;
  private port: number;
  private isRunning = false;
  private pool: Pool;
  private emailConfig: EmailConfig;
  private slackConfig: SlackConfig;
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor(port: number = 3003) {
    this.app = express();
    this.port = port;
    
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

    // Initialize email configuration
    this.emailConfig = {
      smtpServer: process.env.SMTP_SERVER || 'smtp.gmail.com',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      emailUser: process.env.EMAIL_USER || '',
      emailPass: process.env.EMAIL_PASS || ''
    };

    // Initialize Slack configuration
    this.slackConfig = {
      webhookUrl: process.env.SLACK_WEBHOOK || ''
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.initializeEmailTransporter();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    const router = this.createNotificationRoutes();
    this.app.use('/api/notifications', router);
  }

  private createNotificationRoutes() {
    const router = express.Router();

    // Send email notification
    router.post('/email', async (req, res) => {
      try {
        const { to, subject, body, template } = req.body;
        
        if (!to || !subject || !body) {
          return res.status(400).json({
            success: false,
            error: 'to, subject, and body are required'
          });
        }

        await this.sendEmailNotification(to, subject, body, template);
        
        res.json({
          success: true,
          message: 'Email notification sent successfully'
        });
      } catch (error) {
        logger.error('Error sending email notification:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to send email notification'
        });
      }
    });

    // Send Slack notification
    router.post('/slack', async (req, res) => {
      try {
        const { channel, message, attachments } = req.body;
        
        if (!channel || !message) {
          return res.status(400).json({
            success: false,
            error: 'channel and message are required'
          });
        }

        await this.sendSlackNotification(channel, message, attachments);
        
        res.json({
          success: true,
          message: 'Slack notification sent successfully'
        });
      } catch (error) {
        logger.error('Error sending Slack notification:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to send Slack notification'
        });
      }
    });

    // Get notification preferences
    router.get('/preferences/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        
        const preferences = await this.getNotificationPreferences(userId);
        
        res.json({
          success: true,
          data: preferences
        });
      } catch (error) {
        logger.error('Error getting notification preferences:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to get notification preferences'
        });
      }
    });

    // Update notification preferences
    router.put('/preferences/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const { preferences } = req.body;
        
        await this.updateNotificationPreferences(userId, preferences);
        
        res.json({
          success: true,
          message: 'Notification preferences updated successfully'
        });
      } catch (error) {
        logger.error('Error updating notification preferences:', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to update notification preferences'
        });
      }
    });

    return router;
  }

  /**
   * Initialize email transporter
   */
  private initializeEmailTransporter(): void {
    try {
      if (this.emailConfig.emailUser && this.emailConfig.emailPass) {
        this.emailTransporter = nodemailer.createTransporter({
          host: this.emailConfig.smtpServer,
          port: this.emailConfig.smtpPort,
          secure: this.emailConfig.smtpPort === 465,
          auth: {
            user: this.emailConfig.emailUser,
            pass: this.emailConfig.emailPass
          }
        });
        
        logger.info('Email transporter initialized');
      } else {
        logger.warn('Email credentials not configured. Email notifications will be logged only.');
      }
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error as Error);
    }
  }

  /**
   * Send email notification using real SMTP
   */
  private async sendEmailNotification(to: string, subject: string, body: string, template?: string): Promise<void> {
    try {
      logger.info('Sending email notification', { to, subject, template });
      
      if (!this.emailTransporter) {
        logger.warn('Email transporter not available. Logging notification instead.');
        logger.info('Email notification content:', { to, subject, body });
        return;
      }

      // Create email content
      const emailContent = template ? this.applyEmailTemplate(template, body) : body;
      
      // Send email
      const mailOptions = {
        from: this.emailConfig.emailUser,
        to: to,
        subject: subject,
        html: emailContent,
        text: body.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', { messageId: result.messageId });
      
    } catch (error) {
      logger.error('Error sending email notification:', error as Error);
      throw error;
    }
  }

  /**
   * Apply email template
   */
  private applyEmailTemplate(template: string, content: string): string {
    const templates: { [key: string]: string } = {
      'signal-alert': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Trading Signal Alert</h2>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px;">
            ${content}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
            This is an automated notification from your Paper Trading System.
          </p>
        </div>
      `,
      'system-alert': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">System Alert</h2>
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
            ${content}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
            Please check your trading system immediately.
          </p>
        </div>
      `,
      'default': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px;">
            ${content}
          </div>
        </div>
      `
    };

    return templates[template] || templates.default;
  }

  /**
   * Send Slack notification using webhook
   */
  private async sendSlackNotification(channel: string, message: string, attachments?: any[]): Promise<void> {
    try {
      logger.info('Sending Slack notification', { channel, message });
      
      if (!this.slackConfig.webhookUrl) {
        logger.warn('Slack webhook not configured. Logging notification instead.');
        logger.info('Slack notification content:', { channel, message, attachments });
        return;
      }

      // Prepare Slack message
      const slackMessage = {
        channel: channel.startsWith('#') ? channel : `#${channel}`,
        text: message,
        attachments: attachments || []
      };

      // Send to Slack webhook
      const response = await axios.post(this.slackConfig.webhookUrl, slackMessage, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        logger.info('Slack notification sent successfully');
      } else {
        throw new Error(`Slack API returned status ${response.status}`);
      }
      
    } catch (error) {
      logger.error('Error sending Slack notification:', error as Error);
      throw error;
    }
  }

  /**
   * Get notification preferences from database
   */
  private async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const result = await this.pool.query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const userPreferences = result.rows[0].preferences || {};
      
      return {
        email: {
          enabled: userPreferences.notifications?.email?.enabled ?? true,
          frequency: userPreferences.notifications?.email?.frequency ?? 'immediate',
          types: userPreferences.notifications?.email?.types ?? ['signals', 'alerts', 'reports']
        },
        slack: {
          enabled: userPreferences.notifications?.slack?.enabled ?? true,
          channel: userPreferences.notifications?.slack?.channel ?? '#trading-alerts',
          types: userPreferences.notifications?.slack?.types ?? ['signals', 'alerts']
        },
        sms: {
          enabled: userPreferences.notifications?.sms?.enabled ?? false,
          frequency: userPreferences.notifications?.sms?.frequency ?? 'daily',
          types: userPreferences.notifications?.sms?.types ?? ['critical-alerts']
        }
      };
      
    } catch (error) {
      logger.error('Error getting notification preferences:', error as Error);
      
      // Return default preferences if database fails
      return {
        email: {
          enabled: true,
          frequency: 'immediate',
          types: ['signals', 'alerts', 'reports']
        },
        slack: {
          enabled: true,
          channel: '#trading-alerts',
          types: ['signals', 'alerts']
        },
        sms: {
          enabled: false,
          frequency: 'daily',
          types: ['critical-alerts']
        }
      };
    }
  }

  /**
   * Update notification preferences in database
   */
  private async updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    try {
      const result = await this.pool.query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentPreferences = result.rows[0].preferences || {};
      const updatedPreferences = {
        ...currentPreferences,
        notifications: preferences
      };

      await this.pool.query(
        'UPDATE users SET preferences = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(updatedPreferences), userId]
      );

      logger.info('Notification preferences updated successfully', { userId });
      
    } catch (error) {
      logger.error('Error updating notification preferences:', error as Error);
      throw error;
    }
  }

  /**
   * Start the notification service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('NotificationService is already running');
      return;
    }

    try {
      // Test database connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.app.listen(this.port, () => {
        logger.info(`NotificationService started on port ${this.port}`);
      });

      this.isRunning = true;
    } catch (error) {
      logger.error('Failed to start NotificationService', error as Error);
      throw error;
    }
  }

  /**
   * Stop the notification service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('NotificationService is not running');
      return;
    }

    await this.pool.end();
    this.isRunning = false;
    logger.info('NotificationService stopped');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      uptime: process.uptime(),
      emailConfigured: !!this.emailTransporter,
      slackConfigured: !!this.slackConfig.webhookUrl,
      databaseConnected: this.pool.totalCount > 0
    };
  }
} 