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

const SYSTEM_EMAIL = "esthington@gmail.com";

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

    // Validation
    if (!amount || amount < 100) {
      return next(
        new AppError("Amount must be at least ₦100", StatusCodes.BAD_REQUEST)
      );
    }

    if (!bankAccountId) {
      return next(
        new AppError("Please select a bank account", StatusCodes.BAD_REQUEST)
      );
    }

    // Get wallet, bank account, and system user
    const [wallet, bankAccount, systemUser] = await Promise.all([
      Wallet.findOne({ user: userId }),
      BankAccount.findOne({ _id: bankAccountId, user: userId }),
      User.findOne({ email: SYSTEM_EMAIL }),
    ]);

    if (!wallet) {
      return next(new AppError("Wallet not found", StatusCodes.NOT_FOUND));
    }

    if (!bankAccount) {
      return next(
        new AppError("Bank account not found", StatusCodes.NOT_FOUND)
      );
    }

    if (!systemUser) {
      return next(new AppError("System user not found", StatusCodes.NOT_FOUND));
    }

    if (wallet.balance < amount) {
      return next(
        new AppError("Insufficient balance", StatusCodes.BAD_REQUEST)
      );
    }

    // Create system wallet if not existing
    let systemWallet = await Wallet.findOne({ user: systemUser._id });

    if (!systemWallet) {
      systemWallet = await Wallet.create({
        user: systemUser._id,
        balance: 0,
        pendingBalance: 0,
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
      // Notify user about withdrawal approval
    }

    // Update system wallet
    // systemWallet.balance += amount;
    systemWallet.pendingBalance += amount;

    // Create transaction
    const reference = `withdraw_${uuidv4()}`;
    const transaction = await Transaction.create({
      user: userId,
      type: TransactionType.WITHDRAWAL,
      amount,
      status: TransactionStatus.PENDING,
      check: TransactionCheck.OUTGOING,
      reference,
      description:
        note ||
        `Withdrawal to ${bankAccount.bankName} - ${bankAccount.accountNumber}`,
      metadata: {
        bankAccount: {
          id: bankAccount._id,
          bankName: bankAccount.bankName,
          accountName: bankAccount.accountName,
          accountNumber: bankAccount.accountNumber,
        },
      },
    });

    // Update user wallet
    wallet.balance -= amount;
    wallet.pendingBalance += amount;

    // Save both wallets
    await Promise.all([wallet.save(), systemWallet.save()]);

    // Notify user
    await notificationService.createNotification(
      userId.toString(),
      "Withdrawal Request Submitted",
      `Your withdrawal request for ₦${amount.toLocaleString()} is pending approval.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Withdrawal request submitted",
      transaction,
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
    const { id } = req.params;
    const { note } = req.body;
    if (!req.user)
      return next(new AppError("Unauthorized", StatusCodes.UNAUTHORIZED));

    const withdrawal = await Transaction.findOne({
      _id: id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
    }).populate("user", "firstName lastName email");

    if (!withdrawal)
      return next(new AppError("Withdrawal not found", StatusCodes.NOT_FOUND));

    const [userWallet, systemUser] = await Promise.all([
      Wallet.findOne({ user: withdrawal.user._id }),
      User.findOne({ email: SYSTEM_EMAIL }),
    ]);

    if (!userWallet)
      return next(new AppError("User wallet not found", StatusCodes.NOT_FOUND));
    if (!systemUser)
      return next(new AppError("System user not found", StatusCodes.NOT_FOUND));

    const systemWallet = await Wallet.findOne({ user: systemUser._id });
    if (!systemWallet)
      return next(
        new AppError("System wallet not found", StatusCodes.NOT_FOUND)
      );
    if (systemWallet.pendingBalance < withdrawal.amount)
      return next(
        new AppError("System pending balance too low", StatusCodes.BAD_REQUEST)
      );

    withdrawal.status = TransactionStatus.COMPLETED;
    withdrawal.metadata = {
      ...withdrawal.metadata,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      note,
    };
    if (note) withdrawal.description += ` - Admin note: ${note}`;

    const user = await User.findById(withdrawal.user._id);

    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
      // Notify user about withdrawal approval
    }

    systemWallet.pendingBalance -= withdrawal.amount;
    systemWallet.balance += withdrawal.amount;
    userWallet.pendingBalance -= withdrawal.amount;

    await Transaction.create({
      user: systemUser._id,
      type: TransactionType.WITHDRAWAL,
      check: TransactionCheck.OUTGOING,
      amount: withdrawal.amount,
      status: TransactionStatus.COMPLETED,
      reference: withdrawal.reference,
      description: `Payout to ${user.firstName} ${user.lastName}`,
      metadata: {
        originalTransactionId: withdrawal._id,
        payoutTo: withdrawal.user._id,
      },
    });

    await Promise.all([
      withdrawal.save(),
      userWallet.save(),
      systemWallet.save(),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Withdrawal approved and system debited",
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
    const { id } = req.params;
    const { note } = req.body;

    if (!req.user)
      return next(new AppError("Unauthorized", StatusCodes.UNAUTHORIZED));
    if (!note)
      return next(
        new AppError("Rejection note is required", StatusCodes.BAD_REQUEST)
      );

    const withdrawal = await Transaction.findOne({
      _id: id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
    }).populate("user", "firstName lastName email");

    if (!withdrawal)
      return next(new AppError("Withdrawal not found", StatusCodes.NOT_FOUND));

    const [userWallet, systemUser] = await Promise.all([
      Wallet.findOne({ user: withdrawal.user._id }),
      User.findOne({ email: SYSTEM_EMAIL }),
    ]);

    if (!userWallet)
      return next(new AppError("User wallet not found", StatusCodes.NOT_FOUND));
    if (!systemUser)
      return next(new AppError("System user not found", StatusCodes.NOT_FOUND));

    const systemWallet = await Wallet.findOne({ user: systemUser._id });
    if (!systemWallet)
      return next(
        new AppError("System wallet not found", StatusCodes.NOT_FOUND)
      );

    userWallet.balance += withdrawal.amount;
    userWallet.pendingBalance -= withdrawal.amount;
    systemWallet.pendingBalance -= withdrawal.amount;

    withdrawal.status = TransactionStatus.FAILED;
    withdrawal.description += ` - Rejected: ${note}`;
    withdrawal.metadata = {
      ...withdrawal.metadata,
      rejectedBy: req.user._id,
      rejectedAt: new Date(),
      note,
    };

    await Transaction.create({
      user: withdrawal.user._id,
      type: TransactionType.WITHDRAWAL,
      check: TransactionCheck.INCOMING,
      amount: withdrawal.amount,
      status: TransactionStatus.COMPLETED,
      reference: `reversal_${withdrawal.reference}`,
      description: `Reversal of rejected withdrawal`,
      metadata: {
        originalTransactionId: withdrawal._id,
        rejectionNote: note,
      },
    });

    await Promise.all([
      withdrawal.save(),
      userWallet.save(),
      systemWallet.save(),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Withdrawal rejected and refunded to user",
      data: withdrawal,
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
