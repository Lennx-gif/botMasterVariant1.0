export declare class GroupManagementService {
    private telegramClient;
    private groupId;
    constructor();
    addUserToGroup(userId: number): Promise<{
        success: boolean;
        error?: string;
    }>;
    removeUserFromGroup(userId: number): Promise<{
        success: boolean;
        error?: string;
    }>;
    checkUserInGroup(userId: number): Promise<{
        inGroup: boolean;
        error?: string;
    }>;
    validateGroupAccess(userId: number, shouldHaveAccess: boolean): Promise<{
        valid: boolean;
        error?: string;
    }>;
    checkBotPermissions(): Promise<{
        canRemoveUsers: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=GroupManagementService.d.ts.map