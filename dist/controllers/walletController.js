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
exports.updateTransactionStatus = exports.getAllTransactions = exports.getTransactionById = exports.transferMoney = exports.withdrawFromWallet = exports.fundWallet = exports.getTransactions = exports.getWallet = void 0;
const http_status_codes_1 = require("http-status-codes");
const uuid_1 = require("uuid");
const walletModel_1 = require("../models/walletModel");
const userModel_1 = __importDefault(require("../models/userModel"));
const bankAccountModel_1 = __importDefault(require("../models/bankAccountModel"));
const appError_1 = require("../utils/appError");
const asyncHandler_1 = require("../utils/asyncHandler");
const notificationService_1 = __importDefault(require("../services/notificationService"));
const notificationModel_1 = require("../models/notificationModel");
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * @desc    Get user wallet
 * @route   GET /api/wallet
 * @access  Private
 */
exports.getWallet = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    // Find or create wallet
    let wallet = yield walletModel_1.Wallet.findOne({ user: userId });
    if (!wallet) {
        wallet = yield walletModel_1.Wallet.create({
            user: userId,
            balance: 0,
            availableBalance: 0,
            pendingBalance: 0,
        });
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        wallet,
    });
}));
/**
 * @desc    Get user transactions
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
exports.getTransactions = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const { page = "1", limit = "10", type, status, startDate, endDate, } = req.query;
    // Build query
    const query = { user: userId };
    if (type)
        query.type = type;
    if (status)
        query.status = status;
    // Date range
    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };
    }
    // Pagination
    const pageNum = Number.parseInt(page, 10);
    const limitNum = Number.parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    // Get transactions
    const transactions = yield walletModel_1.Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("recipient sender property investment", "firstName lastName email title");
    // Get total count
    const total = yield walletModel_1.Transaction.countDocuments(query);
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: transactions.length,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        transactions,
    });
}));
/**
 * @desc    Fund user wallet
 * @route   POST /api/wallet/fund
 * @access  Private
 */
