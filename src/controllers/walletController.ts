import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import {
  Wallet,
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from "../models/walletModel";
import User from "../models/userModel";
import BankAccount from "../models/bankAccountModel";
import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";
import notificationService from "../services/notificationService";
import { NotificationType } from "../models/notificationModel";
import mongoose from "mongoose";

/**
 * @desc    Get user wallet
 * @route   GET /api/wallet
 * @access  Private
 */
export const getWallet = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    // Find or create wallet
    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      wallet,
    });
  }
);

/**
 * @desc    Get user transactions
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
export const getTransactions = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const {
      page = "1",
      limit = "10",
      type,
      status,
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query: any = { user: userId };
    if (type) query.type = type;
    if (status) query.status = status;

    // Date range
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

    // Get transactions
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate(
        "recipient sender property investment",
        "firstName lastName email title"
      );

    // Get total count
    const total = await Transaction.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: transactions.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      transactions,
    });
  }
);

/**
 * @desc    Fund user wallet
 * @route   POST /api/wallet/fund
 * @access  Private
 */
export const fundWallet = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { amount, reference, paymentMethod } = req.body;

    if (!amount || amount < 100) {
      return next(
        new AppError("Amount must be at least 100", StatusCodes.BAD_REQUEST)
      );
    }

    if (!reference) {
      return next(
        new AppError(
          "Transaction reference is required",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({ reference });
    if (existingTransaction) {
      return next(
        new AppError("Transaction already processed", StatusCodes.BAD_REQUEST)
      );
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
      });
    }

    // Create transaction
    const transaction = await Transaction.create({
      user: userId,
      type: TransactionType.DEPOSIT,
      amount,
      status: TransactionStatus.COMPLETED,
      reference,
      description: `Wallet funding via ${paymentMethod || "direct deposit"}`,
      paymentMethod: paymentMethod || PaymentMethod.WALLET,
    });

    // Update wallet balance
    wallet.balance += amount;
    wallet.availableBalance += amount;
    await wallet.save();

    // Create notification
    await notificationService.createNotification(
      userId.toString(),
      "Wallet Funded",
      `Your wallet has been credited with ₦${amount.toLocaleString()}.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Wallet funded successfully",
      transaction,
      wallet,
    });
  }
);

/**
 * @desc    Withdraw from wallet
 * @route   POST /api/wallet/withdraw
 * @access  Private
 */
export const withdrawFromWallet = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { amount, bankAccountId, note } = req.body;

    if (!amount || amount < 100) {
      return next(
        new AppError("Amount must be at least 100", StatusCodes.BAD_REQUEST)
      );
    }

    // Find bank account
    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      user: userId,
    });

    if (!bankAccount) {
      return next(
        new AppError("Bank account not found", StatusCodes.NOT_FOUND)
      );
    }

    // Find wallet
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return next(new AppError("Wallet not found", StatusCodes.NOT_FOUND));
    }

    // Check if wallet has sufficient balance
    if (wallet.availableBalance < amount) {
      return next(
        new AppError("Insufficient balance", StatusCodes.BAD_REQUEST)
      );
    }

    // Generate reference
    const reference = `withdraw_${uuidv4()}`;

    // Create transaction
    const transaction = await Transaction.create({
      user: userId,
      type: TransactionType.WITHDRAWAL,
      amount,
      status: TransactionStatus.PENDING,
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

    // Create notification
    await notificationService.createNotification(
      userId.toString(),
      "Withdrawal Request Submitted",
      `Your withdrawal request for ₦${amount.toLocaleString()} has been submitted and is pending approval.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    // Update wallet balance
    wallet.availableBalance -= amount;
    wallet.pendingBalance += amount;
    await wallet.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      transaction,
      wallet,
    });
  }
);

/**
 * @desc    Transfer money to another user
 * @route   POST /api/wallet/transfer
 * @access  Private
 */
