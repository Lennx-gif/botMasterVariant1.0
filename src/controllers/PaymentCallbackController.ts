import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { Transaction } from '../models/Transaction';
import { SubscriptionService } from '../services/SubscriptionService';
import { GroupManagementService } from '../services/GroupManagementService';
import { User } from '../models/User';

export interface MpesaCallbackData {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

export interface CallbackProcessingResult {
  success: boolean;
  message: string;
  transactionId?: string;
  error?: string;
}

export class PaymentCallbackController {
  private subscriptionService: SubscriptionService;
  private groupManagementService: GroupManagementService;

  constructor() {
    this.subscriptionService = new SubscriptionService();
    this.groupManagementService = new GroupManagementService();
  }

  /**
   * Handle Mpesa payment callback webhook
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Received Mpesa callback', { body: req.body });

      // Validate callback data structure
      const validationResult = this.validateCallbackData(req.body);
      if (!validationResult.isValid) {
        logger.error('Invalid callback data structure:', new Error(validationResult.error));
        res.status(400).json({
          success: false,
          message: 'Invalid callback data structure'
        });
        return;
      }

      const callbackData: MpesaCallbackData = req.body;
      const result = await this.processCallback(callbackData);

      if (result.success) {
        logger.info('Callback processed successfully', {
          transactionId: result.transactionId,
          message: result.message
        });
        res.status(200).json({
          success: true,
          message: result.message
        });
      } else {
        logger.error('Callback processing failed:', new Error(result.error || result.message));
        res.status(200).json({
          success: false,
          message: result.message,
          ...(result.error ? { error: result.error } : {})
        });
      }

    } catch (error) {
      logger.error('Unexpected error in callback handler:', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Process Mpesa callback data and update transaction status
   */
  async processCallback(callbackData: MpesaCallbackData): Promise<CallbackProcessingResult> {
    try {
      const { stkCallback } = callbackData.Body;
      const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

      // Find transaction by checkout request ID (used as transaction ID)
      const transaction = await Transaction.findByTransactionId(CheckoutRequestID);
      
      if (!transaction) {
        logger.warn('Transaction not found for callback', {
          merchantRequestId: MerchantRequestID,
          checkoutRequestId: CheckoutRequestID
        });
        return {
          success: false,
          message: 'Transaction not found',
          error: 'TRANSACTION_NOT_FOUND'
        };
      }

      // Check if transaction is already processed
      if (!transaction.isPending()) {
        logger.info('Transaction already processed', {
          transactionId: transaction.transactionId,
          status: transaction.status
        });
        return {
          success: true,
          message: 'Transaction already processed',
          transactionId: transaction.transactionId
        };
      }

      // Process based on result code
      if (ResultCode === 0) {
        // Payment successful
        const mpesaReceiptNumber = this.extractMpesaReceiptNumber(stkCallback.CallbackMetadata);
        
        if (!mpesaReceiptNumber) {
          logger.error('Mpesa receipt number not found in successful callback', new Error('Receipt number missing'), {
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

        // Complete the transaction
        await transaction.complete(mpesaReceiptNumber);
        
        // Create subscription and add user to group
        try {
          // Get user information
          const user = await User.findById(transaction.userId);
          if (!user) {
            logger.error('User not found for completed transaction', new Error('User not found'), {
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

          // Create subscription
          const subscription = await this.subscriptionService.createSubscription(
            user.telegramId,
            transaction.packageType,
            transaction.transactionId,
            transaction.amount
          );

          // Add user to group
          const groupResult = await this.groupManagementService.addUserToGroup(user.telegramId);
          if (!groupResult.success) {
            logger.warn('Failed to add user to group after successful payment', {
              transactionId: transaction.transactionId,
              userId: transaction.userId,
              telegramId: user.telegramId,
              error: groupResult.error
            });
            // Don't fail the entire process if group addition fails
          }

          // Send authentication confirmation and success notification to user
          try {
            const { Telegraf } = await import('telegraf');
            const { getConfig } = await import('../utils/config');
            const config = getConfig();
            const bot = new Telegraf(config.BOT_TOKEN);
            
            // First, send authentication confirmation
            const authConfirmationMessage = 
              `🔐 *AUTHENTICATION CONFIRMED*\n\n` +
              `✅ User: ${user.username || user.telegramId}\n` +
              `📱 Phone: ${transaction.phoneNumber}\n` +
              `🧾 Receipt: ${mpesaReceiptNumber}\n` +
              `💰 Amount: KES ${transaction.amount}\n` +
              `📦 Package: ${transaction.packageType}\n` +
              `⏰ Authenticated: ${new Date().toLocaleString()}\n\n` +
              `🎯 *ACCESS GRANTED*\n` +
              `Your payment has been verified and your subscription is now active!`;

            await bot.telegram.sendMessage(user.telegramId, authConfirmationMessage, { parse_mode: 'Markdown' });
            
            // Wait a moment before sending group access info
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Then send group access information
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
            
            logger.info('Authentication confirmation and group access messages sent', {
              transactionId: transaction.transactionId,
              userId: transaction.userId,
              groupAdded: groupResult.success
            });
            
          } catch (notificationError) {
            logger.error('Failed to send authentication confirmation to user', notificationError instanceof Error ? notificationError : new Error(String(notificationError)), {
              transactionId: transaction.transactionId,
              userId: transaction.userId
            });
          }

          logger.info('Transaction completed and subscription created successfully', {
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

        } catch (subscriptionError) {
          logger.error('Failed to create subscription after successful payment', subscriptionError instanceof Error ? subscriptionError : new Error(String(subscriptionError)), {
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

      } else {
        // Payment failed
        await transaction.fail();
        
        logger.info('Transaction failed', {
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

    } catch (error) {
      logger.error('Error processing callback:', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        message: 'Failed to process callback',
        error: 'CALLBACK_PROCESSING_ERROR'
      };
    }
  }

  /**
   * Validate the structure of callback data
   */
  private validateCallbackData(data: any): { isValid: boolean; error?: string } {
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

  /**
   * Extract Mpesa receipt number from callback metadata
   */
  private extractMpesaReceiptNumber(callbackMetadata?: { Item: Array<{ Name: string; Value: string | number }> }): string | null {
    if (!callbackMetadata || !callbackMetadata.Item || !Array.isArray(callbackMetadata.Item)) {
      return null;
    }

    const receiptItem = callbackMetadata.Item.find(item => 
      item.Name === 'MpesaReceiptNumber' && typeof item.Value === 'string'
    );

    return receiptItem ? String(receiptItem.Value) : null;
  }

  /**
   * Health check endpoint for the callback service
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Payment callback service is healthy',
      timestamp: new Date().toISOString()
    });
  }
}