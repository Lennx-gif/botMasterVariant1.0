import jwt from 'jsonwebtoken';
import { AdminUser, AdminUserDocument } from '../models/AdminUser';
import { ActivityLog } from '../models/ActivityLog';
import { LoginRequest, LoginResponse, JWTPayload } from '../types/admin';
import { AuthenticationError } from '../middleware/auth';

export class AuthService {
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || '';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  async login(loginData: LoginRequest): Promise<LoginResponse> {
    const { username, password } = loginData;

    // Find user by username
    const user = await AdminUser.findOne({ username });
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log the login activity
    await this.logActivity(user._id.toString(), 'login', {
      timestamp: new Date(),
      userAgent: 'Admin Panel'
    });

    // Generate JWT token
    const payload: JWTPayload = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    return {
      token,
      user: {
        _id: user._id.toString(),
        username: user.username,
        role: user.role,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    };
  }

  async logout(userId: string): Promise<void> {
    // Log the logout activity
    await this.logActivity(userId, 'logout', {
      timestamp: new Date()
    });
  }

  async verifyToken(token: string): Promise<AdminUserDocument | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      const user = await AdminUser.findById(decoded.userId);
      return user;
    } catch (error) {
      return null;
    }
  }

  async createAdminUser(username: string, password: string, role: 'admin' | 'super_admin' = 'admin'): Promise<AdminUserDocument> {
    // Check if user already exists
    const existingUser = await AdminUser.findOne({ username });
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Create new admin user
    const adminUser = new AdminUser({
      username,
      passwordHash: password, // Will be hashed by the pre-save middleware
      role
    });

    await adminUser.save();
    return adminUser;
  }

  private async logActivity(
    adminId: string,
    action: 'login' | 'logout',
    details: Record<string, any>
  ): Promise<void> {
    try {
      const activityLog = new ActivityLog({
        adminId,
        action,
        details,
        timestamp: new Date()
      });
      await activityLog.save();
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });
  }
}