export const transferMoney = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const senderId = req.user._id;
    const { recipientId, amount, note } = req.body;

    if (!amount || amount < 100) {
      return next(
        new AppError("Amount must be at least 100", StatusCodes.BAD_REQUEST)
      );
    }

    if (senderId.toString() === recipientId) {
      return next(
        new AppError("Cannot transfer to yourself", StatusCodes.BAD_REQUEST)
      );
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return next(new AppError("Recipient not found", StatusCodes.NOT_FOUND));
    }

    // Find sender wallet
    const senderWallet = await Wallet.findOne({ user: senderId });
    if (!senderWallet) {
      return next(
        new AppError("Sender wallet not found", StatusCodes.NOT_FOUND)
      );
    }

    // Check if sender has sufficient balance
    if (senderWallet.availableBalance < amount) {
      return next(
        new AppError("Insufficient balance", StatusCodes.BAD_REQUEST)
      );
    }

    // Find or create recipient wallet
    let recipientWallet = await Wallet.findOne({ user: recipientId });
    if (!recipientWallet) {
      recipientWallet = await Wallet.create({
        user: recipientId,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
      });
    }

    // Generate reference
    const reference = `transfer_${uuidv4()}`;

    // Create transaction for sender
    const senderTransaction = await Transaction.create({
      user: senderId,
      type: TransactionType.TRANSFER,
      amount,
      status: TransactionStatus.COMPLETED,
      reference,
      description:
        note || `Transfer to ${recipient.firstName} ${recipient.lastName}`,
      recipient: recipientId,
    });

    // Create transaction for recipient
    const recipientTransaction = await Transaction.create({
      user: recipientId,
      type: TransactionType.TRANSFER,
      amount,
      status: TransactionStatus.COMPLETED,
      reference,
      description:
        note || `Transfer from ${req.user.firstName} ${req.user.lastName}`,
      sender: senderId,
    });

    // Use a transaction to update both wallets atomically
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update sender wallet
      senderWallet.balance -= amount;
      senderWallet.availableBalance -= amount;
      await senderWallet.save({ session });

      // Update recipient wallet
      recipientWallet.balance += amount;
      recipientWallet.availableBalance += amount;
      await recipientWallet.save({ session });

      // Commit the transaction
      await session.commitTransaction();
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End the session
      session.endSession();
    }

    // Create notification for sender
    await notificationService.createNotification(
      senderId.toString(),
      "Transfer Successful",
      `You have successfully transferred ₦${amount.toLocaleString()} to ${
        recipient.firstName
      } ${recipient.lastName}.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: senderTransaction._id }
    );

    // Create notification for recipient
    await notificationService.createNotification(
      recipientId.toString(),
      "Transfer Received",
      `You have received ₦${amount.toLocaleString()} from ${
        req.user.firstName
      } ${req.user.lastName}.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: recipientTransaction._id }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Transfer completed successfully",
      transaction: senderTransaction,
      wallet: senderWallet,
    });
  }
);

/**
 * @desc    Get transaction by ID
 * @route   GET /api/wallet/transactions/:id
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

    const transaction = await Transaction.findOne({
      _id: id,
      user: userId,
    }).populate(
      "recipient sender property investment",
      "firstName lastName email title"
    );

    if (!transaction) {
      return next(new AppError("Transaction not found", StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      transaction,
    });
  }
);

/**
 * @desc    Admin: Get all transactions
 * @route   GET /api/wallet/admin/transactions
 * @access  Private/Admin
 */
export const getAllTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = "1",
      limit = "10",
      type,
      status,
      userId,
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query: any = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (userId) query.user = userId;

    // Date range
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

    // Get transactions
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate(
        "user recipient sender property investment",
        "firstName lastName email title"
      );

    // Get total count
    const total = await Transaction.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: transactions.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      transactions,
    });
  }
);

/**
 * @desc    Admin: Update transaction status
 * @route   PUT /api/wallet/admin/transactions/:id
 * @access  Private/Admin
 */
