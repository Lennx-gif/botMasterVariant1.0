import axios, { AxiosInstance, AxiosResponse } from "axios";
import { getConfig } from "../utils/config";
import { logger } from "../utils/logger";

export interface MpesaAuthResponse {
  access_token: string;
  expires_in: string;
}

export interface MpesaApiError {
  errorCode: string;
  errorMessage: string;
}

export interface StkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface PaymentInitiationResult {
  success: boolean;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  message: string;
  error?: string;
}

export interface TransactionStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

export interface TransactionVerificationResult {
  success: boolean;
  status: "completed" | "pending" | "failed";
  message: string;
  mpesaReceiptNumber?: string;
  error?: string;
}

export class MpesaApiClient {
  private httpClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiryTime: number = 0;

  constructor() {
    const config = getConfig();
    this.httpClient = axios.create({
      baseURL: config.MPESA_BASE_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error("Mpesa API Error:", undefined, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate OAuth access token for Mpesa API authentication
   */
  async generateAccessToken(): Promise<string> {
    try {
      // Check if we have a valid token that hasn't expired
      if (this.accessToken && Date.now() < this.tokenExpiryTime) {
        return this.accessToken;
      }

      const config = getConfig();
      const credentials = Buffer.from(
        `${config.SAFARICOM_CONSUMER_KEY}:${config.SAFARICOM_CONSUMER_SECRET}`
      ).toString("base64");

      const response: AxiosResponse<MpesaAuthResponse> =
        await this.httpClient.get(
          "/oauth/v1/generate?grant_type=client_credentials",
          {
            headers: {
              Authorization: `Basic ${credentials}`,
            },
          }
        );

      if (!response.data.access_token) {
        const error = new Error("No access token received from Mpesa API");
        logger.error("Failed to generate Mpesa access token:", error);
        throw error;
      }

      this.accessToken = response.data.access_token;
      // Set expiry time (subtract 60 seconds for safety margin)
      const expiresInMs = parseInt(response.data.expires_in) * 1000;
      this.tokenExpiryTime = Date.now() + expiresInMs - 60000;

      logger.info("Mpesa access token generated successfully");
      return this.accessToken;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "No access token received from Mpesa API"
      ) {
        throw error;
      }
      logger.error(
        "Failed to generate Mpesa access token:",
        error instanceof Error ? error : new Error(String(error))
      );
      throw new Error("Failed to authenticate with Mpesa API");
    }
  }

  /**
   * Make authenticated request to Mpesa API
   */
  async makeAuthenticatedRequest<T>(
    method: "GET" | "POST",
    endpoint: string,
    data?: any
  ): Promise<AxiosResponse<T>> {
    try {
      const token = await this.generateAccessToken();

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };

      if (method === "GET") {
        return await this.httpClient.get<T>(endpoint, config);
      } else {
        return await this.httpClient.post<T>(endpoint, data, config);
      }
    } catch (error) {
      logger.error(
        `Failed to make authenticated request to ${endpoint}:`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Clear cached access token (useful for testing or error recovery)
   */
  clearAccessToken(): void {
    this.accessToken = null;
    this.tokenExpiryTime = 0;
  }
}

export class PaymentService {
  private mpesaClient: MpesaApiClient;

  constructor() {
    this.mpesaClient = new MpesaApiClient();
  }

  /**
   * Get the Mpesa API client instance
   */
  getMpesaClient(): MpesaApiClient {
    return this.mpesaClient;
  }

  /**
   * Initiate STK Push payment request
   */
  async initiatePayment(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    transactionDesc?: string
  ): Promise<PaymentInitiationResult> {
    try {
      // Validate input parameters
      const validationError = this.validatePaymentRequest(
        phoneNumber,
        amount,
        accountReference
      );
      if (validationError) {
        logger.error("Payment validation failed:", new Error(validationError));
        return {
          success: false,
          message: validationError,
          error: "VALIDATION_ERROR",
        };
      }

      const config = getConfig();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(
        config.BUSINESS_SHORT_CODE,
        config.PASS_KEY,
        timestamp
      );

      const stkPushRequest: StkPushRequest = {
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

      logger.info("Initiating STK Push payment", {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        amount,
        accountReference,
      });

      const response =
        await this.mpesaClient.makeAuthenticatedRequest<StkPushResponse>(
          "POST",
          "/mpesa/stkpush/v1/processrequest",
          stkPushRequest
        );

      if (response.data.ResponseCode === "0") {
        logger.info("STK Push initiated successfully", {
          merchantRequestId: response.data.MerchantRequestID,
          checkoutRequestId: response.data.CheckoutRequestID,
        });

        return {
          success: true,
          merchantRequestId: response.data.MerchantRequestID,
          checkoutRequestId: response.data.CheckoutRequestID,
          message:
            response.data.CustomerMessage ||
            "Payment request sent successfully",
        };
      } else {
        logger.error(
          "STK Push failed:",
          new Error(response.data.ResponseDescription),
          {
            responseCode: response.data.ResponseCode,
            phoneNumber: this.maskPhoneNumber(phoneNumber),
            amount,
          }
        );

        return {
          success: false,
          message:
            response.data.ResponseDescription || "Payment request failed",
          error: "STK_PUSH_FAILED",
        };
      }
    } catch (error) {
      logger.error(
        "Failed to initiate payment:",
        error instanceof Error ? error : new Error(String(error)),
        {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          amount,
          accountReference,
        }
      );

      return {
        success: false,
        message: "Failed to process payment request. Please try again.",
        error: "PAYMENT_PROCESSING_ERROR",
      };
    }
  }

  /**
   * Validate payment request parameters
   */
  private validatePaymentRequest(
    phoneNumber: string,
    amount: number,
    accountReference: string
  ): string | null {
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

  /**
   * Validate Kenyan phone number format
   */
  private isValidKenyanPhoneNumber(phoneNumber: string): boolean {
    // Remove any spaces, dashes, or plus signs
    const cleaned = phoneNumber.replace(/[\s\-\+]/g, "");

    // Check for valid Kenyan phone number patterns
    const patterns = [
      /^254[17]\d{8}$/, // 254701234567, 254711234567 (12 digits total)
      /^0[17]\d{8}$/, // 0701234567, 0711234567 (10 digits total)
      /^[17][01]\d{7}$/, // 701234567, 711234567 (9 digits total, starting with 7 or 1, second digit 0 or 1)
    ];

    return patterns.some((pattern) => pattern.test(cleaned));
  }

  /**
   * Format phone number to international format (254...)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/[\s\-\+]/g, "");

    if (cleaned.startsWith("254")) {
      return cleaned;
    } else if (cleaned.startsWith("0")) {
      return "254" + cleaned.substring(1);
    } else if (cleaned.match(/^[17]\d{8}$/)) {
      return "254" + cleaned;
    }

    return cleaned;
  }

  /**
   * Generate timestamp in the format required by Mpesa API
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate password for STK Push request
   */
  private generatePassword(
    businessShortCode: string,
    passKey: string,
    timestamp: string
  ): string {
    const concatenated = businessShortCode + passKey + timestamp;
    return Buffer.from(concatenated).toString("base64");
  }

  /**
   * Verify transaction status by querying Mpesa API
   */
  async verifyTransaction(
    checkoutRequestId: string
  ): Promise<TransactionVerificationResult> {
    try {
      if (!checkoutRequestId || checkoutRequestId.trim() === "") {
        return {
          success: false,
          status: "failed",
          message: "Checkout request ID is required",
          error: "INVALID_REQUEST_ID",
        };
      }

      const config = getConfig();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(
        config.BUSINESS_SHORT_CODE,
        config.PASS_KEY,
        timestamp
      );

      const queryRequest = {
        BusinessShortCode: config.BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      logger.info("Verifying transaction status", {
        checkoutRequestId: checkoutRequestId,
      });

      const response =
        await this.mpesaClient.makeAuthenticatedRequest<TransactionStatusResponse>(
          "POST",
          "/mpesa/stkpushquery/v1/query",
          queryRequest
        );

      if (response.data.ResponseCode === "0") {
        // Query successful, check result code
        const resultCode = parseInt(response.data.ResultCode);

        if (resultCode === 0) {
          // Transaction completed successfully
          logger.info("Transaction verification successful", {
            checkoutRequestId,
            resultDesc: response.data.ResultDesc,
          });

          return {
            success: true,
            status: "completed",
            message: "Transaction completed successfully",
          };
        } else if (resultCode === 1032) {
          // Transaction cancelled by user
          logger.info("Transaction cancelled by user", {
            checkoutRequestId,
            resultDesc: response.data.ResultDesc,
          });

          return {
            success: true,
            status: "failed",
            message: "Transaction was cancelled by user",
          };
        } else if (resultCode === 1037) {
          // Transaction timeout
          logger.info("Transaction timeout", {
            checkoutRequestId,
            resultDesc: response.data.ResultDesc,
          });

          return {
            success: true,
            status: "failed",
            message: "Transaction timeout - user did not complete payment",
          };
        } else if (resultCode === 1001) {
          // Insufficient funds
          logger.info("Transaction failed - insufficient funds", {
            checkoutRequestId,
            resultDesc: response.data.ResultDesc,
          });

          return {
            success: true,
            status: "failed",
            message: "Insufficient funds in account",
          };
        } else {
          // Other failure codes
          logger.info("Transaction failed", {
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
      } else {
        logger.error(
          "Transaction verification query failed:",
          new Error(response.data.ResponseDescription),
          {
            checkoutRequestId,
            responseCode: response.data.ResponseCode,
          }
        );

        return {
          success: false,
          status: "pending",
          message:
            response.data.ResponseDescription ||
            "Failed to verify transaction status",
          error: "VERIFICATION_QUERY_FAILED",
        };
      }
    } catch (error) {
      logger.error(
        "Failed to verify transaction:",
        error instanceof Error ? error : new Error(String(error)),
        {
          checkoutRequestId,
        }
      );

      return {
        success: false,
        status: "pending",
        message: "Failed to verify transaction status. Please try again.",
        error: "VERIFICATION_ERROR",
      };
    }
  }

  /**
   * Mask a phone number for logging (e.g., 2547******1234)
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 4) return "****";
    const visible = phoneNumber.slice(-4);
    const masked = phoneNumber.slice(0, -4).replace(/\d/g, "*");
    return `${masked}${visible}`;
  }

  /**
   * Get transaction status with retry logic
   */
  async getTransactionStatus(
    checkoutRequestId: string,
    maxRetries: number = 3
  ): Promise<TransactionVerificationResult> {
    let lastResult: TransactionVerificationResult | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.verifyTransaction(checkoutRequestId);
        if (
          result.success &&
          (result.status === "completed" || result.status === "failed")
        ) {
          return result;
        }
        lastResult = result;
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.info(
            `Transaction verification attempt ${attempt} failed, retrying in ${delay}ms`,
            {
              checkoutRequestId,
              attempt,
              maxRetries,
            }
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        logger.error(
          `Transaction verification attempt ${attempt} error:`,
          error instanceof Error ? error : new Error(String(error)),
          {
            checkoutRequestId,
            attempt,
            maxRetries,
          }
        );
      }
    }
    // Always return a result
    return (
      lastResult || {
        success: false,
        status: "pending",
        message: "Transaction status unknown after retries",
        error: "UNKNOWN_STATUS",
      }
    );
  }
}
