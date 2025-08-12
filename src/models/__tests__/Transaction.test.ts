import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Transaction, ITransaction } from '../Transaction';
import { User } from '../User';

describe('Transaction Model', () => {
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
    await Transaction.deleteMany({});
  });

  describe('Transaction Creation', () => {
    it('should create a valid transaction with required fields', async () => {
      const transactionData = {
        userId: testUserId,
        transactionId: 'TXN123456',
        phoneNumber: '254712345678',
        amount: 100,
        packageType: 'daily' as const
      };

      const transaction = new Transaction(transactionData);
      const savedTransaction = await transaction.save();

      expect(savedTransaction.userId).toEqual(testUserId);
      expect(savedTransaction.transactionId).toBe('TXN123456');
      expect(savedTransaction.phoneNumber).toBe('254712345678');
      expect(savedTransaction.amount).toBe(100);
      expect(savedTransaction.packageType).toBe('daily');
      expect(savedTransaction.status).toBe('pending');
      expect(savedTransaction.createdAt).toBeDefined();
      expect(savedTransaction.updatedAt).toBeDefined();
      expect(savedTransaction.completedAt).toBeUndefined();
    });

    it('should fail to create transaction without userId', async () => {
      const transactionData = {
        transactionId: 'TXN123456',
        phoneNumber: '254712345678',
        amount: 100,
        packageType: 'daily' as const
      };

      const transaction = new Transaction(transactionData);
      
      await expect(transaction.save()).rejects.toThrow('User ID is required');
    });

    it('should fail to create transaction without transactionId', async () => {
      const transactionData = {
        userId: testUserId,
        phoneNumber: '254712345678',
        amount: 100,
        packageType: 'daily' as const
      };

      const transaction = new Transaction(transactionData);
      
      await expect(transaction.save()).rejects.toThrow('Transaction ID is required');
    });

    it('should fail to create transaction without phoneNumber', async () => {
      const transactionData = {
        userId: testUserId,
        transactionId: 'TXN123456',
        amount: 100,
        packageType: 'daily' as const
      };

      const transaction = new Transaction(transactionData);
      
      await expect(transaction.save()).rejects.toThrow('Phone number is required');
    });

    it('should fail to create transaction without amount', async () => {
      const transactionData = {
        userId: testUserId,
        transactionId: 'TXN123456',
        phoneNumber: '254712345678',
        packageType: 'daily' as const
      };

      const transaction = new Transaction(transactionData);
      
      await expect(transaction.save()).rejects.toThrow('Amount is required');
    });

    it('should fail to create transaction without packageType', async () => {
      const transactionData = {
        userId: testUserId,
        transactionId: 'TXN123456',
        phoneNumber: '254712345678',
        amount: 100
      };

      const transaction = new Transaction(transactionData);
      
      await expect(transaction.save()).rejects.toThrow('Package type is required');
    });
  });

  describe('Validation', () => {
    it('should validate phone number format', async () => {
      const invalidPhoneNumbers = [
        '123456789',      // Too short
        '254612345678',   // Wrong prefix
        '+1234567890',    // Wrong country code
        'abcdefghijk'     // Non-numeric
      ];

      for (const phoneNumber of invalidPhoneNumbers) {
        const transactionData = {
          userId: testUserId,
          transactionId: `TXN${Math.random()}`,
          phoneNumber,
          amount: 100,
          packageType: 'daily' as const
        };

        const transaction = new Transaction(transactionData);
        await expect(transaction.save()).rejects.toThrow('Please provide a valid Kenyan phone number');
      }
    });

    it('should accept valid phone number formats', async () => {
      const validPhoneNumbers = [
        '254712345678',   // Standard format
        '+254712345678',  // With country code
        '0712345678',     // Local format
        '254112345678'    // Landline format
      ];

      for (let i = 0; i < validPhoneNumbers.length; i++) {
        const transactionData = {
          userId: testUserId,
          transactionId: `TXN${i}${Date.now()}`,
          phoneNumber: validPhoneNumbers[i],
          amount: 100,
          packageType: 'daily' as const
        };

        const transaction = new Transaction(transactionData);
        const savedTransaction = await transaction.save();
        expect(savedTransaction.phoneNumber).toBe(validPhoneNumbers[i]);
      }
    });

    it('should validate amount is positive', async () => {
      const invalidAmounts = [-100, 0];

      for (const amount of invalidAmounts) {
        const transactionData = {
          userId: testUserId,
          transactionId: `TXN${Math.random()}`,
          phoneNumber: '254712345678',
          amount,
          packageType: 'daily' as const
        };

        const transaction = new Transaction(transactionData);
        await expect(transaction.save()).rejects.toThrow('Amount must be greater than 0');
      }
    });

    it('should validate package type', async () => {
      const validPackageTypes = ['daily', 'weekly', 'monthly'] as const;

      for (let i = 0; i < validPackageTypes.length; i++) {
        const transactionData = {
          userId: testUserId,
          transactionId: `TXN${i}${Date.now()}`,
          phoneNumber: '254712345678',
          amount: 100,
          packageType: validPackageTypes[i]
        };

        const transaction = new Transaction(transactionData);
        const savedTransaction = await transaction.save();
        expect(savedTransaction.packageType).toBe(validPackageTypes[i]);
      }
    });

    it('should reject invalid package type', async () => {
      const transactionData = {
        userId: testUserId,
        transactionId: 'TXN123456',
        phoneNumber: '254712345678',
        amount: 100,
        packageType: 'invalid' as any
      };

      const transaction = new Transaction(transactionData);
      await expect(transaction.save()).rejects.toThrow('Package type must be daily, weekly, or monthly');
    });

    it('should validate status values', async () => {
      const validStatuses = ['pending', 'completed', 'failed'] as const;

      for (let i = 0; i < validStatuses.length; i++) {
        const transactionData = {
          userId: testUserId,
          transactionId: `TXN${i}${Date.now()}`,
          phoneNumber: '254712345678',
          amount: 100,
          packageType: 'daily' as const,
          status: validStatuses[i]
        };

        const transaction = new Transaction(transactionData);
        const savedTransaction = await transaction.save();
        expect(savedTransaction.status).toBe(validStatuses[i]);
      }
    });
  });

  describe('Instance Methods', () => {
    let pendingTransaction: ITransaction;

    beforeEach(async () => {
      pendingTransaction = new Transaction({
        userId: testUserId,
        transactionId: 'TXN_PENDING',
        phoneNumber: '254712345678',
        amount: 100,
        packageType: 'daily'
      });
      await pendingTransaction.save();
    });

    it('should complete transaction', async () => {
      expect(pendingTransaction.isPending()).toBe(true);
      expect(pendingTransaction.isCompleted()).toBe(false);
      expect(pendingTransaction.completedAt).toBeUndefined();

      const completedTransaction = await pendingTransaction.complete('MPESA123456');

      expect(completedTransaction.isCompleted()).toBe(true);
      expect(completedTransaction.isPending()).toBe(false);
      expect(completedTransaction.mpesaReceiptNumber).toBe('MPESA123456');
      expect(completedTransaction.completedAt).toBeDefined();
    });

    it('should fail transaction', async () => {
      expect(pendingTransaction.isPending()).toBe(true);
      expect(pendingTransaction.isFailed()).toBe(false);

      const failedTransaction = await pendingTransaction.fail();

      expect(failedTransaction.isFailed()).toBe(true);
      expect(failedTransaction.isPending()).toBe(false);
      expect(failedTransaction.completedAt).toBeUndefined();
    });

    it('should correctly identify transaction status', () => {
      expect(pendingTransaction.isPending()).toBe(true);
      expect(pendingTransaction.isCompleted()).toBe(false);
      expect(pendingTransaction.isFailed()).toBe(false);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test transactions
      const transactions = [
        {
          userId: testUserId,
          transactionId: 'TXN001',
          phoneNumber: '254712345678',
          amount: 100,
          packageType: 'daily' as const,
          status: 'pending' as const
        },
        {
          userId: testUserId,
          transactionId: 'TXN002',
          phoneNumber: '254712345678',
          amount: 500,
          packageType: 'weekly' as const,
          status: 'completed' as const,
          mpesaReceiptNumber: 'MPESA001'
        },
        {
          userId: testUserId,
          transactionId: 'TXN003',
          phoneNumber: '254712345679',
          amount: 1500,
          packageType: 'monthly' as const,
          status: 'failed' as const
        }
      ];

      for (const txnData of transactions) {
        const transaction = new Transaction(txnData);
        await transaction.save();
      }
    });

    it('should find transaction by transaction ID', async () => {
      const transaction = await Transaction.findByTransactionId('TXN001');
      expect(transaction).toBeTruthy();
      expect(transaction!.transactionId).toBe('TXN001');
    });

    it('should return null for non-existent transaction ID', async () => {
      const transaction = await Transaction.findByTransactionId('TXN999');
      expect(transaction).toBeNull();
    });

    it('should find transactions by user ID', async () => {
      const transactions = await Transaction.findByUserId(testUserId);
      expect(transactions).toHaveLength(3);
      expect(transactions[0].userId).toEqual(testUserId);
    });

    it('should find pending transactions', async () => {
      const pendingTransactions = await Transaction.findPendingTransactions();
      expect(pendingTransactions.length).toBeGreaterThan(0);
      
      for (const txn of pendingTransactions) {
        expect(txn.status).toBe('pending');
      }
    });

    it('should find transactions by status', async () => {
      const completedTransactions = await Transaction.findByStatus('completed');
      expect(completedTransactions.length).toBeGreaterThan(0);
      
      for (const txn of completedTransactions) {
        expect(txn.status).toBe('completed');
      }
    });

    it('should find transactions by phone number', async () => {
      const transactions = await Transaction.findByPhoneNumber('254712345678');
      expect(transactions.length).toBeGreaterThan(0);
      
      for (const txn of transactions) {
        expect(txn.phoneNumber).toBe('254712345678');
      }
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique transaction ID', async () => {
      const transactionData1 = {
        userId: testUserId,
        transactionId: 'TXN_DUPLICATE',
        phoneNumber: '254712345678',
        amount: 100,
        packageType: 'daily' as const
      };

      const transactionData2 = {
        userId: testUserId,
        transactionId: 'TXN_DUPLICATE',
        phoneNumber: '254712345679',
        amount: 500,
        packageType: 'weekly' as const
      };

      const transaction1 = new Transaction(transactionData1);
      await transaction1.save();

      const transaction2 = new Transaction(transactionData2);
      await expect(transaction2.save()).rejects.toThrow();
    });
  });

  describe('Pre-save Middleware', () => {
    it('should set completedAt when status changes to completed', async () => {
      const transaction = new Transaction({
        userId: testUserId,
        transactionId: 'TXN_MIDDLEWARE',
        phoneNumber: '254712345678',
        amount: 100,
        packageType: 'daily'
      });
      await transaction.save();

      expect(transaction.completedAt).toBeUndefined();

      transaction.status = 'completed';
      await transaction.save();

      expect(transaction.completedAt).toBeDefined();
    });

    it('should clear completedAt when status changes from completed', async () => {
      const transaction = new Transaction({
        userId: testUserId,
        transactionId: 'TXN_MIDDLEWARE2',
        phoneNumber: '254712345678',
        amount: 100,
        packageType: 'daily',
        status: 'completed'
      });
      await transaction.save();

      expect(transaction.completedAt).toBeDefined();

      transaction.status = 'failed';
      await transaction.save();

      expect(transaction.completedAt).toBeUndefined();
    });
  });
});