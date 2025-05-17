import mongoose, { type Document, Schema } from "mongoose";
import { InvestmentStatus } from "./investmentModel";

export interface IUserInvestment extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  investmentId: mongoose.Types.ObjectId;
  amount: number;
  status: InvestmentStatus;
  startDate: Date;
  endDate: Date;
  expectedReturn: number;
  actualReturn: number;
  nextPayoutDate?: Date;
  payouts: {
    date: Date;
    amount: number;
    status: "pending" | "paid" | "failed";
    transactionId?: mongoose.Types.ObjectId;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const userInvestmentSchema = new Schema<IUserInvestment>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    investmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investment",
      required: true,
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
        transactionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Transaction",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Calculate total payouts
userInvestmentSchema.virtual("totalPayouts").get(function () {
  return this.payouts.reduce((total, payout) => {
    return payout.status === "paid" ? total + payout.amount : total;
  }, 0);
});

// Calculate remaining payouts
userInvestmentSchema.virtual("remainingPayouts").get(function () {
  return Math.max(0, this.expectedReturn - this.actualReturn);
});

// Populate user and investment details on find
userInvestmentSchema.pre(/^find/, function (next) {
  (this as mongoose.Query<any, any>)
    .populate({
      path: "userId",
      select: "firstName lastName userName avatar email",
    })
    .populate({
      path: "investmentId",
      select: "title propertyId returnRate duration payoutFrequency",
    });
  next();
});

// Set toJSON option to include virtuals
userInvestmentSchema.set("toJSON", { virtuals: true });
userInvestmentSchema.set("toObject", { virtuals: true });

const UserInvestment =
  mongoose.models.UserInvestment ||
  mongoose.model<IUserInvestment>("UserInvestment", userInvestmentSchema);

export default UserInvestment;
