import mongoose, { type Document, Schema } from "mongoose"

export enum InvestmentType {
  REAL_ESTATE = "real_estate",
  AGRICULTURE = "agriculture",
  BUSINESS = "business",
  STOCKS = "stocks",
}

export enum InvestmentStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  PENDING = "pending",
}

export enum ReturnType {
  FIXED = "fixed",
  VARIABLE = "variable",
  PROFIT_SHARING = "profit_sharing",
}

export enum PayoutFrequency {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUALLY = "semi_annually",
  ANNUALLY = "annually",
  END_OF_TERM = "end_of_term",
}

export interface IInvestmentPlan extends Document {
  _id: string
  title: string
  description: string
  type: InvestmentType
  minimumAmount: number
  maximumAmount: number
  expectedReturn: number
  returnType: ReturnType
  duration: number // in months
  payoutFrequency: PayoutFrequency
  riskLevel: number // 1-5 (low to high)
  isActive: boolean
  startDate: Date
  endDate: Date
  totalRaised: number
  targetAmount: number
  creator: mongoose.Types.ObjectId
  images: string[]
  documents: string[]
  location?: {
    address?: string
    city?: string
    state?: string
    country?: string
  }
  createdAt: Date
  updatedAt: Date
}

const investmentPlanSchema = new Schema<IInvestmentPlan>(
  {
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
      type: mongoose.Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  },
)

export interface IUserInvestment extends Document {
  user: mongoose.Types.ObjectId;
  plan: mongoose.Types.ObjectId;
  amount: number;
  status: InvestmentStatus;
  rejectionReason: string;
  startDate: Date;
  endDate: Date;
  expectedReturn: number;
  actualReturn: number;
  nextPayoutDate?: Date;
  payouts: {
    date: Date;
    amount: number;
    status: "pending" | "paid" | "failed";
    transaction?: mongoose.Types.ObjectId;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const userInvestmentSchema = new Schema<IUserInvestment>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
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

export const InvestmentPlan = mongoose.model<IInvestmentPlan>("InvestmentPlan", investmentPlanSchema)
export const UserInvestment = mongoose.model<IUserInvestment>("UserInvestment", userInvestmentSchema)
