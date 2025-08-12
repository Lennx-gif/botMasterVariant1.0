import cron from 'node-cron';
import { SubscriptionService } from './SubscriptionService';
import { GroupManagementService } from './GroupManagementService';
import { User } from '../models/User';
import { Subscription } from '../models/Subscription';
import { Telegraf } from 'telegraf';
import { logger } from '../utils/logger';

export class SchedulerService {
  private subscriptionService: SubscriptionService;
  private groupService: GroupManagementService;
  private bot: Telegraf<any>;

  constructor(bot: Telegraf<any>) {
    this.subscriptionService = new SubscriptionService();
    this.groupService = new GroupManagementService();
    this.bot = bot;
  }

  public start() {
    logger.info('Starting scheduler service');

    // Notify users of expiring subscriptions every hour
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Running expiration notification job');
        const expiring = await this.subscriptionService.getExpiringSubscriptions(24);
        
        for (const sub of expiring) {
          const user = await User.findById(sub.userId);
          if (user) {
            try {
              await this.bot.telegram.sendMessage(
                user.telegramId,
                `⚠️ Your subscription (${sub.packageType}) will expire on ${sub.endDate.toLocaleString()}. Please renew to avoid losing access.\n\nUse /renew to extend your subscription.`
              );
              logger.info('Sent expiration warning', { userId: user.telegramId, subscriptionId: sub._id });
            } catch (error) {
              logger.warn('Failed to send expiration warning', { 
                userId: user.telegramId, 
                error: error instanceof Error ? error.message : String(error) 
              });
            }
          }
        }
      } catch (error) {
        logger.error('Error in expiration notification job:', error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Check pending transactions every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      try {
        logger.info('Running pending transaction verification job');
        const { Transaction } = await import('../models/Transaction');
        const { PaymentService } = await import('./PaymentService');
        const { SubscriptionService } = await import('./SubscriptionService');
        const { GroupManagementService } = await import('./GroupManagementService');
        const { User } = await import('../models/User');
        
        const paymentService = new PaymentService();
        const subscriptionService = new SubscriptionService();
        const groupService = new GroupManagementService();
        
        // Find transactions that are pending for more than 1 minute but less than 10 minutes
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
              // Payment successful - process it
              await transaction.complete(verificationResult.mpesaReceiptNumber || 'AUTO_VERIFY');
              
              const user = await User.findById(transaction.userId);
              if (user) {
                // Create subscription
                const subscription = await subscriptionService.createSubscription(
                  user.telegramId,
                  transaction.packageType,
                  transaction.transactionId,
                  transaction.amount
                );
                
                // Add to group
                const groupResult = await groupService.addUserToGroup(user.telegramId);
                
                // Send success notification
                try {
                  await this.bot.telegram.sendMessage(
                    user.telegramId,
                    `🎉 *PAYMENT VERIFIED!*\n\n` +
                    `✅ Your payment has been automatically verified!\n` +
                    `💰 Amount: KES ${transaction.amount}\n` +
                    `📦 Package: ${transaction.packageType}\n` +
                    `📅 Valid until: ${subscription.endDate.toLocaleString()}\n\n` +
                    `${groupResult.success ? '🔗 Group invitation sent!' : '⚠️ Group access will be provided manually.'}`,
                    { parse_mode: 'Markdown' }
                  );
                } catch (notifyError) {
                  logger.error('Failed to send auto-verification notification', notifyError instanceof Error ? notifyError : new Error(String(notifyError)));
                }
                
                logger.info('Auto-verified pending transaction', {
                  transactionId: transaction.transactionId,
                  userId: user.telegramId
                });
              }
            } else if (verificationResult.status === 'failed') {
              // Payment failed
              await transaction.fail();
              logger.info('Auto-marked transaction as failed', {
                transactionId: transaction.transactionId
              });
            }
            // If still pending, leave it for next check
          } catch (verifyError) {
            logger.error('Error auto-verifying transaction', verifyError instanceof Error ? verifyError : new Error(String(verifyError)), {
              transactionId: transaction.transactionId
            });
          }
        }
      } catch (error) {
        logger.error('Error in pending transaction verification job:', error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Clean up old pending transactions every hour
    cron.schedule('0 */2 * * *', async () => {
      try {
        logger.info('Running transaction cleanup job');
        const { Transaction } = await import('../models/Transaction');
        
        // Find transactions older than 1 hour that are still pending
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const oldPendingTransactions = await Transaction.find({
          status: 'pending',
          createdAt: { $lt: oneHourAgo }
        });
        
        for (const transaction of oldPendingTransactions) {
          await transaction.fail();
          logger.info('Marked old pending transaction as failed', {
            transactionId: transaction.transactionId,
            age: Date.now() - transaction.createdAt.getTime()
          });
        }
      } catch (error) {
        logger.error('Error in transaction cleanup job:', error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Process expired subscriptions every 10 minutes (more frequent)
    cron.schedule('*/10 * * * *', async () => {
      try {
        logger.info('Running subscription expiration job');
        const expiredSubs = await Subscription.findExpiredSubscriptions();
        
        logger.info(`Found ${expiredSubs.length} expired subscriptions to process`);
        
        for (const sub of expiredSubs) {
          const user = await User.findById(sub.userId);
          if (user) {
            try {
              logger.info('Processing expired subscription', {
                userId: user.telegramId,
                subscriptionId: sub._id,
                packageType: sub.packageType,
                endDate: sub.endDate
              });

              // Mark subscription as expired first
              await sub.expire();
              
              // Check if user is actually in the group before trying to remove
              const groupCheckResult = await this.groupService.checkUserInGroup(user.telegramId);
              
              if (groupCheckResult.inGroup) {
                // Remove user from group
                const removeResult = await this.groupService.removeUserFromGroup(user.telegramId);
                
                if (removeResult.success) {
                  logger.info('Successfully removed expired user from group', {
                    userId: user.telegramId,
                    subscriptionId: sub._id
                  });
                } else {
                  logger.error('Failed to remove expired user from group', new Error(removeResult.error || 'Unknown error'), {
                    userId: user.telegramId,
                    subscriptionId: sub._id,
                    error: removeResult.error
                  });
                }
              } else {
                logger.info('User not in group, skipping removal', {
                  userId: user.telegramId,
                  subscriptionId: sub._id
                });
              }
              
              // Notify user about expiration
              try {
                await this.bot.telegram.sendMessage(
                  user.telegramId,
                  `⏰ *SUBSCRIPTION EXPIRED*\n\n` +
                  `Your ${sub.packageType} subscription has expired and you have been removed from the premium group.\n\n` +
                  `📅 Expired on: ${sub.endDate.toLocaleString()}\n\n` +
                  `🔄 Use /renew to purchase a new subscription and regain access.\n` +
                  `💡 Use /start to see all available options.`,
                  { parse_mode: 'Markdown' }
                );
                
                logger.info('Sent expiration notification to user', {
                  userId: user.telegramId,
                  subscriptionId: sub._id
                });
              } catch (notificationError) {
                logger.warn('Failed to send expiration notification', {
                  userId: user.telegramId,
                  error: notificationError instanceof Error ? notificationError.message : String(notificationError)
                });
              }
              
              logger.info('Successfully processed expired subscription', { 
                userId: user.telegramId, 
                subscriptionId: sub._id,
                packageType: sub.packageType
              });
              
            } catch (error) {
              logger.error('Failed to process expired subscription', error instanceof Error ? error : new Error(String(error)), {
                userId: user.telegramId,
                subscriptionId: sub._id,
                packageType: sub.packageType
              });
            }
          } else {
            logger.warn('User not found for expired subscription', {
              subscriptionId: sub._id,
              userId: sub.userId
            });
          }
        }
        
        if (expiredSubs.length > 0) {
          logger.info(`Completed processing ${expiredSubs.length} expired subscriptions`);
        }
      } catch (error) {
        logger.error('Error in subscription expiration job:', error instanceof Error ? error : new Error(String(error)));
      }
    });

    logger.info('Scheduler service started successfully');
  }
} 