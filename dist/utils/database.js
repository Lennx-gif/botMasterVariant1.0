"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDBConnection = void 0;
exports.getDatabase = getDatabase;
exports.setDatabase = setDatabase;
exports.resetDatabase = resetDatabase;
exports.initializeDatabase = initializeDatabase;
exports.closeDatabase = closeDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const database_1 = require("../types/database");
const logger_1 = require("./logger");
const config_1 = require("./config");
class MongoDBConnection {
    constructor(options) {
        this.retryAttempts = 0;
        this.maxRetryAttempts = 5;
        this.retryDelayMs = 1000;
        this.isConnecting = false;
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
    async connect() {
        if (this.isConnected()) {
            logger_1.logger.debug('Database already connected');
            return;
        }
        if (this.isConnecting) {
            logger_1.logger.debug('Database connection already in progress');
            return;
        }
        this.isConnecting = true;
        try {
            await this.connectWithRetry();
            this.retryAttempts = 0;
            this.isConnecting = false;
            logger_1.logger.info('Database connected successfully', {
                uri: this.maskUri(this.options.uri),
                connectionState: this.getConnectionState()
            });
            console.log('✅ Connected to MongoDB!');
        }
        catch (error) {
            this.isConnecting = false;
            const dbError = error instanceof database_1.DatabaseError ? error :
                new database_1.DatabaseError(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            logger_1.logger.logError('Database connection failed', dbError, {
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
    async disconnect() {
        if (!this.isConnected()) {
            logger_1.logger.debug('Database already disconnected');
            return;
        }
        try {
            await mongoose_1.default.disconnect();
            logger_1.logger.info('Database disconnected successfully');
        }
        catch (error) {
            const dbError = new database_1.DatabaseError(`Failed to disconnect from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            logger_1.logger.logError('Database disconnection failed', dbError, {
                errorCode: 'DB_DISCONNECTION_FAILED',
                operation: 'disconnect'
            });
            throw dbError;
        }
    }
    isConnected() {
        return mongoose_1.default.connection.readyState === 1;
    }
    getConnectionState() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        return states[mongoose_1.default.connection.readyState] || 'unknown';
    }
    async connectWithRetry() {
        while (this.retryAttempts < this.maxRetryAttempts) {
            try {
                const connectOptions = {};
                if (this.options.maxPoolSize !== undefined)
                    connectOptions.maxPoolSize = this.options.maxPoolSize;
                if (this.options.minPoolSize !== undefined)
                    connectOptions.minPoolSize = this.options.minPoolSize;
                if (this.options.maxIdleTimeMS !== undefined)
                    connectOptions.maxIdleTimeMS = this.options.maxIdleTimeMS;
                if (this.options.serverSelectionTimeoutMS !== undefined)
                    connectOptions.serverSelectionTimeoutMS = this.options.serverSelectionTimeoutMS;
                if (this.options.socketTimeoutMS !== undefined)
                    connectOptions.socketTimeoutMS = this.options.socketTimeoutMS;
                if (this.options.connectTimeoutMS !== undefined)
                    connectOptions.connectTimeoutMS = this.options.connectTimeoutMS;
                if (this.options.retryWrites !== undefined)
                    connectOptions.retryWrites = this.options.retryWrites;
                await mongoose_1.default.connect(this.options.uri, connectOptions);
                return;
            }
            catch (error) {
                this.retryAttempts++;
                if (this.retryAttempts >= this.maxRetryAttempts) {
                    throw new database_1.DatabaseError(`Failed to connect after ${this.maxRetryAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`, 'MAX_RETRIES_EXCEEDED');
                }
                const delay = this.retryDelayMs * Math.pow(2, this.retryAttempts - 1);
                logger_1.logger.warn(`Database connection attempt ${this.retryAttempts} failed, retrying in ${delay}ms`, {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    retryAttempts: this.retryAttempts,
                    maxRetryAttempts: this.maxRetryAttempts,
                    nextRetryDelay: delay
                });
                await this.sleep(delay);
            }
        }
    }
    setupEventListeners() {
        mongoose_1.default.connection.on('connected', () => {
            logger_1.logger.info('Mongoose connected to database');
        });
        mongoose_1.default.connection.on('error', (error) => {
            logger_1.logger.logError('Mongoose connection error', error, {
                errorCode: 'MONGOOSE_CONNECTION_ERROR',
                operation: 'connection_event'
            });
        });
        mongoose_1.default.connection.on('disconnected', () => {
            logger_1.logger.warn('Mongoose disconnected from database');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            logger_1.logger.info('Mongoose reconnected to database');
        });
        process.on('SIGINT', async () => {
            try {
                await this.disconnect();
                logger_1.logger.info('Database connection closed due to application termination');
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error('Error closing database connection during termination', error instanceof Error ? error : new Error('Unknown error'));
                process.exit(1);
            }
        });
    }
    maskUri(uri) {
        try {
            const url = new URL(uri);
            if (url.password) {
                url.password = '***';
            }
            return url.toString();
        }
        catch {
            return uri.replace(/\/\/[^@]+@/, '//***:***@');
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.MongoDBConnection = MongoDBConnection;
let databaseInstance = null;
function getDatabase() {
    if (!databaseInstance) {
        const config = (0, config_1.getConfig)();
        databaseInstance = new MongoDBConnection({
            uri: config.MONGO_URI
        });
    }
    return databaseInstance;
}
function setDatabase(database) {
    databaseInstance = database;
}
function resetDatabase() {
    databaseInstance = null;
}
async function initializeDatabase() {
    const database = getDatabase();
    await database.connect();
}
async function closeDatabase() {
    if (databaseInstance) {
        await databaseInstance.disconnect();
        databaseInstance = null;
    }
}
//# sourceMappingURL=database.js.map