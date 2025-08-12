"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const SubscriptionService_1 = require("./SubscriptionService");
const GroupManagementService_1 = require("./GroupManagementService");
const User_1 = require("../models/User");
const Subscription_1 = require("../models/Subscription");
const logger_1 = require("../utils/logger");
class SchedulerService {
    constructor(bot) {
        this.subscriptionService = new SubscriptionService_1.SubscriptionService();
        this.groupService = new GroupManagementService_1.GroupManagementService();
        this.bot = bot;
    }
    start() {
        logger_1.logger.info('Starting scheduler service');
        node_cron_1.default.schedule('0 * * * *', async () => {
            try {
                logger_1.logger.info('Running expiration notification job');
                const expiring = await this.subscriptionService.getExpiringSubscriptions(24);
                for (const sub of expiring) {
                    const user = await User_1.User.findById(sub.userId);
                    if (user) {
                        try {
                            await this.bot.telegram.sendMessage(user.telegramId, `⚠️ Your subscription (${sub.packageType}) will expire on ${sub.endDate.toLocaleString()}. Please renew to avoid losing access.\n\nUse /renew to extend your subscription.`);
                            logger_1.logger.info('Sent expiration warning', { userId: user.telegramId, subscriptionId: sub._id });
                        }
                        catch (error) {
                            logger_1.logger.warn('Failed to send expiration warning', {
                                userId: user.telegramId,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                    }
                }
            }
            catch (error) {
                logger_1.logger.error('Error in expiration notification job:', error instanceof Error ? error : new Error(String(error)));
            }
        });
        node_cron_1.default.schedule('*/2 * * * *', async () => {
            try {
                logger_1.logger.info('Running pending transaction verification job');
                const { Transaction } = await Promise.resolve().then(() => __importStar(require('../models/Transaction')));
                const { PaymentService } = await Promise.resolve().then(() => __importStar(require('./PaymentService')));
                const { SubscriptionService } = await Promise.resolve().then(() => __importStar(require('./SubscriptionService')));
                const { GroupManagementService } = await Promise.resolve().then(() => __importStar(require('./GroupManagementService')));
                const { User } = await Promise.resolve().then(() => __importStar(require('../models/User')));
                const paymentService = new PaymentService();
                const subscriptionService = new SubscriptionService();
                const groupService = new GroupManagementService();
                const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                const pendingTransactions = await Transaction.find({
                    status: 'pending',
                    createdAt: { $lt: oneMinuteAgo, $gt: tenMinutesAgo }
                });
                for (const transaction of pendingTransactions) {
                    try {
                        const verificationResult = await paymentService.verifyTransaction(transaction.transactionId);
                        if (verificationResult.success && verificationResult.status === 'completed') {
                            await transaction.complete(verificationResult.mpesaReceiptNumber || 'AUTO_VERIFY');
                            const user = await User.findById(transaction.userId);
                            if (user) {
                                const subscription = await subscriptionService.createSubscription(user.telegramId, transaction.packageType, transaction.transactionId, transaction.amount);
                                const groupResult = await groupService.addUserToGroup(user.telegramId);
                                try {
                                    await this.bot.telegram.sendMessage(user.telegramId, `🎉 *PAYMENT VERIFIED!*\n\n` +
                                        `✅ Your payment has been automatically verified!\n` +
                                        `💰 Amount: KES ${transaction.amount}\n` +
                                        `📦 Package: ${transaction.packageType}\n` +
                                        `📅 Valid until: ${subscription.endDate.toLocaleString()}\n\n` +
                                        `${groupResult.success ? '🔗 Group invitation sent!' : '⚠️ Group access will be provided manually.'}`, { parse_mode: 'Markdown' });
                                }
                                catch (notifyError) {
                                    logger_1.logger.error('Failed to send auto-verification notification', notifyError instanceof Error ? notifyError : new Error(String(notifyError)));
                                }
                                logger_1.logger.info('Auto-verified pending transaction', {
                                    transactionId: transaction.transactionId,
                                    userId: user.telegramId
                                });
                            }
                        }
                        else if (verificationResult.status === 'failed') {
                            await transaction.fail();
                            logger_1.logger.info('Auto-marked transaction as failed', {
                                transactionId: transaction.transactionId
                            });
                        }
                    }
                    catch (verifyError) {
                        logger_1.logger.error('Error auto-verifying transaction', verifyError instanceof Error ? verifyError : new Error(String(verifyError)), {
                            transactionId: transaction.transactionId
                        });
                    }
                }
            }
            catch (error) {
                logger_1.logger.error('Error in pending transaction verification job:', error instanceof Error ? error : new Error(String(error)));
            }
        });
        node_cron_1.default.schedule('0 */2 * * *', async () => {
            try {
                logger_1.logger.info('Running transaction cleanup job');
                const { Transaction } = await Promise.resolve().then(() => __importStar(require('../models/Transaction')));
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                const oldPendingTransactions = await Transaction.find({
                    status: 'pending',
                    createdAt: { $lt: oneHourAgo }
                });
                for (const transaction of oldPendingTransactions) {
                    await transaction.fail();
                    logger_1.logger.info('Marked old pending transaction as failed', {
                        transactionId: transaction.transactionId,
                        age: Date.now() - transaction.createdAt.getTime()
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('Error in transaction cleanup job:', error instanceof Error ? error : new Error(String(error)));
            }
        });
        node_cron_1.default.schedule('*/10 * * * *', async () => {
            try {
                logger_1.logger.info('Running subscription expiration job');
                const expiredSubs = await Subscription_1.Subscription.findExpiredSubscriptions();
                logger_1.logger.info(`Found ${expiredSubs.length} expired subscriptions to process`);
                for (const sub of expiredSubs) {
                    const user = await User_1.User.findById(sub.userId);
                    if (user) {
                        try {
                            logger_1.logger.info('Processing expired subscription', {
                                userId: user.telegramId,
                                subscriptionId: sub._id,
                                packageType: sub.packageType,
                                endDate: sub.endDate
                            });
                            await sub.expire();
                            const groupCheckResult = await this.groupService.checkUserInGroup(user.telegramId);
                            if (groupCheckResult.inGroup) {
                                const removeResult = await this.groupService.removeUserFromGroup(user.telegramId);
                                if (removeResult.success) {
                                    logger_1.logger.info('Successfully removed expired user from group', {
                                        userId: user.telegramId,
                                        subscriptionId: sub._id
                                    });
                                }
                                else {
                                    logger_1.logger.error('Failed to remove expired user from group', new Error(removeResult.error || 'Unknown error'), {
                                        userId: user.telegramId,
                                        subscriptionId: sub._id,
                                        error: removeResult.error
                                    });
                                }
                            }
                            else {
                                logger_1.logger.info('User not in group, skipping removal', {
                                    userId: user.telegramId,
                                    subscriptionId: sub._id
                                });
                            }
                            try {
                                await this.bot.telegram.sendMessage(user.telegramId, `⏰ *SUBSCRIPTION EXPIRED*\n\n` +
                                    `Your ${sub.packageType} subscription has expired and you have been removed from the premium group.\n\n` +
                                    `📅 Expired on: ${sub.endDate.toLocaleString()}\n\n` +
                                    `🔄 Use /renew to purchase a new subscription and regain access.\n` +
                                    `💡 Use /start to see all available options.`, { parse_mode: 'Markdown' });
                                logger_1.logger.info('Sent expiration notification to user', {
                                    userId: user.telegramId,
                                    subscriptionId: sub._id
                                });
                            }
                            catch (notificationError) {
                                logger_1.logger.warn('Failed to send expiration notification', {
                                    userId: user.telegramId,
                                    error: notificationError instanceof Error ? notificationError.message : String(notificationError)
                                });
                            }
                            logger_1.logger.info('Successfully processed expired subscription', {
                                userId: user.telegramId,
                                subscriptionId: sub._id,
                                packageType: sub.packageType
                            });
                        }
                        catch (error) {
                            logger_1.logger.error('Failed to process expired subscription', error instanceof Error ? error : new Error(String(error)), {
                                userId: user.telegramId,
                                subscriptionId: sub._id,
                                packageType: sub.packageType
                            });
                        }
                    }
                    else {
                        logger_1.logger.warn('User not found for expired subscription', {
                            subscriptionId: sub._id,
                            userId: sub.userId
                        });
                    }
                }
                if (expiredSubs.length > 0) {
                    logger_1.logger.info(`Completed processing ${expiredSubs.length} expired subscriptions`);
                }
            }
            catch (error) {
                logger_1.logger.error('Error in subscription expiration job:', error instanceof Error ? error : new Error(String(error)));
            }
        });
        logger_1.logger.info('Scheduler service started successfully');
    }
}
exports.SchedulerService = SchedulerService;
//# sourceMappingURL=SchedulerService.js.map