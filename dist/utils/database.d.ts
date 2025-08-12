import { DatabaseConnection, DatabaseConnectionOptions } from '../types/database';
export declare class MongoDBConnection implements DatabaseConnection {
    private options;
    private retryAttempts;
    private maxRetryAttempts;
    private retryDelayMs;
    private isConnecting;
    constructor(options: DatabaseConnectionOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    getConnectionState(): string;
    private connectWithRetry;
    private setupEventListeners;
    private maskUri;
    private sleep;
}
export declare function getDatabase(): DatabaseConnection;
export declare function setDatabase(database: DatabaseConnection): void;
export declare function resetDatabase(): void;
export declare function initializeDatabase(): Promise<void>;
export declare function closeDatabase(): Promise<void>;
//# sourceMappingURL=database.d.ts.map