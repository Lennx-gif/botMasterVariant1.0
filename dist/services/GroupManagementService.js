"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupManagementService = void 0;
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const node_fetch_1 = __importDefault(require("node-fetch"));
class TelegramApiClient {
    constructor(botToken) {
        this.botToken = botToken;
    }
    async addUserToGroup(userId, groupId) {
        try {
            const response = await (0, node_fetch_1.default)(`https://api.telegram.org/bot${this.botToken}/getChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: groupId,
                    user_id: userId
                })
            });
            const data = await response.json();
            if (data.ok && ['member', 'administrator', 'creator'].includes(data.result.status)) {
                return true;
            }
            const inviteResponse = await (0, node_fetch_1.default)(`https://api.telegram.org/bot${this.botToken}/createChatInviteLink`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: groupId,
                    member_limit: 1,
                    expire_date: Math.floor(Date.now() / 1000) + 3600
                })
            });
            const inviteData = await inviteResponse.json();
            if (inviteData.ok) {
                await (0, node_fetch_1.default)(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
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
                logger_1.logger.info('Group invitation sent successfully', {
                    userId,
                    groupId,
                    inviteLink: inviteData.result.invite_link
                });
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Error adding user to group:', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
    async removeUserFromGroup(userId, groupId) {
        try {
            logger_1.logger.info('Attempting to ban user from group', {
                userId,
                groupId,
                action: 'banChatMember'
            });
            const response = await (0, node_fetch_1.default)(`https://api.telegram.org/bot${this.botToken}/banChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: groupId,
                    user_id: userId,
                    until_date: Math.floor(Date.now() / 1000) + 60
                })
            });
            const data = await response.json();
            logger_1.logger.info('Ban user API response', {
                userId,
                groupId,
                success: data.ok,
                description: data.description
            });
            if (data.ok) {
                setTimeout(async () => {
                    try {
                        logger_1.logger.info('Attempting to unban user to allow future rejoining', {
                            userId,
                            groupId,
                            action: 'unbanChatMember'
                        });
                        const unbanResponse = await (0, node_fetch_1.default)(`https://api.telegram.org/bot${this.botToken}/unbanChatMember`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: groupId,
                                user_id: userId,
                                only_if_banned: true
                            })
                        });
                        const unbanData = await unbanResponse.json();
                        logger_1.logger.info('Unban user API response', {
                            userId,
                            groupId,
                            success: unbanData.ok,
                            description: unbanData.description
                        });
                    }
                    catch (unbanError) {
                        logger_1.logger.error('Error unbanning user:', unbanError instanceof Error ? unbanError : new Error(String(unbanError)), {
                            userId,
                            groupId
                        });
                    }
                }, 10000);
                return true;
            }
            else {
                logger_1.logger.error('Failed to ban user from group', new Error(data.description || 'Unknown API error'), {
                    userId,
                    groupId,
                    apiResponse: data
                });
                return false;
            }
        }
        catch (error) {
            logger_1.logger.error('Error removing user from group:', error instanceof Error ? error : new Error(String(error)), {
                userId,
                groupId
            });
            return false;
        }
    }
    async checkUserInGroup(userId, groupId) {
        try {
            const response = await (0, node_fetch_1.default)(`https://api.telegram.org/bot${this.botToken}/getChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: groupId,
                    user_id: userId
                })
            });
            const data = await response.json();
            return data.ok && ['member', 'administrator', 'creator'].includes(data.result.status);
        }
        catch (error) {
            logger_1.logger.error('Error checking user in group:', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
}
class GroupManagementService {
    constructor() {
        const config = (0, config_1.getConfig)();
        this.telegramClient = new TelegramApiClient(config.BOT_TOKEN);
        this.groupId = config.GROUP_ID;
    }
    async addUserToGroup(userId) {
        try {
            logger_1.logger.info('Attempting to add user to group', {
                userId,
                groupId: this.groupId
            });
            const result = await this.telegramClient.addUserToGroup(userId, this.groupId);
            if (!result) {
                logger_1.logger.warn('Failed to add user to group', {
                    userId,
                    groupId: this.groupId
                });
                return { success: false, error: 'Failed to add user to group' };
            }
            logger_1.logger.info('Successfully processed group access for user', {
                userId,
                groupId: this.groupId
            });
            return { success: true };
        }
        catch (error) {
            logger_1.logger.error('Error in addUserToGroup:', error instanceof Error ? error : new Error(String(error)), {
                userId,
                groupId: this.groupId
            });
            return { success: false, error: error.message };
        }
    }
    async removeUserFromGroup(userId) {
        try {
            logger_1.logger.info('Attempting to remove user from group', {
                userId,
                groupId: this.groupId
            });
            const isInGroup = await this.telegramClient.checkUserInGroup(userId, this.groupId);
            if (!isInGroup) {
                logger_1.logger.info('User not in group, no removal needed', {
                    userId,
                    groupId: this.groupId
                });
                return { success: true };
            }
            const result = await this.telegramClient.removeUserFromGroup(userId, this.groupId);
            if (!result) {
                logger_1.logger.warn('Failed to remove user from group', {
                    userId,
                    groupId: this.groupId
                });
                return { success: false, error: 'Failed to remove user from group - API call failed' };
            }
            logger_1.logger.info('Successfully removed user from group', {
                userId,
                groupId: this.groupId
            });
            return { success: true };
        }
        catch (error) {
            logger_1.logger.error('Error in removeUserFromGroup:', error instanceof Error ? error : new Error(String(error)), {
                userId,
                groupId: this.groupId
            });
            return { success: false, error: error.message };
        }
    }
    async checkUserInGroup(userId) {
        try {
            const inGroup = await this.telegramClient.checkUserInGroup(userId, this.groupId);
            return { inGroup };
        }
        catch (error) {
            return { inGroup: false, error: error.message };
        }
    }
    async validateGroupAccess(userId, shouldHaveAccess) {
        try {
            const { inGroup } = await this.checkUserInGroup(userId);
            if (shouldHaveAccess && !inGroup)
                return { valid: false, error: 'User should have access but is not in group' };
            if (!shouldHaveAccess && inGroup)
                return { valid: false, error: 'User should not have access but is in group' };
            return { valid: true };
        }
        catch (error) {
            return { valid: false, error: error.message };
        }
    }
    async checkBotPermissions() {
        try {
            logger_1.logger.info('Checking bot permissions in group', {
                groupId: this.groupId
            });
            const config = (0, config_1.getConfig)();
            const botToken = config.BOT_TOKEN;
            const botId = botToken.split(':')[0];
            if (!botId) {
                return {
                    canRemoveUsers: false,
                    error: 'Invalid bot token format'
                };
            }
            const response = await (0, node_fetch_1.default)(`https://api.telegram.org/bot${botToken}/getChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.groupId,
                    user_id: parseInt(botId)
                })
            });
            const data = await response.json();
            if (data.ok) {
                const isAdmin = ['creator', 'administrator'].includes(data.result.status);
                logger_1.logger.info('Bot permissions check result', {
                    groupId: this.groupId,
                    botStatus: data.result.status,
                    canRemoveUsers: isAdmin
                });
                if (isAdmin) {
                    return { canRemoveUsers: true };
                }
                else {
                    return {
                        canRemoveUsers: false,
                        error: `Bot status is '${data.result.status}', needs to be administrator to remove users`
                    };
                }
            }
            else {
                return {
                    canRemoveUsers: false,
                    error: `Failed to check bot permissions: ${data.description || 'Unknown error'}`
                };
            }
        }
        catch (error) {
            logger_1.logger.error('Error checking bot permissions:', error instanceof Error ? error : new Error(String(error)));
            return {
                canRemoveUsers: false,
                error: `Error checking permissions: ${error.message}`
            };
        }
    }
}
exports.GroupManagementService = GroupManagementService;
//# sourceMappingURL=GroupManagementService.js.map