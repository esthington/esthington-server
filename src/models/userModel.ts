import mongoose, { type Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export enum UserRole {
  BUYER = "buyer",
  AGENT = "agent",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
}

export enum AgentRank {
  BRONZE = "Bronze",
  SILVER = "Silver",
  GOLD = "Gold",
  PLATINUM = "Platinum",
  DIAMOND = "Diamond",
  MASTER = "Master",
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLACKLISTED = "blacklisted",
}

export enum Gender {
  MALE = "Male",
  FEMALE = "Female",
  OTHER = "Other",
}

export interface IUser extends Document {
  _id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  address?: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  onboardingCompleted: boolean;
  hasSeenSplash: boolean;
  isActive: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshToken?: string;
  profileImage?: string;
  permissions?: string[];
  referralCode?: string;
  referer?: mongoose.Types.ObjectId | string; // Added referer field
  agentRank?: AgentRank;
  businessName?: string;
  city?: string;
  gender?: Gender;
  country?: string;
  stateOfOrigin?: string;
  validID?: string;
  nextOfKinName?: string;
  nextOfKinAddress?: string;
  nextOfKinPhone?: string;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  securityOTP: string | undefined;
  securityOTPExpiry: Date | undefined;
  securityOTPValidPeriod: Date | undefined;
  comparePassword(enteredPassword: string): Promise<boolean>;
  generateVerificationToken(): { token: string; expires: Date };
  generatePasswordResetToken(): { token: string; expires: Date };
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [false, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [false, "Last name is required"],
      trim: true,
    },
    userName: {
      type: String,
      unique: true,
      required: [true, "userName is required"],
      trim: true,
    },
    avatar: {
      type: String,
      default:
        "https://ferf1mheo22r9ira.public.blob.vercel-storage.com/avatar-02-albo9B0tWOSLXCVZh9rX9KFxXIVWMr.png",
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    address: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.BUYER,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    hasSeenSplash: {
      type: Boolean,
      default: false,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Security OTP fields
    securityOTP: {
      type: String,
    },
    securityOTPExpiry: {
      type: Date,
    },
    securityOTPValidPeriod: {
      type: Date,
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    refreshToken: String,
    profileImage: String,
    referralCode: {
      type: String,
      unique: true,
      sparse: true, // This allows null/undefined values and only enforces uniqueness on actual values
    },
    // Add direct reference to referer
    referer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    agentRank: {
      type: String,
      enum: Object.values(AgentRank),
      default: AgentRank.BRONZE,
    },
    businessName: {
      type: String,
      trim: true,
    },
    // New optional fields from the form
    gender: {
      type: String,
      enum: Object.values(Gender),
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    stateOfOrigin: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    validID: {
      type: String, // Store the file path or URL
    },
    nextOfKinName: {
      type: String,
      trim: true,
    },
    nextOfKinAddress: {
      type: String,
      trim: true,
    },
    nextOfKinPhone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },

    passwordChangedAt: Date,
    lastLogin: Date,
  },

  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  try {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified("password")) {
      return next();
    }

    // Generate a salt
    const salt = await bcrypt.genSalt(10);

    // Hash the password along with the new salt
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("Password hashing failed"));
  }
});

// Set username as referral code for agents
userSchema.pre("save", function (next) {
  // If this is a new agent user, set their username as their referral code
  if (this.isNew && this.role === UserRole.AGENT) {
    this.referralCode = this.userName;
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (
  enteredPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Generate verification token
userSchema.methods.generateVerificationToken = function (): {
  token: string;
  expires: Date;
} {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  this.verificationToken = token;
  this.verificationTokenExpires = expires;

  return { token, expires };
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function (): {
  token: string;
  expires: Date;
} {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

  this.resetPasswordToken = token;
  this.resetPasswordExpires = expires;

  return { token, expires };
};

const User = mongoose.model<IUser>("User", userSchema);

export default User;
