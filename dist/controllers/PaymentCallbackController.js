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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentCallbackController = void 0;
const logger_1 = require("../utils/logger");
const Transaction_1 = require("../models/Transaction");
const SubscriptionService_1 = require("../services/SubscriptionService");
const GroupManagementService_1 = require("../services/GroupManagementService");
const User_1 = require("../models/User");
class PaymentCallbackController {
    constructor() {
        this.subscriptionService = new SubscriptionService_1.SubscriptionService();
        this.groupManagementService = new GroupManagementService_1.GroupManagementService();
    }
    async handleCallback(req, res) {
        try {
            logger_1.logger.info('Received Mpesa callback', { body: req.body });
            const validationResult = this.validateCallbackData(req.body);
            if (!validationResult.isValid) {
                logger_1.logger.error('Invalid callback data structure:', new Error(validationResult.error));
                res.status(400).json({
                    success: false,
                    message: 'Invalid callback data structure'
                });
                return;
            }
            const callbackData = req.body;
            const result = await this.processCallback(callbackData);
            if (result.success) {
                logger_1.logger.info('Callback processed successfully', {
                    transactionId: result.transactionId,
                    message: result.message
                });
                res.status(200).json({
                    success: true,
                    message: result.message
                });
            }
            else {
                logger_1.logger.error('Callback processing failed:', new Error(result.error || result.message));
                res.status(200).json({
                    success: false,
                    message: result.message,
                    ...(result.error ? { error: result.error } : {})
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Unexpected error in callback handler:', error instanceof Error ? error : new Error(String(error)));
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    async processCallback(callbackData) {
        try {
            const { stkCallback } = callbackData.Body;
            const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
            const transaction = await Transaction_1.Transaction.findByTransactionId(CheckoutRequestID);
            if (!transaction) {
                logger_1.logger.warn('Transaction not found for callback', {
                    merchantRequestId: MerchantRequestID,
                    checkoutRequestId: CheckoutRequestID
                });
                return {
                    success: false,
                    message: 'Transaction not found',
                    error: 'TRANSACTION_NOT_FOUND'
                };
            }
            if (!transaction.isPending()) {
                logger_1.logger.info('Transaction already processed', {
                    transactionId: transaction.transactionId,
                    status: transaction.status
                });
                return {
                    success: true,
                    message: 'Transaction already processed',
                    transactionId: transaction.transactionId
                };
            }
            if (ResultCode === 0) {
                const mpesaReceiptNumber = this.extractMpesaReceiptNumber(stkCallback.CallbackMetadata);
                if (!mpesaReceiptNumber) {
                    logger_1.logger.error('Mpesa receipt number not found in successful callback', new Error('Receipt number missing'), {
                        transactionId: transaction.transactionId,
                        callbackMetadata: stkCallback.CallbackMetadata
                    });
                    await transaction.fail();
                    return {
                        success: false,
                        message: 'Payment verification failed - receipt number missing',
                        error: 'RECEIPT_NUMBER_MISSING',
                        transactionId: transaction.transactionId
                    };
                }
                await transaction.complete(mpesaReceiptNumber);
                try {
                    const user = await User_1.User.findById(transaction.userId);
                    if (!user) {
                        logger_1.logger.error('User not found for completed transaction', new Error('User not found'), {
                            transactionId: transaction.transactionId,
                            userId: transaction.userId
                        });
                        return {
                            success: false,
                            message: 'User not found for completed transaction',
                            error: 'USER_NOT_FOUND',
                            transactionId: transaction.transactionId
                        };
                    }
                    const subscription = await this.subscriptionService.createSubscription(user.telegramId, transaction.packageType, transaction.transactionId, transaction.amount);
                    const groupResult = await this.groupManagementService.addUserToGroup(user.telegramId);
                    if (!groupResult.success) {
                        logger_1.logger.warn('Failed to add user to group after successful payment', {
                            transactionId: transaction.transactionId,
                            userId: transaction.userId,
                            telegramId: user.telegramId,
                            error: groupResult.error
                        });
                    }
                    try {
                        const { Telegraf } = await Promise.resolve().then(() => __importStar(require('telegraf')));
                        const { getConfig } = await Promise.resolve().then(() => __importStar(require('../utils/config')));
                        const config = getConfig();
                        const bot = new Telegraf(config.BOT_TOKEN);
                        const authConfirmationMessage = `🔐 *AUTHENTICATION CONFIRMED*\n\n` +
                            `✅ User: ${user.username || user.telegramId}\n` +
                            `📱 Phone: ${transaction.phoneNumber}\n` +
                            `🧾 Receipt: ${mpesaReceiptNumber}\n` +
                            `💰 Amount: KES ${transaction.amount}\n` +
                            `📦 Package: ${transaction.packageType}\n` +
                            `⏰ Authenticated: ${new Date().toLocaleString()}\n\n` +
                            `🎯 *ACCESS GRANTED*\n` +
                            `Your payment has been verified and your subscription is now active!`;
                        await bot.telegram.sendMessage(user.telegramId, authConfirmationMessage, { parse_mode: 'Markdown' });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        const groupAccessMessage = groupResult.success
                            ? `🏆 *WELCOME TO THE PREMIUM GROUP!*\n\n` +
                                `✅ Your subscription is active until: ${subscription.endDate.toLocaleString()}\n\n` +
                                `🔗 You should receive a group invitation link shortly.\n` +
                                `Click the link to join our exclusive group!\n\n` +
                                `📋 Use /status anytime to check your subscription details.\n` +
                                `🔄 Use /renew when your subscription is about to expire.`
                            : `🎉 *SUBSCRIPTION ACTIVATED!*\n\n` +
                                `✅ Your subscription is active until: ${subscription.endDate.toLocaleString()}\n\n` +
                                `⚠️ There was an issue with automatic group access.\n` +
                                `📞 Please contact support with your receipt number: ${mpesaReceiptNumber}\n` +
                                `We'll add you to the group manually within 24 hours.\n\n` +
                                `📋 Use /status anytime to check your subscription details.`;
                        await bot.telegram.sendMessage(user.telegramId, groupAccessMessage, { parse_mode: 'Markdown' });
                        logger_1.logger.info('Authentication confirmation and group access messages sent', {
                            transactionId: transaction.transactionId,
                            userId: transaction.userId,
                            groupAdded: groupResult.success
                        });
                    }
                    catch (notificationError) {
                        logger_1.logger.error('Failed to send authentication confirmation to user', notificationError instanceof Error ? notificationError : new Error(String(notificationError)), {
                            transactionId: transaction.transactionId,
                            userId: transaction.userId
                        });
                    }
                    logger_1.logger.info('Transaction completed and subscription created successfully', {
                        transactionId: transaction.transactionId,
                        mpesaReceiptNumber,
                        userId: transaction.userId,
                        subscriptionId: subscription._id,
                        groupAdded: groupResult.success
                    });
                    return {
                        success: true,
                        message: 'Payment processed and subscription created successfully',
                        transactionId: transaction.transactionId
                    };
                }
                catch (subscriptionError) {
                    logger_1.logger.error('Failed to create subscription after successful payment', subscriptionError instanceof Error ? subscriptionError : new Error(String(subscriptionError)), {
                        transactionId: transaction.transactionId,
                        userId: transaction.userId
                    });
                    return {
                        success: false,
                        message: 'Payment completed but subscription creation failed',
                        error: 'SUBSCRIPTION_CREATION_FAILED',
                        transactionId: transaction.transactionId
                    };
                }
            }
            else {
                await transaction.fail();
                logger_1.logger.info('Transaction failed', {
                    transactionId: transaction.transactionId,
                    resultCode: ResultCode,
                    resultDesc: ResultDesc
                });
                return {
                    success: true,
                    message: 'Payment failure processed',
                    transactionId: transaction.transactionId
                };
            }
        }
        catch (error) {
            logger_1.logger.error('Error processing callback:', error instanceof Error ? error : new Error(String(error)));
            return {
                success: false,
                message: 'Failed to process callback',
                error: 'CALLBACK_PROCESSING_ERROR'
            };
        }
    }
    validateCallbackData(data) {
        if (!data || typeof data !== 'object') {
            return { isValid: false, error: 'Callback data is not an object' };
        }
        if (!data.Body || typeof data.Body !== 'object') {
            return { isValid: false, error: 'Body is missing or not an object' };
        }
        if (!data.Body.stkCallback || typeof data.Body.stkCallback !== 'object') {
            return { isValid: false, error: 'stkCallback is missing or not an object' };
        }
        const callback = data.Body.stkCallback;
        if (!callback.MerchantRequestID || typeof callback.MerchantRequestID !== 'string') {
            return { isValid: false, error: 'MerchantRequestID is missing or not a string' };
        }
        if (!callback.CheckoutRequestID || typeof callback.CheckoutRequestID !== 'string') {
            return { isValid: false, error: 'CheckoutRequestID is missing or not a string' };
        }
        if (typeof callback.ResultCode !== 'number') {
            return { isValid: false, error: 'ResultCode is missing or not a number' };
        }
        if (!callback.ResultDesc || typeof callback.ResultDesc !== 'string') {
            return { isValid: false, error: 'ResultDesc is missing or not a string' };
        }
        return { isValid: true };
    }
    extractMpesaReceiptNumber(callbackMetadata) {
        if (!callbackMetadata || !callbackMetadata.Item || !Array.isArray(callbackMetadata.Item)) {
            return null;
        }
        const receiptItem = callbackMetadata.Item.find(item => item.Name === 'MpesaReceiptNumber' && typeof item.Value === 'string');
        return receiptItem ? String(receiptItem.Value) : null;
    }
    async healthCheck(_req, res) {
        res.status(200).json({
            success: true,
            message: 'Payment callback service is healthy',
            timestamp: new Date().toISOString()
        });
    }
}
exports.PaymentCallbackController = PaymentCallbackController;
//# sourceMappingURL=PaymentCallbackController.js.map