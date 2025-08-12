"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TransactionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
            validator: function (v) {
                return v.length > 0;
            },
            message: 'Transaction ID cannot be empty'
        }
    },
    mpesaReceiptNumber: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                if (!v)
                    return true;
                return v.length > 0;
            },
            message: 'Mpesa receipt number cannot be empty if provided'
        }
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        validate: {
            validator: function (v) {
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
            validator: function (v) {
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
            validator: function (v) {
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
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});
TransactionSchema.index({ userId: 1, status: 1 });
TransactionSchema.index({ phoneNumber: 1 });
TransactionSchema.index({ status: 1, createdAt: -1 });
TransactionSchema.index({ mpesaReceiptNumber: 1 }, { sparse: true });
TransactionSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        if (this.status === 'completed' && !this.completedAt) {
            this.completedAt = new Date();
        }
        else if (this.status !== 'completed') {
            this.completedAt = undefined;
        }
    }
    next();
});
TransactionSchema.statics.findByTransactionId = function (transactionId) {
    return this.findOne({ transactionId });
};
TransactionSchema.statics.findByUserId = function (userId) {
    return this.find({ userId }).sort({ createdAt: -1 });
};
TransactionSchema.statics.findPendingTransactions = function () {
    return this.find({ status: 'pending' }).sort({ createdAt: 1 });
};
TransactionSchema.statics.findByStatus = function (status) {
    return this.find({ status }).sort({ createdAt: -1 });
};
TransactionSchema.statics.findByPhoneNumber = function (phoneNumber) {
    return this.find({ phoneNumber }).sort({ createdAt: -1 });
};
TransactionSchema.methods.complete = function (mpesaReceiptNumber) {
    this.status = 'completed';
    this.mpesaReceiptNumber = mpesaReceiptNumber;
    this.completedAt = new Date();
    return this.save();
};
TransactionSchema.methods.fail = function () {
    this.status = 'failed';
    this.completedAt = undefined;
    return this.save();
};
TransactionSchema.methods.isPending = function () {
    return this.status === 'pending';
};
TransactionSchema.methods.isCompleted = function () {
    return this.status === 'completed';
};
TransactionSchema.methods.isFailed = function () {
    return this.status === 'failed';
};
exports.Transaction = mongoose_1.default.model('Transaction', TransactionSchema);
//# sourceMappingURL=Transaction.js.map