exports.fundWallet = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const { amount, reference, paymentMethod } = req.body;
    if (!amount || amount < 100) {
        return next(new appError_1.AppError("Amount must be at least 100", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    if (!reference) {
        return next(new appError_1.AppError("Transaction reference is required", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Check if transaction already exists
    const existingTransaction = yield walletModel_1.Transaction.findOne({ reference });
    if (existingTransaction) {
        return next(new appError_1.AppError("Transaction already processed", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Find or create wallet
    let wallet = yield walletModel_1.Wallet.findOne({ user: userId });
    if (!wallet) {
        wallet = yield walletModel_1.Wallet.create({
            user: userId,
            balance: 0,
            availableBalance: 0,
            pendingBalance: 0,
        });
    }
    // Create transaction
    const transaction = yield walletModel_1.Transaction.create({
        user: userId,
        type: walletModel_1.TransactionType.DEPOSIT,
        amount,
        status: walletModel_1.TransactionStatus.COMPLETED,
        reference,
        description: `Wallet funding via ${paymentMethod || "direct deposit"}`,
        paymentMethod: paymentMethod || walletModel_1.PaymentMethod.WALLET,
    });
    // Update wallet balance
    wallet.balance += amount;
    wallet.availableBalance += amount;
    yield wallet.save();
    // Create notification
    yield notificationService_1.default.createNotification(userId.toString(), "Wallet Funded", `Your wallet has been credited with ₦${amount.toLocaleString()}.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/my-transactions", { transactionId: transaction._id });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Wallet funded successfully",
        transaction,
        wallet,
    });
}));
/**
 * @desc    Withdraw from wallet
 * @route   POST /api/wallet/withdraw
 * @access  Private
 */
exports.withdrawFromWallet = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const { amount, bankAccountId, note } = req.body;
    if (!amount || amount < 100) {
        return next(new appError_1.AppError("Amount must be at least 100", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Find bank account
    const bankAccount = yield bankAccountModel_1.default.findOne({
        _id: bankAccountId,
        user: userId,
    });
    if (!bankAccount) {
        return next(new appError_1.AppError("Bank account not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Find wallet
    const wallet = yield walletModel_1.Wallet.findOne({ user: userId });
    if (!wallet) {
        return next(new appError_1.AppError("Wallet not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Check if wallet has sufficient balance
    if (wallet.availableBalance < amount) {
        return next(new appError_1.AppError("Insufficient balance", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Generate reference
    const reference = `withdraw_${(0, uuid_1.v4)()}`;
    // Create transaction
    const transaction = yield walletModel_1.Transaction.create({
        user: userId,
        type: walletModel_1.TransactionType.WITHDRAWAL,
        amount,
        status: walletModel_1.TransactionStatus.PENDING,
        reference,
        description: note ||
            `Withdrawal to bank account: ${bankAccount.bankName} - ${bankAccount.accountNumber}`,
        metadata: {
            bankAccount: {
                id: bankAccount._id,
                bankName: bankAccount.bankName,
                accountName: bankAccount.accountName,
                accountNumber: bankAccount.accountNumber,
            },
        },
    });
    // Create notification
    yield notificationService_1.default.createNotification(userId.toString(), "Withdrawal Request Submitted", `Your withdrawal request for ₦${amount.toLocaleString()} has been submitted and is pending approval.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/my-transactions", { transactionId: transaction._id });
    // Update wallet balance
    wallet.availableBalance -= amount;
    wallet.pendingBalance += amount;
    yield wallet.save();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Withdrawal request submitted successfully",
        transaction,
        wallet,
    });
}));
/**
 * @desc    Transfer money to another user
 * @route   POST /api/wallet/transfer
 * @access  Private
 */
exports.transferMoney = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const senderId = req.user._id;
    const { recipientId, amount, note } = req.body;
    if (!amount || amount < 100) {
        return next(new appError_1.AppError("Amount must be at least 100", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    if (senderId.toString() === recipientId) {
        return next(new appError_1.AppError("Cannot transfer to yourself", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Check if recipient exists
    const recipient = yield userModel_1.default.findById(recipientId);
    if (!recipient) {
        return next(new appError_1.AppError("Recipient not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Find sender wallet
    const senderWallet = yield walletModel_1.Wallet.findOne({ user: senderId });
    if (!senderWallet) {
        return next(new appError_1.AppError("Sender wallet not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Check if sender has sufficient balance
    if (senderWallet.availableBalance < amount) {
        return next(new appError_1.AppError("Insufficient balance", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Find or create recipient wallet
    let recipientWallet = yield walletModel_1.Wallet.findOne({ user: recipientId });
    if (!recipientWallet) {
        recipientWallet = yield walletModel_1.Wallet.create({
            user: recipientId,
            balance: 0,
            availableBalance: 0,
            pendingBalance: 0,
        });
    }
    // Generate reference
    const reference = `transfer_${(0, uuid_1.v4)()}`;
    // Create transaction for sender
    const senderTransaction = yield walletModel_1.Transaction.create({
        user: senderId,
        type: walletModel_1.TransactionType.TRANSFER,
        amount,
        status: walletModel_1.TransactionStatus.COMPLETED,
        reference,
        description: note || `Transfer to ${recipient.firstName} ${recipient.lastName}`,
        recipient: recipientId,
    });
    // Create transaction for recipient
    const recipientTransaction = yield walletModel_1.Transaction.create({
        user: recipientId,
        type: walletModel_1.TransactionType.TRANSFER,
        amount,
        status: walletModel_1.TransactionStatus.COMPLETED,
        reference,
        description: note || `Transfer from ${req.user.firstName} ${req.user.lastName}`,
        sender: senderId,
    });
    // Use a transaction to update both wallets atomically
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Update sender wallet
        senderWallet.balance -= amount;
        senderWallet.availableBalance -= amount;
        yield senderWallet.save({ session });
        // Update recipient wallet
        recipientWallet.balance += amount;
        recipientWallet.availableBalance += amount;
        yield recipientWallet.save({ session });
        // Commit the transaction
        yield session.commitTransaction();
    }
    catch (error) {
        // Abort the transaction on error
        yield session.abortTransaction();
        throw error;
    }
    finally {
        // End the session
        session.endSession();
    }
    // Create notification for sender
    yield notificationService_1.default.createNotification(senderId.toString(), "Transfer Successful", `You have successfully transferred ₦${amount.toLocaleString()} to ${recipient.firstName} ${recipient.lastName}.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/my-transactions", { transactionId: senderTransaction._id });
    // Create notification for recipient
    yield notificationService_1.default.createNotification(recipientId.toString(), "Transfer Received", `You have received ₦${amount.toLocaleString()} from ${req.user.firstName} ${req.user.lastName}.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/my-transactions", { transactionId: recipientTransaction._id });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Transfer completed successfully",
        transaction: senderTransaction,
        wallet: senderWallet,
    });
}));
/**
 * @desc    Get transaction by ID
 * @route   GET /api/wallet/transactions/:id
 * @access  Private
 */
exports.getTransactionById = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const { id } = req.params;
    const userId = req.user._id;
    const transaction = yield walletModel_1.Transaction.findOne({
        _id: id,
        user: userId,
    }).populate("recipient sender property investment", "firstName lastName email title");
    if (!transaction) {
        return next(new appError_1.AppError("Transaction not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        transaction,
    });
}));
/**
 * @desc    Admin: Get all transactions
 * @route   GET /api/wallet/admin/transactions
 * @access  Private/Admin
 */
exports.getAllTransactions = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = "1", limit = "10", type, status, userId, startDate, endDate, } = req.query;
    // Build query
    const query = {};
    if (type)
        query.type = type;
    if (status)
        query.status = status;
    if (userId)
        query.user = userId;
    // Date range
    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };
    }
    // Pagination
    const pageNum = Number.parseInt(page, 10);
    const limitNum = Number.parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    // Get transactions
    const transactions = yield walletModel_1.Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("user recipient sender property investment", "firstName lastName email title");
    // Get total count
    const total = yield walletModel_1.Transaction.countDocuments(query);
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: transactions.length,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        transactions,
    });
}));
/**
 * @desc    Admin: Update transaction status
 * @route   PUT /api/wallet/admin/transactions/:id
 * @access  Private/Admin
 */
exports.updateTransactionStatus = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const { id } = req.params;
    const { status, note } = req.body;
    if (!req.user) {
        return res
            .status(400)
            .json({ status: "fail", message: "User not authenticated" });
    }
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    if (!Object.values(walletModel_1.TransactionStatus).includes(status)) {
        return next(new appError_1.AppError("Invalid status", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const transaction = yield walletModel_1.Transaction.findById(id);
    if (!transaction) {
        return next(new appError_1.AppError("Transaction not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    const oldStatus = transaction.status;
    // Update transaction
    transaction.status = status;
    if (note) {
        transaction.metadata = Object.assign(Object.assign({}, transaction.metadata), { adminNote: note });
    }
    yield transaction.save();
    // Handle status change for different transaction types
    if (oldStatus !== status) {
        const user = yield userModel_1.default.findById(transaction.sender);
        const wallet = yield walletModel_1.Wallet.findOne({ user: transaction.sender });
        if (!wallet) {
            return next(new appError_1.AppError("Wallet not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        // For deposits
        if (transaction.type === walletModel_1.TransactionType.DEPOSIT) {
            if (oldStatus === walletModel_1.TransactionStatus.PENDING &&
                status === walletModel_1.TransactionStatus.COMPLETED) {
                // Credit wallet
                wallet.balance += transaction.amount;
                wallet.availableBalance += transaction.amount;
                yield wallet.save();
                // Send notification
                if (user) {
                    yield notificationService_1.default.createNotification(((_b = transaction.sender) === null || _b === void 0 ? void 0 : _b.toString()) || "", "Deposit Completed", `Your deposit of ₦${transaction.amount.toLocaleString()} has been completed.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/my-transactions", { transactionId: transaction._id });
                }
            }
            else if (oldStatus === walletModel_1.TransactionStatus.PENDING &&
                status === walletModel_1.TransactionStatus.FAILED) {
                // Send notification
                if (user) {
                    yield notificationService_1.default.createNotification((_d = (_c = transaction.sender) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : "", "Deposit Failed", `Your deposit of ₦${transaction.amount.toLocaleString()} has failed.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/my-transactions", { transactionId: transaction._id });
                }
            }
        }
        // For withdrawals
        else if (transaction.type === walletModel_1.TransactionType.WITHDRAWAL) {
            if (oldStatus === walletModel_1.TransactionStatus.PENDING &&
                status === walletModel_1.TransactionStatus.COMPLETED) {
                // Update wallet
                wallet.balance -= transaction.amount;
                wallet.pendingBalance -= transaction.amount;
                yield wallet.save();
                // Send notification
                if (user) {
                    yield notificationService_1.default.createNotification(((_f = (_e = transaction.sender) === null || _e === void 0 ? void 0 : _e.toString()) !== null && _f !== void 0 ? _f : ""), "Withdrawal Completed", `Your withdrawal of ₦${transaction.amount.toLocaleString()} has been completed.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/my-transactions", { transactionId: transaction._id });
                }
            }
            else if (oldStatus === walletModel_1.TransactionStatus.PENDING &&
                (status === walletModel_1.TransactionStatus.FAILED ||
                    status === walletModel_1.TransactionStatus.CANCELLED)) {
                // Refund to available balance
                wallet.availableBalance += transaction.amount;
                wallet.pendingBalance -= transaction.amount;
                yield wallet.save();
                // Send notification
                if (user) {
                    yield notificationService_1.default.createNotification(transaction.sender ? transaction.sender.toString() : "", `Withdrawal ${status === walletModel_1.TransactionStatus.FAILED ? "Failed" : "Cancelled"}`, `Your withdrawal of ₦${transaction.amount.toLocaleString()} has been ${status === walletModel_1.TransactionStatus.FAILED ? "failed" : "cancelled"}. The funds have been returned to your wallet.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/my-transactions", { transactionId: transaction._id });
                }
            }
        }
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Transaction status updated successfully",
        transaction,
    });
}));
//# sourceMappingURL=walletController.js.map