export interface DatabaseConnectionOptions {
    uri: string;
    maxPoolSize?: number;
    minPoolSize?: number;
    maxIdleTimeMS?: number;
    serverSelectionTimeoutMS?: number;
    socketTimeoutMS?: number;
    connectTimeoutMS?: number;
    retryWrites?: boolean;
}
export interface DatabaseConnection {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    getConnectionState(): string;
}
export declare class DatabaseError extends Error {
    readonly code?: string;
    readonly retryable: boolean;
    constructor(message: string, code?: string, retryable?: boolean);
}
//# sourceMappingURL=database.d.ts.map