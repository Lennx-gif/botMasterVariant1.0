import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

// Telegram API response types
interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
}

interface ChatMemberResponse extends TelegramApiResponse {
  result: {
    status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
    user: {
      id: number;
      is_bot: boolean;
      first_name: string;
    };
  };
}

interface InviteLinkResponse extends TelegramApiResponse {
  result: {
    invite_link: string;
    creator: any;
    creates_join_request: boolean;
    is_primary: boolean;
    is_revoked: boolean;
  };
}

// Real Telegram API client using Telegram Bot API
class TelegramApiClient {
  private botToken: string;
  
  constructor(botToken: string) {
    this.botToken = botToken;
  }

  async addUserToGroup(userId: number, groupId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupId,
          user_id: userId
        })
      });
      
      const data = await response.json() as ChatMemberResponse;
      
      // If user is already in group, return true
      if (data.ok && ['member', 'administrator', 'creator'].includes(data.result.status)) {
        return true;
      }
      
      // Try to create invite link and send to user
      const inviteResponse = await fetch(`https://api.telegram.org/bot${this.botToken}/createChatInviteLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupId,
          member_limit: 1,
          expire_date: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
        })
      });
      
      const inviteData = await inviteResponse.json() as InviteLinkResponse;
      if (inviteData.ok) {
        // Send invite link to user with clear instructions
        await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userId,
            text: `🔗 *EXCLUSIVE GROUP ACCESS*\n\n` +
                  `🎉 Your authentication is complete!\n` +
                  `Click the link below to join our premium group:\n\n` +
                  `${inviteData.result.invite_link}\n\n` +
                  `⏰ This invitation expires in 1 hour\n` +
                  `🔒 This link is exclusively for you\n\n` +
                  `Welcome to the community! 🎊`,
            parse_mode: 'Markdown'
          })
        });
        
        logger.info('Group invitation sent successfully', {
          userId,
          groupId,
          inviteLink: inviteData.result.invite_link
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error adding user to group:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async removeUserFromGroup(userId: number, groupId: string): Promise<boolean> {
    try {
      logger.info('Attempting to ban user from group', {
        userId,
        groupId,
        action: 'banChatMember'
      });

      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/banChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupId,
          user_id: userId,
          until_date: Math.floor(Date.now() / 1000) + 60 // Unban after 1 minute (effectively just removes)
        })
      });
      
      const data = await response.json() as TelegramApiResponse;
      
      logger.info('Ban user API response', {
        userId,
        groupId,
        success: data.ok,
        description: data.description
      });
      
      if (data.ok) {
        // Unban the user after a short delay so they can rejoin later if they renew
        setTimeout(async () => {
          try {
            logger.info('Attempting to unban user to allow future rejoining', {
              userId,
              groupId,
              action: 'unbanChatMember'
            });

            const unbanResponse = await fetch(`https://api.telegram.org/bot${this.botToken}/unbanChatMember`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: groupId,
                user_id: userId,
                only_if_banned: true
              })
            });
            
            const unbanData = await unbanResponse.json() as TelegramApiResponse;
            
            logger.info('Unban user API response', {
              userId,
              groupId,
              success: unbanData.ok,
              description: unbanData.description
            });
          } catch (unbanError) {
            logger.error('Error unbanning user:', unbanError instanceof Error ? unbanError : new Error(String(unbanError)), {
              userId,
              groupId
            });
          }
        }, 10000); // Wait 10 seconds before unbanning
        
        return true;
      } else {
        logger.error('Failed to ban user from group', new Error(data.description || 'Unknown API error'), {
          userId,
          groupId,
          apiResponse: data
        });
        return false;
      }
      
    } catch (error) {
      logger.error('Error removing user from group:', error instanceof Error ? error : new Error(String(error)), {
        userId,
        groupId
      });
      return false;
    }
  }

  async checkUserInGroup(userId: number, groupId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupId,
          user_id: userId
        })
      });
      
      const data = await response.json() as ChatMemberResponse;
      return data.ok && ['member', 'administrator', 'creator'].includes(data.result.status);
    } catch (error) {
      logger.error('Error checking user in group:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}

export class GroupManagementService {
  private telegramClient: TelegramApiClient;
  private groupId: string;

  constructor() {
    const config = getConfig();
    this.telegramClient = new TelegramApiClient(config.BOT_TOKEN);
    this.groupId = config.GROUP_ID;
  }

  async addUserToGroup(userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Attempting to add user to group', {
        userId,
        groupId: this.groupId
      });
      
      const result = await this.telegramClient.addUserToGroup(userId, this.groupId);
      
      if (!result) {
        logger.warn('Failed to add user to group', {
          userId,
          groupId: this.groupId
        });
        return { success: false, error: 'Failed to add user to group' };
      }
      
      logger.info('Successfully processed group access for user', {
        userId,
        groupId: this.groupId
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Error in addUserToGroup:', error instanceof Error ? error : new Error(String(error)), {
        userId,
        groupId: this.groupId
      });
      return { success: false, error: (error as Error).message };
    }
  }

  async removeUserFromGroup(userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Attempting to remove user from group', {
        userId,
        groupId: this.groupId
      });
      
      // First check if user is actually in the group
      const isInGroup = await this.telegramClient.checkUserInGroup(userId, this.groupId);
      
      if (!isInGroup) {
        logger.info('User not in group, no removal needed', {
          userId,
          groupId: this.groupId
        });
        return { success: true }; // Consider this a success since the end result is achieved
      }
      
      const result = await this.telegramClient.removeUserFromGroup(userId, this.groupId);
      
      if (!result) {
        logger.warn('Failed to remove user from group', {
          userId,
          groupId: this.groupId
        });
        return { success: false, error: 'Failed to remove user from group - API call failed' };
      }
      
      logger.info('Successfully removed user from group', {
        userId,
        groupId: this.groupId
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Error in removeUserFromGroup:', error instanceof Error ? error : new Error(String(error)), {
        userId,
        groupId: this.groupId
      });
      return { success: false, error: (error as Error).message };
    }
  }

  async checkUserInGroup(userId: number): Promise<{ inGroup: boolean; error?: string }> {
    try {
      const inGroup = await this.telegramClient.checkUserInGroup(userId, this.groupId);
      return { inGroup };
    } catch (error) {
      return { inGroup: false, error: (error as Error).message };
    }
  }

  async validateGroupAccess(userId: number, shouldHaveAccess: boolean): Promise<{ valid: boolean; error?: string }> {
    try {
      const { inGroup } = await this.checkUserInGroup(userId);
      if (shouldHaveAccess && !inGroup) return { valid: false, error: 'User should have access but is not in group' };
      if (!shouldHaveAccess && inGroup) return { valid: false, error: 'User should not have access but is in group' };
      return { valid: true };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }

  async checkBotPermissions(): Promise<{ canRemoveUsers: boolean; error?: string }> {
    try {
      logger.info('Checking bot permissions in group', {
        groupId: this.groupId
      });

      const config = getConfig();
      const botToken = config.BOT_TOKEN;
      const botId = botToken.split(':')[0];
      
      if (!botId) {
        return { 
          canRemoveUsers: false, 
          error: 'Invalid bot token format' 
        };
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.groupId,
          user_id: parseInt(botId)
        })
      });
      
      const data = await response.json() as ChatMemberResponse;
      
      if (data.ok) {
        const isAdmin = ['creator', 'administrator'].includes(data.result.status);
        logger.info('Bot permissions check result', {
          groupId: this.groupId,
          botStatus: data.result.status,
          canRemoveUsers: isAdmin
        });
        
        if (isAdmin) {
          return { canRemoveUsers: true };
        } else {
          return { 
            canRemoveUsers: false,
            error: `Bot status is '${data.result.status}', needs to be administrator to remove users`
          };
        }
      } else {
        return { 
          canRemoveUsers: false, 
          error: `Failed to check bot permissions: ${data.description || 'Unknown error'}` 
        };
      }
    } catch (error) {
      logger.error('Error checking bot permissions:', error instanceof Error ? error : new Error(String(error)));
      return { 
        canRemoveUsers: false, 
        error: `Error checking permissions: ${(error as Error).message}` 
      };
    }
  }
} 