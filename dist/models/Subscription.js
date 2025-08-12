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
exports.Subscription = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
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
            validator: function (v) {
                return v > 0;
            },
            message: 'Amount must be greater than 0'
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
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ endDate: 1, status: 1 });
SubscriptionSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('packageType') || this.isModified('startDate')) {
        this.endDate = this.calculateEndDate();
    }
    next();
});
SubscriptionSchema.statics.findByUserId = function (userId) {
    return this.find({ userId }).sort({ createdAt: -1 });
};
SubscriptionSchema.statics.findActiveByUserId = function (userId) {
    return this.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
    }).sort({ endDate: -1 });
};
SubscriptionSchema.statics.findExpiringSubscriptions = function (hours = 24) {
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
SubscriptionSchema.statics.findExpiredSubscriptions = function () {
    return this.find({
        status: 'active',
        endDate: { $lte: new Date() }
    });
};
SubscriptionSchema.methods.isExpired = function () {
    return new Date() > this.endDate;
};
SubscriptionSchema.methods.isExpiringSoon = function (hours = 24) {
    const now = new Date();
    const expirationThreshold = new Date(now.getTime() + (hours * 60 * 60 * 1000));
    return this.endDate <= expirationThreshold && this.endDate > now;
};
SubscriptionSchema.methods.calculateEndDate = function () {
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
SubscriptionSchema.methods.expire = function () {
    this.status = 'expired';
    return this.save();
};
exports.Subscription = mongoose_1.default.model('Subscription', SubscriptionSchema);
//# sourceMappingURL=Subscription.js.map