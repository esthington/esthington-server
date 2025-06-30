import axios from "axios";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentMethod,
  Wallet,
  TransactionCheck,
} from "../models/walletModel";
import User from "../models/userModel";
import notificationService from "./notificationService";
import { NotificationType } from "../models/notificationModel";
import logger from "../utils/logger";
import emailService from "./emailService";
import mongoose from "mongoose";

class PaymentService {
  private paystackSecretKey: string;
  private paystackBaseUrl: string;

  constructor() {
    this.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || "";
    this.paystackBaseUrl = "https://api.paystack.co";
  }

  /**
   * Initialize wallet funding via Paystack new
   */
  async initializeWalletFunding(userId: string, amount: number, email: string) {
    try {
      const response = await axios.post(
        `${this.paystackBaseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // Convert to kobo
          callback_url: `${process.env.FRONTEND_URL}/dashboard/fund-wallet`,
          metadata: {
            userId,
            custom_fields: [
              {
                display_name: "Payment For",
                variable_name: "payment_for",
                value: "Wallet Funding",
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.data;
    } catch (error) {
      console.error("Paystack initialization error:", error);
      throw new Error("Failed to initialize payment");
    }
  }

  /**
   * Verify payment via Paystack
   */
  async verifyPayment(reference: string) {
    try {
      console.log(
        "🔍 Starting payment verification with reference:",
        reference
      );

      // Check if transaction already exists in our database (both standalone and embedded)
      console.log("📦 Checking if transaction already exists in DB...");

      // Check standalone transaction collection
      const existingStandaloneTransaction = await Transaction.findOne({
        reference,
      });

      // Check embedded transactions in wallets
      const walletWithTransaction = await Wallet.findOne({
        "transactions.reference": reference,
      });

      if (existingStandaloneTransaction || walletWithTransaction) {
        console.log("✅ Transaction already processed");
        return {
          success: true,
          message: "Transaction already processed",
          transaction:
            existingStandaloneTransaction ||
            walletWithTransaction?.transactions.find(
              (t) => t.reference === reference
            ),
        };
      }

      // Verify with Paystack
      console.log("📡 Verifying transaction with Paystack...");
      try {
        const response = await axios.get(
          `${this.paystackBaseUrl}/transaction/verify/${reference}`,
          {
            headers: {
              Authorization: `Bearer ${this.paystackSecretKey}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        const { data } = response.data;
        console.log("📬 Paystack response received:", data);

        if (data.status !== "success") {
          console.log("❌ Payment verification failed from Paystack.");
          return {
            success: false,
            message: "Payment verification failed",
            transaction: null,
          };
        }

        // Double-check if transaction was created while we were verifying
        const transactionCreatedDuringVerification =
          (await Transaction.findOne({ reference })) ||
          (await Wallet.findOne({ "transactions.reference": reference }));

        if (transactionCreatedDuringVerification) {
          console.log("⚠️ Transaction was created during verification");
          return {
            success: true,
            message: "Transaction already processed",
            transaction: transactionCreatedDuringVerification,
          };
        }

        // Find user by email
        if (!data.customer?.email) {
          console.error("🚫 Customer email not found in payment data");
          return {
            success: false,
            message: "Customer email not found in payment data",
            transaction: null,
          };
        }

        console.log("🔍 Finding user by email:", data.customer.email);
        const user = await User.findOne({ email: data.customer.email });

        if (!user) {
          console.error("🚫 No user found with email:", data.customer.email);
          return {
            success: false,
            message: `No user found with email: ${data.customer.email}`,
            transaction: null,
          };
        }

        console.log("✅ Found user:", user._id);

        // Find or create wallet
        let wallet = await Wallet.findOne({ user: user._id });
        if (!wallet) {
          console.log("🆕 Creating new wallet for user...");
          wallet = await Wallet.create({
            user: user._id,
            balance: 0,
            availableBalance: 0,
            pendingBalance: 0,
            transactions: [],
          });
        }

        // const amount = data.amount / 100; // Convert from kobo to naira

        // // Create transaction object
        // const transactionData = {
        //   user: user._id,
        //   type: TransactionType.DEPOSIT,
        //   amount,
        //   status: TransactionStatus.COMPLETED,
        //   reference: data.reference,
        //   description: `Wallet funding via Paystack`,
        //   paymentMethod: PaymentMethod.CARD,
        //   date: new Date(),
        //   metadata: {
        //     paystackData: data,
        //     verificationProcessed: true,
        //     processedAt: new Date(),
        //   },
        // };

        // // Create standalone transaction
        // const standaloneTransaction = await Transaction.create(transactionData);

        // // Add transaction to wallet's embedded transactions array
        // wallet.transactions.push(transactionData as any);

        // // Update wallet balance
        // wallet.balance += amount;
        // wallet.availableBalance += amount;
        // await wallet.save();

        // console.log(
        //   "💾 Transaction saved to both standalone collection and wallet"
        // );

        // // Create notification
        // await notificationService.createNotification(
        //   user._id,
        //   "Wallet Funded",
        //   `Your wallet has been credited with ₦${amount.toLocaleString()}.`,
        //   NotificationType.TRANSACTION,
        //   "/dashboard/my-transactions",
        //   { transactionId: standaloneTransaction._id }
        // );

        console.log("🎉 Payment verified and processed successfully.");
        return {
          success: true,
          message: "Payment verified successfully",
          // transaction: standaloneTransaction,
        };
      } catch (axiosError) {
        console.error("💥 Paystack API error:", axiosError);

        // If we can't reach Paystack, check if the transaction was already created by webhook
        const webhookCreatedTransaction =
          (await Transaction.findOne({
            reference,
            status: TransactionStatus.COMPLETED,
          })) ||
          (await Wallet.findOne({
            "transactions.reference": reference,
            "transactions.status": TransactionStatus.COMPLETED,
          }));

        if (webhookCreatedTransaction) {
          console.log("✅ Transaction was already processed by webhook");
          return {
            success: true,
            message: "Transaction already processed by webhook",
            transaction: webhookCreatedTransaction,
          };
        }

        return {
          success: false,
          message:
            "Payment verification failed: Unable to connect to payment provider",
          transaction: null,
        };
      }
    } catch (error) {
      console.error("💥 Payment verification error:", error);
      return {
        success: false,
        message: "Payment verification failed",
        transaction: null,
      };
    }
  }

