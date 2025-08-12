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
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    telegramId: {
        type: Number,
        required: [true, 'Telegram ID is required'],
        unique: true,
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
        maxlength: [50, 'Username cannot exceed 50 characters'],
        validate: {
            validator: function (v) {
                if (!v)
                    return true;
                return /^[a-zA-Z0-9_]+$/.test(v);
            },
            message: 'Username can only contain letters, numbers, and underscores'
        }
    },
    phoneNumber: {
        type: String,
        required: false,
        validate: {
            validator: function (v) {
                if (!v)
                    return true;
                return /^(\+?254|0)?[17]\d{8}$/.test(v);
            },
            message: 'Please provide a valid Kenyan phone number'
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
UserSchema.index({ phoneNumber: 1 });
UserSchema.statics.findByTelegramId = function (telegramId) {
    return this.findOne({ telegramId });
};
UserSchema.statics.findByPhoneNumber = function (phoneNumber) {
    return this.findOne({ phoneNumber });
};
UserSchema.methods.toSafeObject = function () {
    const userObject = this.toObject();
    delete userObject.__v;
    return userObject;
};
exports.User = mongoose_1.default.model('User', UserSchema);
//# sourceMappingURL=User.js.map