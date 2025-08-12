"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = void 0;
class DatabaseError extends Error {
    constructor(message, code, retryable = false) {
        super(message);
        this.name = 'DatabaseError';
        if (code !== undefined) {
            this.code = code;
        }
        this.retryable = retryable;
    }
}
exports.DatabaseError = DatabaseError;
//# sourceMappingURL=database.js.map