import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  transactionId: string;
  mpesaReceiptNumber?: string;
  phoneNumber: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  packageType: 'daily' | 'weekly' | 'monthly';
  createdAt: Date;
  completedAt?: Date;
  updatedAt: Date;
  complete(mpesaReceiptNumber: string): Promise<ITransaction>;
  fail(): Promise<ITransaction>;
  isPending(): boolean;
  isCompleted(): boolean;
  isFailed(): boolean;
}

export interface ITransactionModel extends Model<ITransaction> {
  findByTransactionId(transactionId: string): Promise<ITransaction | null>;
  findByUserId(userId: mongoose.Types.ObjectId): Promise<ITransaction[]>;
  findPendingTransactions(): Promise<ITransaction[]>;
  findByStatus(status: 'pending' | 'completed' | 'failed'): Promise<ITransaction[]>;
  findByPhoneNumber(phoneNumber: string): Promise<ITransaction[]>;
}

const TransactionSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return v.length > 0;
      },
      message: 'Transaction ID cannot be empty'
    }
  },
  mpesaReceiptNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Optional field
        return v.length > 0;
      },
      message: 'Mpesa receipt number cannot be empty if provided'
    }
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v: string) {
        // Kenyan phone number format: 254XXXXXXXXX or +254XXXXXXXXX
        return /^(\+?254|0)?[17]\d{8}$/.test(v);
      },
      message: 'Please provide a valid Kenyan phone number'
    }
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
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed'],
      message: 'Status must be pending, completed, or failed'
    },
    default: 'pending',
    required: [true, 'Status is required'],
    index: true
  },
  packageType: {
    type: String,
    enum: {
      values: ['daily', 'weekly', 'monthly'],
      message: 'Package type must be daily, weekly, or monthly'
    },
    required: [true, 'Package type is required']
  },
  completedAt: {
    type: Date,
    validate: {
      validator: function(this: ITransaction, v: Date) {
        // If completedAt is set, status should be 'completed'
        if (v && this.status !== 'completed') {
          return false;
        }
        return true;
      },
      message: 'Completed date can only be set when status is completed'
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
TransactionSchema.index({ userId: 1, status: 1 });
TransactionSchema.index({ phoneNumber: 1 });
TransactionSchema.index({ status: 1, createdAt: -1 });
TransactionSchema.index({ mpesaReceiptNumber: 1 }, { sparse: true });

// Pre-save middleware to set completedAt when status changes to completed
TransactionSchema.pre('save', function(this: ITransaction, next) {
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'completed') {
      this.completedAt = undefined as any;
    }
  }
  next();
});

// Static methods
TransactionSchema.statics.findByTransactionId = function(transactionId: string) {
  return this.findOne({ transactionId });
};

TransactionSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

TransactionSchema.statics.findPendingTransactions = function() {
  return this.find({ status: 'pending' }).sort({ createdAt: 1 });
};

TransactionSchema.statics.findByStatus = function(status: 'pending' | 'completed' | 'failed') {
  return this.find({ status }).sort({ createdAt: -1 });
};

TransactionSchema.statics.findByPhoneNumber = function(phoneNumber: string) {
  return this.find({ phoneNumber }).sort({ createdAt: -1 });
};

// Instance methods
TransactionSchema.methods.complete = function(mpesaReceiptNumber: string): Promise<ITransaction> {
  this.status = 'completed';
  this.mpesaReceiptNumber = mpesaReceiptNumber;
  this.completedAt = new Date();
  return this.save();
};

TransactionSchema.methods.fail = function(): Promise<ITransaction> {
  this.status = 'failed';
  this.completedAt = undefined as any;
  return this.save();
};

TransactionSchema.methods.isPending = function(): boolean {
  return this.status === 'pending';
};

TransactionSchema.methods.isCompleted = function(): boolean {
  return this.status === 'completed';
};

TransactionSchema.methods.isFailed = function(): boolean {
  return this.status === 'failed';
};

export const Transaction = mongoose.model<ITransaction, ITransactionModel>('Transaction', TransactionSchema);