import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import {
  Wallet,
  TransactionType,
  TransactionStatus,
  Transaction,
} from "../models/walletModel";
import User from "../models/userModel";
import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";

/**
 * @desc    Get user's own transactions
 * @route   GET /api/transactions/user
 * @access  Private
 */
export const getAllTransactions = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    // Extract query parameters with default values
    const {
      page = "1",
      limit = "10",
      type,
      status,
      startDate,
      endDate,
    } = req.query;

    // Build query object
    const query: any = { user: userId };

    if (type) query.type = type;
    if (status) query.status = status;

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    // Pagination
    const pageNum = Number.parseInt(page as string, 10);
    const limitNum = Number.parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch transactions
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate(
        "recipient sender property investment",
        "firstName lastName email title"
      );

    // Count total matching documents
    const total = await Transaction.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: transactions.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: transactions,
    });
  }
);

/**
 * @desc    Get all transactions (Admin only)
 * @route   GET /api/transactions
 * @access  Private/Admin
 */
export const getAllTransactionsAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Extract query parameters with default values
    const {
      page = "1",
      limit = "10",
      type,
      status,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query object
    const query: any = {};

    if (type && type !== "all") query.type = type;
    if (status && status !== "all") query.status = status;

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      query.$or = [
        { reference: searchRegex },
        { description: searchRegex },
        {
          _id: mongoose.Types.ObjectId.isValid(search as string)
            ? search
            : null,
        },
      ].filter(Boolean);
    }

    // Pagination
    const pageNum = Number.parseInt(page as string, 10);
    const limitNum = Number.parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    // Fetch transactions with user population
    const transactions = await Transaction.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate("user", "firstName lastName email avatar")
      .populate(
        "recipient sender property investment",
        "firstName lastName email title"
      );

    // Count total matching documents
    const total = await Transaction.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: transactions.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: transactions,
    });
  }
);

/**
 * @desc    Get transaction details
 * @route   GET /api/transactions/:id
 * @access  Private
 */
export const getTransactionById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const { id } = req.params;
    const userId = req.user._id;

    // Get user to check role
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Build query - admins can see all transactions, users only their own
    const query: any = { _id: id };
    if (user.role !== "admin" && user.role !== "super_admin") {
      query.user = userId;
    }

    const transaction = await Transaction.findOne(query)
      .populate("user", "firstName lastName email avatar")
      .populate(
        "recipient sender property investment",
        "firstName lastName email title"
      );

    if (!transaction) {
      return next(new AppError("Transaction not found", StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      status: "success",
      data: transaction,
    });
  }
);

/**
 * @desc    Approve a transaction (Admin only)
 * @route   PATCH /api/transactions/:id/approve
 * @access  Private/Admin
 */
export const approveTransaction = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { id } = req.params;
    const { notes } = req.body;

    // Find the transaction
    const transaction = await Transaction.findOne({
      _id: id,
      status: TransactionStatus.PENDING,
    }).populate("user", "firstName lastName email");

    if (!transaction) {
      return next(
        new AppError("Pending transaction not found", StatusCodes.NOT_FOUND)
      );
    }

    // Find the user's wallet
    const wallet = await Wallet.findOne({ user: transaction.user._id });
    if (!wallet) {
      return next(new AppError("User wallet not found", StatusCodes.NOT_FOUND));
    }

    // Update transaction status
    transaction.status = TransactionStatus.COMPLETED;
    if (notes) {
      transaction.description += ` - Admin notes: ${notes}`;
    }

    // Add audit trail
    transaction.metadata = {
      ...transaction.metadata,
      approvedBy: userId,
      approvedAt: new Date(),
      approvalNotes: notes,
    };

    // Update balances based on transaction type
    if (transaction.type === TransactionType.DEPOSIT) {
      // For deposits, move from pendingBalance to availableBalance
      wallet.pendingBalance = Math.max(
        0,
        wallet.pendingBalance - transaction.amount
      );
      wallet.availableBalance += transaction.amount;
      wallet.balance += transaction.amount;
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      // For withdrawals, the amount was already deducted from availableBalance
      // Just update the pendingBalance
      wallet.pendingBalance = Math.max(
        0,
        wallet.pendingBalance - transaction.amount
      );
    } else if (
      transaction.type === TransactionType.INVESTMENT ||
      transaction.type === TransactionType.PROPERTY_PURCHASE
    ) {
      // For investments and property purchases, move from pendingBalance
      wallet.pendingBalance = Math.max(
        0,
        wallet.pendingBalance - transaction.amount
      );
    }

    // Save both transaction and wallet
    await Promise.all([transaction.save(), wallet.save()]);

    // Log the admin action for audit purposes
    console.log(
      `Transaction ${id} approved by admin ${userId} at ${new Date().toISOString()}`
    );

    res.status(StatusCodes.OK).json({
      status: "success",
      message: "Transaction approved successfully",
      data: transaction,
    });
  }
);

