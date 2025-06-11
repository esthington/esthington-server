import mongoose, { type Document, Schema } from "mongoose";

export enum InvestmentStatus {
  DRAFT = "draft",
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
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

export enum InvestmentType {
  REAL_ESTATE = "real_estate",
  AGRICULTURE = "agriculture",
  BUSINESS = "business",
  STOCKS = "stocks",
}

export interface IInvestment extends Document {
  _id: string;
  title: string;
  description: string;
  propertyId: mongoose.Types.ObjectId;
  minimumInvestment: number;
  targetAmount: number;
  raisedAmount: number;
  returnRate: number;
  returnType: ReturnType;
  investmentPeriod: number; // in months
  payoutFrequency: PayoutFrequency;
  startDate: Date;
  endDate: Date;
  status: InvestmentStatus;
  type: InvestmentType;
  featured: boolean;
  trending: boolean;
  investors: {
    userId: mongoose.Types.ObjectId;
    amount: number;
    date: Date;
    planName?: string;
    selectedDuration?: string;
    durationMonths?: number;
    payoutDate?: Date;
    isPaid?: boolean;
    amountPaid?: number;
    transactionRef?: string;
    notes?: string;
  }[];
  totalInvestors: number;
  documents: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  maxInvestors?: number;
  investmentPlans: {
    name: string;
    minAmount: number;
    returnRate: number;
  }[];
  durations: {
    name: string;
    months: number;
    bonusRate: number;
  }[];
  amenities: string[];
}

const investmentSchema = new Schema<IInvestment>(
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
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property is required"],
    },
    minimumInvestment: {
      type: Number,
      required: [true, "Minimum investment amount is required"],
      min: [0, "Minimum investment cannot be negative"],
    },
    targetAmount: {
      type: Number,
      required: [true, "Target amount is required"],
      min: [0, "Target amount cannot be negative"],
    },
    raisedAmount: {
      type: Number,
      default: 0,
      min: [0, "Raised amount cannot be negative"],
    },
    returnRate: {
      type: Number,
      required: [true, "Return rate is required"],
      min: [0, "Return rate cannot be negative"],
    },
    returnType: {
      type: String,
      enum: Object.values(ReturnType),
      default: ReturnType.FIXED,
    },
    investmentPeriod: {
      type: Number,
      required: [true, "Duration is required"],
      min: [1, "Duration must be at least 1 month"],
    },
    payoutFrequency: {
      type: String,
      enum: Object.values(PayoutFrequency),
      default: PayoutFrequency.MONTHLY,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    status: {
      type: String,
      enum: Object.values(InvestmentStatus),
      default: InvestmentStatus.DRAFT,
    },
    type: {
      type: String,
      enum: Object.values(InvestmentType),
      default: InvestmentType.REAL_ESTATE,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    trending: {
      type: Boolean,
      default: false,
    },
    investors: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: [0, "Investment amount cannot be negative"],
        },
        date: {
          type: Date,
          default: Date.now,
        },
        planName: {
          type: String,
        },
        selectedDuration: {
          type: String,
        },
        durationMonths: {
          type: Number,
        },
        payoutDate: {
          type: Date, // When the payout is due or was paid
        },
        isPaid: {
          type: Boolean,
          default: false, // If the payout has been made
        },
        amountPaid: {
          type: Number,
          default: 0, // Can reflect actual amount paid
        },
        transactionRef: {
          type: String, // Optional: Track payout reference
        },
        notes: {
          type: String, // Optional notes for internal tracking
        },
      },
    ],

    totalInvestors: {
      type: Number,
      default: 0,
    },
    documents: [String],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    maxInvestors: {
      type: Number,
      min: [1, "Max investors must be at least 1"],
    },
    investmentPlans: [
      {
        name: { type: String, required: true },
        minAmount: { type: Number, required: true },
        returnRate: { type: Number, required: true },
      },
    ],
    durations: [
      {
        name: { type: String, required: true },
        months: { type: Number, required: true },
        bonusRate: { type: Number, required: true },
      },
    ],
    amenities: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for percentage funded
investmentSchema.virtual("percentageFunded").get(function () {
  return this.targetAmount > 0
    ? Math.min(100, (this.raisedAmount / this.targetAmount) * 100)
    : 0;
});

// Virtual for remaining amount
investmentSchema.virtual("remainingAmount").get(function () {
  return Math.max(0, this.targetAmount - this.raisedAmount);
});

// Update total investors and raised amount before save
investmentSchema.pre("save", function (next) {
  if (this.investors) {
    this.totalInvestors = this.investors.length;
    this.raisedAmount = this.investors.reduce(
      (total, investor) => total + investor.amount,
      0
    );
  }
  next();
});

// Populate property and creator details on find
investmentSchema.pre(/^find/, function (next) {
  (this as mongoose.Query<any, any>)
    .populate({
      path: "propertyId",
      select: "title location type thumbnail",
    })
    .populate({
      path: "createdBy",
      select: "firstName lastName userName avatar role",
    });
  next();
});

// Set toJSON and toObject to include virtuals
investmentSchema.set("toJSON", { virtuals: true });
investmentSchema.set("toObject", { virtuals: true });

// Create text index for search
investmentSchema.index({ title: "text", description: "text" });

const Investment =
  mongoose.models.Investment ||
  mongoose.model<IInvestment>("Investment", investmentSchema);

export default Investment;
