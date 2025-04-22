import { body, param } from "express-validator"
import { UserRole } from "../models/userModel"
import { PaymentMethod } from "../models/walletModel"
import { PropertyType, PropertyStatus } from "../models/propertyModel"
import { InvestmentType, ReturnType, PayoutFrequency } from "../models/investmentModel"
import { ListingType } from "../models/marketplaceModel"

// Auth validators
export const registerValidator = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    ),
  body("role").optional().isIn(Object.values(UserRole)).withMessage("Invalid role"),
  body("phone")
    .optional()
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Invalid phone number format"),
  body("referralCode").optional().trim(),
]

export const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("password").trim().notEmpty().withMessage("Password is required"),
]

export const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
]

export const resetPasswordValidator = [
  param("token").trim().notEmpty().withMessage("Token is required"),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    ),
  body("confirmPassword")
    .trim()
    .notEmpty()
    .withMessage("Confirm password is required")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match")
      }
      return true
    }),
]

// Wallet validators
export const fundWalletValidator = [
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 100 })
    .withMessage("Amount must be at least 100"),
  body("paymentMethod").isIn(Object.values(PaymentMethod)).withMessage("Invalid payment method"),
]

export const withdrawValidator = [
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 100 })
    .withMessage("Amount must be at least 100"),
  body("bankAccount").isMongoId().withMessage("Invalid bank account ID"),
  body("note").optional().trim().isLength({ max: 200 }).withMessage("Note cannot exceed 200 characters"),
]

export const transferValidator = [
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 100 })
    .withMessage("Amount must be at least 100"),
  body("recipientId").isMongoId().withMessage("Invalid recipient ID"),
  body("note").optional().trim().isLength({ max: 200 }).withMessage("Note cannot exceed 200 characters"),
]

// Bank account validators
export const bankAccountValidator = [
  body("bankName").trim().notEmpty().withMessage("Bank name is required"),
  body("accountName").trim().notEmpty().withMessage("Account name is required"),
  body("accountNumber")
    .trim()
    .notEmpty()
    .withMessage("Account number is required")
    .matches(/^[0-9]{10}$/)
    .withMessage("Account number must be 10 digits"),
  body("isDefault").optional().isBoolean().withMessage("isDefault must be a boolean"),
]

// Property validators
export const propertyValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5, max: 100 })
    .withMessage("Title must be between 5 and 100 characters"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 20 })
    .withMessage("Description must be at least 20 characters"),
  body("type").isIn(Object.values(PropertyType)).withMessage("Invalid property type"),
  body("price")
    .isNumeric()
    .withMessage("Price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Price cannot be negative"),
  body("location.address").trim().notEmpty().withMessage("Address is required"),
  body("location.city").trim().notEmpty().withMessage("City is required"),
  body("location.state").trim().notEmpty().withMessage("State is required"),
  body("location.country").optional().trim(),
  body("location.coordinates").optional(),
  body("features.size")
    .isNumeric()
    .withMessage("Size must be a number")
    .isFloat({ min: 0 })
    .withMessage("Size cannot be negative"),
  body("features.sizeUnit").isIn(["sqm", "sqft", "acres", "hectares"]).withMessage("Invalid size unit"),
  body("features.bedrooms").optional().isInt({ min: 0 }).withMessage("Bedrooms must be a non-negative integer"),
  body("features.bathrooms").optional().isInt({ min: 0 }).withMessage("Bathrooms must be a non-negative integer"),
  body("features.amenities").optional().isArray().withMessage("Amenities must be an array"),
  body("status").optional().isIn(Object.values(PropertyStatus)).withMessage("Invalid property status"),
]

