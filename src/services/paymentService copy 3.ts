import axios from "axios";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentMethod,
  Wallet,
} from "../models/walletModel";
import User from "../models/userModel";
import notificationService from "./notificationService";
import { NotificationType } from "../models/notificationModel";
import logger from "../utils/logger";
import emailService from "./emailService";

class PaymentService {
  private paystackSecretKey: string;
  private paystackBaseUrl: string;

  constructor() {
    this.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || "";
    this.paystackBaseUrl = "https://api.paystack.co";
  }

  /**
   * Initialize wallet funding via Paystack
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
      console.log("Verifying payment with reference:", reference);

      // Check if transaction already exists in our database
      const existingTransaction = await Transaction.findOne({ reference });
      
      if (existingTransaction) {
        return {
          success: true,
          message: "Transaction already processed",
          transaction: existingTransaction,
        };
      }

      // Verify with Paystack
      const response = await axios.get(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const { data } = response.data;

      if (data.status !== "success") {
        return {
          success: false,
          message: "Payment verification failed",
          transaction: null,
        };
      }

      // Extract user ID from metadata
      const userId = data.metadata?.userId;
      if (!userId) {
        console.error("User ID not found in payment metadata");
        return {
          success: false,
          message: "User ID not found in payment metadata",
          transaction: null,
        };
      }

      // Find user and wallet
      const user = await User.findById(userId);
      if (!user) {
        console.error("User not found:", userId);
        return {
          success: false,
          message: "User not found",
          transaction: null,
        };
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
      const amount = data.amount / 100; // Convert from kobo to naira
      const transaction = await Transaction.create({
        user: userId,
        type: TransactionType.DEPOSIT,
        amount,
        status: TransactionStatus.COMPLETED,
        reference: data.reference,
        description: `Wallet funding via Paystack`,
        paymentMethod: PaymentMethod.CARD,
        metadata: {
          paystackData: data,
        },
      });

      // Update wallet balance
      wallet.balance += amount;
      wallet.availableBalance += amount;
      await wallet.save();

      // Create notification
      await notificationService.createNotification(
        userId,
        "Wallet Funded",
        `Your wallet has been credited with ₦${amount.toLocaleString()}.`,
        NotificationType.TRANSACTION,
        "/dashboard/my-transactions",
        { transactionId: transaction._id }
      );

      return {
        success: true,
        message: "Payment verified successfully",
        transaction,
      };
    } catch (error) {
      console.error("Payment verification error:", error);
      return {
        success: false,
        message: "Payment verification failed",
        transaction: null,
      };
    }
  }

  /**
   * Process Paystack webhook
   * @param payload Webhook payload from Paystack
   */
  async processPaystackWebhook(payload: any) {
    logger.info("Processing Paystack webhook:", {
      reference: payload.data?.reference,
      event: payload.event,
    });

    try {
      const { event, data } = payload;

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

    // If still not found, try to extract from custom_fields if available
    if (!userId && data.metadata?.custom_fields) {
      const paymentForField = data.metadata.custom_fields.find(
        (field: any) =>
          field.variable_name === "payment_for" &&
          field.value === "Wallet Funding"
      );

      if (paymentForField) {
        // Try to find the transaction by reference in your database
        const pendingTransaction = await Transaction.findOne({
          reference: data.reference,
          status: TransactionStatus.PENDING,
        });

        if (pendingTransaction) {
          userId = pendingTransaction.user.toString();
          logger.info(`Found pending transaction with userId: ${userId}`);
        }
      }
    }

    return userId;
  }

  /**
   * Handle successful charge event
   */
  private async handleSuccessfulCharge(data: any) {
    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({
      reference: data.reference,
    });

    if (existingTransaction) {
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

      // Store the webhook data for manual processing later
      await Transaction.create({
        type: TransactionType.DEPOSIT,
        amount: data.amount / 100, // Convert from kobo to naira
        status: TransactionStatus.PENDING,
        reference: data.reference,
        description: `Unprocessed Paystack webhook - missing userId`,
        paymentMethod: PaymentMethod.CARD,
        metadata: {
          paystackData: data,
          webhookProcessed: false,
          requiresManualProcessing: true,
          processedAt: new Date(),
        },
      });

      return {
        success: false,
        message:
          "User ID not found in payment metadata, stored for manual processing",
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

    // Find or create wallet
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      logger.info(`Creating new wallet for user: ${userId}`);
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
      });
    }

    // Create transaction
    const amount = data.amount / 100; // Convert from kobo to naira
    logger.info(`Creating transaction for amount: ₦${amount}`);

    const transaction = await Transaction.create({
      user: userId,
      type: TransactionType.DEPOSIT,
      amount,
      status: TransactionStatus.COMPLETED,
      reference: data.reference,
      description: `Wallet funding via Paystack`,
      paymentMethod: PaymentMethod.CARD,
      metadata: {
        paystackData: data,
        webhookProcessed: true,
        processedAt: new Date(),
      },
    });

    // Update wallet balance
    logger.info(`Updating wallet balance: +₦${amount}`);
    wallet.balance += amount;
    wallet.availableBalance += amount;
    await wallet.save();

    // Create notification
    await notificationService.createNotification(
      userId,
      "Wallet Funded",
      `Your wallet has been credited with ₦${amount.toLocaleString()}.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    // Send wallet funding confirmation email
    if (user.email) {
      try {
        // Get card details if available
        const cardLastFour = data.authorization?.last4 || "****";

        // Send transaction status email
        await emailService.sendTransactionStatusEmail(
          user.email,
          user.firstName || user.userName || "Valued Customer",
          amount,
          data.reference,
          TransactionStatus.COMPLETED,
          new Date(),
          cardLastFour,
          transaction._id.toString()
        );

        logger.info(`Wallet funding confirmation email sent to: ${user.email}`);
      } catch (emailError) {
        // Log the error but don't fail the webhook processing
        logger.error("Failed to send wallet funding email:", emailError);
      }
    }

    logger.info(
      `Webhook processing completed successfully for reference: ${data.reference}`
    );
    return {
      success: true,
      message: "Webhook processed successfully",
      transaction,
    };
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

      // Store the webhook data for manual processing later
      await Transaction.create({
        type: TransactionType.DEPOSIT,
        amount: data.amount / 100, // Convert from kobo to naira
        status: TransactionStatus.FAILED,
        reference: data.reference,
        description: `Failed Paystack charge - missing userId`,
        paymentMethod: PaymentMethod.CARD,
        metadata: {
          paystackData: data,
          webhookProcessed: true,
          requiresManualProcessing: true,
          processedAt: new Date(),
        },
      });

      return {
        success: false,
        message:
          "User ID not found in payment metadata, stored for manual processing",
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

    // Create or update transaction
    const amount = data.amount / 100; // Convert from kobo to naira

    let transaction;
    if (existingTransaction) {
      existingTransaction.status = TransactionStatus.FAILED;
      existingTransaction.metadata = {
        ...existingTransaction.metadata,
        paystackData: data,
        webhookProcessed: true,
        processedAt: new Date(),
        failureReason: data.gateway_response || "Payment failed",
      };
      transaction = await existingTransaction.save();
    } else {
      transaction = await Transaction.create({
        user: userId,
        type: TransactionType.DEPOSIT,
        amount,
        status: TransactionStatus.FAILED,
        reference: data.reference,
        description: `Failed wallet funding via Paystack`,
        paymentMethod: PaymentMethod.CARD,
        metadata: {
          paystackData: data,
          webhookProcessed: true,
          processedAt: new Date(),
          failureReason: data.gateway_response || "Payment failed",
        },
      });
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

    // Send failed transaction email
    if (user.email) {
      try {
        // Get card details if available
        const cardLastFour = data.authorization?.last4 || "****";
        const failureReason =
          data.gateway_response || "Payment could not be processed";

        // Send transaction status email
        await emailService.sendTransactionStatusEmail(
          user.email,
          user.firstName || user.userName || "Valued Customer",
          amount,
          data.reference,
          TransactionStatus.FAILED,
          new Date(),
          cardLastFour,
          transaction._id.toString(),
          failureReason
        );

        logger.info(`Failed transaction email sent to: ${user.email}`);
      } catch (emailError) {
        // Log the error but don't fail the webhook processing
        logger.error("Failed to send transaction failed email:", emailError);
      }
    }

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

    // Find the transaction by reference
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

    // Update transaction status
    transaction.status = TransactionStatus.FAILED;
    transaction.metadata = {
      ...transaction.metadata,
      paystackData: data,
      webhookProcessed: true,
      processedAt: new Date(),
      failureReason: data.reason || "Transfer failed",
    };

    await transaction.save();

    // Find user
    const user = await User.findById(transaction.user);
    if (!user) {
      logger.error(`User not found: ${transaction.user}`);
      return {
        success: false,
        message: "User not found",
      };
    }

    // Create notification
    await notificationService.createNotification(
      transaction.user.toString(),
      "Transfer Failed",
      `Your transfer of ₦${transaction.amount.toLocaleString()} was not successful.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    // Send failed transaction email
    if (user.email) {
      try {
        // Send transaction status email
        await emailService.sendTransactionStatusEmail(
          user.email,
          user.firstName || user.userName || "Valued Customer",
          transaction.amount,
          data.reference,
          TransactionStatus.FAILED,
          new Date(),
          undefined,
          transaction._id.toString(),
          data.reason || "Transfer could not be completed"
        );

        logger.info(`Failed transfer email sent to: ${user.email}`);
      } catch (emailError) {
        // Log the error but don't fail the webhook processing
        logger.error("Failed to send transfer failed email:", emailError);
      }
    }

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

    // Find the transaction by reference
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

    // Update transaction status
    transaction.status = TransactionStatus.DECLINED;
    transaction.metadata = {
      ...transaction.metadata,
      paystackData: data,
      webhookProcessed: true,
      processedAt: new Date(),
      reversalReason: data.reason || "Transfer reversed",
    };

    await transaction.save();

    // Find user
    const user = await User.findById(transaction.user);
    if (!user) {
      logger.error(`User not found: ${transaction.user}`);
      return {
        success: false,
        message: "User not found",
      };
    }

    // If this was a withdrawal, we need to credit the wallet back
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

    // Create notification
    await notificationService.createNotification(
      transaction.user.toString(),
      "Transfer Reversed",
      `Your transfer of ₦${transaction.amount.toLocaleString()} has been reversed.`,
      NotificationType.TRANSACTION,
      "/dashboard/my-transactions",
      { transactionId: transaction._id }
    );

    // Send declined transaction email
    if (user.email) {
      try {
        // Send transaction status email
        await emailService.sendTransactionStatusEmail(
          user.email,
          user.firstName || user.userName || "Valued Customer",
          transaction.amount,
          data.reference,
          TransactionStatus.DECLINED,
          new Date(),
          undefined,
          transaction._id.toString(),
          data.reason || "Transfer was reversed"
        );

        logger.info(`Transfer reversed email sent to: ${user.email}`);
      } catch (emailError) {
        // Log the error but don't fail the webhook processing
        logger.error("Failed to send transfer reversed email:", emailError);
      }
    }

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
