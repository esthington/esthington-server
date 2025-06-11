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
 * @desc    Get user transactions
 * @route   GET /api/wallet/transactions
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
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
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

    console.log("Total transactions found 2:", transactions);


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


// Get transaction details
export const getTransactionById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {

    console.log("New update");
    
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const { id } = req.params;

    const transaction = await Transaction.findOne({
      _id: id,
      user: req.user._id, // Optional: Only show user’s own transactions
    }).populate(
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


// Approve a transaction
export const approveTransaction = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Always check authentication first
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is admin
    if (user.role !== "admin") {
      return next(
        new AppError(
          "Not authorized to approve transactions",
          StatusCodes.FORBIDDEN
        )
      );
    }

    const { id } = req.params;
    const { notes } = req.body;

    // Find the wallet containing this transaction
    const wallet = await Wallet.findOne({ "transactions._id": id });

    if (!wallet) {
      return next(new AppError("Transaction not found", StatusCodes.NOT_FOUND));
    }

    // Find the transaction in the wallet
    const transactionIndex = wallet.transactions.findIndex(
      (t) => t._id.toString() === id && t.status === TransactionStatus.PENDING
    );

    if (transactionIndex === -1) {
      return next(
        new AppError("Pending transaction not found", StatusCodes.NOT_FOUND)
      );
    }

    const transaction = wallet.transactions[transactionIndex];

    // Update transaction status
    wallet.transactions[transactionIndex].status = TransactionStatus.COMPLETED;
    if (notes) {
      wallet.transactions[
        transactionIndex
      ].description += ` - Admin notes: ${notes}`;
    }

    // Add audit trail
    wallet.transactions[transactionIndex].metadata = {
      ...wallet.transactions[transactionIndex].metadata,
      approvedBy: userId,
      approvedAt: new Date(),
    };

    // Update balances based on transaction type
    if (transaction.type === TransactionType.DEPOSIT) {
      // For deposits, move from pendingBalance to availableBalance
      wallet.pendingBalance -= transaction.amount;
      wallet.availableBalance += transaction.amount;
      wallet.balance += transaction.amount;
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      // For withdrawals, the amount was already deducted from availableBalance
      // Just update the pendingBalance
      wallet.pendingBalance -= transaction.amount;
    } else if (
      transaction.type === TransactionType.INVESTMENT ||
      transaction.type === TransactionType.PROPERTY_PURCHASE
    ) {
      // For investments and property purchases, move from pendingBalance
      wallet.pendingBalance -= transaction.amount;
    }

    await wallet.save();

    // Log the admin action for audit purposes
    console.log(
      `Transaction ${id} approved by admin ${userId} at ${new Date().toISOString()}`
    );

    res.status(200).json({
      status: "success",
      data: wallet.transactions[transactionIndex],
    });
  }
);

// Reject a transaction
export const rejectTransaction = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Always check authentication first
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is admin
    if (user.role !== "admin") {
      return next(
        new AppError(
          "Not authorized to reject transactions",
          StatusCodes.FORBIDDEN
        )
      );
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return next(
        new AppError("Rejection reason is required", StatusCodes.BAD_REQUEST)
      );
    }

    // Find the wallet containing this transaction
    const wallet = await Wallet.findOne({ "transactions._id": id });

    if (!wallet) {
      return next(new AppError("Transaction not found", StatusCodes.NOT_FOUND));
    }

    // Find the transaction in the wallet
    const transactionIndex = wallet.transactions.findIndex(
      (t) => t._id.toString() === id && t.status === TransactionStatus.PENDING
    );

    if (transactionIndex === -1) {
      return next(
        new AppError("Pending transaction not found", StatusCodes.NOT_FOUND)
      );
    }

    const transaction = wallet.transactions[transactionIndex];

    // Update transaction status
    wallet.transactions[transactionIndex].status = TransactionStatus.FAILED;
    wallet.transactions[
      transactionIndex
    ].description += ` - Rejected: ${reason}`;

    // Add audit trail
    wallet.transactions[transactionIndex].metadata = {
      ...wallet.transactions[transactionIndex].metadata,
      rejectedBy: userId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    };

    // Update balances based on transaction type
    if (transaction.type === TransactionType.DEPOSIT) {
      // For deposits, just reduce pendingBalance
      wallet.pendingBalance -= transaction.amount;
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      // For withdrawals, restore the amount to availableBalance and reduce pendingBalance
      wallet.availableBalance += transaction.amount;
      wallet.pendingBalance -= transaction.amount;
    } else if (
      transaction.type === TransactionType.INVESTMENT ||
      transaction.type === TransactionType.PROPERTY_PURCHASE
    ) {
      // For investments and property purchases, restore to availableBalance
      wallet.availableBalance += transaction.amount;
      wallet.pendingBalance -= transaction.amount;
    }

    await wallet.save();

    // Log the admin action for audit purposes
    console.log(
      `Transaction ${id} rejected by admin ${userId} at ${new Date().toISOString()}: ${reason}`
    );

    res.status(200).json({
      status: "success",
      data: wallet.transactions[transactionIndex],
    });
  }
);

// Get transaction statistics
export const getTransactionStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Always check authentication first
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is admin
    if (user.role !== "admin") {
      return next(
        new AppError(
          "Not authorized to access transaction statistics",
          StatusCodes.FORBIDDEN
        )
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

    const stats = await Wallet.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.date": dateFilter } },
      {
        $group: {
          _id: "$transactions.type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$transactions.amount" },
          avgAmount: { $avg: "$transactions.amount" },
          minAmount: { $min: "$transactions.amount" },
          maxAmount: { $max: "$transactions.amount" },
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

    // Get status statistics
    const statusStats = await Wallet.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.date": dateFilter } },
      {
        $group: {
          _id: "$transactions.status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$transactions.amount" },
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

    // Get time series data
    const timeSeriesData = await Wallet.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.date": dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: "$transactions.date" },
            month: { $month: "$transactions.date" },
            day: { $dayOfMonth: "$transactions.date" },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$transactions.amount" },
          depositAmount: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", TransactionType.DEPOSIT] },
                "$transactions.amount",
                0,
              ],
            },
          },
          withdrawalAmount: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", TransactionType.WITHDRAWAL] },
                "$transactions.amount",
                0,
              ],
            },
          },
          investmentAmount: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", TransactionType.INVESTMENT] },
                "$transactions.amount",
                0,
              ],
            },
          },
          propertyPurchaseAmount: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$transactions.type",
                    TransactionType.PROPERTY_PURCHASE,
                  ],
                },
                "$transactions.amount",
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

    // Get payment method statistics
    const paymentMethodStats = await Wallet.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.date": dateFilter,
          "transactions.paymentMethod": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$transactions.paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$transactions.amount" },
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

    res.status(200).json({
      status: "success",
      data: {
        byType: stats,
        byStatus: statusStats,
        byPaymentMethod: paymentMethodStats,
        timeSeries: timeSeriesData,
      },
    });
  }
);
