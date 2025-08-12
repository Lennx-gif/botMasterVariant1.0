"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const telegraf_1 = require("telegraf");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const SubscriptionRequest_1 = require("../models/SubscriptionRequest");
const SubscriptionService_1 = require("./SubscriptionService");
const GroupManagementService_1 = require("./GroupManagementService");
class AdminService {
    constructor(bot) {
        const config = (0, config_1.getConfig)();
        this.bot = bot;
        this.adminId = config.ADMIN_ID;
        this.subscriptionService = new SubscriptionService_1.SubscriptionService();
        this.groupManagementService = new GroupManagementService_1.GroupManagementService();
        logger_1.logger.info('AdminService initialized', {
            adminId: this.adminId,
            adminIdType: typeof this.adminId
        });
    }
    async notifyAdminOfRequest(request) {
        try {
            logger_1.logger.info('Starting admin notification process', {
                requestId: request._id,
                adminId: this.adminId,
                telegramId: request.telegramId
            });
            const config = (0, config_1.getConfig)();
            const price = request.packageType === 'daily' ? config.DAILY_PRICE :
                request.packageType === 'weekly' ? config.WEEKLY_PRICE :
                    config.MONTHLY_PRICE;
            const message = `🔔 *NEW SUBSCRIPTION REQUEST*\n\n` +
                `👤 User: ${request.username ? `@${request.username}` : 'No username'}\n` +
                `🆔 Telegram ID: ${request.telegramId}\n` +
                `📱 Phone: ${request.phoneNumber || 'Not provided'}\n` +
                `📦 Package: ${request.packageType.charAt(0).toUpperCase() + request.packageType.slice(1)}\n` +
                `💰 Price: KES ${price}\n` +
                `⏰ Requested: ${request.requestedAt.toLocaleString()}\n\n` +
                `Please approve or reject this request:`;
            logger_1.logger.info('Sending message to admin', {
                adminId: this.adminId,
                messageLength: message.length
            });
            await this.bot.telegram.sendMessage(this.adminId, message, {
                parse_mode: 'Markdown',
                reply_markup: telegraf_1.Markup.inlineKeyboard([
                    [
                        telegraf_1.Markup.button.callback('✅ Approve', `approve_${request._id}`),
                        telegraf_1.Markup.button.callback('❌ Reject', `reject_${request._id}`)
                    ],
                    [telegraf_1.Markup.button.callback('📋 View Details', `details_${request._id}`)]
                ]).reply_markup
            });
            logger_1.logger.info('Admin notification sent successfully for subscription request', {
                requestId: request._id,
                telegramId: request.telegramId,
                packageType: request.packageType,
                adminId: this.adminId
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to notify admin of subscription request', error instanceof Error ? error : new Error(String(error)), {
                requestId: request._id,
                adminId: this.adminId,
                telegramId: request.telegramId,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorCode: error?.code,
                errorDescription: error?.description
            });
            logger_1.logger.warn('Admin notification failed, but continuing with user response', {
                possibleCauses: [
                    'Admin has not started conversation with bot',
                    'Bot token permissions issue',
                    'Network connectivity problem',
                    'Admin ID incorrect'
                ]
            });
        }
    }
    async approveRequest(requestId, adminId) {
        try {
            const request = await SubscriptionRequest_1.SubscriptionRequest.findById(requestId);
            if (!request) {
                return { success: false, message: 'Request not found' };
            }
            if (request.status !== 'pending') {
                return { success: false, message: `Request already ${request.status}` };
            }
            request.processedBy = adminId;
            await request.approve();
            const subscription = await this.subscriptionService.createSubscription(request.telegramId, request.packageType, `ADMIN_APPROVED_${request._id}`, this.getPackagePrice(request.packageType));
            const groupResult = await this.groupManagementService.addUserToGroup(request.telegramId);
            try {
                await this.bot.telegram.sendMessage(request.telegramId, `🎉 *SUBSCRIPTION APPROVED!*\n\n` +
                    `✅ Your ${request.packageType} subscription has been approved by admin!\n` +
                    `📅 Valid until: ${subscription.endDate.toLocaleString()}\n\n` +
                    `${groupResult.success ? '🔗 You should receive a group invitation shortly!' : '⚠️ Group access will be provided manually.'}\n\n` +
                    `Thank you for your subscription! 🎊`, { parse_mode: 'Markdown' });
            }
            catch (userNotifyError) {
                logger_1.logger.warn('Failed to notify user of approval', {
                    requestId: request._id,
                    telegramId: request.telegramId,
                    error: userNotifyError instanceof Error ? userNotifyError.message : String(userNotifyError)
                });
            }
            logger_1.logger.info('Subscription request approved', {
                requestId: request._id,
                telegramId: request.telegramId,
                packageType: request.packageType,
                approvedBy: adminId,
                subscriptionId: subscription._id,
                groupAdded: groupResult.success
            });
            return {
                success: true,
                message: `✅ Request approved! User has been granted ${request.packageType} access.`
            };
        }
        catch (error) {
            logger_1.logger.error('Error approving subscription request', error instanceof Error ? error : new Error(String(error)), {
                requestId,
                adminId
            });
            return { success: false, message: 'Error processing approval' };
        }
    }
    async rejectRequest(requestId, adminId, reason) {
        try {
            const request = await SubscriptionRequest_1.SubscriptionRequest.findById(requestId);
            if (!request) {
                return { success: false, message: 'Request not found' };
            }
            if (request.status !== 'pending') {
                return { success: false, message: `Request already ${request.status}` };
            }
            request.processedBy = adminId;
            await request.reject(reason);
            try {
                await this.bot.telegram.sendMessage(request.telegramId, `❌ *SUBSCRIPTION REQUEST REJECTED*\n\n` +
                    `Your ${request.packageType} subscription request has been rejected by admin.\n\n` +
                    `${reason ? `Reason: ${reason}\n\n` : ''}` +
                    `You can submit a new request anytime using /start.`, { parse_mode: 'Markdown' });
            }
            catch (userNotifyError) {
                logger_1.logger.warn('Failed to notify user of rejection', {
                    requestId: request._id,
                    telegramId: request.telegramId,
                    error: userNotifyError instanceof Error ? userNotifyError.message : String(userNotifyError)
                });
            }
            logger_1.logger.info('Subscription request rejected', {
                requestId: request._id,
                telegramId: request.telegramId,
                packageType: request.packageType,
                rejectedBy: adminId,
                reason
            });
            return {
                success: true,
                message: `❌ Request rejected.${reason ? ` Reason: ${reason}` : ''}`
            };
        }
        catch (error) {
            logger_1.logger.error('Error rejecting subscription request', error instanceof Error ? error : new Error(String(error)), {
                requestId,
                adminId
            });
            return { success: false, message: 'Error processing rejection' };
        }
    }
    async getPendingRequests() {
        try {
            return await SubscriptionRequest_1.SubscriptionRequest.findPendingRequests();
        }
        catch (error) {
            logger_1.logger.error('Error fetching pending requests', error instanceof Error ? error : new Error(String(error)));
            return [];
        }
    }
    async sendPendingRequestsSummary() {
        try {
            const pendingRequests = await this.getPendingRequests();
            if (pendingRequests.length === 0) {
                await this.bot.telegram.sendMessage(this.adminId, '✅ No pending subscription requests at the moment.');
                return;
            }
            let message = `📋 *PENDING SUBSCRIPTION REQUESTS* (${pendingRequests.length})\n\n`;
            for (const request of pendingRequests.slice(0, 10)) {
                message += `👤 ${request.username ? `@${request.username}` : `ID: ${request.telegramId}`}\n`;
                message += `📦 ${request.packageType} • ⏰ ${request.requestedAt.toLocaleString()}\n\n`;
            }
            if (pendingRequests.length > 10) {
                message += `... and ${pendingRequests.length - 10} more requests`;
            }
            await this.bot.telegram.sendMessage(this.adminId, message, { parse_mode: 'Markdown' });
        }
        catch (error) {
            logger_1.logger.error('Error sending pending requests summary', error instanceof Error ? error : new Error(String(error)));
        }
    }
    getPackagePrice(packageType) {
        const config = (0, config_1.getConfig)();
        switch (packageType) {
            case 'daily': return config.DAILY_PRICE;
            case 'weekly': return config.WEEKLY_PRICE;
            case 'monthly': return config.MONTHLY_PRICE;
            default: return 0;
        }
    }
    isAdmin(telegramId) {
        return telegramId === this.adminId;
    }
}
exports.AdminService = AdminService;
//# sourceMappingURL=AdminService.js.map