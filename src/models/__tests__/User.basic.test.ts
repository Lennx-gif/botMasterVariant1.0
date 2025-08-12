import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, IUser } from '../User';

describe('User Model Basic Tests', () => {
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
});