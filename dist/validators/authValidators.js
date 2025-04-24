"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.updateProfileSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const userModel_1 = require("../models/userModel");
exports.registerSchema = joi_1.default.object({
    firstName: joi_1.default.string().required().trim().min(2).max(50).messages({
        "string.empty": "First name is required",
        "string.min": "First name must be at least 2 characters",
        "string.max": "First name cannot exceed 50 characters",
    }),
    lastName: joi_1.default.string().required().trim().min(2).max(50).messages({
        "string.empty": "Last name is required",
        "string.min": "Last name must be at least 2 characters",
        "string.max": "Last name cannot exceed 50 characters",
    }),
    email: joi_1.default.string().required().email().trim().lowercase().messages({
        "string.empty": "Email is required",
        "string.email": "Please provide a valid email",
    }),
    password: joi_1.default.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .messages({
        "string.empty": "Password is required",
        "string.min": "Password must be at least 8 characters",
        "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
    confirmPassword: joi_1.default.string().required().valid(joi_1.default.ref("password")).messages({
        "string.empty": "Please confirm your password",
        "any.only": "Passwords do not match",
    }),
    role: joi_1.default.string()
        .valid(...Object.values(userModel_1.UserRole))
        .default(userModel_1.UserRole.BUYER),
    phoneNumber: joi_1.default.string().allow("").optional(),
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().required().email().trim().lowercase().messages({
        "string.empty": "Email is required",
        "string.email": "Please provide a valid email",
    }),
    password: joi_1.default.string().required().messages({
        "string.empty": "Password is required",
    }),
});
exports.forgotPasswordSchema = joi_1.default.object({
    email: joi_1.default.string().required().email().trim().lowercase().messages({
        "string.empty": "Email is required",
        "string.email": "Please provide a valid email",
    }),
});
exports.resetPasswordSchema = joi_1.default.object({
    password: joi_1.default.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .messages({
        "string.empty": "Password is required",
        "string.min": "Password must be at least 8 characters",
        "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
    confirmPassword: joi_1.default.string().required().valid(joi_1.default.ref("password")).messages({
        "string.empty": "Please confirm your password",
        "any.only": "Passwords do not match",
    }),
});
exports.updateProfileSchema = joi_1.default.object({
    firstName: joi_1.default.string().trim().min(2).max(50).messages({
        "string.min": "First name must be at least 2 characters",
        "string.max": "First name cannot exceed 50 characters",
    }),
    lastName: joi_1.default.string().trim().min(2).max(50).messages({
        "string.min": "Last name must be at least 2 characters",
        "string.max": "Last name cannot exceed 50 characters",
    }),
    phoneNumber: joi_1.default.string().allow("").optional(),
});
exports.changePasswordSchema = joi_1.default.object({
    currentPassword: joi_1.default.string().required().messages({
        "string.empty": "Current password is required",
    }),
    newPassword: joi_1.default.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .messages({
        "string.empty": "New password is required",
        "string.min": "New password must be at least 8 characters",
        "string.pattern.base": "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
    confirmPassword: joi_1.default.string().required().valid(joi_1.default.ref("newPassword")).messages({
        "string.empty": "Please confirm your new password",
        "any.only": "New passwords do not match",
    }),
});
//# sourceMappingURL=authValidators.js.map