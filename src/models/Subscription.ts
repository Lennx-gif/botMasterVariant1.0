import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  packageType: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'cancelled';
  transactionId: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
  isExpired(): boolean;
  isExpiringSoon(hours?: number): boolean;
  calculateEndDate(): Date;
  expire(): Promise<ISubscription>;
}

export interface ISubscriptionModel extends Model<ISubscription> {
  findByUserId(userId: mongoose.Types.ObjectId): Promise<ISubscription[]>;
  findActiveByUserId(userId: mongoose.Types.ObjectId): Promise<ISubscription | null>;
  findExpiringSubscriptions(hours?: number): Promise<ISubscription[]>;
  findExpiredSubscriptions(): Promise<ISubscription[]>;
}

const SubscriptionSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    //index: true
  },
  packageType: {
    type: String,
    enum: {
      values: ['daily', 'weekly', 'monthly'],
      message: 'Package type must be daily, weekly, or monthly'
    },
    required: [true, 'Package type is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'expired', 'cancelled'],
      message: 'Status must be active, expired, or cancelled'
    },
    default: 'active',
    required: [true, 'Status is required']
  },
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    unique: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive'],
    validate: {
      validator: function(v: number) {
        return v > 0;
      },
      message: 'Amount must be greater than 0'
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

// Indexes for efficient queries
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ endDate: 1, status: 1 });
//SubscriptionSchema.index({ transactionId: 1 });

// Pre-save middleware to calculate end date
SubscriptionSchema.pre('save', function(this: ISubscription, next) {
  if (this.isNew || this.isModified('packageType') || this.isModified('startDate')) {
    this.endDate = this.calculateEndDate();
  }
  next();
});

// Static methods
SubscriptionSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

SubscriptionSchema.statics.findActiveByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ 
    userId, 
    status: 'active',
    endDate: { $gt: new Date() }
  }).sort({ endDate: -1 });
};

SubscriptionSchema.statics.findExpiringSubscriptions = function(hours: number = 24) {
  const now = new Date();
  const expirationThreshold = new Date(now.getTime() + (hours * 60 * 60 * 1000));
  
  return this.find({
    status: 'active',
    endDate: {
      $gt: now,
      $lte: expirationThreshold
    }
  });
};

SubscriptionSchema.statics.findExpiredSubscriptions = function() {
  return this.find({
    status: 'active',
    endDate: { $lte: new Date() }
  });
};

// Instance methods
SubscriptionSchema.methods.isExpired = function(): boolean {
  return new Date() > this.endDate;
};

SubscriptionSchema.methods.isExpiringSoon = function(hours: number = 24): boolean {
  const now = new Date();
  const expirationThreshold = new Date(now.getTime() + (hours * 60 * 60 * 1000));
  return this.endDate <= expirationThreshold && this.endDate > now;
};

SubscriptionSchema.methods.calculateEndDate = function(): Date {
  const startDate = this.startDate || new Date();
  const endDate = new Date(startDate);
  
  switch (this.packageType) {
    case 'daily':
      endDate.setDate(endDate.getDate() + 1);
      break;
    case 'weekly':
      endDate.setDate(endDate.getDate() + 7);
      break;
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    default:
      throw new Error(`Invalid package type: ${this.packageType}`);
  }
  
  return endDate;
};

SubscriptionSchema.methods.expire = function(): Promise<ISubscription> {
  this.status = 'expired';
  return this.save();
};

export const Subscription = mongoose.model<ISubscription, ISubscriptionModel>('Subscription', SubscriptionSchema);