/**
 * @desc    Reject a transaction (Admin only)
 * @route   PATCH /api/transactions/:id/reject
 * @access  Private/Admin
 */
export const rejectTransaction = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return next(
        new AppError("Rejection reason is required", StatusCodes.BAD_REQUEST)
      );
    }

    // Find the transaction
    const transaction = await Transaction.findOne({
      _id: id,
      status: TransactionStatus.PENDING,
    }).populate("user", "firstName lastName email");

    if (!transaction) {
      return next(
        new AppError("Pending transaction not found", StatusCodes.NOT_FOUND)
      );
    }

    // Find the user's wallet
    const wallet = await Wallet.findOne({ user: transaction.user._id });
    if (!wallet) {
      return next(new AppError("User wallet not found", StatusCodes.NOT_FOUND));
    }

    // Update transaction status
    transaction.status = TransactionStatus.FAILED;
    transaction.description += ` - Rejected: ${reason}`;

    // Add audit trail
    transaction.metadata = {
      ...transaction.metadata,
      rejectedBy: userId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    };

    // Update balances based on transaction type
    if (transaction.type === TransactionType.DEPOSIT) {
      // For deposits, just reduce pendingBalance
      wallet.pendingBalance = Math.max(
        0,
        wallet.pendingBalance - transaction.amount
      );
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      // For withdrawals, restore the amount to availableBalance and reduce pendingBalance
      wallet.availableBalance += transaction.amount;
      wallet.pendingBalance = Math.max(
        0,
        wallet.pendingBalance - transaction.amount
      );
    } else if (
      transaction.type === TransactionType.INVESTMENT ||
      transaction.type === TransactionType.PROPERTY_PURCHASE
    ) {
      // For investments and property purchases, restore to availableBalance
      wallet.availableBalance += transaction.amount;
      wallet.pendingBalance = Math.max(
        0,
        wallet.pendingBalance - transaction.amount
      );
    }

    // Save both transaction and wallet
    await Promise.all([transaction.save(), wallet.save()]);

    // Log the admin action for audit purposes
    console.log(
      `Transaction ${id} rejected by admin ${userId} at ${new Date().toISOString()}: ${reason}`
    );

    res.status(StatusCodes.OK).json({
      status: "success",
      message: "Transaction rejected successfully",
      data: transaction,
    });
  }
);

/**
 * @desc    Get transaction statistics (Admin only)
 * @route   GET /api/transactions/stats
 * @access  Private/Admin
 */
export const getTransactionStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const { period = "month" } = req.query;

    let dateFilter: any = {};
    const now = new Date();

    if (period === "day") {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      dateFilter = { $gte: startOfDay };
    } else if (period === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { $gte: startOfWeek };
    } else if (period === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { $gte: startOfMonth };
    } else if (period === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { $gte: startOfYear };
    } else {
      return next(
        new AppError(
          "Invalid period. Use day, week, month, or year",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // Get statistics by type
    const typeStats = await Transaction.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
          minAmount: { $min: "$amount" },
          maxAmount: { $max: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          type: "$_id",
          count: 1,
          totalAmount: 1,
          avgAmount: 1,
          minAmount: 1,
          maxAmount: 1,
        },
      },
    ]);

    // Get statistics by status
    const statusStats = await Transaction.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
          totalAmount: 1,
        },
      },
    ]);

    // Get statistics by payment method
    const paymentMethodStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: dateFilter,
          paymentMethod: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          paymentMethod: "$_id",
          count: 1,
          totalAmount: 1,
        },
      },
    ]);

    // Get time series data
    const timeSeriesData = await Transaction.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          depositAmount: {
            $sum: {
              $cond: [
                { $eq: ["$type", TransactionType.DEPOSIT] },
                "$amount",
                0,
              ],
            },
          },
          withdrawalAmount: {
            $sum: {
              $cond: [
                { $eq: ["$type", TransactionType.WITHDRAWAL] },
                "$amount",
                0,
              ],
            },
          },
          investmentAmount: {
            $sum: {
              $cond: [
                { $eq: ["$type", TransactionType.INVESTMENT] },
                "$amount",
                0,
              ],
            },
          },
          propertyPurchaseAmount: {
            $sum: {
              $cond: [
                {
                  $eq: ["$type", TransactionType.PROPERTY_PURCHASE],
                },
                "$amount",
                0,
              ],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          count: 1,
          totalAmount: 1,
          depositAmount: 1,
          withdrawalAmount: 1,
          investmentAmount: 1,
          propertyPurchaseAmount: 1,
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        byType: typeStats,
        byStatus: statusStats,
        byPaymentMethod: paymentMethodStats,
        timeSeries: timeSeriesData,
      },
    });
  }
);
