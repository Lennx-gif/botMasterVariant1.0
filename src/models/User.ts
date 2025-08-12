import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  phoneNumber?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  toSafeObject(): any;
}

export interface IUserModel extends Model<IUser> {
  findByTelegramId(telegramId: number): Promise<IUser | null>;
  findByPhoneNumber(phoneNumber: string): Promise<IUser | null>;
}

const UserSchema: Schema = new Schema({
  telegramId: {
    type: Number,
    required: [true, 'Telegram ID is required'],
    unique: true,
    validate: {
      validator: function(v: number) {
        return v > 0;
      },
      message: 'Telegram ID must be a positive number'
    }
  },
  username: {
    type: String,
    trim: true,
    maxlength: [50, 'Username cannot exceed 50 characters'],
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Optional field
        return /^[a-zA-Z0-9_]+$/.test(v);
      },
      message: 'Username can only contain letters, numbers, and underscores'
    }
  },
  phoneNumber: {
    type: String,
    required: false, // Make phone number optional
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Allow empty phone number
        // Kenyan phone number format: 254XXXXXXXXX or +254XXXXXXXXX
        return /^(\+?254|0)?[17]\d{8}$/.test(v);
      },
      message: 'Please provide a valid Kenyan phone number'
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      delete ret.__v;
      return ret;
    }
  }
});

// Index for efficient queries
UserSchema.index({ phoneNumber: 1 });

// Static methods
UserSchema.statics.findByTelegramId = function(telegramId: number) {
  return this.findOne({ telegramId });
};

UserSchema.statics.findByPhoneNumber = function(phoneNumber: string) {
  return this.findOne({ phoneNumber });
};

// Instance methods
UserSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete (userObject as any).__v;
  return userObject;
};

export const User = mongoose.model<IUser, IUserModel>('User', UserSchema);