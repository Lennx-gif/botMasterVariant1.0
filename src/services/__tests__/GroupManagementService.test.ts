import { GroupManagementService } from '../GroupManagementService';

describe('GroupManagementService', () => {
  let service: GroupManagementService;
  let mockTelegramClient: any;

  beforeEach(() => {
    process.env.BOT_TOKEN = 'dummy';
    process.env.GROUP_ID = '-1001234567890';
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';
    process.env.SAFARICOM_CONSUMER_KEY = 'dummy';
    process.env.SAFARICOM_CONSUMER_SECRET = 'dummy';
    process.env.MPESA_BASE_URL = 'https://example.com';
    process.env.BUSINESS_SHORT_CODE = '123456';
    process.env.PASS_KEY = 'dummy';
    process.env.CALLBACK_URL = 'https://example.com/callback';
    process.env.PORT = '3000';
    process.env.DAILY_PRICE = '50';
    process.env.WEEKLY_PRICE = '300';
    process.env.MONTHLY_PRICE = '1000';
    service = new GroupManagementService();
    mockTelegramClient = (service as any).telegramClient;
  });

  it('should add user to group successfully', async () => {
    mockTelegramClient.addUserToGroup = jest.fn().mockResolvedValue(true);
    const result = await service.addUserToGroup(123);
    expect(result.success).toBe(true);
  });

  it('should handle failure to add user to group', async () => {
    mockTelegramClient.addUserToGroup = jest.fn().mockResolvedValue(false);
    const result = await service.addUserToGroup(123);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to add user to group');
  });

  it('should handle error when adding user to group', async () => {
    mockTelegramClient.addUserToGroup = jest.fn().mockRejectedValue(new Error('API error'));
    const result = await service.addUserToGroup(123);
    expect(result.success).toBe(false);
    expect(result.error).toBe('API error');
  });

  it('should remove user from group successfully', async () => {
    mockTelegramClient.removeUserFromGroup = jest.fn().mockResolvedValue(true);
    const result = await service.removeUserFromGroup(123);
    expect(result.success).toBe(true);
  });

  it('should handle failure to remove user from group', async () => {
    mockTelegramClient.removeUserFromGroup = jest.fn().mockResolvedValue(false);
    const result = await service.removeUserFromGroup(123);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to remove user from group');
  });

  it('should handle error when removing user from group', async () => {
    mockTelegramClient.removeUserFromGroup = jest.fn().mockRejectedValue(new Error('API error'));
    const result = await service.removeUserFromGroup(123);
    expect(result.success).toBe(false);
    expect(result.error).toBe('API error');
  });

  it('should check if user is in group', async () => {
    mockTelegramClient.checkUserInGroup = jest.fn().mockResolvedValue(true);
    const result = await service.checkUserInGroup(123);
    expect(result.inGroup).toBe(true);
  });

  it('should handle error when checking user in group', async () => {
    mockTelegramClient.checkUserInGroup = jest.fn().mockRejectedValue(new Error('API error'));
    const result = await service.checkUserInGroup(123);
    expect(result.inGroup).toBe(false);
    expect(result.error).toBe('API error');
  });

  it('should validate group access (should have access and is in group)', async () => {
    mockTelegramClient.checkUserInGroup = jest.fn().mockResolvedValue(true);
    const result = await service.validateGroupAccess(123, true);
    expect(result.valid).toBe(true);
  });

  it('should validate group access (should have access but not in group)', async () => {
    mockTelegramClient.checkUserInGroup = jest.fn().mockResolvedValue(false);
    const result = await service.validateGroupAccess(123, true);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('User should have access but is not in group');
  });

  it('should validate group access (should not have access and is not in group)', async () => {
    mockTelegramClient.checkUserInGroup = jest.fn().mockResolvedValue(false);
    const result = await service.validateGroupAccess(123, false);
    expect(result.valid).toBe(true);
  });

  it('should validate group access (should not have access but is in group)', async () => {
    mockTelegramClient.checkUserInGroup = jest.fn().mockResolvedValue(true);
    const result = await service.validateGroupAccess(123, false);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('User should not have access but is in group');
  });

  it('should handle error in validateGroupAccess', async () => {
    mockTelegramClient.checkUserInGroup = jest.fn().mockRejectedValue(new Error('API error'));
    const result = await service.validateGroupAccess(123, true);
    // eslint-disable-next-line no-console
    console.log('validateGroupAccess error:', result.error);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('User should have access but is not in group');
  });
}); 