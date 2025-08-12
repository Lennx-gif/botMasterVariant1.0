export declare enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug"
}
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, any>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}
export interface TransactionLogData {
    transactionId: string;
    userId: string;
    amount: number;
    phoneNumber: string;
    status: string;
    packageType?: string;
    mpesaReceiptNumber?: string;
}
export interface ErrorLogData {
    errorCode?: string;
    userId?: string;
    operation?: string;
    details?: Record<string, any>;
}
export interface Logger {
    error(message: string, error?: Error, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    debug(message: string, context?: Record<string, any>): void;
    logTransaction(message: string, data: TransactionLogData): void;
    logError(message: string, error: Error, data?: ErrorLogData): void;
}
//# sourceMappingURL=logger.d.ts.map