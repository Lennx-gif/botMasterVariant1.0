"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigError = void 0;
class ConfigError extends Error {
    constructor(errors) {
        const message = `Configuration validation failed:\n${errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}`;
        super(message);
        this.name = 'ConfigError';
        this.errors = errors;
    }
}
exports.ConfigError = ConfigError;
//# sourceMappingURL=config.js.map