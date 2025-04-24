"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const walletModel_1 = require("../models/walletModel");
const notificationService_1 = __importDefault(require("./notificationService"));
const notificationModel_1 = require("../models/notificationModel");
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config/config"));
// Initialize Paystack directly
const paystack = require("paystack")(config_1.default.paystack.secretKey);
class PaymentService {
    /**
     * Initialize payment for wallet funding
     */
    initializeWalletFunding(userId, amount, email) {
        return __awaiter(this, void 0, void 0, function* () {
            const reference = `fund_${(0, uuid_1.v4)()}`;
            const session = yield mongoose_1.default.startSession();
            try {
                session.startTransaction();
                // Use Paystack directly
                const paystackResponse = yield paystack.transaction.initialize({
                    email,
                    amount: amount * 100, // Convert to kobo
                    reference,
                    callback_url: null,
                    metadata: JSON.stringify({ userId, type: "wallet_funding" }),
                });
                // Create transaction record
                const wallet = yield this.findOrCreateWallet(userId);
                // Add transaction to wallet
                const newTransaction = {
                    _id: new mongoose_1.default.Types.ObjectId(), // Now correctly typed as ObjectId
                    type: walletModel_1.TransactionType.DEPOSIT,
                    amount,
                    status: walletModel_1.TransactionStatus.PENDING,
                    reference,
                    description: `Wallet funding via Paystack ${this.isTestMode() ? "(Test Mode)" : ""}`,
                    paymentMethod: walletModel_1.PaymentMethod.PAYSTACK,
                    date: new Date(),
                    metadata: {
                        authorization_url: paystackResponse.data.authorization_url,
                        access_code: paystackResponse.data.access_code,
                        is_test: this.isTestMode(),
                    },
                };
                wallet.transactions.push(newTransaction);
                yield wallet.save({ session });
                yield session.commitTransaction();
                // Get the created transaction
                const transaction = wallet.transactions[wallet.transactions.length - 1];
                return {
                    authorization_url: paystackResponse.data.authorization_url,
                    reference,
                    transaction,
                };
            }
            catch (error) {
                yield session.abortTransaction();
                logger_1.default.error(`Payment initialization error: ${error instanceof Error ? error.message : "Unknown error"}`);
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Initialize payment for property purchase
     */
    initializePropertyPurchase(userId, propertyId, amount, email) {
        return __awaiter(this, void 0, void 0, function* () {
            const reference = `property_${(0, uuid_1.v4)()}`;
            const session = yield mongoose_1.default.startSession();
            try {
                session.startTransaction();
                // Use Paystack directly
                const paystackResponse = yield paystack.transaction.initialize({
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
                const wallet = yield this.findOrCreateWallet(userId);
                // Add transaction to wallet
                const newTransaction = {
                    _id: new mongoose_1.default.Types.ObjectId(), // Now correctly typed as ObjectId
                    type: walletModel_1.TransactionType.PROPERTY_PURCHASE,
                    amount,
                    status: walletModel_1.TransactionStatus.PENDING,
                    reference,
                    description: `Property purchase payment ${this.isTestMode() ? "(Test Mode)" : ""}`,
                    paymentMethod: walletModel_1.PaymentMethod.PAYSTACK,
                    date: new Date(),
                    property: new mongoose_1.default.Types.ObjectId(propertyId), // Properly convert to ObjectId
                    metadata: {
                        authorization_url: paystackResponse.data.authorization_url,
                        access_code: paystackResponse.data.access_code,
                        is_test: this.isTestMode(),
                    },
                };
                wallet.transactions.push(newTransaction);
                yield wallet.save({ session });
                yield session.commitTransaction();
                // Get the created transaction
                const transaction = wallet.transactions[wallet.transactions.length - 1];
                return {
                    authorization_url: paystackResponse.data.authorization_url,
                    reference,
                    transaction,
                };
            }
            catch (error) {
                yield session.abortTransaction();
                logger_1.default.error(`Property payment initialization error: ${error instanceof Error ? error.message : "Unknown error"}`);
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Initialize payment for investment
     */
    initializeInvestment(userId, investmentPlanId, amount, email) {
        return __awaiter(this, void 0, void 0, function* () {
            const reference = `invest_${(0, uuid_1.v4)()}`;
            const session = yield mongoose_1.default.startSession();
            try {
                session.startTransaction();
                // Use Paystack directly
                const paystackResponse = yield paystack.transaction.initialize({
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
                const wallet = yield this.findOrCreateWallet(userId);
                // Add transaction to wallet
                const newTransaction = {
                    _id: new mongoose_1.default.Types.ObjectId(), // Now correctly typed as ObjectId
                    type: walletModel_1.TransactionType.INVESTMENT,
                    amount,
                    status: walletModel_1.TransactionStatus.PENDING,
                    reference,
                    description: `Investment payment ${this.isTestMode() ? "(Test Mode)" : ""}`,
                    paymentMethod: walletModel_1.PaymentMethod.PAYSTACK,
                    date: new Date(),
                    investment: new mongoose_1.default.Types.ObjectId(investmentPlanId), // Properly convert to ObjectId
                    metadata: {
                        authorization_url: paystackResponse.data.authorization_url,
                        access_code: paystackResponse.data.access_code,
                        is_test: this.isTestMode(),
                    },
                };
                wallet.transactions.push(newTransaction);
                yield wallet.save({ session });
                yield session.commitTransaction();
                // Get the created transaction
                const transaction = wallet.transactions[wallet.transactions.length - 1];
                return {
                    authorization_url: paystackResponse.data.authorization_url,
                    reference,
                    transaction,
                };
            }
            catch (error) {
                yield session.abortTransaction();
                logger_1.default.error(`Investment payment initialization error: ${error instanceof Error ? error.message : "Unknown error"}`);
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Initialize payment for marketplace listing
     */
    initializeMarketplacePurchase(userId, listingId, amount, email) {
        return __awaiter(this, void 0, void 0, function* () {
            const reference = `marketplace_${(0, uuid_1.v4)()}`;
            const session = yield mongoose_1.default.startSession();
            try {
                session.startTransaction();
                // Use Paystack directly
                const paystackResponse = yield paystack.transaction.initialize({
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
                const wallet = yield this.findOrCreateWallet(userId);
                // Add transaction to wallet
                const newTransaction = {
                    _id: new mongoose_1.default.Types.ObjectId(), // Now correctly typed as ObjectId
                    type: walletModel_1.TransactionType.PAYMENT,
                    amount,
                    status: walletModel_1.TransactionStatus.PENDING,
                    reference,
                    description: `Marketplace listing purchase ${this.isTestMode() ? "(Test Mode)" : ""}`,
                    paymentMethod: walletModel_1.PaymentMethod.PAYSTACK,
                    date: new Date(),
                    metadata: {
                        listingId,
                        authorization_url: paystackResponse.data.authorization_url,
                        access_code: paystackResponse.data.access_code,
                        is_test: this.isTestMode(),
                    },
                };
                wallet.transactions.push(newTransaction);
                yield wallet.save({ session });
                yield session.commitTransaction();
                // Get the created transaction
                const transaction = wallet.transactions[wallet.transactions.length - 1];
                return {
                    authorization_url: paystackResponse.data.authorization_url,
                    reference,
                    transaction,
                };
            }
            catch (error) {
                yield session.abortTransaction();
                logger_1.default.error(`Marketplace payment initialization error: ${error instanceof Error ? error.message : "Unknown error"}`);
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Verify payment and process based on transaction type
     */
    verifyPayment(reference) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield mongoose_1.default.startSession();
            try {
                session.startTransaction();
                // Find wallet with transaction
                const wallet = yield walletModel_1.Wallet.findOne({
                    "transactions.reference": reference,
                });
                if (!wallet) {
                    throw new Error("Transaction not found");
                }
                // Find transaction in wallet
                const transactionIndex = wallet.transactions.findIndex((t) => t.reference === reference);
                if (transactionIndex === -1) {
                    throw new Error("Transaction not found");
                }
                const transaction = wallet.transactions[transactionIndex];
                // Check if transaction is already completed
                if (transaction.status === walletModel_1.TransactionStatus.COMPLETED) {
                    return {
                        success: true,
                        message: "Transaction already verified and completed",
                        transaction,
                    };
                }
                // Verify with Paystack directly
                const verification = yield paystack.transaction.verify(reference);
                if (verification.data.status === "success") {
                    // Update transaction status
                    wallet.transactions[transactionIndex].status =
                        walletModel_1.TransactionStatus.COMPLETED;
                    wallet.transactions[transactionIndex].metadata = Object.assign(Object.assign({}, transaction.metadata), { paystack_response: {
                            status: verification.data.status,
                            amount: verification.data.amount,
                            currency: verification.data.currency,
                            transaction_date: verification.data.transaction_date,
                            gateway_response: verification.data.gateway_response,
                        } });
                    yield wallet.save({ session });
                    // Process based on transaction type
                    yield this.processCompletedTransaction(wallet, transaction, session);
                    yield session.commitTransaction();
                    return {
                        success: true,
                        message: "Payment verified and processed successfully",
                        transaction: wallet.transactions[transactionIndex],
                    };
                }
                else {
                    wallet.transactions[transactionIndex].status = walletModel_1.TransactionStatus.FAILED;
                    wallet.transactions[transactionIndex].metadata = Object.assign(Object.assign({}, transaction.metadata), { paystack_response: {
                            status: verification.data.status,
                            amount: verification.data.amount,
                            currency: verification.data.currency,
                            transaction_date: verification.data.transaction_date,
                            gateway_response: verification.data.gateway_response,
                        } });
                    yield wallet.save({ session });
                    yield session.commitTransaction();
                    return {
                        success: false,
                        message: `Payment verification failed: ${verification.data.gateway_response || "Unknown error"}`,
                        transaction: wallet.transactions[transactionIndex],
                    };
                }
            }
            catch (error) {
                yield session.abortTransaction();
                logger_1.default.error(`Payment verification error: ${error instanceof Error ? error.message : "Unknown error"}`);
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Process completed transaction based on type
     */
    processCompletedTransaction(wallet, transaction, session) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = wallet.user.toString();
            switch (transaction.type) {
                case walletModel_1.TransactionType.DEPOSIT:
                    yield this.processWalletFunding(wallet, transaction, session);
                    break;
                case walletModel_1.TransactionType.PROPERTY_PURCHASE:
                    yield this.processPropertyPurchase(wallet, transaction, session);
                    break;
                case walletModel_1.TransactionType.INVESTMENT:
                    yield this.processInvestment(wallet, transaction, session);
                    break;
                case walletModel_1.TransactionType.PAYMENT:
                    yield this.processMarketplacePurchase(wallet, transaction, session);
                    break;
                default:
                    logger_1.default.warn(`Unhandled transaction type: ${transaction.type}`);
            }
        });
    }
    /**
     * Process wallet funding
     */
    processWalletFunding(wallet, transaction, session) {
        return __awaiter(this, void 0, void 0, function* () {
            // Update wallet balance
            wallet.balance += transaction.amount;
            wallet.availableBalance += transaction.amount;
            yield wallet.save({ session });
            // Create notification
            yield notificationService_1.default.createNotification(wallet.user.toString(), "Payment Successful", `Your wallet has been funded with ₦${transaction.amount.toLocaleString()}.`, notificationModel_1.NotificationType.TRANSACTION, "/dashboard/wallet", { transactionId: transaction._id.toString() } // Convert ObjectId to string for notification
            );
        });
    }
    /**
     * Process property purchase
     */
    processPropertyPurchase(wallet, transaction, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!transaction.property) {
                logger_1.default.error("Missing property ID in transaction");
                throw new Error("Missing property ID in transaction");
            }
            // Update property status
            const Property = mongoose_1.default.model("Property");
            const property = yield Property.findById(transaction.property);
            if (property) {
                property.status = "sold";
                property.soldAt = new Date();
                property.buyer = wallet.user;
                yield property.save({ session });
                // Create notification for buyer
                yield notificationService_1.default.createNotification(wallet.user.toString(), "Property Purchase Successful", `Your purchase of ${property.title} has been completed successfully.`, notificationModel_1.NotificationType.PROPERTY, `/dashboard/properties/${property._id}`, { propertyId: property._id.toString() } // Convert ObjectId to string for notification
                );
                // Create notification for seller
                if (property.owner) {
                    yield notificationService_1.default.createNotification(property.owner.toString(), "Property Sold", `Your property ${property.title} has been sold.`, notificationModel_1.NotificationType.PROPERTY, `/dashboard/properties/${property._id}`, { propertyId: property._id.toString() } // Convert ObjectId to string for notification
                    );
                }
            }
            else {
                logger_1.default.error(`Property not found for transaction: ${transaction._id}`);
                throw new Error(`Property not found for transaction: ${transaction._id}`);
            }
        });
    }
    /**
     * Process investment
     */
    processInvestment(wallet, transaction, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!transaction.investment) {
                logger_1.default.error("Missing investment ID in transaction");
                throw new Error("Missing investment ID in transaction");
            }
            const InvestmentPlan = mongoose_1.default.model("InvestmentPlan");
            const UserInvestment = mongoose_1.default.model("UserInvestment");
            const investmentPlan = yield InvestmentPlan.findById(transaction.investment);
            if (investmentPlan) {
                // Create user investment
                const userInvestment = yield UserInvestment.create([
                    {
                        user: wallet.user,
                        plan: investmentPlan._id,
                        amount: transaction.amount,
                        startDate: new Date(),
                        endDate: new Date(Date.now() + investmentPlan.duration * 30 * 24 * 60 * 60 * 1000),
                        expectedReturn: (transaction.amount * investmentPlan.expectedReturn) / 100,
                        status: "active",
                    },
                ], { session });
                // Update investment plan
                investmentPlan.totalRaised += transaction.amount;
                yield investmentPlan.save({ session });
                // Create notification
                yield notificationService_1.default.createNotification(wallet.user.toString(), "Investment Successful", `Your investment of ₦${transaction.amount.toLocaleString()} in ${investmentPlan.title} has been processed successfully.`, notificationModel_1.NotificationType.INVESTMENT, `/dashboard/investments/${userInvestment[0]._id}`, { investmentId: userInvestment[0]._id.toString() } // Convert ObjectId to string for notification
                );
            }
            else {
                logger_1.default.error(`Investment plan not found for transaction: ${transaction._id}`);
                throw new Error(`Investment plan not found for transaction: ${transaction._id}`);
            }
        });
    }
    /**
     * Process marketplace purchase
     */
    processMarketplacePurchase(wallet, transaction, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!transaction.metadata || !transaction.metadata.listingId) {
                logger_1.default.error("Missing listing ID in transaction metadata");
                throw new Error("Missing listing ID in transaction metadata");
            }
            const MarketplaceListing = mongoose_1.default.model("MarketplaceListing");
            const listing = yield MarketplaceListing.findById(transaction.metadata.listingId);
            if (listing) {
                listing.status = "sold";
                listing.buyer = wallet.user;
                listing.soldAt = new Date();
                yield listing.save({ session });
                // Create notification for buyer
                yield notificationService_1.default.createNotification(wallet.user.toString(), "Marketplace Purchase Successful", `Your purchase of ${listing.title} has been completed successfully.`, notificationModel_1.NotificationType.TRANSACTION, `/dashboard/marketplace/purchases/${listing._id}`, { listingId: listing._id.toString() } // Convert ObjectId to string for notification
                );
                // Create notification for seller
                yield notificationService_1.default.createNotification(listing.seller.toString(), "Listing Sold", `Your listing ${listing.title} has been sold.`, notificationModel_1.NotificationType.TRANSACTION, `/dashboard/marketplace/listings/${listing._id}`, { listingId: listing._id.toString() } // Convert ObjectId to string for notification
                );
            }
            else {
                logger_1.default.error(`Marketplace listing not found for transaction: ${transaction._id}`);
                throw new Error(`Marketplace listing not found for transaction: ${transaction._id}`);
            }
        });
    }
    /**
     * Find or create a wallet for a user
     */
    findOrCreateWallet(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            let wallet = yield walletModel_1.Wallet.findOne({ user: userId });
            if (!wallet) {
                wallet = yield walletModel_1.Wallet.create({
                    user: new mongoose_1.default.Types.ObjectId(userId),
                    balance: 0,
                    availableBalance: 0,
                    pendingBalance: 0,
                    transactions: [],
                });
            }
            return wallet;
        });
    }
    /**
     * Check if we're in test mode
     */
    isTestMode() {
        return config_1.default.paystack.secretKey.startsWith("sk_test_");
    }
}
exports.default = new PaymentService();
//# sourceMappingURL=paymentService.js.map