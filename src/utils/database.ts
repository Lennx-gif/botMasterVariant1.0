import mongoose from 'mongoose';
import { DatabaseConnection, DatabaseConnectionOptions, DatabaseError } from '../types/database';
import { logger } from './logger';
import { getConfig } from './config';

/**
 * MongoDB connection manager with connection pooling and retry logic
 */
export class MongoDBConnection implements DatabaseConnection {
  private options: DatabaseConnectionOptions;
  private retryAttempts: number = 0;
  private maxRetryAttempts: number = 5;
  private retryDelayMs: number = 1000;
  private isConnecting: boolean = false;
  
  constructor(options: DatabaseConnectionOptions) {
    this.options = {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      ...options
    };
    
    this.setupEventListeners();
  }
  
  /**
   * Establishes connection to MongoDB with retry logic
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      logger.debug('Database already connected');
      return;
    }
    
    if (this.isConnecting) {
      logger.debug('Database connection already in progress');
      return;
    }
    
    this.isConnecting = true;
    
    try {
      await this.connectWithRetry();
      this.retryAttempts = 0;
      this.isConnecting = false;
      logger.info('Database connected successfully', {
        uri: this.maskUri(this.options.uri),
        connectionState: this.getConnectionState()
      });
      console.log('✅ Connected to MongoDB!');
    } catch (error) {
      this.isConnecting = false;
      const dbError = error instanceof DatabaseError ? error : 
        new DatabaseError(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      logger.logError('Database connection failed', dbError, {
        errorCode: 'DB_CONNECTION_FAILED',
        operation: 'connect',
        details: {
          retryAttempts: this.retryAttempts,
          maxRetryAttempts: this.maxRetryAttempts,
          uri: this.maskUri(this.options.uri)
        }
      });
      
      throw dbError;
    }
  }
  
  /**
   * Closes the database connection
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected()) {
      logger.debug('Database already disconnected');
      return;
    }
    
    try {
      await mongoose.disconnect();
      logger.info('Database disconnected successfully');
    } catch (error) {
      const dbError = new DatabaseError(`Failed to disconnect from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.logError('Database disconnection failed', dbError, {
        errorCode: 'DB_DISCONNECTION_FAILED',
        operation: 'disconnect'
      });
      throw dbError;
    }
  }
  
  /**
   * Checks if the database is connected
   */
  isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }
  
  /**
   * Gets the current connection state as a string
   */
  getConnectionState(): string {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return states[mongoose.connection.readyState as keyof typeof states] || 'unknown';
  }
  
  /**
   * Attempts to connect with exponential backoff retry logic
   */
  private async connectWithRetry(): Promise<void> {
    while (this.retryAttempts < this.maxRetryAttempts) {
      try {
        const connectOptions: any = {};
        if (this.options.maxPoolSize !== undefined) connectOptions.maxPoolSize = this.options.maxPoolSize;
        if (this.options.minPoolSize !== undefined) connectOptions.minPoolSize = this.options.minPoolSize;
        if (this.options.maxIdleTimeMS !== undefined) connectOptions.maxIdleTimeMS = this.options.maxIdleTimeMS;
        if (this.options.serverSelectionTimeoutMS !== undefined) connectOptions.serverSelectionTimeoutMS = this.options.serverSelectionTimeoutMS;
        if (this.options.socketTimeoutMS !== undefined) connectOptions.socketTimeoutMS = this.options.socketTimeoutMS;
        if (this.options.connectTimeoutMS !== undefined) connectOptions.connectTimeoutMS = this.options.connectTimeoutMS;
        if (this.options.retryWrites !== undefined) connectOptions.retryWrites = this.options.retryWrites;
        
        await mongoose.connect(this.options.uri, connectOptions);
        
        return; // Connection successful
      } catch (error) {
        this.retryAttempts++;
        
        if (this.retryAttempts >= this.maxRetryAttempts) {
          throw new DatabaseError(
            `Failed to connect after ${this.maxRetryAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'MAX_RETRIES_EXCEEDED'
          );
        }
        
        const delay = this.retryDelayMs * Math.pow(2, this.retryAttempts - 1);
        logger.warn(`Database connection attempt ${this.retryAttempts} failed, retrying in ${delay}ms`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          retryAttempts: this.retryAttempts,
          maxRetryAttempts: this.maxRetryAttempts,
          nextRetryDelay: delay
        });
        
        await this.sleep(delay);
      }
    }
  }
  
  /**
   * Sets up event listeners for database connection events
   */
  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to database');
    });
    
    mongoose.connection.on('error', (error) => {
      logger.logError('Mongoose connection error', error, {
        errorCode: 'MONGOOSE_CONNECTION_ERROR',
        operation: 'connection_event'
      });
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from database');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('Mongoose reconnected to database');
    });
    
    // Handle application termination
    process.on('SIGINT', async () => {
      try {
        await this.disconnect();
        logger.info('Database connection closed due to application termination');
        process.exit(0);
      } catch (error) {
        logger.error('Error closing database connection during termination', error instanceof Error ? error : new Error('Unknown error'));
        process.exit(1);
      }
    });
  }
  
  /**
   * Masks sensitive information in the URI for logging
   */
  private maskUri(uri: string): string {
    try {
      const url = new URL(uri);
      if (url.password) {
        url.password = '***';
      }
      return url.toString();
    } catch {
      // If URI parsing fails, just mask the entire thing
      return uri.replace(/\/\/[^@]+@/, '//***:***@');
    }
  }
  
  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton database connection instance
let databaseInstance: DatabaseConnection | null = null;

/**
 * Gets the singleton database connection instance
 */
export function getDatabase(): DatabaseConnection {
  if (!databaseInstance) {
    const config = getConfig();
    databaseInstance = new MongoDBConnection({
      uri: config.MONGO_URI
    });
  }
  return databaseInstance;
}

/**
 * Sets a custom database connection instance (useful for testing)
 */
export function setDatabase(database: DatabaseConnection): void {
  databaseInstance = database;
}

/**
 * Resets the database connection instance (useful for testing)
 */
export function resetDatabase(): void {
  databaseInstance = null;
}

/**
 * Initializes the database connection
 */
export async function initializeDatabase(): Promise<void> {
  const database = getDatabase();
  await database.connect();
}

/**
 * Closes the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (databaseInstance) {
    await databaseInstance.disconnect();
    databaseInstance = null;
  }
}