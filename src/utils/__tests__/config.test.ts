import { loadConfig, getConfig, resetConfig } from '../config';
import { ConfigError } from '../../types/config';

describe('Configuration Utility', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    resetConfig();
  });
  
  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });
  
  const validEnvVars = {
    BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    GROUP_ID: '-1001234567890',
    MONGO_URI: 'mongodb://localhost:27017/telegram_bot',
    SAFARICOM_CONSUMER_KEY: 'test_consumer_key',
    SAFARICOM_CONSUMER_SECRET: 'test_consumer_secret',
    MPESA_BASE_URL: 'https://sandbox.safaricom.co.ke',
    BUSINESS_SHORT_CODE: '174379',
    PASS_KEY: 'test_pass_key',
    CALLBACK_URL: 'https://example.com/callback',
    PORT: '3000',
    DAILY_PRICE: '50',
    WEEKLY_PRICE: '300',
    MONTHLY_PRICE: '1000'
  };
  
  describe('loadConfig', () => {
    it('should load valid configuration successfully', () => {
      // Set all required environment variables
      Object.assign(process.env, validEnvVars);
      
      const config = loadConfig();
      
      expect(config.BOT_TOKEN).toBe(validEnvVars.BOT_TOKEN);
      expect(config.GROUP_ID).toBe(validEnvVars.GROUP_ID);
      expect(config.MONGO_URI).toBe(validEnvVars.MONGO_URI);
      expect(config.SAFARICOM_CONSUMER_KEY).toBe(validEnvVars.SAFARICOM_CONSUMER_KEY);
      expect(config.SAFARICOM_CONSUMER_SECRET).toBe(validEnvVars.SAFARICOM_CONSUMER_SECRET);
      expect(config.MPESA_BASE_URL).toBe(validEnvVars.MPESA_BASE_URL);
      expect(config.BUSINESS_SHORT_CODE).toBe(validEnvVars.BUSINESS_SHORT_CODE);
      expect(config.PASS_KEY).toBe(validEnvVars.PASS_KEY);
      expect(config.CALLBACK_URL).toBe(validEnvVars.CALLBACK_URL);
      expect(config.PORT).toBe(3000);
      expect(config.DAILY_PRICE).toBe(50);
      expect(config.WEEKLY_PRICE).toBe(300);
      expect(config.MONTHLY_PRICE).toBe(1000);
    });
    
    it('should throw ConfigError when required string variables are missing', () => {
      // Set all but one required variable
      const incompleteEnv: Partial<typeof validEnvVars> = { ...validEnvVars };
      delete incompleteEnv.BOT_TOKEN;
      Object.assign(process.env, incompleteEnv);
      
      expect(() => loadConfig()).toThrow(ConfigError);
      
      try {
        loadConfig();
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as ConfigError;
        expect(configError.errors).toHaveLength(1);
        expect(configError.errors[0]?.field).toBe('BOT_TOKEN');
        expect(configError.errors[0]?.message).toBe('Required environment variable is missing or empty');
      }
    });
    
    it('should throw ConfigError when required string variables are empty', () => {
      const envWithEmpty = { ...validEnvVars, BOT_TOKEN: '' };
      Object.assign(process.env, envWithEmpty);
      
      expect(() => loadConfig()).toThrow(ConfigError);
    });
    
    it('should throw ConfigError when required string variables are whitespace only', () => {
      const envWithWhitespace = { ...validEnvVars, BOT_TOKEN: '   ' };
      Object.assign(process.env, envWithWhitespace);
      
      expect(() => loadConfig()).toThrow(ConfigError);
    });
    
    it('should throw ConfigError when numeric variables are missing', () => {
      const incompleteEnv: Partial<typeof validEnvVars> = { ...validEnvVars };
      delete incompleteEnv.PORT;
      Object.assign(process.env, incompleteEnv);
      
      expect(() => loadConfig()).toThrow(ConfigError);
      
      try {
        loadConfig();
      } catch (error) {
        const configError = error as ConfigError;
        expect(configError.errors.some(e => e.field === 'PORT')).toBe(true);
      }
    });
    
    it('should throw ConfigError when numeric variables are invalid', () => {
      const envWithInvalidNumber = { ...validEnvVars, PORT: 'not-a-number' };
      Object.assign(process.env, envWithInvalidNumber);
      
      expect(() => loadConfig()).toThrow(ConfigError);
      
      try {
        loadConfig();
      } catch (error) {
        const configError = error as ConfigError;
        expect(configError.errors.some(e => e.field === 'PORT' && e.message === 'Must be a valid positive number')).toBe(true);
      }
    });
    
    it('should throw ConfigError when numeric variables are negative or zero', () => {
      const envWithNegativeNumber = { ...validEnvVars, DAILY_PRICE: '-10' };
      Object.assign(process.env, envWithNegativeNumber);
      
      expect(() => loadConfig()).toThrow(ConfigError);
      
      const envWithZero = { ...validEnvVars, DAILY_PRICE: '0' };
      Object.assign(process.env, envWithZero);
      
      expect(() => loadConfig()).toThrow(ConfigError);
    });
    
    it('should throw ConfigError when URLs are invalid', () => {
      const envWithInvalidUrl = { ...validEnvVars, MPESA_BASE_URL: 'not-a-url' };
      Object.assign(process.env, envWithInvalidUrl);
      
      expect(() => loadConfig()).toThrow(ConfigError);
      
      try {
        loadConfig();
      } catch (error) {
        const configError = error as ConfigError;
        expect(configError.errors.some(e => e.field === 'MPESA_BASE_URL' && e.message === 'Must be a valid URL')).toBe(true);
      }
    });
    
    it('should throw ConfigError when MongoDB URI is invalid', () => {
      const envWithInvalidMongoUri = { ...validEnvVars, MONGO_URI: 'invalid-mongo-uri' };
      Object.assign(process.env, envWithInvalidMongoUri);
      
      expect(() => loadConfig()).toThrow(ConfigError);
      
      try {
        loadConfig();
      } catch (error) {
        const configError = error as ConfigError;
        expect(configError.errors.some(e => e.field === 'MONGO_URI' && e.message === 'Must be a valid MongoDB connection string')).toBe(true);
      }
    });
    
    it('should accept valid MongoDB URIs', () => {
      const envWithValidMongoUri1 = { ...validEnvVars, MONGO_URI: 'mongodb://localhost:27017/test' };
      Object.assign(process.env, envWithValidMongoUri1);
      expect(() => loadConfig()).not.toThrow();
      
      resetConfig();
      
      const envWithValidMongoUri2 = { ...validEnvVars, MONGO_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/test' };
      Object.assign(process.env, envWithValidMongoUri2);
      expect(() => loadConfig()).not.toThrow();
    });
    
    it('should collect multiple validation errors', () => {
      const envWithMultipleErrors = {
        ...validEnvVars,
        BOT_TOKEN: '',
        PORT: 'invalid',
        MPESA_BASE_URL: 'not-a-url'
      };
      Object.assign(process.env, envWithMultipleErrors);
      
      try {
        loadConfig();
      } catch (error) {
        const configError = error as ConfigError;
        expect(configError.errors.length).toBeGreaterThan(1);
        expect(configError.errors.some(e => e.field === 'BOT_TOKEN')).toBe(true);
        expect(configError.errors.some(e => e.field === 'PORT')).toBe(true);
        expect(configError.errors.some(e => e.field === 'MPESA_BASE_URL')).toBe(true);
      }
    });
  });
  
  describe('getConfig', () => {
    it('should return the same config instance on multiple calls', () => {
      Object.assign(process.env, validEnvVars);
      
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2);
    });
    
    it('should load config on first call', () => {
      Object.assign(process.env, validEnvVars);
      
      const config = getConfig();
      
      expect(config.BOT_TOKEN).toBe(validEnvVars.BOT_TOKEN);
    });
  });
  
  describe('resetConfig', () => {
    it('should reset the config instance', () => {
      Object.assign(process.env, validEnvVars);
      
      const config1 = getConfig();
      resetConfig();
      
      // Change environment variable
      process.env.BOT_TOKEN = 'new_token';
      
      const config2 = getConfig();
      
      expect(config1).not.toBe(config2);
      expect(config2.BOT_TOKEN).toBe('new_token');
    });
  });
});