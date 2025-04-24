"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processReferralValidator = exports.referralCommissionValidator = exports.marketplaceInterestValidator = exports.marketplaceListingValidator = exports.userInvestmentValidator = exports.investmentPlanValidator = exports.propertyValidator = exports.bankAccountValidator = exports.transferValidator = exports.withdrawValidator = exports.fundWalletValidator = exports.resetPasswordValidator = exports.forgotPasswordValidator = exports.loginValidator = exports.registerValidator = void 0;
const express_validator_1 = require("express-validator");
const userModel_1 = require("../models/userModel");
const walletModel_1 = require("../models/walletModel");
const propertyModel_1 = require("../models/propertyModel");
const investmentModel_1 = require("../models/investmentModel");
const marketplaceModel_1 = require("../models/marketplaceModel");
// Auth validators
exports.registerValidator = [
    (0, express_validator_1.body)("firstName")
        .trim()
        .notEmpty()
        .withMessage("First name is required")
        .isLength({ min: 2, max: 50 })
        .withMessage("First name must be between 2 and 50 characters"),
    (0, express_validator_1.body)("lastName")
        .trim()
        .notEmpty()
        .withMessage("Last name is required")
        .isLength({ min: 2, max: 50 })
        .withMessage("Last name must be between 2 and 50 characters"),
    (0, express_validator_1.body)("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email format")
        .normalizeEmail(),
    (0, express_validator_1.body)("password")
        .trim()
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
    (0, express_validator_1.body)("role").optional().isIn(Object.values(userModel_1.UserRole)).withMessage("Invalid role"),
    (0, express_validator_1.body)("phone")
        .optional()
        .trim()
        .matches(/^\+?[0-9]{10,15}$/)
        .withMessage("Invalid phone number format"),
    (0, express_validator_1.body)("referralCode").optional().trim(),
];
exports.loginValidator = [
    (0, express_validator_1.body)("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email format")
        .normalizeEmail(),
    (0, express_validator_1.body)("password").trim().notEmpty().withMessage("Password is required"),
];
exports.forgotPasswordValidator = [
    (0, express_validator_1.body)("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email format")
        .normalizeEmail(),
];
exports.resetPasswordValidator = [
    (0, express_validator_1.param)("token").trim().notEmpty().withMessage("Token is required"),
    (0, express_validator_1.body)("password")
        .trim()
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
    (0, express_validator_1.body)("confirmPassword")
        .trim()
        .notEmpty()
        .withMessage("Confirm password is required")
        .custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Passwords do not match");
        }
        return true;
    }),
];
// Wallet validators
exports.fundWalletValidator = [
    (0, express_validator_1.body)("amount")
        .isNumeric()
        .withMessage("Amount must be a number")
        .isFloat({ min: 100 })
        .withMessage("Amount must be at least 100"),
    (0, express_validator_1.body)("paymentMethod").isIn(Object.values(walletModel_1.PaymentMethod)).withMessage("Invalid payment method"),
];
exports.withdrawValidator = [
    (0, express_validator_1.body)("amount")
        .isNumeric()
        .withMessage("Amount must be a number")
        .isFloat({ min: 100 })
        .withMessage("Amount must be at least 100"),
    (0, express_validator_1.body)("bankAccount").isMongoId().withMessage("Invalid bank account ID"),
    (0, express_validator_1.body)("note").optional().trim().isLength({ max: 200 }).withMessage("Note cannot exceed 200 characters"),
];
exports.transferValidator = [
    (0, express_validator_1.body)("amount")
        .isNumeric()
        .withMessage("Amount must be a number")
        .isFloat({ min: 100 })
        .withMessage("Amount must be at least 100"),
    (0, express_validator_1.body)("recipientId").isMongoId().withMessage("Invalid recipient ID"),
    (0, express_validator_1.body)("note").optional().trim().isLength({ max: 200 }).withMessage("Note cannot exceed 200 characters"),
];
// Bank account validators
exports.bankAccountValidator = [
    (0, express_validator_1.body)("bankName").trim().notEmpty().withMessage("Bank name is required"),
    (0, express_validator_1.body)("accountName").trim().notEmpty().withMessage("Account name is required"),
    (0, express_validator_1.body)("accountNumber")
        .trim()
        .notEmpty()
        .withMessage("Account number is required")
        .matches(/^[0-9]{10}$/)
        .withMessage("Account number must be 10 digits"),
    (0, express_validator_1.body)("isDefault").optional().isBoolean().withMessage("isDefault must be a boolean"),
];
// Property validators
exports.propertyValidator = [
    (0, express_validator_1.body)("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ min: 5, max: 100 })
        .withMessage("Title must be between 5 and 100 characters"),
    (0, express_validator_1.body)("description")
        .trim()
        .notEmpty()
        .withMessage("Description is required")
        .isLength({ min: 20 })
        .withMessage("Description must be at least 20 characters"),
    (0, express_validator_1.body)("type").isIn(Object.values(propertyModel_1.PropertyType)).withMessage("Invalid property type"),
    (0, express_validator_1.body)("price")
        .isNumeric()
        .withMessage("Price must be a number")
        .isFloat({ min: 0 })
        .withMessage("Price cannot be negative"),
    (0, express_validator_1.body)("location.address").trim().notEmpty().withMessage("Address is required"),
    (0, express_validator_1.body)("location.city").trim().notEmpty().withMessage("City is required"),
    (0, express_validator_1.body)("location.state").trim().notEmpty().withMessage("State is required"),
    (0, express_validator_1.body)("location.country").optional().trim(),
    (0, express_validator_1.body)("location.coordinates").optional(),
    (0, express_validator_1.body)("features.size")
        .isNumeric()
        .withMessage("Size must be a number")
        .isFloat({ min: 0 })
        .withMessage("Size cannot be negative"),
    (0, express_validator_1.body)("features.sizeUnit").isIn(["sqm", "sqft", "acres", "hectares"]).withMessage("Invalid size unit"),
    (0, express_validator_1.body)("features.bedrooms").optional().isInt({ min: 0 }).withMessage("Bedrooms must be a non-negative integer"),
    (0, express_validator_1.body)("features.bathrooms").optional().isInt({ min: 0 }).withMessage("Bathrooms must be a non-negative integer"),
    (0, express_validator_1.body)("features.amenities").optional().isArray().withMessage("Amenities must be an array"),
    (0, express_validator_1.body)("status").optional().isIn(Object.values(propertyModel_1.PropertyStatus)).withMessage("Invalid property status"),
];
// Investment validators
exports.investmentPlanValidator = [
    (0, express_validator_1.body)("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ min: 5, max: 100 })
        .withMessage("Title must be between 5 and 100 characters"),
    (0, express_validator_1.body)("description")
        .trim()
        .notEmpty()
        .withMessage("Description is required")
        .isLength({ min: 20 })
        .withMessage("Description must be at least 20 characters"),
    (0, express_validator_1.body)("type").isIn(Object.values(investmentModel_1.InvestmentType)).withMessage("Invalid investment type"),
    (0, express_validator_1.body)("minimumAmount")
        .isNumeric()
        .withMessage("Minimum amount must be a number")
        .isFloat({ min: 0 })
        .withMessage("Minimum amount cannot be negative"),
    (0, express_validator_1.body)("maximumAmount")
        .isNumeric()
        .withMessage("Maximum amount must be a number")
        .isFloat({ min: 0 })
        .withMessage("Maximum amount cannot be negative")
        .custom((value, { req }) => {
        if (Number.parseFloat(value) <= Number.parseFloat(req.body.minimumAmount)) {
            throw new Error("Maximum amount must be greater than minimum amount");
        }
        return true;
    }),
    (0, express_validator_1.body)("expectedReturn")
        .isNumeric()
        .withMessage("Expected return must be a number")
        .isFloat({ min: 0 })
        .withMessage("Expected return cannot be negative"),
    (0, express_validator_1.body)("returnType").isIn(Object.values(investmentModel_1.ReturnType)).withMessage("Invalid return type"),
    (0, express_validator_1.body)("duration").isInt({ min: 1 }).withMessage("Duration must be at least 1 month"),
    (0, express_validator_1.body)("payoutFrequency").isIn(Object.values(investmentModel_1.PayoutFrequency)).withMessage("Invalid payout frequency"),
    (0, express_validator_1.body)("riskLevel").isInt({ min: 1, max: 5 }).withMessage("Risk level must be between 1 and 5"),
    (0, express_validator_1.body)("startDate")
        .isISO8601()
        .withMessage("Start date must be a valid date")
        .custom((value) => {
        if (new Date(value) < new Date()) {
            throw new Error("Start date cannot be in the past");
        }
        return true;
    }),
    (0, express_validator_1.body)("endDate")
        .isISO8601()
        .withMessage("End date must be a valid date")
        .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startDate)) {
            throw new Error("End date must be after start date");
        }
        return true;
    }),
    (0, express_validator_1.body)("targetAmount")
        .isNumeric()
        .withMessage("Target amount must be a number")
        .isFloat({ min: 0 })
        .withMessage("Target amount cannot be negative"),
];
exports.userInvestmentValidator = [
    (0, express_validator_1.body)("plan").isMongoId().withMessage("Invalid investment plan ID"),
    (0, express_validator_1.body)("amount")
        .isNumeric()
        .withMessage("Amount must be a number")
        .isFloat({ min: 0 })
        .withMessage("Amount cannot be negative"),
];
// Marketplace validators
exports.marketplaceListingValidator = [
    (0, express_validator_1.body)("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ min: 5, max: 100 })
        .withMessage("Title must be between 5 and 100 characters"),
    (0, express_validator_1.body)("description")
        .trim()
        .notEmpty()
        .withMessage("Description is required")
        .isLength({ min: 20 })
        .withMessage("Description must be at least 20 characters"),
    (0, express_validator_1.body)("price")
        .isNumeric()
        .withMessage("Price must be a number")
        .isFloat({ min: 0 })
        .withMessage("Price cannot be negative"),
    (0, express_validator_1.body)("negotiable").optional().isBoolean().withMessage("Negotiable must be a boolean"),
    (0, express_validator_1.body)("type").isIn(Object.values(marketplaceModel_1.ListingType)).withMessage("Invalid listing type"),
    (0, express_validator_1.body)("propertyType").isIn(Object.values(propertyModel_1.PropertyType)).withMessage("Invalid property type"),
    (0, express_validator_1.body)("location.address").trim().notEmpty().withMessage("Address is required"),
    (0, express_validator_1.body)("location.city").trim().notEmpty().withMessage("City is required"),
    (0, express_validator_1.body)("location.state").trim().notEmpty().withMessage("State is required"),
    (0, express_validator_1.body)("features.size")
        .isNumeric()
        .withMessage("Size must be a number")
        .isFloat({ min: 0 })
        .withMessage("Size cannot be negative"),
    (0, express_validator_1.body)("features.sizeUnit").isIn(["sqm", "sqft", "acres", "hectares"]).withMessage("Invalid size unit"),
    (0, express_validator_1.body)("property").optional().isMongoId().withMessage("Invalid property ID"),
];
exports.marketplaceInterestValidator = [
    (0, express_validator_1.body)("listing").isMongoId().withMessage("Invalid listing ID"),
    (0, express_validator_1.body)("message").optional().trim().isLength({ max: 500 }).withMessage("Message cannot exceed 500 characters"),
];
// Referral validators
exports.referralCommissionValidator = [
    (0, express_validator_1.body)("rank").isIn(Object.values(userModel_1.UserRole)).withMessage("Invalid agent rank"),
    (0, express_validator_1.body)("investmentRate")
        .isNumeric()
        .withMessage("Investment rate must be a number")
        .isFloat({ min: 0, max: 100 })
        .withMessage("Investment rate must be between 0 and 100"),
    (0, express_validator_1.body)("propertyRate")
        .isNumeric()
        .withMessage("Property rate must be a number")
        .isFloat({ min: 0, max: 100 })
        .withMessage("Property rate must be between 0 and 100"),
];
exports.processReferralValidator = [
    (0, express_validator_1.body)("referredUserId").isMongoId().withMessage("Invalid referred user ID"),
    (0, express_validator_1.body)("transactionType").isIn(["investment", "property"]).withMessage("Invalid transaction type"),
    (0, express_validator_1.body)("amount")
        .isNumeric()
        .withMessage("Amount must be a number")
        .isFloat({ min: 0 })
        .withMessage("Amount cannot be negative"),
];
//# sourceMappingURL=validators.js.map