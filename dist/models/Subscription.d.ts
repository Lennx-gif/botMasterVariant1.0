import mongoose, { Document, Model } from 'mongoose';
export interface ISubscription extends Document {
    userId: mongoose.Types.ObjectId;
    packageType: 'daily' | 'weekly' | 'monthly';
    startDate: Date;
    endDate: Date;
    status: 'active' | 'expired' | 'cancelled';
    transactionId: string;
    amount: number;
    createdAt: Date;
    updatedAt: Date;
    isExpired(): boolean;
    isExpiringSoon(hours?: number): boolean;
    calculateEndDate(): Date;
    expire(): Promise<ISubscription>;
}
export interface ISubscriptionModel extends Model<ISubscription> {
    findByUserId(userId: mongoose.Types.ObjectId): Promise<ISubscription[]>;
    findActiveByUserId(userId: mongoose.Types.ObjectId): Promise<ISubscription | null>;
    findExpiringSubscriptions(hours?: number): Promise<ISubscription[]>;
    findExpiredSubscriptions(): Promise<ISubscription[]>;
}
export declare const Subscription: ISubscriptionModel;
//# sourceMappingURL=Subscription.d.ts.map