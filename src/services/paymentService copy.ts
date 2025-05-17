import { v4 as uuidv4 } from "uuid";
import {
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  Wallet,
  type IWallet,
  type ITransaction,
} from "../models/walletModel";
import notificationService from "./notificationService";
import { NotificationType } from "../models/notificationModel";
import logger from "../utils/logger";
import mongoose from "mongoose";
import config from "../config/config";

// Initialize Paystack directly
const paystack = require("paystack")(config.paystack.secretKey);

class PaymentService {
  /**
   * Initialize payment for wallet funding
   */
  async initializeWalletFunding(userId: string, amount: number, email: string) {
    const reference = `fund_${uuidv4()}`;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Use Paystack directly
      const paystackResponse = await paystack.transaction.initialize({
        email,
        amount: amount * 100, // Convert to kobo
        reference,
        callback_url: null,
        metadata: JSON.stringify({ userId, type: "wallet_funding" }),
      });

      // Create transaction record
      const wallet = await this.findOrCreateWallet(userId);

      // Add transaction to wallet
      const newTransaction: Partial<ITransaction> = {
        _id: new mongoose.Types.ObjectId(), // Now correctly typed as ObjectId
        type: TransactionType.DEPOSIT,
        amount,
        status: TransactionStatus.PENDING,
        reference,
        description: `Wallet funding via Paystack ${
          this.isTestMode() ? "(Test Mode)" : ""
        }`,
        paymentMethod: PaymentMethod.PAYSTACK,
        date: new Date(),
        metadata: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          is_test: this.isTestMode(),
        },
      };

      wallet.transactions.push(newTransaction as ITransaction);
      await wallet.save({ session });
      await session.commitTransaction();

      // Get the created transaction
      const transaction = wallet.transactions[wallet.transactions.length - 1];

