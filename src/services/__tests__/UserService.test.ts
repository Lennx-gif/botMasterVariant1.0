import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserService } from '../UserService';
import { User } from '../../models/User';
import { Subscription } from '../../models/Subscription';

describe('UserService', () => {
  let mongoServer: MongoMemoryServer;
  let userService: UserService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    userService = new UserService();
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    await User.deleteMany({});
    await Subscription.deleteMany({});
  });

  it('should create a new user', async () => {
    const user = await userService.createUser(123, 'testuser', '254712345678');
    expect(user.telegramId).toBe(123);
    expect(user.username).toBe('testuser');
    expect(user.phoneNumber).toBe('254712345678');
  });

  it('should not create duplicate users', async () => {
    await userService.createUser(123, 'testuser', '254712345678');
    const user2 = await userService.createUser(123, 'testuser', '254712345678');
    const users = await User.find({ telegramId: 123 });
    expect(users.length).toBe(1);
    expect(user2.telegramId).toBe(123);
  });

  it('should get a user by telegramId', async () => {
    await userService.createUser(123, 'testuser', '254712345678');
    const user = await userService.getUser(123);
    expect(user).toBeTruthy();
    expect(user?.telegramId).toBe(123);
  });

  it('should update a user', async () => {
    await userService.createUser(123, 'testuser', '254712345678');
    const updated = await userService.updateUser(123, { username: 'updated', phoneNumber: '254799999999' });
    expect(updated).toBeTruthy();
    expect(updated?.username).toBe('updated');
    expect(updated?.phoneNumber).toBe('254799999999');
  });

  describe('getUserSubscriptionStatus', () => {
    it('should return none if user does not exist', async () => {
      const status = await userService.getUserSubscriptionStatus(999);
      expect(status.status).toBe('none');
    });

    it('should return none if user has no subscriptions', async () => {
      await userService.createUser(123, 'testuser', '254712345678');
      const status = await userService.getUserSubscriptionStatus(123);
      expect(status.status).toBe('none');
    });

    it('should return active if user has an active subscription', async () => {
      const user = await userService.createUser(123, 'testuser', '254712345678');
      const now = new Date();
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await Subscription.create({
        userId: user._id,
        packageType: 'daily',
        startDate: now,
        endDate: end,
        status: 'active',
        transactionId: 'tx1',
        amount: 100
      });
      const status = await userService.getUserSubscriptionStatus(123);
      expect(status.status).toBe('active');
      expect(status.packageType).toBe('daily');
      expect(status.endDate).toBeInstanceOf(Date);
    });

    it('should return expired if user has only expired subscriptions', async () => {
      const user = await userService.createUser(123, 'testuser', '254712345678');
      const now = new Date();
      const end = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      await Subscription.create({
        userId: user._id,
        packageType: 'weekly',
        startDate: now,
        endDate: end,
        status: 'expired',
        transactionId: 'tx2',
        amount: 200
      });
      const status = await userService.getUserSubscriptionStatus(123);
      expect(status.status).toBe('expired');
      expect(status.packageType).toBe('weekly');
      expect(status.endDate).toBeInstanceOf(Date);
    });
  });
}); 