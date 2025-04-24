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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRank = exports.UserRole = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
var UserRole;
(function (UserRole) {
    UserRole["BUYER"] = "buyer";
    UserRole["AGENT"] = "agent";
    UserRole["ADMIN"] = "admin";
    UserRole["SUPER_ADMIN"] = "super_admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var AgentRank;
(function (AgentRank) {
    AgentRank["BRONZE"] = "Bronze";
    AgentRank["SILVER"] = "Silver";
    AgentRank["GOLD"] = "Gold";
    AgentRank["PLATINUM"] = "Platinum";
})(AgentRank || (exports.AgentRank = AgentRank = {}));
const userSchema = new mongoose_1.Schema({
    firstName: {
        type: String,
        required: [false, "First name is required"],
        trim: true,
    },
    lastName: {
        type: String,
        required: [false, "Last name is required"],
        trim: true,
    },
    userName: {
        type: String,
        unique: true,
        required: [true, "userName is required"],
        trim: true,
    },
    avatar: {
        type: String,
        default: "https://ferf1mheo22r9ira.public.blob.vercel-storage.com/avatar-02-albo9B0tWOSLXCVZh9rX9KFxXIVWMr.png",
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 8 characters"],
        select: false,
    },
    phone: {
        type: String,
        trim: true,
    },
    permissions: {
        type: [String],
        default: [],
    },
    address: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.BUYER,
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    hasSeenSplash: {
        type: Boolean,
        default: false,
    },
    onboardingCompleted: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    refreshToken: String,
    profileImage: String,
    referralCode: {
        type: String,
        unique: true,
        sparse: true, // This allows null/undefined values and only enforces uniqueness on actual values
    },
    // Add direct reference to referer
    referer: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    agentRank: {
        type: String,
        enum: Object.values(AgentRank),
        default: AgentRank.BRONZE,
    },
    businessName: {
        type: String,
        trim: true,
    },
    passwordChangedAt: Date,
    lastLogin: Date,
}, {
    timestamps: true,
});
// Hash password before saving
userSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Only hash the password if it has been modified (or is new)
            if (!this.isModified("password")) {
                return next();
            }
            // Generate a salt
            const salt = yield bcryptjs_1.default.genSalt(10);
            // Hash the password along with the new salt
            this.password = yield bcryptjs_1.default.hash(this.password, salt);
            next();
        }
        catch (error) {
            next(error instanceof Error ? error : new Error("Password hashing failed"));
        }
    });
});
// Set username as referral code for agents
userSchema.pre("save", function (next) {
    // If this is a new agent user, set their username as their referral code
    if (this.isNew && this.role === UserRole.AGENT) {
        this.referralCode = this.userName;
    }
    next();
});
// Compare password method
userSchema.methods.comparePassword = function (enteredPassword) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield bcryptjs_1.default.compare(enteredPassword, this.password);
        }
        catch (error) {
            throw new Error("Password comparison failed");
        }
    });
};
// Generate verification token
userSchema.methods.generateVerificationToken = function () {
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.verificationToken = token;
    this.verificationTokenExpires = expires;
    return { token, expires };
};
// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
    this.resetPasswordToken = token;
    this.resetPasswordExpires = expires;
    return { token, expires };
};
const User = mongoose_1.default.model("User", userSchema);
exports.default = User;
//# sourceMappingURL=userModel.js.map