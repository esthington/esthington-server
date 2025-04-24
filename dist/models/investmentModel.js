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
exports.UserInvestment = exports.InvestmentPlan = exports.PayoutFrequency = exports.ReturnType = exports.InvestmentStatus = exports.InvestmentType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var InvestmentType;
(function (InvestmentType) {
    InvestmentType["REAL_ESTATE"] = "real_estate";
    InvestmentType["AGRICULTURE"] = "agriculture";
    InvestmentType["BUSINESS"] = "business";
    InvestmentType["STOCKS"] = "stocks";
})(InvestmentType || (exports.InvestmentType = InvestmentType = {}));
var InvestmentStatus;
(function (InvestmentStatus) {
    InvestmentStatus["ACTIVE"] = "active";
    InvestmentStatus["COMPLETED"] = "completed";
    InvestmentStatus["CANCELLED"] = "cancelled";
    InvestmentStatus["PENDING"] = "pending";
})(InvestmentStatus || (exports.InvestmentStatus = InvestmentStatus = {}));
var ReturnType;
(function (ReturnType) {
    ReturnType["FIXED"] = "fixed";
    ReturnType["VARIABLE"] = "variable";
    ReturnType["PROFIT_SHARING"] = "profit_sharing";
})(ReturnType || (exports.ReturnType = ReturnType = {}));
var PayoutFrequency;
(function (PayoutFrequency) {
    PayoutFrequency["MONTHLY"] = "monthly";
    PayoutFrequency["QUARTERLY"] = "quarterly";
    PayoutFrequency["SEMI_ANNUALLY"] = "semi_annually";
    PayoutFrequency["ANNUALLY"] = "annually";
    PayoutFrequency["END_OF_TERM"] = "end_of_term";
})(PayoutFrequency || (exports.PayoutFrequency = PayoutFrequency = {}));
const investmentPlanSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, "Investment title is required"],
        trim: true,
    },
    description: {
        type: String,
        required: [true, "Investment description is required"],
    },
    type: {
        type: String,
        enum: Object.values(InvestmentType),
        required: [true, "Investment type is required"],
    },
    minimumAmount: {
        type: Number,
        required: [true, "Minimum investment amount is required"],
        min: [0, "Minimum amount cannot be negative"],
    },
    maximumAmount: {
        type: Number,
        required: [true, "Maximum investment amount is required"],
        min: [0, "Maximum amount cannot be negative"],
    },
    expectedReturn: {
        type: Number,
        required: [true, "Expected return is required"],
        min: [0, "Expected return cannot be negative"],
    },
    returnType: {
        type: String,
        enum: Object.values(ReturnType),
        required: [true, "Return type is required"],
    },
    duration: {
        type: Number,
        required: [true, "Duration is required"],
        min: [1, "Duration must be at least 1 month"],
    },
    payoutFrequency: {
        type: String,
        enum: Object.values(PayoutFrequency),
        required: [true, "Payout frequency is required"],
    },
    riskLevel: {
        type: Number,
        required: [true, "Risk level is required"],
        min: [1, "Risk level must be at least 1"],
        max: [5, "Risk level must be at most 5"],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    startDate: {
        type: Date,
        required: [true, "Start date is required"],
    },
    endDate: {
        type: Date,
        required: [true, "End date is required"],
    },
    totalRaised: {
        type: Number,
        default: 0,
        min: [0, "Total raised cannot be negative"],
    },
    targetAmount: {
        type: Number,
        required: [true, "Target amount is required"],
        min: [0, "Target amount cannot be negative"],
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    images: [String],
    documents: [String],
    location: {
        address: String,
        city: String,
        state: String,
        country: {
            type: String,
            default: "Nigeria",
        },
    },
}, {
    timestamps: true,
});
const userInvestmentSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    plan: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "InvestmentPlan",
        required: true,
    },
    rejectionReason: {
        type: String,
    },
    amount: {
        type: Number,
        required: [true, "Investment amount is required"],
        min: [0, "Amount cannot be negative"],
    },
    status: {
        type: String,
        enum: Object.values(InvestmentStatus),
        default: InvestmentStatus.PENDING,
    },
    startDate: {
        type: Date,
        required: [true, "Start date is required"],
    },
    endDate: {
        type: Date,
        required: [true, "End date is required"],
    },
    expectedReturn: {
        type: Number,
        required: [true, "Expected return is required"],
        min: [0, "Expected return cannot be negative"],
    },
    actualReturn: {
        type: Number,
        default: 0,
        min: [0, "Actual return cannot be negative"],
    },
    nextPayoutDate: Date,
    payouts: [
        {
            date: {
                type: Date,
                required: true,
            },
            amount: {
                type: Number,
                required: true,
                min: [0, "Payout amount cannot be negative"],
            },
            status: {
                type: String,
                enum: ["pending", "paid", "failed"],
                default: "pending",
            },
            transaction: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: "Transaction",
            },
        },
    ],
}, {
    timestamps: true,
});
exports.InvestmentPlan = mongoose_1.default.model("InvestmentPlan", investmentPlanSchema);
exports.UserInvestment = mongoose_1.default.model("UserInvestment", userInvestmentSchema);
//# sourceMappingURL=investmentModel.js.map