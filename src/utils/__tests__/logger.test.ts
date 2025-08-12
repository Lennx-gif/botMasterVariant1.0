import { ConsoleLogger, getLogger, setLogger, resetLogger, logger } from '../logger';
import { LogLevel, Logger, TransactionLogData, ErrorLogData } from '../../types/logger';

describe('Logger Utility', () => {
  let mockConsole: {
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
    log: jest.SpyInstance;
    debug: jest.SpyInstance;
  };
  
  beforeEach(() => {
    // Mock console methods
    mockConsole = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation()
    };
    
    resetLogger();
  });
  
  afterEach(() => {
    // Restore console methods
    Object.values(mockConsole).forEach(spy => spy.mockRestore());
  });
  
  describe('ConsoleLogger', () => {
    describe('log level filtering', () => {
      it('should log messages at or above the minimum level', () => {
        const logger = new ConsoleLogger(LogLevel.WARN);
        
        logger.error('Error message');
        logger.warn('Warning message');
        logger.info('Info message');
        logger.debug('Debug message');
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
        expect(mockConsole.log).toHaveBeenCalledTimes(0);
        expect(mockConsole.debug).toHaveBeenCalledTimes(0);
      });
      
      it('should log all messages when level is DEBUG', () => {
        const logger = new ConsoleLogger(LogLevel.DEBUG);
        
        logger.error('Error message');
        logger.warn('Warning message');
        logger.info('Info message');
        logger.debug('Debug message');
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        expect(mockConsole.warn).toHaveBeenCalledTimes(1);
        expect(mockConsole.log).toHaveBeenCalledTimes(1);
        expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      });
      
      it('should only log errors when level is ERROR', () => {
        const logger = new ConsoleLogger(LogLevel.ERROR);
        
        logger.error('Error message');
        logger.warn('Warning message');
        logger.info('Info message');
        logger.debug('Debug message');
        
        expect(mockConsole.error).toHaveBeenCalledTimes(1);
        expect(mockConsole.warn).toHaveBeenCalledTimes(0);
        expect(mockConsole.log).toHaveBeenCalledTimes(0);
        expect(mockConsole.debug).toHaveBeenCalledTimes(0);
      });
    });
    
    describe('structured logging', () => {
      let logger: ConsoleLogger;
      
      beforeEach(() => {
        logger = new ConsoleLogger(LogLevel.DEBUG);
      });
      
      it('should create structured log entries with timestamp and level', () => {
        logger.info('Test message');
        
        expect(mockConsole.log).toHaveBeenCalledTimes(1);
        const logCall = mockConsole.log.mock.calls[0][0];
        const logEntry = JSON.parse(logCall);
        
        expect(logEntry).toHaveProperty('timestamp');
        expect(logEntry).toHaveProperty('level', LogLevel.INFO);
        expect(logEntry).toHaveProperty('message', 'Test message');
        expect(new Date(logEntry.timestamp)).toBeInstanceOf(Date);
      });
      
      it('should include context when provided', () => {
        const context = { userId: '123', operation: 'test' };
        logger.info('Test message', context);
        
        const logCall = mockConsole.log.mock.calls[0][0];
        const logEntry = JSON.parse(logCall);
        
        expect(logEntry).toHaveProperty('context', context);
      });
      
      it('should include error information when provided', () => {
        const error = new Error('Test error');
        error.stack = 'Error stack trace';
        
        logger.error('Error occurred', error);
        
        const logCall = mockConsole.error.mock.calls[0][0];
        const logEntry = JSON.parse(logCall);
        
        expect(logEntry).toHaveProperty('error');
        expect(logEntry.error).toHaveProperty('name', 'Error');
        expect(logEntry.error).toHaveProperty('message', 'Test error');
        expect(logEntry.error).toHaveProperty('stack', 'Error stack trace');
      });
      
      it('should include both context and error when provided', () => {
        const context = { userId: '123' };
        const error = new Error('Test error');
        
        logger.error('Error with context', error, context);
        
        const logCall = mockConsole.error.mock.calls[0][0];
        const logEntry = JSON.parse(logCall);
        
        expect(logEntry).toHaveProperty('context', context);
        expect(logEntry).toHaveProperty('error');
      });
    });
    
    describe('transaction logging', () => {
      let logger: ConsoleLogger;
      
      beforeEach(() => {
        logger = new ConsoleLogger(LogLevel.DEBUG);
      });
      
      it('should log transaction data with masked phone number', () => {
        const transactionData: TransactionLogData = {
          transactionId: 'TXN123',
          userId: 'USER456',
          amount: 100,
          phoneNumber: '254712345678',
          status: 'completed',
          packageType: 'daily',
          mpesaReceiptNumber: 'MPE789'
        };
        
        logger.logTransaction('Payment processed', transactionData);
        
        const logCall = mockConsole.log.mock.calls[0][0];
        const logEntry = JSON.parse(logCall);
        
        expect(logEntry.message).toBe('Payment processed');
        expect(logEntry.context.type).toBe('transaction');
        expect(logEntry.context.transaction).toEqual({
          id: 'TXN123',
          userId: 'USER456',
          amount: 100,
          phoneNumber: '********5678', // Masked phone number
          status: 'completed',
          packageType: 'daily',
          mpesaReceiptNumber: 'MPE789'
        });
      });
      
      it('should handle short phone numbers by masking completely', () => {
        const transactionData: TransactionLogData = {
          transactionId: 'TXN123',
          userId: 'USER456',
          amount: 100,
          phoneNumber: '123',
          status: 'completed'
        };
        
        logger.logTransaction('Payment processed', transactionData);
        
        const logCall = mockConsole.log.mock.calls[0][0];
        const logEntry = JSON.parse(logCall);
        
        expect(logEntry.context.transaction.phoneNumber).toBe('***');
      });
    });
    
    describe('error logging', () => {
      let logger: ConsoleLogger;
      
      beforeEach(() => {
        logger = new ConsoleLogger(LogLevel.DEBUG);
      });
      
      it('should log error with structured error data', () => {
        const error = new Error('Payment failed');
        const errorData: ErrorLogData = {
          errorCode: 'PAYMENT_TIMEOUT',
          userId: 'USER123',
          operation: 'processPayment',
          details: { transactionId: 'TXN456' }
        };
        
        logger.logError('Payment processing failed', error, errorData);
        
        const logCall = mockConsole.error.mock.calls[0][0];
        const logEntry = JSON.parse(logCall);
        
        expect(logEntry.message).toBe('Payment processing failed');
        expect(logEntry.context.type).toBe('error');
        expect(logEntry.context.errorData).toEqual(errorData);
        expect(logEntry.error.message).toBe('Payment failed');
      });
      
      it('should log error without additional data', () => {
        const error = new Error('Simple error');
        
        logger.logError('Simple error occurred', error);
        
        const logCall = mockConsole.error.mock.calls[0][0];
        const logEntry = JSON.parse(logCall);
        
        expect(logEntry.message).toBe('Simple error occurred');
        expect(logEntry.context.type).toBe('error');
        expect(logEntry.error.message).toBe('Simple error');
      });
    });
    
    describe('level management', () => {
      it('should allow setting and getting minimum log level', () => {
        const logger = new ConsoleLogger(LogLevel.INFO);
        
        expect(logger.getMinLevel()).toBe(LogLevel.INFO);
        
        logger.setMinLevel(LogLevel.ERROR);
        expect(logger.getMinLevel()).toBe(LogLevel.ERROR);
      });
    });
  });
  
  describe('singleton logger functions', () => {
    it('should return the same logger instance on multiple calls', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      
      expect(logger1).toBe(logger2);
    });
    
    it('should allow setting a custom logger', () => {
      const customLogger: Logger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        logTransaction: jest.fn(),
        logError: jest.fn()
      };
      
      setLogger(customLogger);
      const retrievedLogger = getLogger();
      
      expect(retrievedLogger).toBe(customLogger);
    });
    
    it('should reset logger instance', () => {
      const logger1 = getLogger();
      resetLogger();
      const logger2 = getLogger();
      
      expect(logger1).not.toBe(logger2);
    });
  });
  
  describe('convenience logger functions', () => {
    let mockLogger: jest.Mocked<Logger>;
    
    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        logTransaction: jest.fn(),
        logError: jest.fn()
      };
      
      setLogger(mockLogger);
    });
    
    it('should call logger.error with correct parameters', () => {
      const error = new Error('Test error');
      const context = { userId: '123' };
      
      logger.error('Error message', error, context);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error message', error, context);
    });
    
    it('should call logger.warn with correct parameters', () => {
      const context = { operation: 'test' };
      
      logger.warn('Warning message', context);
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', context);
    });
    
    it('should call logger.info with correct parameters', () => {
      const context = { userId: '456' };
      
      logger.info('Info message', context);
      
      expect(mockLogger.info).toHaveBeenCalledWith('Info message', context);
    });
    
    it('should call logger.debug with correct parameters', () => {
      const context = { debug: true };
      
      logger.debug('Debug message', context);
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', context);
    });
    
    it('should call logger.logTransaction with correct parameters', () => {
      const transactionData: TransactionLogData = {
        transactionId: 'TXN123',
        userId: 'USER456',
        amount: 100,
        phoneNumber: '254712345678',
        status: 'completed'
      };
      
      logger.logTransaction('Transaction message', transactionData);
      
      expect(mockLogger.logTransaction).toHaveBeenCalledWith('Transaction message', transactionData);
    });
    
    it('should call logger.logError with correct parameters', () => {
      const error = new Error('Test error');
      const errorData: ErrorLogData = {
        errorCode: 'TEST_ERROR',
        userId: 'USER123'
      };
      
      logger.logError('Error message', error, errorData);
      
      expect(mockLogger.logError).toHaveBeenCalledWith('Error message', error, errorData);
    });
  });
  
  describe('environment variable integration', () => {
    const originalEnv = process.env;
    
    afterEach(() => {
      process.env = originalEnv;
    });
    
    it('should use LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = LogLevel.ERROR;
      resetLogger();
      
      const loggerInstance = getLogger() as ConsoleLogger;
      expect(loggerInstance.getMinLevel()).toBe(LogLevel.ERROR);
    });
    
    it('should default to INFO level when LOG_LEVEL is not set', () => {
      delete process.env.LOG_LEVEL;
      resetLogger();
      
      const loggerInstance = getLogger() as ConsoleLogger;
      expect(loggerInstance.getMinLevel()).toBe(LogLevel.INFO);
    });
  });
});