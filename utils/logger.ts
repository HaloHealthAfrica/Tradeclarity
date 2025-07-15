import { EventEmitter } from 'events';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  module: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logFile?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

class Logger extends EventEmitter {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(config: LoggerConfig) {
    super();
    this.config = config;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelStr = LogLevel[entry.level];
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const errorStr = entry.error ? `\n${entry.error.stack}` : '';
    
    return `[${timestamp}] ${levelStr} [${entry.module}] ${entry.message}${contextStr}${errorStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error, module: string = 'SYSTEM'): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context: context || undefined,
      error: error || undefined,
      module
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Emit event for external listeners
    this.emit('log', entry);

    // Console output
    if (this.config.enableConsole) {
      const formatted = this.formatMessage(entry);
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        case LogLevel.INFO:
          console.info(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(formatted);
          break;
      }
    }

    // File output (simplified - in production, use a proper logging library)
    if (this.config.enableFile && this.config.logFile) {
      // This would be implemented with fs.appendFile in a real implementation
      // For now, we'll just emit the event
      this.emit('fileLog', entry);
    }
  }

  debug(message: string, context?: Record<string, any>, module?: string): void {
    this.log(LogLevel.DEBUG, message, context, undefined, module);
  }

  info(message: string, context?: Record<string, any>, module?: string): void {
    this.log(LogLevel.INFO, message, context, undefined, module);
  }

  warn(message: string, context?: Record<string, any>, module?: string): void {
    this.log(LogLevel.WARN, message, context, undefined, module);
  }

  error(message: string, error?: Error, context?: Record<string, any>, module?: string): void {
    this.log(LogLevel.ERROR, message, context, error, module);
  }

  fatal(message: string, error?: Error, context?: Record<string, any>, module?: string): void {
    this.log(LogLevel.FATAL, message, context, error, module);
  }

  // Performance logging
  time(label: string, module?: string): void {
    console.time(`[${module || 'SYSTEM'}] ${label}`);
  }

  timeEnd(label: string, module?: string): void {
    console.timeEnd(`[${module || 'SYSTEM'}] ${label}`);
  }

  // Get recent logs
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter(entry => entry.level === level);
  }

  // Clear buffer
  clearBuffer(): void {
    this.logBuffer = [];
  }
}

// Create default logger instance
const defaultConfig: LoggerConfig = {
  level: process.env.LOG_LEVEL ? 
    (LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO) : 
    LogLevel.INFO,
  enableConsole: true,
  enableFile: false
};

export const logger = new Logger(defaultConfig);

// Module-specific logger factory
export const createModuleLogger = (moduleName: string) => {
  return {
    debug: (message: string, context?: Record<string, any>) => 
      logger.debug(message, context, moduleName),
    info: (message: string, context?: Record<string, any>) => 
      logger.info(message, context, moduleName),
    warn: (message: string, context?: Record<string, any>) => 
      logger.warn(message, context, moduleName),
    error: (message: string, error?: Error, context?: Record<string, any>) => 
      logger.error(message, error, context, moduleName),
    fatal: (message: string, error?: Error, context?: Record<string, any>) => 
      logger.fatal(message, error, context, moduleName),
    time: (label: string) => logger.time(label, moduleName),
    timeEnd: (label: string) => logger.timeEnd(label, moduleName)
  };
}; 