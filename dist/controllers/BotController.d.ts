import { Telegraf, Context } from "telegraf";
interface SessionData {
    packageType?: "daily" | "weekly" | "monthly";
    phoneNumber?: string;
    awaitingPhoneNumber?: boolean;
    awaitingConfirmation?: boolean;
}
interface BotContext extends Context {
    session: SessionData;
}
export declare class BotController {
    bot: Telegraf<BotContext>;
    private userService;
    private subscriptionService;
    private adminService;
    private logger;
    constructor();
    private setupHandlers;
    launch(maxRetries?: number, retryDelay?: number): Promise<void>;
}
export {};
//# sourceMappingURL=BotController.d.ts.map