import mongoose, { type Document, Schema } from "mongoose";
import { AgentRank } from "./userModel";

export enum ReferralStatus {
  PENDING = "pending",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface IReferral extends Document {
  referrer: mongoose.Types.ObjectId;
  referred: mongoose.Types.ObjectId;
  status: ReferralStatus;
  earnings: number;
  level1Earnings: number;
  level2Earnings: number;
  level3Earnings: number;
  totalReferrals: number;
  activeReferrals: number;
  lastActivityDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const referralSchema = new Schema<IReferral>(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Referrer is required"],
      unique: true, // Ensure a user can only refer once
    },
    referred: {
      type: mongoose.Schema.Types.ObjectId,
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
    level1Earnings: {
      type: Number,
      default: 0,
      min: [0, "Level 1 earnings cannot be negative"],
    },
    level2Earnings: {
      type: Number,
      default: 0,
      min: [0, "Level 2 earnings cannot be negative"],
    },
    level3Earnings: {
      type: Number,
      default: 0,
      min: [0, "Level 3 earnings cannot be negative"],
    },
    totalReferrals: {
      type: Number,
      default: 0,
      min: [0, "Total referrals cannot be negative"],
    },
    activeReferrals: {
      type: Number,
      default: 0,
      min: [0, "Active referrals cannot be negative"],
    },
    lastActivityDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ referred: 1 });
referralSchema.index({ earnings: -1 });
referralSchema.index({ createdAt: -1 });

// Virtual for conversion rate
referralSchema.virtual("conversionRate").get(function () {
  return this.totalReferrals > 0
    ? (this.activeReferrals / this.totalReferrals) * 100
    : 0;
});

export interface IReferralCommission extends Document {
  rank: AgentRank;
  level1Rate: number; // Direct referral rate
  level2Rate: number; // Indirect referral rate
  level3Rate: number; // Network bonus rate
  investmentMultiplier: number;
  propertyMultiplier: number;
  createdAt: Date;
  updatedAt: Date;
}

const referralCommissionSchema = new Schema<IReferralCommission>(
  {
    rank: {
      type: String,
      enum: Object.values(AgentRank),
      required: [true, "Agent rank is required"],
      unique: true,
    },
    level1Rate: {
      type: Number,
      required: [true, "Level 1 commission rate is required"],
      min: [0, "Rate cannot be negative"],
      max: [100, "Rate cannot exceed 100%"],
      default: 10, // 10%
    },
    level2Rate: {
      type: Number,
      required: [true, "Level 2 commission rate is required"],
      min: [0, "Rate cannot be negative"],
      max: [100, "Rate cannot exceed 100%"],
      default: 3, // 3%
    },
    level3Rate: {
      type: Number,
      required: [true, "Level 3 commission rate is required"],
      min: [0, "Rate cannot be negative"],
      max: [100, "Rate cannot exceed 100%"],
      default: 1, // 1%
    },
    investmentMultiplier: {
      type: Number,
      default: 1,
      min: [0, "Multiplier cannot be negative"],
    },
    propertyMultiplier: {
      type: Number,
      default: 1,
      min: [0, "Multiplier cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

export const Referral =
  mongoose.models.Referral ||
  mongoose.model<IReferral>("Referral", referralSchema);
export const ReferralCommission =
  mongoose.models.ReferralCommission ||
  mongoose.model<IReferralCommission>(
    "ReferralCommission",
    referralCommissionSchema
  );
