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
exports.SubscriptionRequest = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubscriptionRequestSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    telegramId: {
        type: Number,
        required: [true, 'Telegram ID is required'],
        validate: {
            validator: function (v) {
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
            validator: function (v) {
                if (!v)
                    return true;
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
            validator: function (v) {
                if (!v)
                    return true;
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
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});
SubscriptionRequestSchema.index({ telegramId: 1, status: 1 });
SubscriptionRequestSchema.index({ status: 1, requestedAt: -1 });
SubscriptionRequestSchema.index({ userId: 1 });
SubscriptionRequestSchema.statics.findPendingRequests = function () {
    return this.find({ status: 'pending' }).sort({ requestedAt: 1 });
};
SubscriptionRequestSchema.statics.findByTelegramId = function (telegramId) {
    return this.find({ telegramId }).sort({ requestedAt: -1 });
};
SubscriptionRequestSchema.statics.findPendingByTelegramId = function (telegramId) {
    return this.findOne({ telegramId, status: 'pending' }).sort({ requestedAt: -1 });
};
SubscriptionRequestSchema.methods.approve = function () {
    this.status = 'approved';
    this.processedAt = new Date();
    return this.save();
};
SubscriptionRequestSchema.methods.reject = function (reason) {
    this.status = 'rejected';
    this.processedAt = new Date();
    if (reason) {
        this.notes = reason;
    }
    return this.save();
};
exports.SubscriptionRequest = mongoose_1.default.model('SubscriptionRequest', SubscriptionRequestSchema);
//# sourceMappingURL=SubscriptionRequest.js.map