// Investment validators
export const investmentPlanValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5, max: 100 })
    .withMessage("Title must be between 5 and 100 characters"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 20 })
    .withMessage("Description must be at least 20 characters"),
  body("type").isIn(Object.values(InvestmentType)).withMessage("Invalid investment type"),
  body("minimumAmount")
    .isNumeric()
    .withMessage("Minimum amount must be a number")
    .isFloat({ min: 0 })
    .withMessage("Minimum amount cannot be negative"),
  body("maximumAmount")
    .isNumeric()
    .withMessage("Maximum amount must be a number")
    .isFloat({ min: 0 })
    .withMessage("Maximum amount cannot be negative")
    .custom((value, { req }) => {
      if (Number.parseFloat(value) <= Number.parseFloat(req.body.minimumAmount)) {
        throw new Error("Maximum amount must be greater than minimum amount")
      }
      return true
    }),
  body("expectedReturn")
    .isNumeric()
    .withMessage("Expected return must be a number")
    .isFloat({ min: 0 })
    .withMessage("Expected return cannot be negative"),
  body("returnType").isIn(Object.values(ReturnType)).withMessage("Invalid return type"),
  body("duration").isInt({ min: 1 }).withMessage("Duration must be at least 1 month"),
  body("payoutFrequency").isIn(Object.values(PayoutFrequency)).withMessage("Invalid payout frequency"),
  body("riskLevel").isInt({ min: 1, max: 5 }).withMessage("Risk level must be between 1 and 5"),
  body("startDate")
    .isISO8601()
    .withMessage("Start date must be a valid date")
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error("Start date cannot be in the past")
      }
      return true
    }),
  body("endDate")
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error("End date must be after start date")
      }
      return true
    }),
  body("targetAmount")
    .isNumeric()
    .withMessage("Target amount must be a number")
    .isFloat({ min: 0 })
    .withMessage("Target amount cannot be negative"),
]

export const userInvestmentValidator = [
  body("plan").isMongoId().withMessage("Invalid investment plan ID"),
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 0 })
    .withMessage("Amount cannot be negative"),
]

// Marketplace validators
export const marketplaceListingValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5, max: 100 })
    .withMessage("Title must be between 5 and 100 characters"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 20 })
    .withMessage("Description must be at least 20 characters"),
  body("price")
    .isNumeric()
    .withMessage("Price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Price cannot be negative"),
  body("negotiable").optional().isBoolean().withMessage("Negotiable must be a boolean"),
  body("type").isIn(Object.values(ListingType)).withMessage("Invalid listing type"),
  body("propertyType").isIn(Object.values(PropertyType)).withMessage("Invalid property type"),
  body("location.address").trim().notEmpty().withMessage("Address is required"),
  body("location.city").trim().notEmpty().withMessage("City is required"),
  body("location.state").trim().notEmpty().withMessage("State is required"),
  body("features.size")
    .isNumeric()
    .withMessage("Size must be a number")
    .isFloat({ min: 0 })
    .withMessage("Size cannot be negative"),
  body("features.sizeUnit").isIn(["sqm", "sqft", "acres", "hectares"]).withMessage("Invalid size unit"),
  body("property").optional().isMongoId().withMessage("Invalid property ID"),
]

export const marketplaceInterestValidator = [
  body("listing").isMongoId().withMessage("Invalid listing ID"),
  body("message").optional().trim().isLength({ max: 500 }).withMessage("Message cannot exceed 500 characters"),
]

// Referral validators
export const referralCommissionValidator = [
  body("rank").isIn(Object.values(UserRole)).withMessage("Invalid agent rank"),
  body("investmentRate")
    .isNumeric()
    .withMessage("Investment rate must be a number")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Investment rate must be between 0 and 100"),
  body("propertyRate")
    .isNumeric()
    .withMessage("Property rate must be a number")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Property rate must be between 0 and 100"),
]

export const processReferralValidator = [
  body("referredUserId").isMongoId().withMessage("Invalid referred user ID"),
  body("transactionType").isIn(["investment", "property"]).withMessage("Invalid transaction type"),
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .isFloat({ min: 0 })
    .withMessage("Amount cannot be negative"),
]
