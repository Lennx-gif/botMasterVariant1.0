import { Telegraf } from 'telegraf';
import { ISubscriptionRequest } from '../models/SubscriptionRequest';
export declare class AdminService {
    private bot;
    private adminId;
    private subscriptionService;
    private groupManagementService;
    constructor(bot: Telegraf<any>);
    notifyAdminOfRequest(request: ISubscriptionRequest): Promise<void>;
    approveRequest(requestId: string, adminId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    rejectRequest(requestId: string, adminId: number, reason?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getPendingRequests(): Promise<ISubscriptionRequest[]>;
    sendPendingRequestsSummary(): Promise<void>;
    private getPackagePrice;
    isAdmin(telegramId: number): boolean;
}
//# sourceMappingURL=AdminService.d.ts.map