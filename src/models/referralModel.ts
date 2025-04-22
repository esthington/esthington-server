import mongoose, { type Document, Schema } from "mongoose"
import { AgentRank } from "./userModel"

export enum ReferralStatus {
  PENDING = "pending",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface IReferral extends Document {
  referrer: mongoose.Types.ObjectId
  referred: mongoose.Types.ObjectId
  status: ReferralStatus
  earnings: number
  createdAt: Date
  updatedAt: Date
}

const referralSchema = new Schema<IReferral>(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Referrer is required"],
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
  },
  {
    timestamps: true,
  },
)

export interface IReferralCommission extends Document {
  rank: AgentRank
  investmentRate: number
  propertyRate: number
  createdAt: Date
  updatedAt: Date
}

const referralCommissionSchema = new Schema<IReferralCommission>(
  {
    rank: {
      type: String,
      enum: Object.values(AgentRank),
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
  },
  {
    timestamps: true,
  },
)

export const Referral = mongoose.model<IReferral>("Referral", referralSchema)
export const ReferralCommission = mongoose.model<IReferralCommission>("ReferralCommission", referralCommissionSchema)
