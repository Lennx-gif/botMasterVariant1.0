"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.getConfig = getConfig;
exports.resetConfig = resetConfig;
const config_1 = require("../types/config");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
function loadConfig() {
    const errors = [];
    const getRequiredString = (key) => {
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
    const getRequiredNumber = (key) => {
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
    const BOT_TOKEN = getRequiredString('BOT_TOKEN');
    const GROUP_ID = getRequiredString('GROUP_ID');
    const ADMIN_ID = getRequiredNumber('ADMIN_ID');
    const ADMIN_USERNAME = getRequiredString('ADMIN_USERNAME');
    const MONGO_URI = getRequiredString('MONGO_URI');
    const SAFARICOM_CONSUMER_KEY = getRequiredString('SAFARICOM_CONSUMER_KEY');
    const SAFARICOM_CONSUMER_SECRET = getRequiredString('SAFARICOM_CONSUMER_SECRET');
    const MPESA_BASE_URL = getRequiredString('MPESA_BASE_URL');
    const BUSINESS_SHORT_CODE = getRequiredString('BUSINESS_SHORT_CODE');
    const PASS_KEY = getRequiredString('PASS_KEY');
    const CALLBACK_URL = getRequiredString('CALLBACK_URL');
    const PORT = getRequiredNumber('PORT');
    const DAILY_PRICE = getRequiredNumber('DAILY_PRICE');
    const WEEKLY_PRICE = getRequiredNumber('WEEKLY_PRICE');
    const MONTHLY_PRICE = getRequiredNumber('MONTHLY_PRICE');
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
    if (MONGO_URI && !isValidMongoUri(MONGO_URI)) {
        errors.push({
            field: 'MONGO_URI',
            message: 'Must be a valid MongoDB connection string'
        });
    }
    if (GROUP_ID && !GROUP_ID.startsWith('-')) {
        errors.push({
            field: 'GROUP_ID',
            message: 'Group ID must start with - (negative number for groups)'
        });
    }
    if (BUSINESS_SHORT_CODE && !/^\d+$/.test(BUSINESS_SHORT_CODE)) {
        errors.push({
            field: 'BUSINESS_SHORT_CODE',
            message: 'Must contain only digits'
        });
    }
    if (errors.length > 0) {
        throw new config_1.ConfigError(errors);
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
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
function isValidMongoUri(uri) {
    return uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
}
let configInstance = null;
function getConfig() {
    if (!configInstance) {
        configInstance = loadConfig();
    }
    return configInstance;
}
function resetConfig() {
    configInstance = null;
}
//# sourceMappingURL=config.js.map