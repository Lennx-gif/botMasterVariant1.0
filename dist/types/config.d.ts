export interface Config {
    BOT_TOKEN: string;
    GROUP_ID: string;
    ADMIN_ID: number;
    ADMIN_USERNAME: string;
    MONGO_URI: string;
    SAFARICOM_CONSUMER_KEY: string;
    SAFARICOM_CONSUMER_SECRET: string;
    MPESA_BASE_URL: string;
    BUSINESS_SHORT_CODE: string;
    PASS_KEY: string;
    CALLBACK_URL: string;
    PORT: number;
    DAILY_PRICE: number;
    WEEKLY_PRICE: number;
    MONTHLY_PRICE: number;
}
export interface ConfigValidationError {
    field: string;
    message: string;
}
export declare class ConfigError extends Error {
    readonly errors: ConfigValidationError[];
    constructor(errors: ConfigValidationError[]);
}
//# sourceMappingURL=config.d.ts.map