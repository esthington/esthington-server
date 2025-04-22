import Joi from "joi"
import { UserRole } from "../models/userModel"

export const registerSchema = Joi.object({
  firstName: Joi.string().required().trim().min(2).max(50).messages({
    "string.empty": "First name is required",
    "string.min": "First name must be at least 2 characters",
    "string.max": "First name cannot exceed 50 characters",
  }),
  lastName: Joi.string().required().trim().min(2).max(50).messages({
    "string.empty": "Last name is required",
    "string.min": "Last name must be at least 2 characters",
    "string.max": "Last name cannot exceed 50 characters",
  }),
  email: Joi.string().required().email().trim().lowercase().messages({
    "string.empty": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  password: Joi.string()
    .required()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
  confirmPassword: Joi.string().required().valid(Joi.ref("password")).messages({
    "string.empty": "Please confirm your password",
    "any.only": "Passwords do not match",
  }),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .default(UserRole.BUYER),
  phoneNumber: Joi.string().allow("").optional(),
})

export const loginSchema = Joi.object({
  email: Joi.string().required().email().trim().lowercase().messages({
    "string.empty": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
  }),
})

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().required().email().trim().lowercase().messages({
    "string.empty": "Email is required",
    "string.email": "Please provide a valid email",
  }),
})

export const resetPasswordSchema = Joi.object({
  password: Joi.string()
    .required()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
  confirmPassword: Joi.string().required().valid(Joi.ref("password")).messages({
    "string.empty": "Please confirm your password",
    "any.only": "Passwords do not match",
  }),
})

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).messages({
    "string.min": "First name must be at least 2 characters",
    "string.max": "First name cannot exceed 50 characters",
  }),
  lastName: Joi.string().trim().min(2).max(50).messages({
    "string.min": "Last name must be at least 2 characters",
    "string.max": "Last name cannot exceed 50 characters",
  }),
  phoneNumber: Joi.string().allow("").optional(),
})

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "string.empty": "Current password is required",
  }),
  newPassword: Joi.string()
    .required()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .messages({
      "string.empty": "New password is required",
      "string.min": "New password must be at least 8 characters",
      "string.pattern.base":
        "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
  confirmPassword: Joi.string().required().valid(Joi.ref("newPassword")).messages({
    "string.empty": "Please confirm your new password",
    "any.only": "New passwords do not match",
  }),
})
