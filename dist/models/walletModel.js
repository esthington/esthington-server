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
exports.Transaction = exports.Wallet = exports.PaymentMethod = exports.TransactionStatus = exports.TransactionType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var TransactionType;
(function (TransactionType) {
    TransactionType["DEPOSIT"] = "deposit";
    TransactionType["WITHDRAWAL"] = "withdrawal";
    TransactionType["TRANSFER"] = "transfer";
    TransactionType["PAYMENT"] = "payment";
    TransactionType["REFUND"] = "refund";
    TransactionType["REFERRAL"] = "referral";
    TransactionType["INVESTMENT"] = "investment";
    TransactionType["PROPERTY_PURCHASE"] = "property_purchase";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "pending";
    TransactionStatus["COMPLETED"] = "completed";
    TransactionStatus["FAILED"] = "failed";
    TransactionStatus["CANCELLED"] = "cancelled";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CARD"] = "card";
    PaymentMethod["BANK_TRANSFER"] = "bank_transfer";
    PaymentMethod["WALLET"] = "wallet";
    PaymentMethod["PAYSTACK"] = "paystack";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
const transactionSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: Object.values(TransactionType),
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: [0, "Amount cannot be negative"],
    },
    status: {
        type: String,
        enum: Object.values(TransactionStatus),
        default: TransactionStatus.PENDING,
    },
    reference: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    paymentMethod: {
        type: String,
        enum: Object.values(PaymentMethod),
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    recipient: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
    },
    sender: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
    },
    property: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Property",
    },
    investment: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Investment",
    },
});
const walletSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    balance: {
        type: Number,
        default: 0,
        min: [0, "Balance cannot be negative"],
    },
    availableBalance: {
        type: Number,
        default: 0,
        min: [0, "Available balance cannot be negative"],
    },
    pendingBalance: {
        type: Number,
        default: 0,
        min: [0, "Pending balance cannot be negative"],
    },
    transactions: [transactionSchema],
}, {
    timestamps: true,
});
// Create indexes for faster queries
walletSchema.index({ user: 1 });
walletSchema.index({ "transactions.reference": 1 });
walletSchema.index({ "transactions.status": 1 });
walletSchema.index({ "transactions.date": -1 });
exports.Wallet = mongoose_1.default.model("Wallet", walletSchema);
// For backward compatibility
exports.Transaction = mongoose_1.default.model("Transaction", transactionSchema);
//# sourceMappingURL=walletModel.js.map