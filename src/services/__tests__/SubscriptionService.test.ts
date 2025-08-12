import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SubscriptionService } from '../SubscriptionService';
import { User } from '../../models/User';
import { Subscription } from '../../models/Subscription';

describe('SubscriptionService', () => {
  let mongoServer: MongoMemoryServer;
  let service: SubscriptionService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    service = new SubscriptionService();
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    await User.deleteMany({});
    await Subscription.deleteMany({});
  });

  it('should create a new subscription for a user', async () => {
    const user = await User.create({ telegramId: 1, phoneNumber: '254712345678' });
    const sub = await service.createSubscription(1, 'daily', 'tx1', 100);
    expect(sub.userId.toString()).toBe((user._id as mongoose.Types.ObjectId).toString());
    expect(sub.packageType).toBe('daily');
    expect(sub.status).toBe('active');
    expect(sub.transactionId).toBe('tx1');
    expect(sub.amount).toBe(100);
  });

  it('should renew a subscription by extending from end date', async () => {
    const user = await User.create({ telegramId: 2, phoneNumber: '254712345679' });
    const sub1 = await service.createSubscription(2, 'daily', 'tx2', 100);
    const renewed = await service.renewSubscription(2, 'weekly', 'tx3', 200);
    expect(renewed.userId.toString()).toBe((user._id as mongoose.Types.ObjectId).toString());
    expect(renewed.packageType).toBe('weekly');
    expect(renewed.status).toBe('active');
    expect(renewed.transactionId).toBe('tx3');
    expect(renewed.amount).toBe(200);
    // The previous subscription should be expired
    const old = await Subscription.findById(sub1._id);
    expect(old?.status).toBe('expired');
  });

  it('should get the latest subscription for a user', async () => {
    const user = await User.create({ telegramId: 3, phoneNumber: '254712345680' });
    await service.createSubscription(3, 'daily', 'tx4', 100);
    const sub = await service.getSubscription(3);
    expect(sub).toBeTruthy();
    expect(sub?.userId.toString()).toBe((user._id as mongoose.Types.ObjectId).toString());
  });

  it('should check if a user subscription is expired', async () => {
    const user = await User.create({ telegramId: 4, phoneNumber: '254712345681' });
    // No subscription
    let expired = await service.checkExpiration(4);
    expect(expired).toBe(true);
    // Active subscription
    await service.createSubscription(4, 'daily', 'tx5', 100);
    expired = await service.checkExpiration(4);
    expect(expired).toBe(false);
  });

  it('should expire a user subscription', async () => {
    const user = await User.create({ telegramId: 5, phoneNumber: '254712345682' });
    await service.createSubscription(5, 'daily', 'tx6', 100);
    const expired = await service.expireSubscription(5);
    expect(expired).toBeTruthy();
    expect(expired?.status).toBe('expired');
  });

  it('should get subscriptions expiring soon', async () => {
    const user = await User.create({ telegramId: 6, phoneNumber: '254712345683' });
    // Create a subscription that expires in 1 hour
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    const created = await Subscription.create({
      userId: user._id,
      packageType: 'daily',
      startDate: now,
      endDate: end,
      status: 'active',
      transactionId: 'tx7',
      amount: 100
    });
    // Wait for the document to be written
    await new Promise(res => setTimeout(res, 100));
    const expiring = await service.getExpiringSubscriptions(24); // 24 hours
    expect(expiring.length).toBeGreaterThan(0);
    if (expiring[0]) {
      expect(expiring[0].userId.toString()).toBe((user._id as mongoose.Types.ObjectId).toString());
    }
  });
}); 