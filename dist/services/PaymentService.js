"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = exports.MpesaApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
class MpesaApiClient {
    constructor() {
        this.accessToken = null;
        this.tokenExpiryTime = 0;
        const config = (0, config_1.getConfig)();
        this.httpClient = axios_1.default.create({
            baseURL: config.MPESA_BASE_URL,
            timeout: 30000,
            headers: {
                "Content-Type": "application/json",
            },
        });
        this.httpClient.interceptors.response.use((response) => response, (error) => {
            logger_1.logger.error("Mpesa API Error:", undefined, {
                url: error.config?.url,
                method: error.config?.method,
                status: error.response?.status,
                data: error.response?.data,
            });
            return Promise.reject(error);
        });
    }
    async generateAccessToken() {
        try {
            if (this.accessToken && Date.now() < this.tokenExpiryTime) {
                return this.accessToken;
            }
            const config = (0, config_1.getConfig)();
            const credentials = Buffer.from(`${config.SAFARICOM_CONSUMER_KEY}:${config.SAFARICOM_CONSUMER_SECRET}`).toString("base64");
            const response = await this.httpClient.get("/oauth/v1/generate?grant_type=client_credentials", {
                headers: {
                    Authorization: `Basic ${credentials}`,
                },
            });
            if (!response.data.access_token) {
                const error = new Error("No access token received from Mpesa API");
                logger_1.logger.error("Failed to generate Mpesa access token:", error);
                throw error;
            }
            this.accessToken = response.data.access_token;
            const expiresInMs = parseInt(response.data.expires_in) * 1000;
            this.tokenExpiryTime = Date.now() + expiresInMs - 60000;
            logger_1.logger.info("Mpesa access token generated successfully");
            return this.accessToken;
        }
        catch (error) {
            if (error instanceof Error &&
                error.message === "No access token received from Mpesa API") {
                throw error;
            }
            logger_1.logger.error("Failed to generate Mpesa access token:", error instanceof Error ? error : new Error(String(error)));
            throw new Error("Failed to authenticate with Mpesa API");
        }
    }
    async makeAuthenticatedRequest(method, endpoint, data) {
        try {
            const token = await this.generateAccessToken();
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            };
            if (method === "GET") {
                return await this.httpClient.get(endpoint, config);
            }
            else {
                return await this.httpClient.post(endpoint, data, config);
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to make authenticated request to ${endpoint}:`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    clearAccessToken() {
        this.accessToken = null;
        this.tokenExpiryTime = 0;
    }
}
exports.MpesaApiClient = MpesaApiClient;
class PaymentService {
    constructor() {
        this.mpesaClient = new MpesaApiClient();
    }
    getMpesaClient() {
        return this.mpesaClient;
    }
    async initiatePayment(phoneNumber, amount, accountReference, transactionDesc) {
        try {
            const validationError = this.validatePaymentRequest(phoneNumber, amount, accountReference);
            if (validationError) {
                logger_1.logger.error("Payment validation failed:", new Error(validationError));
                return {
                    success: false,
                    message: validationError,
                    error: "VALIDATION_ERROR",
                };
            }
            const config = (0, config_1.getConfig)();
            const timestamp = this.generateTimestamp();
            const password = this.generatePassword(config.BUSINESS_SHORT_CODE, config.PASS_KEY, timestamp);
            const stkPushRequest = {
                BusinessShortCode: config.BUSINESS_SHORT_CODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: amount,
                PartyA: this.formatPhoneNumber(phoneNumber),
                PartyB: config.BUSINESS_SHORT_CODE,
                PhoneNumber: this.formatPhoneNumber(phoneNumber),
                CallBackURL: config.CALLBACK_URL,
                AccountReference: accountReference,
                TransactionDesc: transactionDesc || `Payment for ${accountReference}`,
            };
            logger_1.logger.info("Initiating STK Push payment", {
                phoneNumber: this.maskPhoneNumber(phoneNumber),
                amount,
                accountReference,
            });
            const response = await this.mpesaClient.makeAuthenticatedRequest("POST", "/mpesa/stkpush/v1/processrequest", stkPushRequest);
            if (response.data.ResponseCode === "0") {
                logger_1.logger.info("STK Push initiated successfully", {
                    merchantRequestId: response.data.MerchantRequestID,
                    checkoutRequestId: response.data.CheckoutRequestID,
                });
                return {
                    success: true,
                    merchantRequestId: response.data.MerchantRequestID,
                    checkoutRequestId: response.data.CheckoutRequestID,
                    message: response.data.CustomerMessage ||
                        "Payment request sent successfully",
                };
            }
            else {
                logger_1.logger.error("STK Push failed:", new Error(response.data.ResponseDescription), {
                    responseCode: response.data.ResponseCode,
                    phoneNumber: this.maskPhoneNumber(phoneNumber),
                    amount,
                });
                return {
                    success: false,
                    message: response.data.ResponseDescription || "Payment request failed",
                    error: "STK_PUSH_FAILED",
                };
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to initiate payment:", error instanceof Error ? error : new Error(String(error)), {
                phoneNumber: this.maskPhoneNumber(phoneNumber),
                amount,
                accountReference,
            });
            return {
                success: false,
                message: "Failed to process payment request. Please try again.",
                error: "PAYMENT_PROCESSING_ERROR",
            };
        }
    }
    validatePaymentRequest(phoneNumber, amount, accountReference) {
        if (!phoneNumber || phoneNumber.trim() === "") {
            return "Phone number is required";
        }
        if (!this.isValidKenyanPhoneNumber(phoneNumber)) {
            return "Invalid Kenyan phone number format";
        }
        if (!amount || amount <= 0) {
            return "Amount must be greater than zero";
        }
        if (amount < 1) {
            return "Minimum payment amount is KES 1";
        }
        if (!accountReference || accountReference.trim() === "") {
            return "Account reference is required";
        }
        if (accountReference.length > 12) {
            return "Account reference must be 12 characters or less";
        }
        return null;
    }
    isValidKenyanPhoneNumber(phoneNumber) {
        const cleaned = phoneNumber.replace(/[\s\-\+]/g, "");
        const patterns = [
            /^254[17]\d{8}$/,
            /^0[17]\d{8}$/,
            /^[17][01]\d{7}$/,
        ];
        return patterns.some((pattern) => pattern.test(cleaned));
    }
    formatPhoneNumber(phoneNumber) {
        const cleaned = phoneNumber.replace(/[\s\-\+]/g, "");
        if (cleaned.startsWith("254")) {
            return cleaned;
        }
        else if (cleaned.startsWith("0")) {
            return "254" + cleaned.substring(1);
        }
        else if (cleaned.match(/^[17]\d{8}$/)) {
            return "254" + cleaned;
        }
        return cleaned;
    }
    generateTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }
    generatePassword(businessShortCode, passKey, timestamp) {
        const concatenated = businessShortCode + passKey + timestamp;
        return Buffer.from(concatenated).toString("base64");
    }
    async verifyTransaction(checkoutRequestId) {
        try {
            if (!checkoutRequestId || checkoutRequestId.trim() === "") {
                return {
                    success: false,
                    status: "failed",
                    message: "Checkout request ID is required",
                    error: "INVALID_REQUEST_ID",
                };
            }
            const config = (0, config_1.getConfig)();
            const timestamp = this.generateTimestamp();
            const password = this.generatePassword(config.BUSINESS_SHORT_CODE, config.PASS_KEY, timestamp);
            const queryRequest = {
                BusinessShortCode: config.BUSINESS_SHORT_CODE,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestId,
            };
            logger_1.logger.info("Verifying transaction status", {
                checkoutRequestId: checkoutRequestId,
            });
            const response = await this.mpesaClient.makeAuthenticatedRequest("POST", "/mpesa/stkpushquery/v1/query", queryRequest);
            if (response.data.ResponseCode === "0") {
                const resultCode = parseInt(response.data.ResultCode);
                if (resultCode === 0) {
                    logger_1.logger.info("Transaction verification successful", {
                        checkoutRequestId,
                        resultDesc: response.data.ResultDesc,
                    });
                    return {
                        success: true,
                        status: "completed",
                        message: "Transaction completed successfully",
                    };
                }
                else if (resultCode === 1032) {
                    logger_1.logger.info("Transaction cancelled by user", {
                        checkoutRequestId,
                        resultDesc: response.data.ResultDesc,
                    });
                    return {
                        success: true,
                        status: "failed",
                        message: "Transaction was cancelled by user",
                    };
                }
                else if (resultCode === 1037) {
                    logger_1.logger.info("Transaction timeout", {
                        checkoutRequestId,
                        resultDesc: response.data.ResultDesc,
                    });
                    return {
                        success: true,
                        status: "failed",
                        message: "Transaction timeout - user did not complete payment",
                    };
                }
                else if (resultCode === 1001) {
                    logger_1.logger.info("Transaction failed - insufficient funds", {
                        checkoutRequestId,
                        resultDesc: response.data.ResultDesc,
                    });
                    return {
                        success: true,
                        status: "failed",
                        message: "Insufficient funds in account",
                    };
                }
                else {
                    logger_1.logger.info("Transaction failed", {
                        checkoutRequestId,
                        resultCode,
                        resultDesc: response.data.ResultDesc,
                    });
                    return {
                        success: true,
                        status: "failed",
                        message: response.data.ResultDesc || "Transaction failed",
                    };
                }
            }
            else {
                logger_1.logger.error("Transaction verification query failed:", new Error(response.data.ResponseDescription), {
                    checkoutRequestId,
                    responseCode: response.data.ResponseCode,
                });
                return {
                    success: false,
                    status: "pending",
                    message: response.data.ResponseDescription ||
                        "Failed to verify transaction status",
                    error: "VERIFICATION_QUERY_FAILED",
                };
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to verify transaction:", error instanceof Error ? error : new Error(String(error)), {
                checkoutRequestId,
            });
            return {
                success: false,
                status: "pending",
                message: "Failed to verify transaction status. Please try again.",
                error: "VERIFICATION_ERROR",
            };
        }
    }
    maskPhoneNumber(phoneNumber) {
        if (!phoneNumber || phoneNumber.length < 4)
            return "****";
        const visible = phoneNumber.slice(-4);
        const masked = phoneNumber.slice(0, -4).replace(/\d/g, "*");
        return `${masked}${visible}`;
    }
    async getTransactionStatus(checkoutRequestId, maxRetries = 3) {
        let lastResult = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.verifyTransaction(checkoutRequestId);
                if (result.success &&
                    (result.status === "completed" || result.status === "failed")) {
                    return result;
                }
                lastResult = result;
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    logger_1.logger.info(`Transaction verification attempt ${attempt} failed, retrying in ${delay}ms`, {
                        checkoutRequestId,
                        attempt,
                        maxRetries,
                    });
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
            catch (error) {
                logger_1.logger.error(`Transaction verification attempt ${attempt} error:`, error instanceof Error ? error : new Error(String(error)), {
                    checkoutRequestId,
                    attempt,
                    maxRetries,
                });
            }
        }
        return (lastResult || {
            success: false,
            status: "pending",
            message: "Transaction status unknown after retries",
            error: "UNKNOWN_STATUS",
        });
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=PaymentService.js.map