      return {
        authorization_url: paystackResponse.data.authorization_url,
        reference,
        transaction,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `Payment initialization error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Initialize payment for property purchase
   */
  async initializePropertyPurchase(
    userId: string,
    propertyId: string,
    amount: number,
    email: string
  ) {
    const reference = `property_${uuidv4()}`;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Use Paystack directly
      const paystackResponse = await paystack.transaction.initialize({
        email,
        amount: amount * 100, // Convert to kobo
        reference,
        callback_url: null,
        metadata: JSON.stringify({
          userId,
          propertyId,
          type: "property_purchase",
        }),
      });

      // Find or create wallet
      const wallet = await this.findOrCreateWallet(userId);

      // Add transaction to wallet
      const newTransaction: Partial<ITransaction> = {
        _id: new mongoose.Types.ObjectId(), // Now correctly typed as ObjectId
        type: TransactionType.PROPERTY_PURCHASE,
        amount,
        status: TransactionStatus.PENDING,
        reference,
        description: `Property purchase payment ${
          this.isTestMode() ? "(Test Mode)" : ""
        }`,
        paymentMethod: PaymentMethod.PAYSTACK,
        date: new Date(),
        property: new mongoose.Types.ObjectId(propertyId), // Properly convert to ObjectId
        metadata: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          is_test: this.isTestMode(),
        },
      };

      wallet.transactions.push(newTransaction as ITransaction);
      await wallet.save({ session });
      await session.commitTransaction();

      // Get the created transaction
      const transaction = wallet.transactions[wallet.transactions.length - 1];

      return {
        authorization_url: paystackResponse.data.authorization_url,
        reference,
        transaction,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `Property payment initialization error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Initialize payment for investment
   */
  async initializeInvestment(
    userId: string,
    investmentPlanId: string,
    amount: number,
    email: string
  ) {
    const reference = `invest_${uuidv4()}`;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Use Paystack directly
      const paystackResponse = await paystack.transaction.initialize({
        email,
        amount: amount * 100, // Convert to kobo
        reference,
        callback_url: null,
        metadata: JSON.stringify({
          userId,
          investmentPlanId,
          type: "investment",
        }),
      });

      // Find or create wallet
      const wallet = await this.findOrCreateWallet(userId);

      // Add transaction to wallet
      const newTransaction: Partial<ITransaction> = {
        _id: new mongoose.Types.ObjectId(), // Now correctly typed as ObjectId
        type: TransactionType.INVESTMENT,
        amount,
        status: TransactionStatus.PENDING,
        reference,
        description: `Investment payment ${
          this.isTestMode() ? "(Test Mode)" : ""
        }`,
        paymentMethod: PaymentMethod.PAYSTACK,
        date: new Date(),
        investment: new mongoose.Types.ObjectId(investmentPlanId), // Properly convert to ObjectId
        metadata: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          is_test: this.isTestMode(),
        },
      };

      wallet.transactions.push(newTransaction as ITransaction);
      await wallet.save({ session });
      await session.commitTransaction();

      // Get the created transaction
      const transaction = wallet.transactions[wallet.transactions.length - 1];

      return {
        authorization_url: paystackResponse.data.authorization_url,
        reference,
        transaction,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `Investment payment initialization error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Initialize payment for marketplace listing
   */
  async initializeMarketplacePurchase(
    userId: string,
    listingId: string,
    amount: number,
    email: string
  ) {
    const reference = `marketplace_${uuidv4()}`;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Use Paystack directly
      const paystackResponse = await paystack.transaction.initialize({
        email,
        amount: amount * 100, // Convert to kobo
        reference,
        callback_url: null,
        metadata: JSON.stringify({
          userId,
          listingId,
          type: "marketplace_purchase",
        }),
      });

      // Find or create wallet
      const wallet = await this.findOrCreateWallet(userId);

      // Add transaction to wallet
      const newTransaction: Partial<ITransaction> = {
        _id: new mongoose.Types.ObjectId(), // Now correctly typed as ObjectId
        type: TransactionType.PAYMENT,
        amount,
        status: TransactionStatus.PENDING,
        reference,
        description: `Marketplace listing purchase ${
          this.isTestMode() ? "(Test Mode)" : ""
        }`,
        paymentMethod: PaymentMethod.PAYSTACK,
        date: new Date(),
        metadata: {
          listingId,
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          is_test: this.isTestMode(),
        },
      };

      wallet.transactions.push(newTransaction as ITransaction);
      await wallet.save({ session });
      await session.commitTransaction();

      // Get the created transaction
      const transaction = wallet.transactions[wallet.transactions.length - 1];

      return {
        authorization_url: paystackResponse.data.authorization_url,
        reference,
        transaction,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `Marketplace payment initialization error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Verify payment and process based on transaction type
   */
  async verifyPayment(reference: string) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Find wallet with transaction
      const wallet = await Wallet.findOne({
        "transactions.reference": reference,
      });

      if (!wallet) {
        throw new Error("Transaction not found");
      }

      // Find transaction in wallet
      const transactionIndex = wallet.transactions.findIndex(
        (t) => t.reference === reference
      );

      if (transactionIndex === -1) {
        throw new Error("Transaction not found");
      }

      const transaction = wallet.transactions[transactionIndex];

      // Check if transaction is already completed
      if (transaction.status === TransactionStatus.COMPLETED) {
        return {
          success: true,
          message: "Transaction already verified and completed",
          transaction,
        };
      }

      // Verify with Paystack directly
      const verification = await paystack.transaction.verify(reference);

      if (verification.data.status === "success") {
        // Update transaction status
        wallet.transactions[transactionIndex].status =
          TransactionStatus.COMPLETED;
        wallet.transactions[transactionIndex].metadata = {
          ...transaction.metadata,
          paystack_response: {
            status: verification.data.status,
            amount: verification.data.amount,
            currency: verification.data.currency,
            transaction_date: verification.data.transaction_date,
            gateway_response: verification.data.gateway_response,
          },
        };

        await wallet.save({ session });

        // Process based on transaction type
        await this.processCompletedTransaction(wallet, transaction, session);

        await session.commitTransaction();

        return {
          success: true,
          message: "Payment verified and processed successfully",
          transaction: wallet.transactions[transactionIndex],
        };
      } else {
        wallet.transactions[transactionIndex].status = TransactionStatus.FAILED;
        wallet.transactions[transactionIndex].metadata = {
          ...transaction.metadata,
          paystack_response: {
            status: verification.data.status,
            amount: verification.data.amount,
            currency: verification.data.currency,
            transaction_date: verification.data.transaction_date,
            gateway_response: verification.data.gateway_response,
          },
        };

        await wallet.save({ session });
        await session.commitTransaction();

        return {
          success: false,
          message: `Payment verification failed: ${
            verification.data.gateway_response || "Unknown error"
          }`,
          transaction: wallet.transactions[transactionIndex],
        };
      }
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `Payment verification error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Process completed transaction based on type
   */
  private async processCompletedTransaction(
    wallet: IWallet,
    transaction: ITransaction,
    session: mongoose.ClientSession
  ) {
    const userId = wallet.user.toString();

    switch (transaction.type) {
      case TransactionType.DEPOSIT:
        await this.processWalletFunding(wallet, transaction, session);
        break;

      case TransactionType.PROPERTY_PURCHASE:
        await this.processPropertyPurchase(wallet, transaction, session);
        break;

      case TransactionType.INVESTMENT:
        await this.processInvestment(wallet, transaction, session);
        break;

      case TransactionType.PAYMENT:
        await this.processMarketplacePurchase(wallet, transaction, session);
        break;

      default:
        logger.warn(`Unhandled transaction type: ${transaction.type}`);
    }
  }

  /**
   * Process wallet funding
   */
  private async processWalletFunding(
    wallet: IWallet,
    transaction: ITransaction,
    session: mongoose.ClientSession
  ) {
    // Update wallet balance
    wallet.balance += transaction.amount;
    wallet.availableBalance += transaction.amount;
    await wallet.save({ session });

    // Create notification
    await notificationService.createNotification(
      wallet.user.toString(),
      "Payment Successful",
      `Your wallet has been funded with ₦${transaction.amount.toLocaleString()}.`,
      NotificationType.TRANSACTION,
      "/dashboard/wallet",
      { transactionId: transaction._id.toString() } // Convert ObjectId to string for notification
    );
  }

  /**
   * Process property purchase
   */
  private async processPropertyPurchase(
    wallet: IWallet,
    transaction: ITransaction,
    session: mongoose.ClientSession
  ) {
    if (!transaction.property) {
      logger.error("Missing property ID in transaction");
      throw new Error("Missing property ID in transaction");
    }

    // Update property status
    const Property = mongoose.model("Property");
    const property = await Property.findById(transaction.property);

    if (property) {
      property.status = "sold";
      property.soldAt = new Date();
      property.buyer = wallet.user;
      await property.save({ session });

      // Create notification for buyer
      await notificationService.createNotification(
        wallet.user.toString(),
        "Property Purchase Successful",
        `Your purchase of ${property.title} has been completed successfully.`,
        NotificationType.PROPERTY,
        `/dashboard/properties/${property._id}`,
        { propertyId: property._id.toString() } // Convert ObjectId to string for notification
      );

      // Create notification for seller
      if (property.owner) {
        await notificationService.createNotification(
          property.owner.toString(),
          "Property Sold",
          `Your property ${property.title} has been sold.`,
          NotificationType.PROPERTY,
          `/dashboard/properties/${property._id}`,
          { propertyId: property._id.toString() } // Convert ObjectId to string for notification
        );
      }
    } else {
      logger.error(`Property not found for transaction: ${transaction._id}`);
      throw new Error(`Property not found for transaction: ${transaction._id}`);
    }
  }

  /**
   * Process investment
   */
  private async processInvestment(
    wallet: IWallet,
    transaction: ITransaction,
    session: mongoose.ClientSession
  ) {
    if (!transaction.investment) {
      logger.error("Missing investment ID in transaction");
      throw new Error("Missing investment ID in transaction");
    }

    const InvestmentPlan = mongoose.model("InvestmentPlan");
    const UserInvestment = mongoose.model("UserInvestment");

    const investmentPlan = await InvestmentPlan.findById(
      transaction.investment
    );

    if (investmentPlan) {
      // Create user investment
      const userInvestment = await UserInvestment.create(
        [
          {
            user: wallet.user,
            plan: investmentPlan._id,
            amount: transaction.amount,
            startDate: new Date(),
            endDate: new Date(
              Date.now() + investmentPlan.duration * 30 * 24 * 60 * 60 * 1000
            ),
            expectedReturn:
              (transaction.amount * investmentPlan.expectedReturn) / 100,
            status: "active",
          },
        ],
        { session }
      );

      // Update investment plan
      investmentPlan.totalRaised += transaction.amount;
      await investmentPlan.save({ session });

      // Create notification
      await notificationService.createNotification(
        wallet.user.toString(),
        "Investment Successful",
        `Your investment of ₦${transaction.amount.toLocaleString()} in ${
          investmentPlan.title
        } has been processed successfully.`,
        NotificationType.INVESTMENT,
        `/dashboard/investments/${userInvestment[0]._id}`,
        { investmentId: userInvestment[0]._id.toString() } // Convert ObjectId to string for notification
      );
    } else {
      logger.error(
        `Investment plan not found for transaction: ${transaction._id}`
      );
      throw new Error(
        `Investment plan not found for transaction: ${transaction._id}`
      );
    }
  }

  /**
   * Process marketplace purchase
   */
  private async processMarketplacePurchase(
    wallet: IWallet,
    transaction: ITransaction,
    session: mongoose.ClientSession
  ) {
    if (!transaction.metadata || !transaction.metadata.listingId) {
      logger.error("Missing listing ID in transaction metadata");
      throw new Error("Missing listing ID in transaction metadata");
    }

    const MarketplaceListing = mongoose.model("MarketplaceListing");
    const listing = await MarketplaceListing.findById(
      transaction.metadata.listingId
    );

    if (listing) {
      listing.status = "sold";
      listing.buyer = wallet.user;
      listing.soldAt = new Date();
      await listing.save({ session });

      // Create notification for buyer
      await notificationService.createNotification(
        wallet.user.toString(),
        "Marketplace Purchase Successful",
        `Your purchase of ${listing.title} has been completed successfully.`,
        NotificationType.TRANSACTION,
        `/dashboard/marketplace/purchases/${listing._id}`,
        { listingId: listing._id.toString() } // Convert ObjectId to string for notification
      );

      // Create notification for seller
      await notificationService.createNotification(
        listing.seller.toString(),
        "Listing Sold",
        `Your listing ${listing.title} has been sold.`,
        NotificationType.TRANSACTION,
        `/dashboard/marketplace/listings/${listing._id}`,
        { listingId: listing._id.toString() } // Convert ObjectId to string for notification
      );
    } else {
      logger.error(
        `Marketplace listing not found for transaction: ${transaction._id}`
      );
      throw new Error(
        `Marketplace listing not found for transaction: ${transaction._id}`
      );
    }
  }

  /**
   * Find or create a wallet for a user
   */
  private async findOrCreateWallet(userId: string): Promise<IWallet> {
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.create({
        user: new mongoose.Types.ObjectId(userId),
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        transactions: [],
      });
    }

    return wallet;
  }

  /**
   * Check if we're in test mode
   */
  private isTestMode(): boolean {
    return config.paystack.secretKey.startsWith("sk_test_");
  }
}

export default new PaymentService();
