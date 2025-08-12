import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Subscription } from '../Subscription';
import { User } from '../User';

describe('Subscription Model Basic Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    // Create a test user
    const testUser = new User({
      telegramId: 123456789,
      phoneNumber: '254712345678'
    });
    const savedUser = await testUser.save();
    testUserId = savedUser._id as mongoose.Types.ObjectId;
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    await Subscription.deleteMany({});
  });

  describe('Subscription Creation', () => {
    it('should create a valid subscription with required fields', async () => {
      const subscriptionData = {
        userId: testUserId,
        packageType: 'daily' as const,
        transactionId: 'TXN123456',
        amount: 100
      };

      const subscription = new Subscription(subscriptionData);
      const savedSubscription = await subscription.save();

      expect(savedSubscription.userId).toEqual(testUserId);
      expect(savedSubscription.packageType).toBe('daily');
      expect(savedSubscription.transactionId).toBe('TXN123456');
      expect(savedSubscription.amount).toBe(100);
      expect(savedSubscription.status).toBe('active');
      expect(savedSubscription.startDate).toBeDefined();
      expect(savedSubscription.endDate).toBeDefined();
    });

    it('should calculate end date correctly for daily subscription', async () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const subscriptionData = {
        userId: testUserId,
        packageType: 'daily' as const,
        startDate,
        transactionId: 'TXN123456',
        amount: 100
      };

      const subscription = new Subscription(subscriptionData);
      const savedSubscription = await subscription.save();

      const expectedEndDate = new Date('2025-01-02T00:00:00Z');
      expect(savedSubscription.endDate.getTime()).toBe(expectedEndDate.getTime());
    });

    it('should identify expired subscriptions correctly', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const subscription = new Subscription({
        userId: testUserId,
        packageType: 'daily',
        transactionId: 'TXN_EXPIRED',
        amount: 100,
        endDate: pastDate
      });
      const savedSubscription = await subscription.save();

      expect(savedSubscription.isExpired()).toBe(true);
    });
  });
});