  /**
   * Process Paystack webhook
   */
  async processPaystackWebhook(payload: any) {
    logger.info("Processing Paystack webhook:", {
      reference: payload.data?.reference,
      event: payload.event,
    });

    try {
      const { event, data } = payload;
      const reference = data?.reference;

      // Check if transaction already exists (both standalone and embedded)
      if (reference) {
        const existingStandaloneTransaction = await Transaction.findOne({
          reference,
        });
        const walletWithTransaction = await Wallet.findOne({
          "transactions.reference": reference,
        });

        if (existingStandaloneTransaction || walletWithTransaction) {
          logger.info(`Transaction already exists for reference: ${reference}`);
          return {
            success: true,
            message: "Transaction already processed",
            transaction:
              existingStandaloneTransaction ||
              walletWithTransaction?.transactions.find(
                (t) => t.reference === reference
              ),
          };
        }
      }

      // Handle different event types
      switch (event) {
        case "charge.success":
          return this.handleSuccessfulCharge(data);
        case "charge.failed":
          return this.handleFailedCharge(data);
        case "transfer.failed":
          return this.handleFailedTransfer(data);
        case "transfer.reversed":
          return this.handleReversedTransfer(data);
        default:
          logger.info(`Ignoring Paystack webhook event: ${event}`);
          return {
            success: true,
            message: `Ignoring event: ${event}`,
          };
      }
    } catch (error) {
      logger.error("Webhook processing error:", error);
      return {
        success: false,
        message: "Webhook processing failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Extract user ID from webhook data
   */
  private async extractUserId(data: any): Promise<string | null> {
    // First try to get it directly from metadata.userId
    let userId = data.metadata?.userId;

    // If not found, try to extract from the email in customer data
    if (!userId) {
      logger.info("userId not found in metadata, trying to find user by email");
      const userEmail = data.customer?.email;

      if (userEmail) {
        const user = await User.findOne({ email: userEmail });
        if (user) {
          userId = user._id.toString();
          logger.info(`Found user by email: ${userEmail}, userId: ${userId}`);
        }
      }
    }

    return userId;
  }

  /**
   * Handle successful charge event
   */
  private async handleSuccessfulCharge(data: any) {
    console.log("Processing successful charge:", data.reference);

    // Check if transaction already exists (both standalone and embedded)
    const existingStandaloneTransaction = await Transaction.findOne({
      reference: data.reference,
    });

    const walletWithTransaction = await Wallet.findOne({
      "transactions.reference": data.reference,
    });

    if (existingStandaloneTransaction || walletWithTransaction) {
      logger.info(`Transaction already exists: ${data.reference}`);
      return {
        success: true,
        message: "Transaction already processed",
        transaction:
          existingStandaloneTransaction ||
          walletWithTransaction?.transactions.find(
            (t) => t.reference === data.reference
          ),
      };
    }

    // Extract user ID from metadata
    const userId = await this.extractUserId(data);

    if (!userId) {
      logger.error("User ID not found in payment metadata", data.metadata);
      return {
        success: false,
        message: "User ID not found in payment metadata",
      };
    }

    // Find user and wallet
    const user = await User.findById(userId);
    if (!user) {
      logger.error(`User not found: ${userId}`);
      return {
        success: false,
        message: "User not found",
      };
    }

    logger.info(`Processing payment for user: ${user.email || userId}`);

    // Find system/admin user (parent wallet)
    const systemUser = await User.findOne({ email: "esthington@gmail.com" });
    if (!systemUser) {
      logger.error("System user not found");
      return {
        success: false,
        message: "System user not found",
      };
    }

    // Find or create user wallet
    let userWallet = await Wallet.findOne({ user: userId });
    if (!userWallet) {
      logger.info(`Creating new wallet for user: ${userId}`);
      userWallet = await Wallet.create({
        user: userId,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        transactions: [],
      });
    }

    // Find or create system wallet
    let systemWallet = await Wallet.findOne({ user: systemUser._id });
    if (!systemWallet) {
      logger.info(`Creating new system wallet for admin: ${systemUser._id}`);
      systemWallet = await Wallet.create({
        user: systemUser._id,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        transactions: [],
      });
    }

    const amount = data.amount / 100; // Convert from kobo to naira
    logger.info(`Creating new transaction for amount: ₦${amount}`);

    // Use database transaction for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create user transaction data
      const userTransactionData = {
        user: userId,
        type: TransactionType.DEPOSIT,
        amount,
        status: TransactionStatus.COMPLETED,
        reference: data.reference,
        description: `Wallet funding via Paystack`,
        paymentMethod: PaymentMethod.CARD,
        check: TransactionCheck.INCOMING,
        date: new Date(),
        metadata: {
          paystackData: data,
          webhookProcessed: true,
          processedAt: new Date(),
        },
      };

      // Create system transaction data
      const systemTransactionData = {
        user: systemUser._id,
        type: TransactionType.DEPOSIT,
        amount,
        status: TransactionStatus.COMPLETED,
        reference: `${data.reference}`, // Prefix to distinguish system transaction
        description: `System credit from ${
          user.firstName || user.userName || "User"
        } wallet funding`,
        paymentMethod: PaymentMethod.CARD,
        check: TransactionCheck.INCOMING,
        date: new Date(),
        sender: userId, // Track who funded the wallet
        metadata: {
          originalReference: data.reference,
          sourceUser: userId,
          sourceUserName:
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            user.userName,
          paystackData: data,
          webhookProcessed: true,
          processedAt: new Date(),
        },
      };

      // Create standalone transactions
      const [userStandaloneTransaction] = await Transaction.create(
        [userTransactionData],
        { session }
      );
      const [systemStandaloneTransaction] = await Transaction.create(
        [systemTransactionData],
        { session }
      );

      // Add transactions to wallets' embedded transactions arrays
      userWallet.transactions.push(userTransactionData as any);
      systemWallet.transactions.push(systemTransactionData as any);

      // Update user wallet balance
      logger.info(`Updating user wallet balance: +₦${amount}`);
      userWallet.balance += amount;
      userWallet.availableBalance += amount;
      await userWallet.save({ session });

      // Update system wallet balance
      logger.info(`Updating system wallet balance: +₦${amount}`);
      systemWallet.balance += amount;
      systemWallet.availableBalance += amount;
      await systemWallet.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      console.log("💾 Transactions saved to both user and system wallets");

      // Create notification for user
      await notificationService.createNotification(
        userId,
        "Wallet Funded",
        `Your wallet has been credited with ₦${amount.toLocaleString()}.`,
        NotificationType.TRANSACTION,
        "/dashboard/my-transactions",
        { transactionId: userStandaloneTransaction._id }
      );

      // Create notification for system/admin
      await notificationService.createNotification(
        systemUser._id.toString(),
        "System Wallet Credit",
        `System wallet credited with ₦${amount.toLocaleString()} from ${
          user.firstName || user.userName || "User"
        } wallet funding.`,
        NotificationType.TRANSACTION,
        "/dashboard/transactions",
        {
          transactionId: systemStandaloneTransaction._id,
          sourceUserId: userId,
          originalReference: data.reference,
        }
      );

      // Send wallet funding confirmation email to user
      if (user.email) {
        try {
          const cardLastFour = data.authorization?.last4 || "****";

          await emailService.sendTransactionStatusEmail(
            user.email,
            user.firstName || user.userName || "Valued Customer",
            amount,
            data.reference,
            TransactionStatus.COMPLETED,
            new Date(),
            cardLastFour,
            userStandaloneTransaction._id.toString()
          );

          logger.info(
            `Wallet funding confirmation email sent to: ${user.email}`
          );
        } catch (emailError) {
          logger.error("Failed to send wallet funding email:", emailError);
        }
      }

      logger.info(
        `Webhook processing completed successfully for reference: ${data.reference}`
      );
      return {
        success: true,
        message: "Webhook processed successfully",
        transaction: userStandaloneTransaction,
        systemTransaction: systemStandaloneTransaction,
        userWalletBalance: userWallet.availableBalance,
        systemWalletBalance: systemWallet.availableBalance,
      };
    } catch (error) {
      // Rollback the transaction on error
      await session.abortTransaction();
      logger.error("Wallet funding transaction failed:", error);

      return {
        success: false,
        message: `Wallet funding failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Handle failed charge event
   */
  private async handleFailedCharge(data: any) {
    logger.info(`Processing failed charge for reference: ${data.reference}`);

    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({
      reference: data.reference,
    });

    if (
      existingTransaction &&
      existingTransaction.status !== TransactionStatus.PENDING
    ) {
      logger.info(`Transaction already processed: ${data.reference}`);
      return {
        success: true,
        message: "Transaction already processed",
        transaction: existingTransaction,
      };
    }

    // Extract user ID from metadata
    const userId = await this.extractUserId(data);

    if (!userId) {
      logger.error("User ID not found in payment metadata", data.metadata);
      return {
        success: false,
        message: "User ID not found in payment metadata",
      };
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      logger.error(`User not found: ${userId}`);
      return {
        success: false,
        message: "User not found",
      };
    }

    const amount = data.amount / 100; // Convert from kobo to naira

    // Create transaction object
    const transactionData = {
      user: userId,
      type: TransactionType.DEPOSIT,
      amount,
      status: TransactionStatus.FAILED,
      check: TransactionCheck.INCOMING,
      reference: data.reference,
      description: `Failed wallet funding via Paystack`,
      paymentMethod: PaymentMethod.CARD,
      date: new Date(),
      metadata: {
        paystackData: data,
        webhookProcessed: true,
        processedAt: new Date(),
        failureReason: data.gateway_response || "Payment failed",
      },
    };

    let transaction;
    if (existingTransaction) {
      existingTransaction.status = TransactionStatus.FAILED;
      existingTransaction.metadata = transactionData.metadata;
      transaction = await existingTransaction.save();
    } else {
      transaction = await Transaction.create(transactionData);

      // Also add to wallet's embedded transactions
      const wallet = await Wallet.findOne({ user: userId });
      if (wallet) {
        wallet.transactions.push(transactionData as any);
        await wallet.save();
      }
    }

    // Create notification
    await notificationService.createNotification(
      userId,
      "Payment Failed",
      `Your wallet funding of ₦${amount.toLocaleString()} was not successful.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    logger.info(
      `Failed charge webhook processed for reference: ${data.reference}`
    );
    return {
      success: true,
      message: "Failed charge webhook processed",
      transaction,
    };
  }

  /**
   * Handle failed transfer event
   */
  private async handleFailedTransfer(data: any) {
    logger.info(`Processing failed transfer for reference: ${data.reference}`);

    const transaction = await Transaction.findOne({
      reference: data.reference,
    });

    if (!transaction) {
      logger.info(`No transaction found for reference: ${data.reference}`);
      return {
        success: false,
        message: "No transaction found for this reference",
      };
    }

    transaction.status = TransactionStatus.FAILED;
    transaction.metadata = {
      ...transaction.metadata,
      paystackData: data,
      webhookProcessed: true,
      processedAt: new Date(),
      failureReason: data.reason || "Transfer failed",
    };

    await transaction.save();

    const user = await User.findById(transaction.user);
    if (!user) {
      logger.error(`User not found: ${transaction.user}`);
      return {
        success: false,
        message: "User not found",
      };
    }

    await notificationService.createNotification(
      transaction.user.toString(),
      "Transfer Failed",
      `Your transfer of ₦${transaction.amount.toLocaleString()} was not successful.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    logger.info(
      `Failed transfer webhook processed for reference: ${data.reference}`
    );
    return {
      success: true,
      message: "Failed transfer webhook processed",
      transaction,
    };
  }

  /**
   * Handle reversed transfer event
   */
  private async handleReversedTransfer(data: any) {
    logger.info(
      `Processing reversed transfer for reference: ${data.reference}`
    );

    const transaction = await Transaction.findOne({
      reference: data.reference,
    });

    if (!transaction) {
      logger.info(`No transaction found for reference: ${data.reference}`);
      return {
        success: false,
        message: "No transaction found for this reference",
      };
    }

    transaction.status = TransactionStatus.DECLINED;
    transaction.metadata = {
      ...transaction.metadata,
      paystackData: data,
      webhookProcessed: true,
      processedAt: new Date(),
      reversalReason: data.reason || "Transfer reversed",
    };

    await transaction.save();

    const user = await User.findById(transaction.user);
    if (!user) {
      logger.error(`User not found: ${transaction.user}`);
      return {
        success: false,
        message: "User not found",
      };
    }

    if (transaction.type === TransactionType.WITHDRAWAL) {
      const wallet = await Wallet.findOne({ user: transaction.user });
      if (wallet) {
        wallet.balance += transaction.amount;
        wallet.availableBalance += transaction.amount;
        await wallet.save();

        logger.info(
          `Wallet balance updated after transfer reversal: +₦${transaction.amount}`
        );
      }
    }

    await notificationService.createNotification(
      transaction.user.toString(),
      "Transfer Reversed",
      `Your transfer of ₦${transaction.amount.toLocaleString()} has been reversed.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    logger.info(
      `Reversed transfer webhook processed for reference: ${data.reference}`
    );
    return {
      success: true,
      message: "Reversed transfer webhook processed",
      transaction,
    };
  }
}

export default new PaymentService();
