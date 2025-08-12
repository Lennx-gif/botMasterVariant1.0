import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, IUser } from '../User';

describe('User Model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('User Creation', () => {
    it('should create a valid user with required fields', async () => {
      const userData = {
        telegramId: 123456789,
        phoneNumber: '254712345678'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.telegramId).toBe(userData.telegramId);
      expect(savedUser.phoneNumber).toBe(userData.phoneNumber);
      expect(savedUser.createdAt).toBeDefined();
      expect(savedUser.updatedAt).toBeDefined();
    });

    it('should create a user with optional username', async () => {
      const userData = {
        telegramId: 123456789,
        username: 'testuser',
        phoneNumber: '254712345678'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.username).toBe(userData.username);
    });

    it('should fail to create user without telegramId', async () => {
      const userData = {
        phoneNumber: '254712345678'
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Telegram ID is required');
    });

    it('should fail to create user without phoneNumber', async () => {
      const userData = {
        telegramId: 123456789
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Phone number is required');
    });
  });

  describe('Validation', () => {
    it('should validate positive telegramId', async () => {
      const userData = {
        telegramId: -123,
        phoneNumber: '254712345678'
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Telegram ID must be a positive number');
    });

    it('should validate Kenyan phone number format', async () => {
      const invalidPhoneNumbers = [
        '123456789',      // Too short
        '254612345678',   // Wrong prefix
        '+1234567890',    // Wrong country code
        'abcdefghijk'     // Non-numeric
      ];

      for (const phoneNumber of invalidPhoneNumbers) {
        const userData = {
          telegramId: 123456789,
          phoneNumber
        };

        const user = new User(userData);
        await expect(user.save()).rejects.toThrow('Please provide a valid Kenyan phone number');
      }
    });

    it('should accept valid Kenyan phone number formats', async () => {
      const validPhoneNumbers = [
        '254712345678',   // Standard format
        '+254712345678',  // With country code
        '0712345678',     // Local format
        '254112345678'    // Landline format
      ];

      for (let i = 0; i < validPhoneNumbers.length; i++) {
        const userData = {
          telegramId: 123456789 + i,
          phoneNumber: validPhoneNumbers[i]
        };

        const user = new User(userData);
        const savedUser = await user.save();
        expect(savedUser.phoneNumber).toBe(validPhoneNumbers[i]);
      }
    });

    it('should validate username format', async () => {
      const invalidUsernames = [
        'user@name',      // Special characters
        'user name',      // Spaces
        'user-name',      // Hyphens
        'a'.repeat(51)    // Too long
      ];

      for (const username of invalidUsernames) {
        const userData = {
          telegramId: 123456789,
          username,
          phoneNumber: '254712345678'
        };

        const user = new User(userData);
        await expect(user.save()).rejects.toThrow();
      }
    });

    it('should accept valid username formats', async () => {
      const validUsernames = [
        'username',
        'user123',
        'user_name',
        'User_123'
      ];

      for (let i = 0; i < validUsernames.length; i++) {
        const userData = {
          telegramId: 123456789 + i,
          username: validUsernames[i],
          phoneNumber: `25471234567${i}`
        };

        const user = new User(userData);
        const savedUser = await user.save();
        expect(savedUser.username).toBe(validUsernames[i]);
      }
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique telegramId', async () => {
      const userData1 = {
        telegramId: 123456789,
        phoneNumber: '254712345678'
      };

      const userData2 = {
        telegramId: 123456789,
        phoneNumber: '254712345679'
      };

      const user1 = new User(userData1);
      await user1.save();

      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      const userData = {
        telegramId: 123456789,
        username: 'testuser',
        phoneNumber: '254712345678'
      };
      const user = new User(userData);
      await user.save();
    });

    it('should find user by telegramId', async () => {
      const user = await User.findByTelegramId(123456789);
      expect(user).toBeTruthy();
      expect(user?.telegramId).toBe(123456789);
    });

    it('should return null for non-existent telegramId', async () => {
      const user = await User.findByTelegramId(999999999);
      expect(user).toBeNull();
    });

    it('should find user by phoneNumber', async () => {
      const user = await User.findByPhoneNumber('254712345678');
      expect(user).toBeTruthy();
      expect(user?.phoneNumber).toBe('254712345678');
    });

    it('should return null for non-existent phoneNumber', async () => {
      const user = await User.findByPhoneNumber('254999999999');
      expect(user).toBeNull();
    });
  });

  describe('Instance Methods', () => {
    it('should return safe object without __v field', async () => {
      const userData = {
        telegramId: 123456789,
        phoneNumber: '254712345678'
      };

      const user = new User(userData);
      const savedUser = await user.save();
      const safeObject = savedUser.toSafeObject();

      expect(safeObject.__v).toBeUndefined();
      expect(safeObject.telegramId).toBe(userData.telegramId);
      expect(safeObject.phoneNumber).toBe(userData.phoneNumber);
    });
  });

  describe('CRUD Operations', () => {
    it('should create, read, update, and delete user', async () => {
      // Create
      const userData = {
        telegramId: 123456789,
        phoneNumber: '254712345678'
      };
      const user = new User(userData);
      const savedUser = await user.save();
      expect(savedUser._id).toBeDefined();

      // Read
      const foundUser = await User.findById(savedUser._id);
      expect(foundUser?.telegramId).toBe(userData.telegramId);

      // Update
      foundUser!.username = 'updateduser';
      const updatedUser = await foundUser!.save();
      expect(updatedUser.username).toBe('updateduser');

      // Delete
      await User.findByIdAndDelete(savedUser._id);
      const deletedUser = await User.findById(savedUser._id);
      expect(deletedUser).toBeNull();
    });
  });
});