import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISubscriptionRequest extends Document {
  userId: mongoose.Types.ObjectId;
  telegramId: number;
  username?: string;
  phoneNumber?: string;
  packageType: 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: number; // Admin telegram ID
  notes?: string;
  approve(): Promise<ISubscriptionRequest>;
  reject(reason?: string): Promise<ISubscriptionRequest>;
}

export interface ISubscriptionRequestModel extends Model<ISubscriptionRequest> {
  findPendingRequests(): Promise<ISubscriptionRequest[]>;
  findByTelegramId(telegramId: number): Promise<ISubscriptionRequest[]>;
  findPendingByTelegramId(telegramId: number): Promise<ISubscriptionRequest | null>;
}

const SubscriptionRequestSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  telegramId: {
    type: Number,
    required: [true, 'Telegram ID is required'],
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
    maxlength: [50, 'Username cannot exceed 50 characters']
  },
  phoneNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Optional field
        return /^254[17]\d{8}$/.test(v);
      },
      message: 'Please provide a valid Kenyan phone number'
    }
  },
  packageType: {
    type: String,
    enum: {
      values: ['daily', 'weekly', 'monthly'],
      message: 'Package type must be daily, weekly, or monthly'
    },
    required: [true, 'Package type is required']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected'],
      message: 'Status must be pending, approved, or rejected'
    },
    default: 'pending',
    required: [true, 'Status is required']
  },
  requestedAt: {
    type: Date,
    default: Date.now,
    required: [true, 'Request date is required']
  },
  processedAt: {
    type: Date
  },
  processedBy: {
    type: Number,
    validate: {
      validator: function(v: number) {
        if (!v) return true; // Optional field
        return v > 0;
      },
      message: 'Processed by must be a positive number'
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
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

// Indexes for efficient queries
SubscriptionRequestSchema.index({ telegramId: 1, status: 1 });
SubscriptionRequestSchema.index({ status: 1, requestedAt: -1 });
SubscriptionRequestSchema.index({ userId: 1 });

// Static methods
SubscriptionRequestSchema.statics.findPendingRequests = function() {
  return this.find({ status: 'pending' }).sort({ requestedAt: 1 });
};

SubscriptionRequestSchema.statics.findByTelegramId = function(telegramId: number) {
  return this.find({ telegramId }).sort({ requestedAt: -1 });
};

SubscriptionRequestSchema.statics.findPendingByTelegramId = function(telegramId: number) {
  return this.findOne({ telegramId, status: 'pending' }).sort({ requestedAt: -1 });
};

// Instance methods
SubscriptionRequestSchema.methods.approve = function(): Promise<ISubscriptionRequest> {
  this.status = 'approved';
  this.processedAt = new Date();
  return this.save();
};

SubscriptionRequestSchema.methods.reject = function(reason?: string): Promise<ISubscriptionRequest> {
  this.status = 'rejected';
  this.processedAt = new Date();
  if (reason) {
    this.notes = reason;
  }
  return this.save();
};

export const SubscriptionRequest = mongoose.model<ISubscriptionRequest, ISubscriptionRequestModel>('SubscriptionRequest', SubscriptionRequestSchema);