"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.ConsoleLogger = void 0;
exports.getLogger = getLogger;
exports.setLogger = setLogger;
exports.resetLogger = resetLogger;
const logger_1 = require("../types/logger");
class ConsoleLogger {
    constructor(minLevel = logger_1.LogLevel.INFO) {
        this.minLevel = minLevel;
    }
    error(message, error, context) {
        if (this.shouldLog(logger_1.LogLevel.ERROR)) {
            const logEntry = this.createLogEntry(logger_1.LogLevel.ERROR, message, context, error);
            console.error(JSON.stringify(logEntry, null, 2));
        }
    }
    warn(message, context) {
        if (this.shouldLog(logger_1.LogLevel.WARN)) {
            const logEntry = this.createLogEntry(logger_1.LogLevel.WARN, message, context);
            console.warn(JSON.stringify(logEntry, null, 2));
        }
    }
    info(message, context) {
        if (this.shouldLog(logger_1.LogLevel.INFO)) {
            const logEntry = this.createLogEntry(logger_1.LogLevel.INFO, message, context);
            console.log(JSON.stringify(logEntry, null, 2));
        }
    }
    debug(message, context) {
        if (this.shouldLog(logger_1.LogLevel.DEBUG)) {
            const logEntry = this.createLogEntry(logger_1.LogLevel.DEBUG, message, context);
            console.debug(JSON.stringify(logEntry, null, 2));
        }
    }
    logTransaction(message, data) {
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
    logError(message, error, data) {
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
    createLogEntry(level, message, context, error) {
        const logEntry = {
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
    shouldLog(level) {
        const levels = [logger_1.LogLevel.ERROR, logger_1.LogLevel.WARN, logger_1.LogLevel.INFO, logger_1.LogLevel.DEBUG];
        const currentLevelIndex = levels.indexOf(level);
        const minLevelIndex = levels.indexOf(this.minLevel);
        return currentLevelIndex <= minLevelIndex;
    }
    maskPhoneNumber(phoneNumber) {
        if (phoneNumber.length <= 4) {
            return '*'.repeat(phoneNumber.length);
        }
        const visibleDigits = phoneNumber.slice(-4);
        const maskedDigits = '*'.repeat(phoneNumber.length - 4);
        return maskedDigits + visibleDigits;
    }
    setMinLevel(level) {
        this.minLevel = level;
    }
    getMinLevel() {
        return this.minLevel;
    }
}
exports.ConsoleLogger = ConsoleLogger;
let loggerInstance = null;
function getLogger() {
    if (!loggerInstance) {
        const logLevel = process.env.LOG_LEVEL || logger_1.LogLevel.INFO;
        loggerInstance = new ConsoleLogger(logLevel);
    }
    return loggerInstance;
}
function setLogger(logger) {
    loggerInstance = logger;
}
function resetLogger() {
    loggerInstance = null;
}
exports.logger = {
    error: (message, error, context) => getLogger().error(message, error, context),
    warn: (message, context) => getLogger().warn(message, context),
    info: (message, context) => getLogger().info(message, context),
    debug: (message, context) => getLogger().debug(message, context),
    logTransaction: (message, data) => getLogger().logTransaction(message, data),
    logError: (message, error, data) => getLogger().logError(message, error, data)
};
//# sourceMappingURL=logger.js.map