import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import {
  Wallet,
  TransactionType,
  TransactionStatus,
} from "../models/walletModel";
import User from "../models/userModel";
import mongoose from "mongoose";

// Get all transactions with filtering
export const getAllTransactions = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      type,
      status,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      userId,
      page = 1,
      limit = 10,
      sort = "-date",
    } = req.query;

    // Build filter object
    const filter: any = {};

    if (type) filter["transactions.type"] = type;
    if (status) filter["transactions.status"] = status;
    if (minAmount) filter["transactions.amount"] = { $gte: Number(minAmount) };
    if (maxAmount) {
      if (filter["transactions.amount"]) {
        filter["transactions.amount"].$lte = Number(maxAmount);
      } else {
        filter["transactions.amount"] = { $lte: Number(maxAmount) };
      }
    }

    if (startDate) {
      filter["transactions.date"] = { $gte: new Date(startDate as string) };
    }

    if (endDate) {
      if (filter["transactions.date"]) {
        filter["transactions.date"].$lte = new Date(endDate as string);
      } else {
        filter["transactions.date"] = { $lte: new Date(endDate as string) };
      }
    }

    if (userId) filter.user = new mongoose.Types.ObjectId(userId as string);

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Aggregation pipeline
    const pipeline = [
      { $match: filter },
      { $unwind: "$transactions" },
      { $match: filter }, // Apply filters to unwound transactions
      {
        $sort: {
          [`transactions.${
            typeof sort === "string" ? sort.replace("-", "") : ""
          }`]: typeof sort === "string" && sort.startsWith("-") ? -1 : 1,
        } as Record<string, 1 | -1>,
      },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $project: {
          _id: "$transactions._id",
          type: "$transactions.type",
          amount: "$transactions.amount",
          status: "$transactions.status",
          date: "$transactions.date",
          description: "$transactions.description",
          reference: "$transactions.reference",
          paymentMethod: "$transactions.paymentMethod",
          metadata: "$transactions.metadata",
          recipient: "$transactions.recipient",
          sender: "$transactions.sender",
          property: "$transactions.property",
          investment: "$transactions.investment",
          userId: "$user",
          userName: "$userDetails.name",
          userEmail: "$userDetails.email",
        },
      },
    ];

    // Count total documents for pagination
    const countPipeline = [
      { $match: filter },
      { $unwind: "$transactions" },
      { $match: filter },
      { $count: "total" },
    ];

    const [transactions, countResult] = await Promise.all([
      Wallet.aggregate(pipeline),
      Wallet.aggregate(countPipeline),
    ]);

    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.status(200).json({
      status: "success",
      results: transactions.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: transactions,
    });
  }
);

// Get transaction details
export const getTransactionById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const transaction = await Wallet.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions._id": new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $project: {
          _id: "$transactions._id",
          type: "$transactions.type",
          amount: "$transactions.amount",
          status: "$transactions.status",
          date: "$transactions.date",
          description: "$transactions.description",
          reference: "$transactions.reference",
          paymentMethod: "$transactions.paymentMethod",
          metadata: "$transactions.metadata",
          recipient: "$transactions.recipient",
          sender: "$transactions.sender",
          property: "$transactions.property",
          investment: "$transactions.investment",
          userId: "$user",
          userName: "$userDetails.name",
          userEmail: "$userDetails.email",
        },
      },
    ]);

    if (!transaction || transaction.length === 0) {
      return next(new AppError("Transaction not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: transaction[0],
    });
  }
);

// Approve a transaction
export const approveTransaction = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { notes } = req.body;

    // Find the wallet containing this transaction
    const wallet = await Wallet.findOne({ "transactions._id": id });

    if (!wallet) {
      return next(new AppError("Transaction not found", 404));
    }

    // Find the transaction in the wallet
    const transactionIndex = wallet.transactions.findIndex(
      (t) => t._id.toString() === id && t.status === TransactionStatus.PENDING
    );

    if (transactionIndex === -1) {
      return next(new AppError("Pending transaction not found", 404));
    }

    const transaction = wallet.transactions[transactionIndex];

    // Update transaction status
    wallet.transactions[transactionIndex].status = TransactionStatus.COMPLETED;
    if (notes) {
      wallet.transactions[
        transactionIndex
      ].description += ` - Admin notes: ${notes}`;
    }

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

    // Get user for notification
    const user = await User.findById(wallet.user);

    // Send notification (you would implement this)
    // await notificationService.sendNotification({
    //   userId: wallet.user,
    //   title: 'Transaction Approved',
    //   message: `Your ${transaction.type} of ${transaction.amount} has been approved.`,
    //   type: 'transaction'
    // });

    res.status(200).json({
      status: "success",
      data: wallet.transactions[transactionIndex],
    });
  }
);

// Reject a transaction
export const rejectTransaction = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return next(new AppError("Rejection reason is required", 400));
    }

    // Find the wallet containing this transaction
    const wallet = await Wallet.findOne({ "transactions._id": id });

    if (!wallet) {
      return next(new AppError("Transaction not found", 404));
    }

    // Find the transaction in the wallet
    const transactionIndex = wallet.transactions.findIndex(
      (t) => t._id.toString() === id && t.status === TransactionStatus.PENDING
    );

    if (transactionIndex === -1) {
      return next(new AppError("Pending transaction not found", 404));
    }

    const transaction = wallet.transactions[transactionIndex];

    // Update transaction status
    wallet.transactions[transactionIndex].status = TransactionStatus.FAILED;
    wallet.transactions[
      transactionIndex
    ].description += ` - Rejected: ${reason}`;

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

    // Get user for notification
    const user = await User.findById(wallet.user);

    // Send notification (you would implement this)
    // await notificationService.sendNotification({
    //   userId: wallet.user,
    //   title: 'Transaction Rejected',
    //   message: `Your ${transaction.type} of ${transaction.amount} has been rejected. Reason: ${reason}`,
    //   type: 'transaction'
    // });

    res.status(200).json({
      status: "success",
      data: wallet.transactions[transactionIndex],
    });
  }
);

// Get transaction statistics
export const getTransactionStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
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
