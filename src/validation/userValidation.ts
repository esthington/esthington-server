import Joi from "joi";
import { UserRole, AgentRank } from "../models/userModel";

// Common validation patterns
const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
const phonePattern = /^\+?[0-9]{10,15}$/;

// Base user schema with common fields
const baseUserSchema = {
  firstName: Joi.string().trim().min(2).max(50),
  lastName: Joi.string().trim().min(2).max(50),
  userName: Joi.string().trim().min(3).max(30).required().messages({
    "string.pattern.base":
      "Username can only contain alphanumeric characters and underscores",
    "string.empty": "Username is required",
    "any.required": "Username is required",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(8).required().pattern(passwordPattern).messages({
    "string.pattern.base":
      "Password must be at least 8 characters and include uppercase, lowercase, number and special character",
    "string.min": "Password must be at least 8 characters",
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
  phone: Joi.string(),
  address: Joi.string().trim().max(200),
  role: Joi.string().valid(...Object.values(UserRole)),
  isEmailVerified: Joi.boolean(),
  isActive: Joi.boolean(),
  verificationToken: Joi.string(),
  verificationTokenExpires: Joi.date(),
  resetPasswordToken: Joi.string(),
  resetPasswordExpires: Joi.date(),
  refreshToken: Joi.string(),
  profileImage: Joi.string().uri(),
  permissions: Joi.array().items(Joi.string()),
  referralCode: Joi.string().trim().optional(),
  referer: Joi.string().trim().optional(), // Added referer field
  agentRank: Joi.string().valid(...Object.values(AgentRank)),
  passwordChangedAt: Joi.date(),
  lastLogin: Joi.date(),
};

// Registration validation schemas
export const registerBuyerSchema = Joi.object({
  userName: baseUserSchema.userName,
  email: baseUserSchema.email,
  password: baseUserSchema.password,
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Please confirm your password",
  }),
  referralCode: Joi.string().trim().allow("", null).optional(),
  referer: Joi.string().trim().optional(), // Added referer field for direct ObjectId
});

export const registerAgentSchema = Joi.object({
  userName: baseUserSchema.userName,
  email: baseUserSchema.email,
  password: baseUserSchema.password,
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Please confirm your password",
  }),
  referralCode: Joi.string().trim().allow("", null).optional(),
  referer: Joi.string().trim().optional(), // Added referer field for direct ObjectId
});

// Login validation schema
export const loginSchema = Joi.object({
  email: baseUserSchema.email,
  password: Joi.string().required().messages({
    "any.required": "Password is required",
    "string.empty": "Password is required",
  }),
});

// Password reset validation schemas
export const forgotPasswordSchema = Joi.object({
  email: baseUserSchema.email,
});

export const resetPasswordSchema = Joi.object({
  password: baseUserSchema.password,
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Please confirm your password",
  }),
});

// Refresh token validation schema
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required",
    "string.empty": "Refresh token cannot be empty",
  }),
});

// Complete user schema (for admin operations or full updates)
export const userSchema = Joi.object(baseUserSchema);

// Profile update schema (for users updating their own profile)
export const updateProfileSchema = Joi.object({
  firstName: baseUserSchema.firstName,
  lastName: baseUserSchema.lastName,
  phone: baseUserSchema.phone,
  address: baseUserSchema.address,
  profileImage: baseUserSchema.profileImage,
});

// Change password schema
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
    "string.empty": "Current password is required",
  }),
  newPassword: baseUserSchema.password,
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Please confirm your new password",
    }),
});
