import { IUser } from '../models/User';
export declare class UserService {
    createUser(telegramId: number, username: string | undefined, phoneNumber?: string): Promise<IUser>;
    getUser(telegramId: number): Promise<IUser | null>;
    updateUser(telegramId: number, updates: Partial<{
        username: string;
        phoneNumber: string;
    }>): Promise<IUser | null>;
    getUserSubscriptionStatus(telegramId: number): Promise<{
        status: 'active' | 'expired' | 'none';
        packageType?: string;
        endDate?: Date;
    }>;
}
//# sourceMappingURL=UserService.d.ts.map