export const updateTransactionStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!req.user) {
      return res
        .status(400)
        .json({ status: "fail", message: "User not authenticated" });
    }

    const userId = req.user?._id;

    if (
      !Object.values(TransactionStatus).includes(status as TransactionStatus)
    ) {
      return next(new AppError("Invalid status", StatusCodes.BAD_REQUEST));
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return next(new AppError("Transaction not found", StatusCodes.NOT_FOUND));
    }

    const oldStatus = transaction.status;

    // Update transaction
    transaction.status = status as TransactionStatus;

    if (note) {
      transaction.metadata = {
        ...transaction.metadata,
        adminNote: note,
      };
    }
    await transaction.save();

    // Handle status change for different transaction types
    if (oldStatus !== status) {
      const user = await User.findById(transaction.sender);
      const wallet = await Wallet.findOne({ user: transaction.sender });

      if (!wallet) {
        return next(new AppError("Wallet not found", StatusCodes.NOT_FOUND));
      }

      // For deposits
      if (transaction.type === TransactionType.DEPOSIT) {
        if (
          oldStatus === TransactionStatus.PENDING &&
          status === TransactionStatus.COMPLETED
        ) {
          // Credit wallet
          wallet.balance += transaction.amount;
          wallet.availableBalance += transaction.amount;
          await wallet.save();

          // Send notification
          if (user) {
            await notificationService.createNotification(
              transaction.sender?.toString() || "",
              "Deposit Completed",
              `Your deposit of ₦${transaction.amount.toLocaleString()} has been completed.`,
              NotificationType.TRANSACTION,
              "/dashboard/my-transactions",
              { transactionId: transaction._id }
            );
          }
        } else if (
          oldStatus === TransactionStatus.PENDING &&
          status === TransactionStatus.FAILED
        ) {
          // Send notification
          if (user) {
            await notificationService.createNotification(
              transaction.sender?.toString() ?? "",
              "Deposit Failed",
              `Your deposit of ₦${transaction.amount.toLocaleString()} has failed.`,
              NotificationType.TRANSACTION,
              "/dashboard/my-transactions",
              { transactionId: transaction._id }
            );
          }
        }
      }

      // For withdrawals
      else if (transaction.type === TransactionType.WITHDRAWAL) {
        if (
          oldStatus === TransactionStatus.PENDING &&
          status === TransactionStatus.COMPLETED
        ) {
          // Update wallet
          wallet.balance -= transaction.amount;
          wallet.pendingBalance -= transaction.amount;
          await wallet.save();

          // Send notification
          if (user) {
            await notificationService.createNotification(
              (transaction.sender?.toString() ?? ""),
              "Withdrawal Completed",
              `Your withdrawal of ₦${transaction.amount.toLocaleString()} has been completed.`,
              NotificationType.TRANSACTION,
              "/dashboard/my-transactions",
              { transactionId: transaction._id }
            );
          }
        } else if (
          oldStatus === TransactionStatus.PENDING &&
          (status === TransactionStatus.FAILED ||
            status === TransactionStatus.CANCELLED)
        ) {
          // Refund to available balance
          wallet.availableBalance += transaction.amount;
          wallet.pendingBalance -= transaction.amount;
          await wallet.save();

          // Send notification
          if (user) {
            await notificationService.createNotification(
              transaction.sender ? transaction.sender.toString() : "",
              `Withdrawal ${
                status === TransactionStatus.FAILED ? "Failed" : "Cancelled"
              }`,
              `Your withdrawal of ₦${transaction.amount.toLocaleString()} has been ${
                status === TransactionStatus.FAILED ? "failed" : "cancelled"
              }. The funds have been returned to your wallet.`,
              NotificationType.TRANSACTION,
              "/dashboard/my-transactions",
              { transactionId: transaction._id }
            );
          }
        }
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Transaction status updated successfully",
      transaction,
    });
  }
);
