"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.updateProfileSchema = exports.userSchema = exports.refreshTokenSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerAgentSchema = exports.registerBuyerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const userModel_1 = require("../models/userModel");
// Common validation patterns
const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
const phonePattern = /^\+?[0-9]{10,15}$/;
// Base user schema with common fields
const baseUserSchema = {
    firstName: joi_1.default.string().trim().min(2).max(50),
    lastName: joi_1.default.string().trim().min(2).max(50),
    userName: joi_1.default.string().trim().min(3).max(30).required().messages({
        "string.pattern.base": "Username can only contain alphanumeric characters and underscores",
        "string.empty": "Username is required",
        "any.required": "Username is required",
    }),
    email: joi_1.default.string().trim().email().required().messages({
        "string.email": "Please provide a valid email address",
        "string.empty": "Email is required",
        "any.required": "Email is required",
    }),
    password: joi_1.default.string().min(8).required().pattern(passwordPattern).messages({
        "string.pattern.base": "Password must be at least 8 characters and include uppercase, lowercase, number and special character",
        "string.min": "Password must be at least 8 characters",
        "string.empty": "Password is required",
        "any.required": "Password is required",
    }),
    phone: joi_1.default.string().pattern(phonePattern).messages({
        "string.pattern.base": "Please provide a valid phone number",
    }),
    address: joi_1.default.string().trim().max(200),
    role: joi_1.default.string().valid(...Object.values(userModel_1.UserRole)),
    isEmailVerified: joi_1.default.boolean(),
    isActive: joi_1.default.boolean(),
    verificationToken: joi_1.default.string(),
    verificationTokenExpires: joi_1.default.date(),
    resetPasswordToken: joi_1.default.string(),
    resetPasswordExpires: joi_1.default.date(),
    refreshToken: joi_1.default.string(),
    profileImage: joi_1.default.string().uri(),
    permissions: joi_1.default.array().items(joi_1.default.string()),
    referralCode: joi_1.default.string().trim().optional(),
    referer: joi_1.default.string().trim().optional(), // Added referer field
    agentRank: joi_1.default.string().valid(...Object.values(userModel_1.AgentRank)),
    passwordChangedAt: joi_1.default.date(),
    lastLogin: joi_1.default.date(),
};
// Registration validation schemas
exports.registerBuyerSchema = joi_1.default.object({
    userName: baseUserSchema.userName,
    email: baseUserSchema.email,
    password: baseUserSchema.password,
    confirmPassword: joi_1.default.string().valid(joi_1.default.ref("password")).required().messages({
        "any.only": "Passwords do not match",
        "any.required": "Please confirm your password",
    }),
    referralCode: joi_1.default.string().trim().allow("", null).optional(),
    referer: joi_1.default.string().trim().optional(), // Added referer field for direct ObjectId
});
exports.registerAgentSchema = joi_1.default.object({
    userName: baseUserSchema.userName,
    email: baseUserSchema.email,
    password: baseUserSchema.password,
    confirmPassword: joi_1.default.string().valid(joi_1.default.ref("password")).required().messages({
        "any.only": "Passwords do not match",
        "any.required": "Please confirm your password",
    }),
    referralCode: joi_1.default.string().trim().allow("", null).optional(),
    referer: joi_1.default.string().trim().optional(), // Added referer field for direct ObjectId
});
// Login validation schema
exports.loginSchema = joi_1.default.object({
    email: baseUserSchema.email,
    password: joi_1.default.string().required().messages({
        "any.required": "Password is required",
        "string.empty": "Password is required",
    }),
});
// Password reset validation schemas
exports.forgotPasswordSchema = joi_1.default.object({
    email: baseUserSchema.email,
});
exports.resetPasswordSchema = joi_1.default.object({
    password: baseUserSchema.password,
    confirmPassword: joi_1.default.string().valid(joi_1.default.ref("password")).required().messages({
        "any.only": "Passwords do not match",
        "any.required": "Please confirm your password",
    }),
});
// Refresh token validation schema
exports.refreshTokenSchema = joi_1.default.object({
    refreshToken: joi_1.default.string().required().messages({
        "any.required": "Refresh token is required",
        "string.empty": "Refresh token cannot be empty",
    }),
});
// Complete user schema (for admin operations or full updates)
exports.userSchema = joi_1.default.object(baseUserSchema);
// Profile update schema (for users updating their own profile)
exports.updateProfileSchema = joi_1.default.object({
    firstName: baseUserSchema.firstName,
    lastName: baseUserSchema.lastName,
    phone: baseUserSchema.phone,
    address: baseUserSchema.address,
    profileImage: baseUserSchema.profileImage,
});
// Change password schema
exports.changePasswordSchema = joi_1.default.object({
    currentPassword: joi_1.default.string().required().messages({
        "any.required": "Current password is required",
        "string.empty": "Current password is required",
    }),
    newPassword: baseUserSchema.password,
    confirmPassword: joi_1.default.string()
        .valid(joi_1.default.ref("newPassword"))
        .required()
        .messages({
        "any.only": "Passwords do not match",
        "any.required": "Please confirm your new password",
    }),
});
//# sourceMappingURL=userValidation.js.map