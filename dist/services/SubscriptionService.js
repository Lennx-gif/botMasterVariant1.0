"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const Subscription_1 = require("../models/Subscription");
const User_1 = require("../models/User");
class SubscriptionService {
    async createSubscription(telegramId, packageType, transactionId, amount) {
        const user = await User_1.User.findByTelegramId(telegramId);
        if (!user)
            throw new Error('User not found');
        await Subscription_1.Subscription.updateMany({ userId: user._id, status: 'active', endDate: { $lte: new Date() } }, { status: 'expired' });
        const now = new Date();
        let endDate = new Date(now);
        switch (packageType) {
            case 'daily':
                endDate.setDate(endDate.getDate() + 1);
                break;
            case 'weekly':
                endDate.setDate(endDate.getDate() + 7);
                break;
            case 'monthly':
                endDate.setMonth(endDate.getMonth() + 1);
                break;
        }
        const sub = new Subscription_1.Subscription({
            userId: user._id,
            packageType,
            startDate: now,
            endDate,
            status: 'active',
            transactionId,
            amount
        });
        return sub.save();
    }
    async renewSubscription(telegramId, packageType, transactionId, amount) {
        const user = await User_1.User.findByTelegramId(telegramId);
        if (!user)
            throw new Error('User not found');
        const activeSub = await Subscription_1.Subscription.findActiveByUserId(user._id);
        let startDate = new Date();
        if (activeSub) {
            startDate = activeSub.endDate > new Date() ? activeSub.endDate : new Date();
            activeSub.status = 'expired';
            await activeSub.save();
        }
        let endDate = new Date(startDate);
        switch (packageType) {
            case 'daily':
                endDate.setDate(endDate.getDate() + 1);
                break;
            case 'weekly':
                endDate.setDate(endDate.getDate() + 7);
                break;
            case 'monthly':
                endDate.setMonth(endDate.getMonth() + 1);
                break;
        }
        const sub = new Subscription_1.Subscription({
            userId: user._id,
            packageType,
            startDate,
            endDate,
            status: 'active',
            transactionId,
            amount
        });
        return sub.save();
    }
    async getSubscription(telegramId) {
        const user = await User_1.User.findByTelegramId(telegramId);
        if (!user)
            return null;
        const subs = await Subscription_1.Subscription.findByUserId(user._id);
        return subs.length > 0 && subs[0] ? subs[0] : null;
    }
    async checkExpiration(telegramId) {
        const user = await User_1.User.findByTelegramId(telegramId);
        if (!user)
            return true;
        const activeSub = await Subscription_1.Subscription.findActiveByUserId(user._id);
        if (!activeSub)
            return true;
        return activeSub.isExpired();
    }
    async expireSubscription(telegramId) {
        const user = await User_1.User.findByTelegramId(telegramId);
        if (!user)
            return null;
        const activeSub = await Subscription_1.Subscription.findActiveByUserId(user._id);
        if (!activeSub)
            return null;
        activeSub.status = 'expired';
        return activeSub.save();
    }
    async getExpiringSubscriptions(hours = 24) {
        return Subscription_1.Subscription.findExpiringSubscriptions(hours);
    }
}
exports.SubscriptionService = SubscriptionService;
//# sourceMappingURL=SubscriptionService.js.map