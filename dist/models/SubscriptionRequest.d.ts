import mongoose, { Document, Model } from 'mongoose';
export interface ISubscriptionRequest extends Document {
    userId: mongoose.Types.ObjectId;
    telegramId: number;
    username?: string;
    phoneNumber?: string;
    packageType: 'daily' | 'weekly' | 'monthly';
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: Date;
    processedAt?: Date;
    processedBy?: number;
    notes?: string;
    approve(): Promise<ISubscriptionRequest>;
    reject(reason?: string): Promise<ISubscriptionRequest>;
}
export interface ISubscriptionRequestModel extends Model<ISubscriptionRequest> {
    findPendingRequests(): Promise<ISubscriptionRequest[]>;
    findByTelegramId(telegramId: number): Promise<ISubscriptionRequest[]>;
    findPendingByTelegramId(telegramId: number): Promise<ISubscriptionRequest | null>;
}
export declare const SubscriptionRequest: ISubscriptionRequestModel;
//# sourceMappingURL=SubscriptionRequest.d.ts.map