import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Subscription, ISubscription } from '../Subscription';
import { User } from '../User';

describe('Subscription Model', () => {
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
      expect(savedSubscription.createdAt).toBeDefined();
      expect(savedSubscription.updatedAt).toBeDefined();
    });

    it('should fail to create subscription without userId', async () => {
      const subscriptionData = {
        packageType: 'daily' as const,
        transactionId: 'TXN123456',
        amount: 100
      };

      const subscription = new Subscription(subscriptionData);
      
      await expect(subscription.save()).rejects.toThrow('User ID is required');
    });

    it('should fail to create subscription without packageType', async () => {
      const subscriptionData = {
        userId: testUserId,
        transactionId: 'TXN123456',
        amount: 100
      };

      const subscription = new Subscription(subscriptionData);
      
      await expect(subscription.save()).rejects.toThrow('Package type is required');
    });

    it('should fail to create subscription without transactionId', async () => {
      const subscriptionData = {
        userId: testUserId,
        packageType: 'daily' as const,
        amount: 100
      };

      const subscription = new Subscription(subscriptionData);
      
      await expect(subscription.save()).rejects.toThrow('Transaction ID is required');
    });

    it('should fail to create subscription without amount', async () => {
      const subscriptionData = {
        userId: testUserId,
        packageType: 'daily' as const,
        transactionId: 'TXN123456'
      };

      const subscription = new Subscription(subscriptionData);
      
      await expect(subscription.save()).rejects.toThrow('Amount is required');
    });
  });

  describe('Package Type Validation', () => {
    it('should accept valid package types', async () => {
      const packageTypes = ['daily', 'weekly', 'monthly'] as const;

      for (let i = 0; i < packageTypes.length; i++) {
        const subscriptionData = {
          userId: testUserId,
          packageType: packageTypes[i],
          transactionId: `TXN12345${i}`,
          amount: 100
        };

        const subscription = new Subscription(subscriptionData);
        const savedSubscription = await subscription.save();
        expect(savedSubscription.packageType).toBe(packageTypes[i]);
      }
    });

    it('should reject invalid package types', async () => {
      const subscriptionData = {
        userId: testUserId,
        packageType: 'invalid' as any,
        transactionId: 'TXN123456',
        amount: 100
      };

      const subscription = new Subscription(subscriptionData);
      
      await expect(subscription.save()).rejects.toThrow('Package type must be daily, weekly, or monthly');
    });
  });

  describe('Amount Validation', () => {
    it('should reject negative amounts', async () => {
      const subscriptionData = {
        userId: testUserId,
        packageType: 'daily' as const,
        transactionId: 'TXN123456',
        amount: -100
      };

      const subscription = new Subscription(subscriptionData);
      
      await expect(subscription.save()).rejects.toThrow('Amount must be greater than 0');
    });

    it('should reject zero amount', async () => {
      const subscriptionData = {
        userId: testUserId,
        packageType: 'daily' as const,
        transactionId: 'TXN123456',
        amount: 0
      };

      const subscription = new Subscription(subscriptionData);
      
      await expect(subscription.save()).rejects.toThrow('Amount must be greater than 0');
    });
  });

  describe('End Date Calculation', () => {
    it('should calculate correct end date for daily subscription', async () => {
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

    it('should calculate correct end date for weekly subscription', async () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const subscriptionData = {
        userId: testUserId,
        packageType: 'weekly' as const,
        startDate,
        transactionId: 'TXN123456',
        amount: 500
      };

      const subscription = new Subscription(subscriptionData);
      const savedSubscription = await subscription.save();

      const expectedEndDate = new Date('2025-01-08T00:00:00Z');
      expect(savedSubscription.endDate.getTime()).toBe(expectedEndDate.getTime());
    });

    it('should calculate correct end date for monthly subscription', async () => {
      const startDate = new Date('2025-01-01T00:00:00Z');
      const subscriptionData = {
        userId: testUserId,
        packageType: 'monthly' as const,
        startDate,
        transactionId: 'TXN123456',
        amount: 1500
      };

      const subscription = new Subscription(subscriptionData);
      const savedSubscription = await subscription.save();

      const expectedEndDate = new Date('2025-02-01T00:00:00Z');
      expect(savedSubscription.endDate.getTime()).toBe(expectedEndDate.getTime());
    });
  });

  describe('Instance Methods', () => {
    let activeSubscription: ISubscription;
    let expiredSubscription: ISubscription;

    beforeEach(async () => {
      // Create active subscription
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      activeSubscription = new Subscription({
        userId: testUserId,
        packageType: 'daily',
        transactionId: 'TXN_ACTIVE',
        amount: 100,
        endDate: futureDate
      });
      await activeSubscription.save();

      // Create expired subscription
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      expiredSubscription = new Subscription({
        userId: testUserId,
        packageType: 'daily',
        transactionId: 'TXN_EXPIRED',
        amount: 100,
        endDate: pastDate
      });
      await expiredSubscription.save();
    });

    it('should correctly identify expired subscriptions', () => {
      expect(activeSubscription.isExpired()).toBe(false);
      expect(expiredSubscription.isExpired()).toBe(true);
    });

    it('should correctly identify expiring subscriptions', () => {
      expect(activeSubscription.isExpiringSoon(48)).toBe(true);
      expect(activeSubscription.isExpiringSoon(1)).toBe(true);
      expect(expiredSubscription.isExpiringSoon()).toBe(false);
    });

    it('should expire subscription', async () => {
      expect(activeSubscription.status).toBe('active');
      
      const expiredSub = await activeSubscription.expire();
      
      expect(expiredSub.status).toBe('expired');
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test subscriptions
      const subscriptions = [
        {
          userId: testUserId,
          packageType: 'daily' as const,
          transactionId: 'TXN001',
          amount: 100,
          status: 'active' as const,
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
        },
        {
          userId: testUserId,
          packageType: 'weekly' as const,
          transactionId: 'TXN002',
          amount: 500,
          status: 'expired' as const,
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        },
        {
          userId: testUserId,
          packageType: 'monthly' as const,
          transactionId: 'TXN003',
          amount: 1500,
          status: 'active' as const,
          endDate: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
        }
      ];

      for (const subData of subscriptions) {
        const subscription = new Subscription(subData);
        await subscription.save();
      }
    });

    it('should find subscriptions by user ID', async () => {
      const subscriptions = await Subscription.findByUserId(testUserId);
      expect(subscriptions).toHaveLength(3);
      expect(subscriptions.length).toBeGreaterThan(0);
      if (subscriptions.length > 0) {
        expect(subscriptions[0]!.userId).toEqual(testUserId);
      }
    });

    it('should find active subscription by user ID', async () => {
      const activeSubscription = await Subscription.findActiveByUserId(testUserId);
      expect(activeSubscription).toBeTruthy();
      expect(activeSubscription!.status).toBe('active');
      expect(activeSubscription!.endDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should find expiring subscriptions', async () => {
      const expiringSubscriptions = await Subscription.findExpiringSubscriptions(24);
      expect(expiringSubscriptions.length).toBeGreaterThan(0);
      
      for (const sub of expiringSubscriptions) {
        expect(sub.status).toBe('active');
        expect(sub.endDate.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
        expect(sub.endDate.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should find expired subscriptions', async () => {
      // First, create an actually expired subscription
      const expiredSub = new Subscription({
        userId: testUserId,
        packageType: 'daily',
        transactionId: 'TXN_EXPIRED_TEST',
        amount: 100,
        status: 'active',
        endDate: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      });
      await expiredSub.save();

      const expiredSubscriptions = await Subscription.findExpiredSubscriptions();
      expect(expiredSubscriptions.length).toBeGreaterThan(0);
      
      for (const sub of expiredSubscriptions) {
        expect(sub.status).toBe('active');
        expect(sub.endDate.getTime()).toBeLessThanOrEqual(Date.now());
      }
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique transaction ID', async () => {
      const subscriptionData1 = {
        userId: testUserId,
        packageType: 'daily' as const,
        transactionId: 'TXN_DUPLICATE',
        amount: 100
      };

      const subscriptionData2 = {
        userId: testUserId,
        packageType: 'weekly' as const,
        transactionId: 'TXN_DUPLICATE',
        amount: 500
      };

      const subscription1 = new Subscription(subscriptionData1);
      await subscription1.save();

      const subscription2 = new Subscription(subscriptionData2);
      await expect(subscription2.save()).rejects.toThrow();
    });
  });
});