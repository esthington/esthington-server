"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDefaultBankAccount = exports.deleteBankAccount = exports.updateBankAccount = exports.addBankAccount = exports.getBankAccounts = void 0;
const http_status_codes_1 = require("http-status-codes");
const bankAccountModel_1 = __importDefault(require("../models/bankAccountModel"));
const appError_1 = require("../utils/appError");
const asyncHandler_1 = require("../utils/asyncHandler");
// Get user bank accounts
exports.getBankAccounts = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const bankAccounts = yield bankAccountModel_1.default.find({ user: userId });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: bankAccounts.length,
        bankAccounts,
    });
}));
// Add bank account
exports.addBankAccount = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const { accountName, accountNumber, bankName, routingNumber, swiftCode, isDefault } = req.body;
    // Check if account number already exists for this user
    const existingAccount = yield bankAccountModel_1.default.findOne({
        user: userId,
        accountNumber,
        bankName,
    });
    if (existingAccount) {
        return next(new appError_1.AppError("Bank account already exists", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Check if this is the first account
    const count = yield bankAccountModel_1.default.countDocuments({ user: userId });
    const shouldBeDefault = count === 0 || isDefault;
    // If this should be the default account, update all other accounts
    if (shouldBeDefault) {
        yield bankAccountModel_1.default.updateMany({ user: userId }, { isDefault: false });
    }
    // Create bank account
    const bankAccount = yield bankAccountModel_1.default.create({
        user: userId,
        accountName,
        accountNumber,
        bankName,
        routingNumber,
        swiftCode,
        isDefault: shouldBeDefault,
    });
    res.status(http_status_codes_1.StatusCodes.CREATED).json({
        success: true,
        bankAccount,
    });
}));
// Update bank account
exports.updateBankAccount = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const { id } = req.params;
    const { accountName, accountNumber, bankName, routingNumber, swiftCode, isDefault } = req.body;
    // Find bank account
    const bankAccount = yield bankAccountModel_1.default.findOne({ _id: id, user: userId });
    if (!bankAccount) {
        return next(new appError_1.AppError("Bank account not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // If setting as default, update all other accounts
    if (isDefault && !bankAccount.isDefault) {
        yield bankAccountModel_1.default.updateMany({ user: userId }, { isDefault: false });
    }
    // Update bank account
    bankAccount.accountName = accountName || bankAccount.accountName;
    bankAccount.accountNumber = accountNumber || bankAccount.accountNumber;
    bankAccount.bankName = bankName || bankAccount.bankName;
    bankAccount.routingNumber = routingNumber || bankAccount.routingNumber;
    bankAccount.swiftCode = swiftCode || bankAccount.swiftCode;
    bankAccount.isDefault = isDefault !== undefined ? isDefault : bankAccount.isDefault;
    yield bankAccount.save();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        bankAccount,
    });
}));
// Delete bank account
exports.deleteBankAccount = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const { id } = req.params;
    // Find bank account
    const bankAccount = yield bankAccountModel_1.default.findOne({ _id: id, user: userId });
    if (!bankAccount) {
        return next(new appError_1.AppError("Bank account not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Delete bank account
    yield bankAccountModel_1.default.deleteOne({ _id: bankAccount._id });
    // If this was the default account, set another account as default
    if (bankAccount.isDefault) {
        const anotherAccount = yield bankAccountModel_1.default.findOne({ user: userId });
        if (anotherAccount) {
            anotherAccount.isDefault = true;
            yield anotherAccount.save();
        }
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Bank account deleted successfully",
    });
}));
// Set default bank account
exports.setDefaultBankAccount = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const { id } = req.params;
    // Find bank account
    const bankAccount = yield bankAccountModel_1.default.findOne({ _id: id, user: userId });
    if (!bankAccount) {
        return next(new appError_1.AppError("Bank account not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Update all other accounts
    yield bankAccountModel_1.default.updateMany({ user: userId }, { isDefault: false });
    // Set this account as default
    bankAccount.isDefault = true;
    yield bankAccount.save();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Default bank account updated successfully",
        bankAccount,
    });
}));
//# sourceMappingURL=bankAccountController.js.map