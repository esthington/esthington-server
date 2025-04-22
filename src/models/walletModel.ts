import mongoose, { type Document, Schema } from "mongoose";

export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  TRANSFER = "transfer",
  PAYMENT = "payment",
  REFUND = "refund",
  REFERRAL = "referral",
  INVESTMENT = "investment",
  PROPERTY_PURCHASE = "property_purchase",
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum PaymentMethod {
  CARD = "card",
  BANK_TRANSFER = "bank_transfer",
  WALLET = "wallet",
  PAYSTACK = "paystack",
}

// Extend Document but omit _id to avoid conflicts
export interface ITransaction extends Omit<Document, "_id"> {
  _id: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  reference: string;
  description: string;
  date: Date;
  paymentMethod?: PaymentMethod;
  metadata?: Record<string, any>;
  recipient?: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  property?: mongoose.Types.ObjectId;
  investment?: mongoose.Types.ObjectId;
}

const transactionSchema = new Schema<ITransaction>({
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
    type: Schema.Types.Mixed,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
  },
  investment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Investment",
  },
});

// Extend Document but omit _id to avoid conflicts
export interface IWallet extends Omit<Document, "_id"> {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

// Create indexes for faster queries
walletSchema.index({ user: 1 });
walletSchema.index({ "transactions.reference": 1 });
walletSchema.index({ "transactions.status": 1 });
walletSchema.index({ "transactions.date": -1 });

export const Wallet = mongoose.model<IWallet>("Wallet", walletSchema);

// For backward compatibility
export const Transaction = mongoose.model<ITransaction>(
  "Transaction",
  transactionSchema
);
