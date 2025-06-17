import mongoose, { Schema, type Document } from "mongoose";

export enum PaymentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export interface CommissionPayment {
  referrerId: mongoose.Types.ObjectId;
  referrerName?: string;
  referrerEmail?: string;
  level: number;
  amount: number;
  transactionId?: mongoose.Types.ObjectId;
  status: "pending" | "paid" | "failed";
  paidAt?: Date;
}

export interface IPropertyPayment extends Document {
  propertyId: mongoose.Types.ObjectId;
  propertyTitle: string;
  buyerId: mongoose.Types.ObjectId;
  buyerName: string;
  buyerEmail: string;
  plotIds: string[];
  plotDetails: Array<{
    plotId: string;
    price: number;
    size: string;
    coordinates?: string;
  }>;
  totalAmount: number;
  paymentDate: Date;
  paymentMethod: string;
  transactionRef: string;
  transactionId: mongoose.Types.ObjectId;
  status: PaymentStatus;
  commissions: CommissionPayment[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const commissionPaymentSchema = new Schema<CommissionPayment>({
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  referrerName: String,
  referrerEmail: String,
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 3,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
  },
  status: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending",
  },
  paidAt: Date,
});

const propertyPaymentSchema = new Schema<IPropertyPayment>(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    propertyTitle: {
      type: String,
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    buyerName: {
      type: String,
      required: true,
    },
    buyerEmail: {
      type: String,
      required: true,
    },
    plotIds: {
      type: [String],
      required: true,
    },
    plotDetails: [
      {
        plotId: String,
        price: Number,
        size: String,
        coordinates: String,
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["wallet", "card", "bank", "crypto"],
    },
    transactionRef: {
      type: String,
      required: true,
      unique: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    commissions: [commissionPaymentSchema],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
propertyPaymentSchema.index({ propertyId: 1 });
propertyPaymentSchema.index({ buyerId: 1 });
propertyPaymentSchema.index({ status: 1 });
propertyPaymentSchema.index({ paymentDate: 1 });
propertyPaymentSchema.index({ "commissions.referrerId": 1 });

// Virtual for total commission amount
propertyPaymentSchema
  .virtual("totalCommission")
  .get(function (this: IPropertyPayment) {
    return this.commissions.reduce(
      (sum, commission) => sum + commission.amount,
      0
    );
  });

// Virtual for commission percentage
propertyPaymentSchema
  .virtual("commissionPercentage")
  .get(function (this: IPropertyPayment) {
    if (this.totalAmount === 0) return 0;
    const totalCommission = this.commissions.reduce(
      (sum, commission) => sum + commission.amount,
      0
    );
    return (totalCommission / this.totalAmount) * 100;
  });

// Method to get commission summary by level
propertyPaymentSchema.methods.getCommissionSummary = function () {
  const summary = {
    level1: 0,
    level2: 0,
    level3: 0,
    total: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
  };

interface CommissionSummary {
    level1: number;
    level2: number;
    level3: number;
    total: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
}

interface CommissionForEach {
    amount?: number;
    level: number;
    status: "pending" | "paid" | "failed";
}

(this.commissions as CommissionForEach[]).forEach((commission: CommissionForEach) => {
    const amount = commission.amount || 0;

    // Add to level totals
    if (commission.level === 1) summary.level1 += amount;
    else if (commission.level === 2) summary.level2 += amount;
    else if (commission.level === 3) summary.level3 += amount;

    // Add to status counts
    if (commission.status === "paid") summary.paidCount++;
    else if (commission.status === "pending") summary.pendingCount++;
    else if (commission.status === "failed") summary.failedCount++;
});

  summary.total = summary.level1 + summary.level2 + summary.level3;
  return summary;
};

const PropertyPayment =
  mongoose.models.PropertyPayment ||
  mongoose.model<IPropertyPayment>("PropertyPayment", propertyPaymentSchema);

export default PropertyPayment;
