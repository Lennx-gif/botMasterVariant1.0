import { Telegraf, Markup } from 'telegraf';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { SubscriptionRequest, ISubscriptionRequest } from '../models/SubscriptionRequest';
import { SubscriptionService } from './SubscriptionService';
import { GroupManagementService } from './GroupManagementService';
import { User } from '../models/User';

export class AdminService {
  private bot: Telegraf<any>;
  private adminId: number;
  private subscriptionService: SubscriptionService;
  private groupManagementService: GroupManagementService;

  constructor(bot: Telegraf<any>) {
    const config = getConfig();
    this.bot = bot;
    this.adminId = config.ADMIN_ID;
    this.subscriptionService = new SubscriptionService();
    this.groupManagementService = new GroupManagementService();
    
    // Log admin configuration for debugging
    logger.info('AdminService initialized', {
      adminId: this.adminId,
      adminIdType: typeof this.adminId
    });
  }

  /**
   * Send subscription request to admin for approval
   */
  async notifyAdminOfRequest(request: ISubscriptionRequest): Promise<void> {
    try {
      logger.info('Starting admin notification process', {
        requestId: request._id,
        adminId: this.adminId,
        telegramId: request.telegramId
      });

      const config = getConfig();
      const price = request.packageType === 'daily' ? config.DAILY_PRICE :
                   request.packageType === 'weekly' ? config.WEEKLY_PRICE :
                   config.MONTHLY_PRICE;

      const message = 
        `🔔 *NEW SUBSCRIPTION REQUEST*\n\n` +
        `👤 User: ${request.username ? `@${request.username}` : 'No username'}\n` +
        `🆔 Telegram ID: ${request.telegramId}\n` +
        `📱 Phone: ${request.phoneNumber || 'Not provided'}\n` +
        `📦 Package: ${request.packageType.charAt(0).toUpperCase() + request.packageType.slice(1)}\n` +
        `💰 Price: KES ${price}\n` +
        `⏰ Requested: ${request.requestedAt.toLocaleString()}\n\n` +
        `Please approve or reject this request:`;

      logger.info('Sending message to admin', {
        adminId: this.adminId,
        messageLength: message.length
      });

      await this.bot.telegram.sendMessage(
        this.adminId,
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Approve', `approve_${request._id}`),
              Markup.button.callback('❌ Reject', `reject_${request._id}`)
            ],
            [Markup.button.callback('📋 View Details', `details_${request._id}`)]
          ]).reply_markup
        }
      );

      logger.info('Admin notification sent successfully for subscription request', {
        requestId: request._id,
        telegramId: request.telegramId,
        packageType: request.packageType,
        adminId: this.adminId
      });

    } catch (error) {
      logger.error('Failed to notify admin of subscription request', error instanceof Error ? error : new Error(String(error)), {
        requestId: request._id,
        adminId: this.adminId,
        telegramId: request.telegramId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: (error as any)?.code,
        errorDescription: (error as any)?.description
      });
      
      // Don't throw the error, just log it so the user still gets a response
      logger.warn('Admin notification failed, but continuing with user response', {
        possibleCauses: [
          'Admin has not started conversation with bot',
          'Bot token permissions issue',
          'Network connectivity problem',
          'Admin ID incorrect'
        ]
      });
    }
  }

  /**
   * Handle admin approval of subscription request
   */
  async approveRequest(requestId: string, adminId: number): Promise<{ success: boolean; message: string }> {
    try {
      const request = await SubscriptionRequest.findById(requestId);
      
      if (!request) {
        return { success: false, message: 'Request not found' };
      }

      if (request.status !== 'pending') {
        return { success: false, message: `Request already ${request.status}` };
      }

      // Mark request as approved
      request.processedBy = adminId;
      await request.approve();

      // Create subscription
      const subscription = await this.subscriptionService.createSubscription(
        request.telegramId,
        request.packageType,
        `ADMIN_APPROVED_${request._id}`,
        this.getPackagePrice(request.packageType)
      );

      // Add user to group
      const groupResult = await this.groupManagementService.addUserToGroup(request.telegramId);

      // Notify user of approval
      try {
        await this.bot.telegram.sendMessage(
          request.telegramId,
          `🎉 *SUBSCRIPTION APPROVED!*\n\n` +
          `✅ Your ${request.packageType} subscription has been approved by admin!\n` +
          `📅 Valid until: ${subscription.endDate.toLocaleString()}\n\n` +
          `${groupResult.success ? '🔗 You should receive a group invitation shortly!' : '⚠️ Group access will be provided manually.'}\n\n` +
          `Thank you for your subscription! 🎊`,
          { parse_mode: 'Markdown' }
        );
      } catch (userNotifyError) {
        logger.warn('Failed to notify user of approval', {
          requestId: request._id,
          telegramId: request.telegramId,
          error: userNotifyError instanceof Error ? userNotifyError.message : String(userNotifyError)
        });
      }

      logger.info('Subscription request approved', {
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

    } catch (error) {
      logger.error('Error approving subscription request', error instanceof Error ? error : new Error(String(error)), {
        requestId,
        adminId
      });
      return { success: false, message: 'Error processing approval' };
    }
  }

  /**
   * Handle admin rejection of subscription request
   */
  async rejectRequest(requestId: string, adminId: number, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const request = await SubscriptionRequest.findById(requestId);
      
      if (!request) {
        return { success: false, message: 'Request not found' };
      }

      if (request.status !== 'pending') {
        return { success: false, message: `Request already ${request.status}` };
      }

      // Mark request as rejected
      request.processedBy = adminId;
      await request.reject(reason);

      // Notify user of rejection
      try {
        await this.bot.telegram.sendMessage(
          request.telegramId,
          `❌ *SUBSCRIPTION REQUEST REJECTED*\n\n` +
          `Your ${request.packageType} subscription request has been rejected by admin.\n\n` +
          `${reason ? `Reason: ${reason}\n\n` : ''}` +
          `You can submit a new request anytime using /start.`,
          { parse_mode: 'Markdown' }
        );
      } catch (userNotifyError) {
        logger.warn('Failed to notify user of rejection', {
          requestId: request._id,
          telegramId: request.telegramId,
          error: userNotifyError instanceof Error ? userNotifyError.message : String(userNotifyError)
        });
      }

      logger.info('Subscription request rejected', {
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

    } catch (error) {
      logger.error('Error rejecting subscription request', error instanceof Error ? error : new Error(String(error)), {
        requestId,
        adminId
      });
      return { success: false, message: 'Error processing rejection' };
    }
  }

  /**
   * Get pending requests for admin review
   */
  async getPendingRequests(): Promise<ISubscriptionRequest[]> {
    try {
      return await SubscriptionRequest.findPendingRequests();
    } catch (error) {
      logger.error('Error fetching pending requests', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Send pending requests summary to admin
   */
  async sendPendingRequestsSummary(): Promise<void> {
    try {
      const pendingRequests = await this.getPendingRequests();
      
      if (pendingRequests.length === 0) {
        await this.bot.telegram.sendMessage(
          this.adminId,
          '✅ No pending subscription requests at the moment.'
        );
        return;
      }

      let message = `📋 *PENDING SUBSCRIPTION REQUESTS* (${pendingRequests.length})\n\n`;
      
      for (const request of pendingRequests.slice(0, 10)) { // Show max 10
        message += `👤 ${request.username ? `@${request.username}` : `ID: ${request.telegramId}`}\n`;
        message += `📦 ${request.packageType} • ⏰ ${request.requestedAt.toLocaleString()}\n\n`;
      }

      if (pendingRequests.length > 10) {
        message += `... and ${pendingRequests.length - 10} more requests`;
      }

      await this.bot.telegram.sendMessage(
        this.adminId,
        message,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      logger.error('Error sending pending requests summary', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get package price based on type
   */
  private getPackagePrice(packageType: 'daily' | 'weekly' | 'monthly'): number {
    const config = getConfig();
    switch (packageType) {
      case 'daily': return config.DAILY_PRICE;
      case 'weekly': return config.WEEKLY_PRICE;
      case 'monthly': return config.MONTHLY_PRICE;
      default: return 0;
    }
  }

  /**
   * Check if user is admin
   */
  isAdmin(telegramId: number): boolean {
    return telegramId === this.adminId;
  }
}