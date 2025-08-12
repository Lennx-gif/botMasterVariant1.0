import { Request, Response } from 'express';
export interface MpesaCallbackData {
    Body: {
        stkCallback: {
            MerchantRequestID: string;
            CheckoutRequestID: string;
            ResultCode: number;
            ResultDesc: string;
            CallbackMetadata?: {
                Item: Array<{
                    Name: string;
                    Value: string | number;
                }>;
            };
        };
    };
}
export interface CallbackProcessingResult {
    success: boolean;
    message: string;
    transactionId?: string;
    error?: string;
}
export declare class PaymentCallbackController {
    private subscriptionService;
    private groupManagementService;
    constructor();
    handleCallback(req: Request, res: Response): Promise<void>;
    processCallback(callbackData: MpesaCallbackData): Promise<CallbackProcessingResult>;
    private validateCallbackData;
    private extractMpesaReceiptNumber;
    healthCheck(_req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=PaymentCallbackController.d.ts.map