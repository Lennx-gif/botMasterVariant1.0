import { ISubscription } from '../models/Subscription';
export declare class SubscriptionService {
    createSubscription(telegramId: number, packageType: 'daily' | 'weekly' | 'monthly', transactionId: string, amount: number): Promise<ISubscription>;
    renewSubscription(telegramId: number, packageType: 'daily' | 'weekly' | 'monthly', transactionId: string, amount: number): Promise<ISubscription>;
    getSubscription(telegramId: number): Promise<ISubscription | null>;
    checkExpiration(telegramId: number): Promise<boolean>;
    expireSubscription(telegramId: number): Promise<ISubscription | null>;
    getExpiringSubscriptions(hours?: number): Promise<ISubscription[]>;
}
//# sourceMappingURL=SubscriptionService.d.ts.map