import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import {
  Wallet,
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from "../models/walletModel";
import crypto from "crypto";
import User from "../models/userModel";
import BankAccount from "../models/bankAccountModel";
import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";
import notificationService from "../services/notificationService";
import { NotificationType } from "../models/notificationModel";
import paymentService from "../services/paymentService";

// Extend Express Request to include user
interface AuthRequest extends Request {
  user?: any;
}

/**
 * @desc    Get user wallet
 * @route   GET /api/wallet
 * @access  Private
 */
export const getWallet = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
 * @desc    Handle Paystack webhook
 * @route   POST /api/wallet/webhook/paystack
 * @access  Public
 */
export const handlePaystackWebhook = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("Received Paystack webhook");

    // Validate webhook signature (optional but recommended)
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
      .update(JSON.stringify(req.body))
      .digest("hex");

    const signature = req.headers["x-paystack-signature"];

    if (signature !== hash) {
      console.error("Invalid webhook signature");
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid signature",
      });
    }

    try {
      const reference = req.body.data?.reference;
      console.log("Processing webhook payload", {
        event: req.body.event,
        reference: reference,
      });

      // Check if transaction already exists
      if (reference) {
        const existingTransaction = await Transaction.findOne({ reference });
        if (
          existingTransaction &&
          existingTransaction.status === TransactionStatus.COMPLETED
        ) {
          console.log("Transaction already processed:", existingTransaction);
          return res.status(StatusCodes.OK).json({
            success: true,
            message: "Transaction already processed",
          });
        }
      }

      const result = await paymentService.processPaystackWebhook(req.body);

      // Always return 200 to Paystack, even if there's an error
      // This prevents Paystack from retrying the webhook
      return res.status(StatusCodes.OK).json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      console.error("Webhook processing error:", error);

      // Always return 200 to Paystack
      return res.status(StatusCodes.OK).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  }
);

/**
 * @desc    Get user transactions
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
export const getTransactions = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      user: userId, // Add user field
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
 * @desc    Initialize wallet funding
 * @route   POST /api/wallet/fund/initialize
 * @access  Private
 */
export const initializeWalletFunding = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { amount } = req.body;
    const email = req.user.email;

    if (!amount || amount < 100) {
      return next(
        new AppError("Amount must be at least 100", StatusCodes.BAD_REQUEST)
      );
    }

    try {
      const result = await paymentService.initializeWalletFunding(
        userId.toString(),
        amount,
        email
      );

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Payment initialization successful",
        data: result,
      });
    } catch (error) {
      return next(
        new AppError(
          `Payment initialization failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          StatusCodes.BAD_REQUEST
        )
      );
    }
  }
);

/**
 * @desc    Verify wallet funding
 * @route   GET /api/wallet/fund/verify/:reference
 * @access  Private
 */
export const verifyWalletFunding = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { reference } = req.params;

    // Check if transaction already exists in our database
    const existingTransaction = await Transaction.findOne({ reference });

    if (existingTransaction) {
      console.log("Transaction already processed:", existingTransaction);
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Transaction already processed",
        transaction: existingTransaction,
      });
    }

    try {
      const result = await paymentService.verifyPayment(reference);

      console.log("Verifying payment with reference:", result);

      res.status(StatusCodes.OK).json({
        success: result.success,
        message: result.message,
        transaction: result.transaction,
      });
    } catch (error) {
      return next(
        new AppError(
          `Payment verification failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          StatusCodes.BAD_REQUEST
        )
      );
    }
  }
);

/**
 * @desc    Search users by username, email, or name
 * @route   GET /api/users/search
 * @access  Private
 */
export const searchWalletUsers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const { query } = req.query;

    if (!query || typeof query !== "string") {
      return next(
        new AppError("Search query is required", StatusCodes.BAD_REQUEST)
      );
    }

    // Don't include the current user in search results
    const currentUserId = req.user._id;

    // Create a regex for case-insensitive search
    const searchRegex = new RegExp(query, "i");

    // Search by username, email, firstName, or lastName
    const users = await User.find({
      _id: { $ne: currentUserId }, // Exclude current user
      $or: [
        { userName: searchRegex },
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
      ],
    })
      .select("_id firstName lastName userName email avatar")
      .limit(10); // Limit results for performance

    res.status(StatusCodes.OK).json({
      success: true,
      count: users.length,
      users,
    });
  }
);

/**
 * @desc    Transfer money to another user
 * @route   POST /api/wallet/transfer
 * @access  Private
 */
export const transferMoney = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // Use a transaction to ensure atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create transaction for sender
      const senderTransaction = await Transaction.create(
        [
          {
            user: senderId, // Add user field
            type: TransactionType.TRANSFER,
            amount,
            status: TransactionStatus.COMPLETED,
            reference,
            description:
              note ||
              `Transfer to ${recipient.firstName} ${recipient.lastName}`,
            recipient: recipientId,
          },
        ],
        { session }
      );

      // Create transaction for recipient
      const recipientTransaction = await Transaction.create(
        [
          {
            user: recipientId, // Add user field
            type: TransactionType.TRANSFER,
            amount,
            status: TransactionStatus.COMPLETED,
            reference,
            description:
              note ||
              `Transfer from ${req.user.firstName} ${req.user.lastName}`,
            sender: senderId,
          },
        ],
        { session }
      );

      // Update sender wallet
      senderWallet.balance -= amount;
      senderWallet.availableBalance -= amount;
      await senderWallet.save({ session });

      // Update recipient wallet
      recipientWallet.balance += amount;
      recipientWallet.availableBalance += amount;
      await recipientWallet.save({ session });

      // Create notification for sender
      await notificationService.createNotification(
        senderId.toString(),
        "Transfer Successful",
        `You have successfully transferred ₦${amount.toLocaleString()} to ${
          recipient.firstName
        } ${recipient.lastName}.`,
        NotificationType.TRANSACTION,
        "/dashboard/my-transactions",
        { transactionId: senderTransaction[0]._id }
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
        { transactionId: recipientTransaction[0]._id }
      );

      await session.commitTransaction();

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Transfer completed successfully",
        transaction: senderTransaction[0],
        wallet: senderWallet,
      });
    } catch (error) {
      await session.abortTransaction();
      return next(
        new AppError(
          `Transfer failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    } finally {
      session.endSession();
    }
  }
);

/**
 * @desc    Withdraw from wallet
 * @route   POST /api/wallet/withdraw
 * @access  Private
 */
export const withdrawFromWallet = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    console.log("hit withdrawal endpoint 2");

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
      user: userId, // Add user field
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
 * @desc    Get transaction by ID
 * @route   GET /api/wallet/transactions/:id
 * @access  Private
 */
export const getTransactionById = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  async (req: AuthRequest, res: Response) => {
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

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
      const user = await User.findById(transaction.user);
      const wallet = await Wallet.findOne({ user: transaction.user });

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
              transaction.user.toString(),
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
              transaction.user.toString(),
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
              transaction.user.toString(),
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
              transaction.user.toString(),
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
