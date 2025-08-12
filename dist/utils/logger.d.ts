import { Logger, LogLevel, TransactionLogData, ErrorLogData } from '../types/logger';
export declare class ConsoleLogger implements Logger {
    private minLevel;
    constructor(minLevel?: LogLevel);
    error(message: string, error?: Error, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    debug(message: string, context?: Record<string, any>): void;
    logTransaction(message: string, data: TransactionLogData): void;
    logError(message: string, error: Error, data?: ErrorLogData): void;
    private createLogEntry;
    private shouldLog;
    private maskPhoneNumber;
    setMinLevel(level: LogLevel): void;
    getMinLevel(): LogLevel;
}
export declare function getLogger(): Logger;
export declare function setLogger(logger: Logger): void;
export declare function resetLogger(): void;
export declare const logger: {
    error: (message: string, error?: Error, context?: Record<string, any>) => void;
    warn: (message: string, context?: Record<string, any>) => void;
    info: (message: string, context?: Record<string, any>) => void;
    debug: (message: string, context?: Record<string, any>) => void;
    logTransaction: (message: string, data: TransactionLogData) => void;
    logError: (message: string, error: Error, data?: ErrorLogData) => void;
};
//# sourceMappingURL=logger.d.ts.map