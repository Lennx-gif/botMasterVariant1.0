import { User, IUser } from '../models/User';
import { Subscription } from '../models/Subscription';
import mongoose from 'mongoose';

export class UserService {
  /**
   * Create a new user from Telegram info
   */
  async createUser(telegramId: number, username: string | undefined, phoneNumber?: string): Promise<IUser> {
    try {
      // Check if user already exists
      let user = await User.findByTelegramId(telegramId);
      if (user) {
        // Update phone number if it has changed
        if (user.phoneNumber !== phoneNumber) {
          user.phoneNumber = phoneNumber;
          if (username) user.username = username;
          await user.save();
        }
        return user;
      }
      
      // Create new user
      const userData: any = { telegramId, username };
      if (phoneNumber) {
        userData.phoneNumber = phoneNumber;
      }
      user = new User(userData);
      return await user.save();
    } catch (error) {
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a user by Telegram ID
   */
  async getUser(telegramId: number): Promise<IUser | null> {
    return User.findByTelegramId(telegramId);
  }

  /**
   * Update a user by Telegram ID
   */
  async updateUser(telegramId: number, updates: Partial<{ username: string; phoneNumber: string }>): Promise<IUser | null> {
    return User.findOneAndUpdate({ telegramId }, updates, { new: true });
  }

  /**
   * Get the user's current subscription status
   */
  async getUserSubscriptionStatus(telegramId: number): Promise<{
    status: 'active' | 'expired' | 'none';
    packageType?: string;
    endDate?: Date;
  }> {
    const user = await User.findByTelegramId(telegramId);
    if (!user) return { status: 'none' };
    const userId = user._id as mongoose.Types.ObjectId;
    const activeSub = await Subscription.findActiveByUserId(userId);
    if (!activeSub) {
      // Check if user has any expired subscriptions
      const subs = await Subscription.findByUserId(userId);
      if (subs && subs.length > 0) {
        const last = subs[0]!;
        return { status: 'expired', packageType: last.packageType, endDate: last.endDate };
      }
      return { status: 'none' };
    }
    return { status: 'active', packageType: activeSub.packageType, endDate: activeSub.endDate };
  }
} 