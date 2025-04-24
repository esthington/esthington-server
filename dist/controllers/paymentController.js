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
exports.getPaymentStatus = exports.paystackWebhook = exports.verifyPayment = void 0;
const http_status_codes_1 = require("http-status-codes");
const asyncHandler_1 = require("../utils/asyncHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const paymentService_1 = __importDefault(require("../services/paymentService"));
const appError_1 = require("../utils/appError");
/**
 * @desc    Verify payment callback
 * @route   GET /api/payments/verify/:reference
 * @access  Public
 */
exports.verifyPayment = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { reference } = req.params;
    if (!reference) {
        return next(new appError_1.AppError("Payment reference is required", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    try {
        const result = yield paymentService_1.default.verifyPayment(reference);
        if (result.success) {
            return res.status(http_status_codes_1.StatusCodes.OK).json({
                success: true,
                message: "Payment verified successfully",
                data: {
                    transaction: result.transaction,
                },
            });
        }
        else {
            logger_1.default.error(`Payment verification failed: ${result.message}`);
            return res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({
                success: false,
                message: result.message,
                data: {
                    reference,
                },
            });
        }
    }
    catch (error) {
        logger_1.default.error(`Payment verification error: ${error instanceof Error ? error.message : "Unknown error"}`);
        return next(new appError_1.AppError("Payment verification failed", http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR));
    }
}));
/**
 * @desc    Paystack webhook
 * @route   POST /api/payments/webhook/paystack
 * @access  Public
 */
exports.paystackWebhook = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Always return 200 to Paystack quickly, then process
    res.sendStatus(http_status_codes_1.StatusCodes.OK);
    try {
        // Get the raw request body as a string
        const payload = JSON.stringify(req.body);
        const signature = req.headers["x-paystack-signature"];
        // Verify webhook signature using our utility function
        const { verifyWebhookSignature } = require("../utils/paystackUtils");
        if (!verifyWebhookSignature(payload, signature)) {
            logger_1.default.error("Invalid Paystack webhook signature");
            return;
        }
        const event = req.body;
        // Log the webhook event
        logger_1.default.info(`Received Paystack webhook: ${event.event}`);
        // Handle charge.success event
        if (event.event === "charge.success") {
            const { reference } = event.data;
            try {
                const result = yield paymentService_1.default.verifyPayment(reference);
                logger_1.default.info(`Webhook processed successfully for reference: ${reference}, status: ${result.success ? "success" : "failed"}`);
            }
            catch (error) {
                logger_1.default.error(`Webhook processing error: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }
        // Handle other events if needed
        else if (event.event === "transfer.success") {
            // Handle successful transfers
            logger_1.default.info(`Transfer successful: ${event.data.reference}`);
        }
        else if (event.event === "transfer.failed") {
            // Handle failed transfers
            logger_1.default.error(`Transfer failed: ${event.data.reference}, reason: ${event.data.reason}`);
        }
    }
    catch (error) {
        logger_1.default.error(`Webhook error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}));
/**
 * @desc    Get payment status
 * @route   GET /api/payments/status/:reference
 * @access  Private
 */
exports.getPaymentStatus = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { reference } = req.params;
    if (!reference) {
        return next(new appError_1.AppError("Payment reference is required", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    try {
        // Find transaction by reference
        const Wallet = require("../models/walletModel").Wallet;
        const wallet = yield Wallet.findOne({ "transactions.reference": reference });
        if (!wallet) {
            return next(new appError_1.AppError("Transaction not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        const transaction = wallet.transactions.find((t) => t.reference === reference);
        if (!transaction) {
            return next(new appError_1.AppError("Transaction not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        // If transaction is still pending, try to verify it
        if (transaction.status === "pending") {
            try {
                yield paymentService_1.default.verifyPayment(reference);
                // Refresh wallet data to get updated transaction
                const updatedWallet = yield Wallet.findOne({ "transactions.reference": reference });
                const updatedTransaction = updatedWallet.transactions.find((t) => t.reference === reference);
                return res.status(http_status_codes_1.StatusCodes.OK).json({
                    success: true,
                    status: updatedTransaction.status,
                    transaction: updatedTransaction,
                });
            }
            catch (error) {
                logger_1.default.error(`Payment status check error: ${error instanceof Error ? error.message : "Unknown error"}`);
                // Continue with the current transaction data
            }
        }
        return res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            status: transaction.status,
            transaction,
        });
    }
    catch (error) {
        logger_1.default.error(`Payment status check error: ${error instanceof Error ? error.message : "Unknown error"}`);
        return next(new appError_1.AppError("Failed to check payment status", http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR));
    }
}));
//# sourceMappingURL=paymentController.js.map