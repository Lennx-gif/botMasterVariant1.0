import { Subscription, ISubscription } from '../models/Subscription';
import { User } from '../models/User';
import mongoose from 'mongoose';

export class SubscriptionService {
  /**
   * Create a new subscription for a user
   */
  async createSubscription(telegramId: number, packageType: 'daily' | 'weekly' | 'monthly', transactionId: string, amount: number): Promise<ISubscription> {
    const user = await User.findByTelegramId(telegramId);
    if (!user) throw new Error('User not found');
    // Expire any active subscriptions
    await Subscription.updateMany({ userId: user._id, status: 'active', endDate: { $lte: new Date() } }, { status: 'expired' });
    // Create new subscription
    const now = new Date();
    // Calculate endDate based on packageType
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
    const sub = new Subscription({
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

  /**
   * Renew an existing subscription or create a new one if none is active
   */
  async renewSubscription(telegramId: number, packageType: 'daily' | 'weekly' | 'monthly', transactionId: string, amount: number): Promise<ISubscription> {
    const user = await User.findByTelegramId(telegramId);
    if (!user) throw new Error('User not found');
    const activeSub = await Subscription.findActiveByUserId(user._id as mongoose.Types.ObjectId);
    let startDate = new Date();
    if (activeSub) {
      // Extend from current end date
      startDate = activeSub.endDate > new Date() ? activeSub.endDate : new Date();
      // Expire the current subscription
      activeSub.status = 'expired';
      await activeSub.save();
    }
    // Calculate endDate for renewal
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
    const sub = new Subscription({
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

  /**
   * Get the latest subscription for a user
   */
  async getSubscription(telegramId: number): Promise<ISubscription | null> {
    const user = await User.findByTelegramId(telegramId);
    if (!user) return null;
    const subs = await Subscription.findByUserId(user._id as mongoose.Types.ObjectId);
    return subs.length > 0 && subs[0] ? subs[0] : null;
  }

  /**
   * Check if a user's subscription is expired
   */
  async checkExpiration(telegramId: number): Promise<boolean> {
    const user = await User.findByTelegramId(telegramId);
    if (!user) return true;
    const activeSub = await Subscription.findActiveByUserId(user._id as mongoose.Types.ObjectId);
    if (!activeSub) return true;
    return activeSub.isExpired();
  }

  /**
   * Expire a user's active subscription
   */
  async expireSubscription(telegramId: number): Promise<ISubscription | null> {
    const user = await User.findByTelegramId(telegramId);
    if (!user) return null;
    const activeSub = await Subscription.findActiveByUserId(user._id as mongoose.Types.ObjectId);
    if (!activeSub) return null;
    activeSub.status = 'expired';
    return activeSub.save();
  }

  /**
   * Get all subscriptions expiring within the next N hours
   */
  async getExpiringSubscriptions(hours: number = 24): Promise<ISubscription[]> {
    return Subscription.findExpiringSubscriptions(hours);
  }
} 