import { Logger, LogLevel, LogEntry, TransactionLogData, ErrorLogData } from '../types/logger';

/**
 * Console-based logger implementation with structured logging
 */
export class ConsoleLogger implements Logger {
  private minLevel: LogLevel;
  
  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }
  
  /**
   * Logs an error message with optional error object and context
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const logEntry = this.createLogEntry(LogLevel.ERROR, message, context, error);
      console.error(JSON.stringify(logEntry, null, 2));
    }
  }
  
  /**
   * Logs a warning message with optional context
   */
  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const logEntry = this.createLogEntry(LogLevel.WARN, message, context);
      console.warn(JSON.stringify(logEntry, null, 2));
    }
  }
  
  /**
   * Logs an info message with optional context
   */
  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const logEntry = this.createLogEntry(LogLevel.INFO, message, context);
      console.log(JSON.stringify(logEntry, null, 2));
    }
  }
  
  /**
   * Logs a debug message with optional context
   */
  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const logEntry = this.createLogEntry(LogLevel.DEBUG, message, context);
      console.debug(JSON.stringify(logEntry, null, 2));
    }
  }
  
  /**
   * Logs transaction-related information with structured data
   */
  logTransaction(message: string, data: TransactionLogData): void {
    this.info(message, {
      type: 'transaction',
      transaction: {
        id: data.transactionId,
        userId: data.userId,
        amount: data.amount,
        phoneNumber: this.maskPhoneNumber(data.phoneNumber),
        status: data.status,
        packageType: data.packageType,
        mpesaReceiptNumber: data.mpesaReceiptNumber
      }
    });
  }
  
  /**
   * Logs error information with structured error data
   */
  logError(message: string, error: Error, data?: ErrorLogData): void {
    this.error(message, error, {
      type: 'error',
      errorData: {
        errorCode: data?.errorCode,
        userId: data?.userId,
        operation: data?.operation,
        details: data?.details
      }
    });
  }
  
  /**
   * Creates a structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    
    if (context) {
      logEntry.context = context;
    }
    
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    }
    
    return logEntry;
  }
  
  /**
   * Determines if a log level should be logged based on minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.minLevel);
    
    return currentLevelIndex <= minLevelIndex;
  }
  
  /**
   * Masks phone number for privacy (shows only last 4 digits)
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return '*'.repeat(phoneNumber.length);
    }
    
    const visibleDigits = phoneNumber.slice(-4);
    const maskedDigits = '*'.repeat(phoneNumber.length - 4);
    return maskedDigits + visibleDigits;
  }
  
  /**
   * Sets the minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
  
  /**
   * Gets the current minimum log level
   */
  getMinLevel(): LogLevel {
    return this.minLevel;
  }
}

// Singleton logger instance
let loggerInstance: Logger | null = null;

/**
 * Gets the singleton logger instance
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    // Default to INFO level, can be overridden by environment variable
    const logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    loggerInstance = new ConsoleLogger(logLevel);
  }
  return loggerInstance;
}

/**
 * Sets a custom logger instance (useful for testing)
 */
export function setLogger(logger: Logger): void {
  loggerInstance = logger;
}

/**
 * Resets the logger instance (useful for testing)
 */
export function resetLogger(): void {
  loggerInstance = null;
}

// Export convenience functions that use the singleton logger
export const logger = {
  error: (message: string, error?: Error, context?: Record<string, any>) => 
    getLogger().error(message, error, context),
  warn: (message: string, context?: Record<string, any>) => 
    getLogger().warn(message, context),
  info: (message: string, context?: Record<string, any>) => 
    getLogger().info(message, context),
  debug: (message: string, context?: Record<string, any>) => 
    getLogger().debug(message, context),
  logTransaction: (message: string, data: TransactionLogData) => 
    getLogger().logTransaction(message, data),
  logError: (message: string, error: Error, data?: ErrorLogData) => 
    getLogger().logError(message, error, data)
};