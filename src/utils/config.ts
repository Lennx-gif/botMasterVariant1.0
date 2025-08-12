import { Config, ConfigError, ConfigValidationError } from '../types/config';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Validates and loads configuration from environment variables
 * Throws ConfigError if validation fails
 */
export function loadConfig(): Config {
  const errors: ConfigValidationError[] = [];
  
  // Helper function to get required string environment variable
  const getRequiredString = (key: string): string => {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      errors.push({
        field: key,
        message: 'Required environment variable is missing or empty'
      });
      return '';
    }
    return value.trim();
  };
  
  // Helper function to get required number environment variable
  const getRequiredNumber = (key: string): number => {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      errors.push({
        field: key,
        message: 'Required environment variable is missing or empty'
      });
      return 0;
    }
    
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      errors.push({
        field: key,
        message: 'Must be a valid positive number'
      });
      return 0;
    }
    
    return numValue;
  };
  
  // Validate Telegram configuration
  const BOT_TOKEN = getRequiredString('BOT_TOKEN');
  const GROUP_ID = getRequiredString('GROUP_ID');
  const ADMIN_ID = getRequiredNumber('ADMIN_ID');
  const ADMIN_USERNAME = getRequiredString('ADMIN_USERNAME');
  
  // Validate database configuration
  const MONGO_URI = getRequiredString('MONGO_URI');
  
  // Validate Mpesa configuration
  const SAFARICOM_CONSUMER_KEY = getRequiredString('SAFARICOM_CONSUMER_KEY');
  const SAFARICOM_CONSUMER_SECRET = getRequiredString('SAFARICOM_CONSUMER_SECRET');
  const MPESA_BASE_URL = getRequiredString('MPESA_BASE_URL');
  const BUSINESS_SHORT_CODE = getRequiredString('BUSINESS_SHORT_CODE');
  const PASS_KEY = getRequiredString('PASS_KEY');
  const CALLBACK_URL = getRequiredString('CALLBACK_URL');
  
  // Validate server configuration
  const PORT = getRequiredNumber('PORT');
  
  // Validate pricing configuration
  const DAILY_PRICE = getRequiredNumber('DAILY_PRICE');
  const WEEKLY_PRICE = getRequiredNumber('WEEKLY_PRICE');
  const MONTHLY_PRICE = getRequiredNumber('MONTHLY_PRICE');
  
  // Additional validation for URLs
  if (MPESA_BASE_URL && !isValidUrl(MPESA_BASE_URL)) {
    errors.push({
      field: 'MPESA_BASE_URL',
      message: 'Must be a valid URL'
    });
  }
  
  if (CALLBACK_URL && !isValidUrl(CALLBACK_URL)) {
    errors.push({
      field: 'CALLBACK_URL',
      message: 'Must be a valid URL'
    });
  }
  
  // Additional validation for MongoDB URI
  if (MONGO_URI && !isValidMongoUri(MONGO_URI)) {
    errors.push({
      field: 'MONGO_URI',
      message: 'Must be a valid MongoDB connection string'
    });
  }

  // Additional validation for Telegram Group ID
  if (GROUP_ID && !GROUP_ID.startsWith('-')) {
    errors.push({
      field: 'GROUP_ID',
      message: 'Group ID must start with - (negative number for groups)'
    });
  }

  // Additional validation for phone number in business short code
  if (BUSINESS_SHORT_CODE && !/^\d+$/.test(BUSINESS_SHORT_CODE)) {
    errors.push({
      field: 'BUSINESS_SHORT_CODE',
      message: 'Must contain only digits'
    });
  }
  
  // Throw error if any validation failed
  if (errors.length > 0) {
    throw new ConfigError(errors);
  }
  
  return {
    BOT_TOKEN,
    GROUP_ID,
    ADMIN_ID,
    ADMIN_USERNAME,
    MONGO_URI,
    SAFARICOM_CONSUMER_KEY,
    SAFARICOM_CONSUMER_SECRET,
    MPESA_BASE_URL,
    BUSINESS_SHORT_CODE,
    PASS_KEY,
    CALLBACK_URL,
    PORT,
    DAILY_PRICE,
    WEEKLY_PRICE,
    MONTHLY_PRICE
  };
}

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid MongoDB URI
 */
function isValidMongoUri(uri: string): boolean {
  return uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
}

// Export singleton config instance
let configInstance: Config | null = null;

/**
 * Gets the singleton configuration instance
 * Loads and validates config on first call
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Resets the configuration instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}