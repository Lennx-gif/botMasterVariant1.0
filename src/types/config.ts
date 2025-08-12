export interface Config {
  // Telegram Bot Configuration
  BOT_TOKEN: string;
  GROUP_ID: string;
  ADMIN_ID: number;
  ADMIN_USERNAME: string;
  
  // Database Configuration
  MONGO_URI: string;
  
  // Mpesa Configuration
  SAFARICOM_CONSUMER_KEY: string;
  SAFARICOM_CONSUMER_SECRET: string;
  MPESA_BASE_URL: string;
  BUSINESS_SHORT_CODE: string;
  PASS_KEY: string;
  CALLBACK_URL: string;
  
  // Server Configuration
  PORT: number;
  
  // Subscription Pricing
  DAILY_PRICE: number;
  WEEKLY_PRICE: number;
  MONTHLY_PRICE: number;
}

export interface ConfigValidationError {
  field: string;
  message: string;
}

export class ConfigError extends Error {
  public readonly errors: ConfigValidationError[];
  
  constructor(errors: ConfigValidationError[]) {
    const message = `Configuration validation failed:\n${errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}`;
    super(message);
    this.name = 'ConfigError';
    this.errors = errors;
  }
}