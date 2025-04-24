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
exports.ReferralCommission = exports.Referral = exports.ReferralStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const userModel_1 = require("./userModel");
var ReferralStatus;
(function (ReferralStatus) {
    ReferralStatus["PENDING"] = "pending";
    ReferralStatus["ACTIVE"] = "active";
    ReferralStatus["INACTIVE"] = "inactive";
})(ReferralStatus || (exports.ReferralStatus = ReferralStatus = {}));
const referralSchema = new mongoose_1.Schema({
    referrer: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Referrer is required"],
    },
    referred: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Referred user is required"],
    },
    status: {
        type: String,
        enum: Object.values(ReferralStatus),
        default: ReferralStatus.PENDING,
    },
    earnings: {
        type: Number,
        default: 0,
        min: [0, "Earnings cannot be negative"],
    },
}, {
    timestamps: true,
});
const referralCommissionSchema = new mongoose_1.Schema({
    rank: {
        type: String,
        enum: Object.values(userModel_1.AgentRank),
        required: [true, "Agent rank is required"],
        unique: true,
    },
    investmentRate: {
        type: Number,
        required: [true, "Investment commission rate is required"],
        min: [0, "Rate cannot be negative"],
        max: [100, "Rate cannot exceed 100%"],
    },
    propertyRate: {
        type: Number,
        required: [true, "Property commission rate is required"],
        min: [0, "Rate cannot be negative"],
        max: [100, "Rate cannot exceed 100%"],
    },
}, {
    timestamps: true,
});
exports.Referral = mongoose_1.default.model("Referral", referralSchema);
exports.ReferralCommission = mongoose_1.default.model("ReferralCommission", referralCommissionSchema);
//# sourceMappingURL=referralModel.js.map