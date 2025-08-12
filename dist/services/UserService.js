"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const User_1 = require("../models/User");
const Subscription_1 = require("../models/Subscription");
class UserService {
    async createUser(telegramId, username, phoneNumber) {
        try {
            let user = await User_1.User.findByTelegramId(telegramId);
            if (user) {
                if (user.phoneNumber !== phoneNumber) {
                    user.phoneNumber = phoneNumber;
                    if (username)
                        user.username = username;
                    await user.save();
                }
                return user;
            }
            const userData = { telegramId, username };
            if (phoneNumber) {
                userData.phoneNumber = phoneNumber;
            }
            user = new User_1.User(userData);
            return await user.save();
        }
        catch (error) {
            throw new Error(`Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async getUser(telegramId) {
        return User_1.User.findByTelegramId(telegramId);
    }
    async updateUser(telegramId, updates) {
        return User_1.User.findOneAndUpdate({ telegramId }, updates, { new: true });
    }
    async getUserSubscriptionStatus(telegramId) {
        const user = await User_1.User.findByTelegramId(telegramId);
        if (!user)
            return { status: 'none' };
        const userId = user._id;
        const activeSub = await Subscription_1.Subscription.findActiveByUserId(userId);
        if (!activeSub) {
            const subs = await Subscription_1.Subscription.findByUserId(userId);
            if (subs && subs.length > 0) {
                const last = subs[0];
                return { status: 'expired', packageType: last.packageType, endDate: last.endDate };
            }
            return { status: 'none' };
        }
        return { status: 'active', packageType: activeSub.packageType, endDate: activeSub.endDate };
    }
}
exports.UserService = UserService;
//# sourceMappingURL=UserService.js.map