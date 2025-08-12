import mongoose from 'mongoose';
import { MongoDBConnection, getDatabase, setDatabase, resetDatabase, initializeDatabase, closeDatabase } from '../database';
import { DatabaseError } from '../../types/database';
import { logger } from '../logger';

// Mock mongoose
jest.mock('mongoose', () => {
  const mockConnection = {
    readyState: 0,
    on: jest.fn(),
    off: jest.fn()
  };
  
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    connection: mockConnection
  };
});

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn()
  }
}));

// Mock config
jest.mock('../config', () => ({
  getConfig: jest.fn(() => ({
    MONGO_URI: 'mongodb://localhost:27017/test'
  }))
}));

describe('Database Utility', () => {
  const mockMongoose = mongoose as jest.Mocked<typeof mongoose>;
  const mockLogger = logger as jest.Mocked<typeof logger>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    resetDatabase();
    
    // Reset mongoose connection state to disconnected
    (mockMongoose.connection as any).readyState = 0;
  });
  
  describe('MongoDBConnection', () => {
    describe('connect', () => {
      it('should connect successfully on first attempt', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        mockMongoose.connect.mockResolvedValueOnce(undefined as any);
        
        await connection.connect();
        
        expect(mockMongoose.connect).toHaveBeenCalledWith(
          'mongodb://localhost:27017/test',
          expect.objectContaining({
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            retryWrites: true
          })
        );
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Database connected successfully',
          expect.objectContaining({
            uri: 'mongodb://localhost:27017/test'
          })
        );
      });
      
      it('should not attempt to connect if already connected', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        // Set connection state to connected before calling connect
        (mockMongoose.connection as any).readyState = 1;
        
        await connection.connect();
        
        expect(mockMongoose.connect).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith('Database already connected');
      });
      
      it('should retry connection on failure with exponential backoff', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        const connectionError = new Error('Connection failed');
        mockMongoose.connect
          .mockRejectedValueOnce(connectionError)
          .mockRejectedValueOnce(connectionError)
          .mockResolvedValueOnce(undefined as any);
        
        // Mock setTimeout to avoid actual delays in tests
        jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
          callback();
          return {} as any;
        });
        
        await connection.connect();
        
        expect(mockMongoose.connect).toHaveBeenCalledTimes(3);
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Database connected successfully',
          expect.any(Object)
        );
        
        jest.restoreAllMocks();
      });
      
      it('should throw DatabaseError after max retry attempts', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        const connectionError = new Error('Connection failed');
        mockMongoose.connect.mockRejectedValue(connectionError);
        
        // Mock setTimeout to avoid actual delays in tests
        jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
          callback();
          return {} as any;
        });
        
        await expect(connection.connect()).rejects.toThrow(DatabaseError);
        
        expect(mockMongoose.connect).toHaveBeenCalledTimes(5);
        expect(mockLogger.logError).toHaveBeenCalledWith(
          'Database connection failed',
          expect.any(DatabaseError),
          expect.objectContaining({
            errorCode: 'DB_CONNECTION_FAILED',
            operation: 'connect'
          })
        );
        
        jest.restoreAllMocks();
      });
      
      it('should use custom connection options', async () => {
        const customOptions = {
          uri: 'mongodb://localhost:27017/test',
          maxPoolSize: 20,
          minPoolSize: 5,
          serverSelectionTimeoutMS: 10000
        };
        
        const connection = new MongoDBConnection(customOptions);
        
        mockMongoose.connect.mockResolvedValueOnce(undefined as any);
        
        await connection.connect();
        
        expect(mockMongoose.connect).toHaveBeenCalledWith(
          customOptions.uri,
          expect.objectContaining({
            maxPoolSize: 20,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 10000
          })
        );
      });
    });
    
    describe('disconnect', () => {
      it('should disconnect successfully', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        (mockMongoose.connection as any).readyState = 1; // Connected
        mockMongoose.disconnect.mockResolvedValueOnce(undefined);
        
        await connection.disconnect();
        
        expect(mockMongoose.disconnect).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith('Database disconnected successfully');
      });
      
      it('should not attempt to disconnect if already disconnected', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        (mockMongoose.connection as any).readyState = 0; // Disconnected
        
        await connection.disconnect();
        
        expect(mockMongoose.disconnect).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith('Database already disconnected');
      });
      
      it('should throw DatabaseError on disconnect failure', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        (mockMongoose.connection as any).readyState = 1; // Connected
        const disconnectError = new Error('Disconnect failed');
        mockMongoose.disconnect.mockRejectedValueOnce(disconnectError);
        
        await expect(connection.disconnect()).rejects.toThrow(DatabaseError);
        
        expect(mockLogger.logError).toHaveBeenCalledWith(
          'Database disconnection failed',
          expect.any(DatabaseError),
          expect.objectContaining({
            errorCode: 'DB_DISCONNECTION_FAILED',
            operation: 'disconnect'
          })
        );
      });
    });
    
    describe('isConnected', () => {
      it('should return true when connected', () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        (mockMongoose.connection as any).readyState = 1;
        
        expect(connection.isConnected()).toBe(true);
      });
      
      it('should return false when not connected', () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        (mockMongoose.connection as any).readyState = 0;
        
        expect(connection.isConnected()).toBe(false);
      });
    });
    
    describe('getConnectionState', () => {
      it('should return correct connection state strings', () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        (mockMongoose.connection as any).readyState = 0;
        expect(connection.getConnectionState()).toBe('disconnected');
        
        (mockMongoose.connection as any).readyState = 1;
        expect(connection.getConnectionState()).toBe('connected');
        
        (mockMongoose.connection as any).readyState = 2;
        expect(connection.getConnectionState()).toBe('connecting');
        
        (mockMongoose.connection as any).readyState = 3;
        expect(connection.getConnectionState()).toBe('disconnecting');
        
        (mockMongoose.connection as any).readyState = 99;
        expect(connection.getConnectionState()).toBe('unknown');
      });
    });
    
    describe('URI masking', () => {
      it('should mask password in URI for logging', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://user:password@localhost:27017/test'
        });
        
        mockMongoose.connect.mockResolvedValueOnce(undefined as any);
        
        await connection.connect();
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Database connected successfully',
          expect.objectContaining({
            uri: 'mongodb://user:***@localhost:27017/test'
          })
        );
      });
      
      it('should handle URI without password', async () => {
        const connection = new MongoDBConnection({
          uri: 'mongodb://localhost:27017/test'
        });
        
        mockMongoose.connect.mockResolvedValueOnce(undefined as any);
        
        await connection.connect();
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Database connected successfully',
          expect.objectContaining({
            uri: 'mongodb://localhost:27017/test'
          })
        );
      });
    });
  });
  
  describe('singleton functions', () => {
    describe('getDatabase', () => {
      it('should return the same database instance on multiple calls', () => {
        const db1 = getDatabase();
        const db2 = getDatabase();
        
        expect(db1).toBe(db2);
      });
      
      it('should create MongoDBConnection with config URI', () => {
        const db = getDatabase();
        
        expect(db).toBeInstanceOf(MongoDBConnection);
      });
    });
    
    describe('setDatabase', () => {
      it('should allow setting a custom database instance', () => {
        const mockDatabase = {
          connect: jest.fn(),
          disconnect: jest.fn(),
          isConnected: jest.fn(),
          getConnectionState: jest.fn()
        };
        
        setDatabase(mockDatabase);
        const retrievedDb = getDatabase();
        
        expect(retrievedDb).toBe(mockDatabase);
      });
    });
    
    describe('resetDatabase', () => {
      it('should reset the database instance', () => {
        const db1 = getDatabase();
        resetDatabase();
        const db2 = getDatabase();
        
        expect(db1).not.toBe(db2);
      });
    });
    
    describe('initializeDatabase', () => {
      it('should call connect on the database instance', async () => {
        const mockDatabase = {
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn(),
          isConnected: jest.fn(),
          getConnectionState: jest.fn()
        };
        
        setDatabase(mockDatabase);
        
        await initializeDatabase();
        
        expect(mockDatabase.connect).toHaveBeenCalled();
      });
    });
    
    describe('closeDatabase', () => {
      it('should call disconnect and reset the instance', async () => {
        const mockDatabase = {
          connect: jest.fn(),
          disconnect: jest.fn().mockResolvedValue(undefined),
          isConnected: jest.fn(),
          getConnectionState: jest.fn()
        };
        
        setDatabase(mockDatabase);
        
        await closeDatabase();
        
        expect(mockDatabase.disconnect).toHaveBeenCalled();
        
        // Should create a new instance after reset
        const newDb = getDatabase();
        expect(newDb).not.toBe(mockDatabase);
      });
      
      it('should handle case when no database instance exists', async () => {
        resetDatabase();
        
        await expect(closeDatabase()).resolves.not.toThrow();
      });
    });
  });
});