import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import {
  Wallet,
  Transaction,
  TransactionType,
  TransactionStatus,
  TransactionCheck,
} from "../models/walletModel";
import BankAccount from "../models/bankAccountModel";
import User from "../models/userModel";
import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import notificationService from "../services/notificationService";
import { v4 as uuidv4 } from "uuid";
import { NotificationType } from "../models/notificationModel";

/**
 * @desc    Create withdrawal request
 * @route   POST /api/withdrawals
 * @access  Private
 */

export const createWithdrawalRequest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { amount, bankAccountId, note } = req.body;

    // Validation: amount must be at least 100
    if (!amount || amount < 100) {
      return next(
        new AppError("Amount must be at least ₦100", StatusCodes.BAD_REQUEST)
      );
    }

    // Validation: bank account ID must be provided
    if (!bankAccountId) {
      return next(
        new AppError("Please select a bank account", StatusCodes.BAD_REQUEST)
      );
    }

    // Find the user's wallet
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return next(new AppError("Wallet not found", StatusCodes.NOT_FOUND));
    }

    // Check if wallet has enough available balance
    if (wallet.availableBalance < amount) {
      return next(
        new AppError("Insufficient balance", StatusCodes.BAD_REQUEST)
      );
    }

    // Find and validate the bank account
    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      user: userId,
    });

    if (!bankAccount) {
      return next(
        new AppError("Bank account not found", StatusCodes.NOT_FOUND)
      );
    }

    // Generate a unique withdrawal reference
    const reference = `withdraw_${uuidv4()}`;

    // Create the withdrawal transaction
    const transaction = await Transaction.create({
      user: userId,
      type: TransactionType.WITHDRAWAL,
      amount,
      status: TransactionStatus.PENDING,
      check: TransactionCheck.OUTGOING,
      reference,
      description:
        note ||
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

    // Send user notification
    await notificationService.createNotification(
      userId.toString(),
      "Withdrawal Request Submitted",
      `Your withdrawal request for ₦${amount.toLocaleString()} has been submitted and is pending approval.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    // Update wallet balances
    wallet.availableBalance -= amount;
    wallet.pendingBalance += amount;
    await wallet.save();

    // Respond to client
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      transaction,
      wallet,
    });
  }
);


/**
 * @desc    Get user's withdrawal requests
 * @route   GET /api/withdrawals/user
 * @access  Private
 */
export const getUserWithdrawals = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { page = "1", limit = "10", status } = req.query;

    // Build query
    const query: any = { user: userId, type: TransactionType.WITHDRAWAL };
    if (status) query.status = status;

    // Pagination
    const pageNum = Number.parseInt(page as string, 10);
    const limitNum = Number.parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch withdrawals
    const withdrawals = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("user", "firstName lastName email avatar");

    // Count total
    const total = await Transaction.countDocuments(query);

    res.status(StatusCodes.OK).json({
      status: "success",
      count: withdrawals.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: withdrawals,
    });
  }
);

/**
 * @desc    Get all withdrawal requests (Admin only)
 * @route   GET /api/withdrawals/admin
 * @access  Private/Admin
 */
export const getAllWithdrawalsAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const {
      page = "1",
      limit = "10",
      status,
      search,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query: any = { type: TransactionType.WITHDRAWAL };

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

    // Fetch withdrawals with user population
    const withdrawals = await Transaction.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate("user", "firstName lastName email avatar");

    // Transform data to include bank account info from metadata
    const transformedWithdrawals = withdrawals.map((withdrawal) => ({
      ...withdrawal.toObject(),
      bankAccount: withdrawal.metadata?.bankAccount || {},
      note: withdrawal.metadata?.userNote || "",
      adminNotes: withdrawal.metadata?.adminNotes || "",
      rejectionReason: withdrawal.metadata?.rejectionReason || "",
    }));

    // Count total
    const total = await Transaction.countDocuments(query);

    res.status(StatusCodes.OK).json({
      status: "success",
      count: transformedWithdrawals.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: transformedWithdrawals,
    });
  }
);

/**
 * @desc    Get withdrawal request by ID
 * @route   GET /api/withdrawals/:id
 * @access  Private
 */
export const getWithdrawalById = asyncHandler(
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

    // Build query - admins can see all withdrawals, users only their own
    const query: any = { _id: id, type: TransactionType.WITHDRAWAL };
    if (user.role !== "admin" && user.role !== "super_admin") {
      query.user = userId;
    }

    const withdrawal = await Transaction.findOne(query).populate(
      "user",
      "firstName lastName email avatar"
    );

    if (!withdrawal) {
      return next(
        new AppError("Withdrawal request not found", StatusCodes.NOT_FOUND)
      );
    }

    // Transform data to include bank account info
    const transformedWithdrawal = {
      ...withdrawal.toObject(),
      bankAccount: withdrawal.metadata?.bankAccount || {},
      note: withdrawal.metadata?.userNote || "",
      adminNotes: withdrawal.metadata?.adminNotes || "",
      rejectionReason: withdrawal.metadata?.rejectionReason || "",
    };

    res.status(StatusCodes.OK).json({
      status: "success",
      data: transformedWithdrawal,
    });
  }
);

/**
 * @desc    Approve withdrawal request (Admin only)
 * @route   PATCH /api/withdrawals/:id/approve
 * @access  Private/Admin
 */
export const approveWithdrawal = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { id } = req.params;
    const { notes } = req.body;

    // Find the withdrawal request
    const withdrawal = await Transaction.findOne({
      _id: id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
    }).populate("user", "firstName lastName email");

    if (!withdrawal) {
      return next(
        new AppError(
          "Pending withdrawal request not found",
          StatusCodes.NOT_FOUND
        )
      );
    }

    // Find the user's wallet
    const wallet = await Wallet.findOne({ user: withdrawal.user._id });
    if (!wallet) {
      return next(new AppError("User wallet not found", StatusCodes.NOT_FOUND));
    }

    // Update withdrawal status
    withdrawal.status = TransactionStatus.COMPLETED;
    if (notes) {
      withdrawal.description += ` - Admin notes: ${notes}`;
    }

    // Add audit trail
    withdrawal.metadata = {
      ...withdrawal.metadata,
      approvedBy: userId,
      approvedAt: new Date(),
      adminNotes: notes,
    };

    // Update wallet balances - remove from pending balance
    wallet.pendingBalance = Math.max(
      0,
      wallet.pendingBalance - withdrawal.amount
    );

    // Save both withdrawal and wallet
    await Promise.all([withdrawal.save(), wallet.save()]);

    // Log the admin action
    console.log(
      `Withdrawal ${id} approved by admin ${userId} at ${new Date().toISOString()}`
    );

    res.status(StatusCodes.OK).json({
      status: "success",
      message: "Withdrawal approved successfully",
      data: withdrawal,
    });
  }
);

/**
 * @desc    Reject withdrawal request (Admin only)
 * @route   PATCH /api/withdrawals/:id/reject
 * @access  Private/Admin
 */
export const rejectWithdrawal = asyncHandler(
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

    // Find the withdrawal request
    const withdrawal = await Transaction.findOne({
      _id: id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
    }).populate("user", "firstName lastName email");

    if (!withdrawal) {
      return next(
        new AppError(
          "Pending withdrawal request not found",
          StatusCodes.NOT_FOUND
        )
      );
    }

    // Find the user's wallet
    const wallet = await Wallet.findOne({ user: withdrawal.user._id });
    if (!wallet) {
      return next(new AppError("User wallet not found", StatusCodes.NOT_FOUND));
    }

    // Update withdrawal status
    withdrawal.status = TransactionStatus.FAILED;
    withdrawal.description += ` - Rejected: ${reason}`;

    // Add audit trail
    withdrawal.metadata = {
      ...withdrawal.metadata,
      rejectedBy: userId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    };

    // Restore user's balance
    wallet.availableBalance += withdrawal.amount;
    wallet.pendingBalance = Math.max(
      0,
      wallet.pendingBalance - withdrawal.amount
    );

    // Save both withdrawal and wallet
    await Promise.all([withdrawal.save(), wallet.save()]);

    // Log the admin action
    console.log(
      `Withdrawal ${id} rejected by admin ${userId} at ${new Date().toISOString()}: ${reason}`
    );

    res.status(StatusCodes.OK).json({
      status: "success",
      message: "Withdrawal rejected successfully",
      data: withdrawal,
    });
  }
);

/**
 * @desc    Get withdrawal statistics (Admin only)
 * @route   GET /api/withdrawals/stats
 * @access  Private/Admin
 */
export const getWithdrawalStats = asyncHandler(
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
    }

    // Get withdrawal statistics
    const stats = await Transaction.aggregate([
      {
        $match: {
          type: TransactionType.WITHDRAWAL,
          createdAt: dateFilter,
        },
      },
      {
        $group: {
          _id: "$status",
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
          status: "$_id",
          count: 1,
          totalAmount: 1,
          avgAmount: 1,
          minAmount: 1,
          maxAmount: 1,
        },
      },
    ]);

    // Get time series data
    const timeSeriesData = await Transaction.aggregate([
      {
        $match: {
          type: TransactionType.WITHDRAWAL,
          createdAt: dateFilter,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ["$status", TransactionStatus.PENDING] }, 1, 0],
            },
          },
          completedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", TransactionStatus.COMPLETED] }, 1, 0],
            },
          },
          rejectedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", TransactionStatus.FAILED] }, 1, 0],
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
          pendingCount: 1,
          completedCount: 1,
          rejectedCount: 1,
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        byStatus: stats,
        timeSeries: timeSeriesData,
      },
    });
  }
);
