import { AxiosResponse } from "axios";
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
export declare class MpesaApiClient {
    private httpClient;
    private accessToken;
    private tokenExpiryTime;
    constructor();
    generateAccessToken(): Promise<string>;
    makeAuthenticatedRequest<T>(method: "GET" | "POST", endpoint: string, data?: any): Promise<AxiosResponse<T>>;
    clearAccessToken(): void;
}
export declare class PaymentService {
    private mpesaClient;
    constructor();
    getMpesaClient(): MpesaApiClient;
    initiatePayment(phoneNumber: string, amount: number, accountReference: string, transactionDesc?: string): Promise<PaymentInitiationResult>;
    private validatePaymentRequest;
    private isValidKenyanPhoneNumber;
    private formatPhoneNumber;
    private generateTimestamp;
    private generatePassword;
    verifyTransaction(checkoutRequestId: string): Promise<TransactionVerificationResult>;
    private maskPhoneNumber;
    getTransactionStatus(checkoutRequestId: string, maxRetries?: number): Promise<TransactionVerificationResult>;
}
//# sourceMappingURL=PaymentService.d.ts.map