"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModuleLogger = exports.logger = exports.LogLevel = void 0;
const events_1 = require("events");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.logBuffer = [];
        this.maxBufferSize = 1000;
        this.config = config;
    }
    formatMessage(entry) {
        const timestamp = new Date(entry.timestamp).toISOString();
        const levelStr = LogLevel[entry.level];
        const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
        const errorStr = entry.error ? `\n${entry.error.stack}` : '';
        return `[${timestamp}] ${levelStr} [${entry.module}] ${entry.message}${contextStr}${errorStr}`;
    }
    shouldLog(level) {
        return level >= this.config.level;
    }
    log(level, message, context, error, module = 'SYSTEM') {
        if (!this.shouldLog(level))
            return;
        const entry = {
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
    debug(message, context, module) {
        this.log(LogLevel.DEBUG, message, context, undefined, module);
    }
    info(message, context, module) {
        this.log(LogLevel.INFO, message, context, undefined, module);
    }
    warn(message, context, module) {
        this.log(LogLevel.WARN, message, context, undefined, module);
    }
    error(message, error, context, module) {
        this.log(LogLevel.ERROR, message, context, error, module);
    }
    fatal(message, error, context, module) {
        this.log(LogLevel.FATAL, message, context, error, module);
    }
    // Performance logging
    time(label, module) {
        console.time(`[${module || 'SYSTEM'}] ${label}`);
    }
    timeEnd(label, module) {
        console.timeEnd(`[${module || 'SYSTEM'}] ${label}`);
    }
    // Get recent logs
    getRecentLogs(count = 100) {
        return this.logBuffer.slice(-count);
    }
    // Get logs by level
    getLogsByLevel(level) {
        return this.logBuffer.filter(entry => entry.level === level);
    }
    // Clear buffer
    clearBuffer() {
        this.logBuffer = [];
    }
}
// Create default logger instance
const defaultConfig = {
    level: process.env.LOG_LEVEL ?
        (LogLevel[process.env.LOG_LEVEL] || LogLevel.INFO) :
        LogLevel.INFO,
    enableConsole: true,
    enableFile: false
};
exports.logger = new Logger(defaultConfig);
// Module-specific logger factory
const createModuleLogger = (moduleName) => {
    return {
        debug: (message, context) => exports.logger.debug(message, context, moduleName),
        info: (message, context) => exports.logger.info(message, context, moduleName),
        warn: (message, context) => exports.logger.warn(message, context, moduleName),
        error: (message, error, context) => exports.logger.error(message, error, context, moduleName),
        fatal: (message, error, context) => exports.logger.fatal(message, error, context, moduleName),
        time: (label) => exports.logger.time(label, moduleName),
        timeEnd: (label) => exports.logger.timeEnd(label, moduleName)
    };
};
exports.createModuleLogger = createModuleLogger;
