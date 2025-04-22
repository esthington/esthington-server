import type { Request, Response, NextFunction } from "express"
import { StatusCodes } from "http-status-codes"
import { asyncHandler } from "../utils/asyncHandler"
import logger from "../utils/logger"
import paymentService from "../services/paymentService"
import { AppError } from "../utils/appError"

/**
 * @desc    Verify payment callback
 * @route   GET /api/payments/verify/:reference
 * @access  Public
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { reference } = req.params

  if (!reference) {
    return next(new AppError("Payment reference is required", StatusCodes.BAD_REQUEST))
  }

  try {
    const result = await paymentService.verifyPayment(reference)

    if (result.success) {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Payment verified successfully",
        data: {
          transaction: result.transaction,
        },
      })
    } else {
      logger.error(`Payment verification failed: ${result.message}`)
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: result.message,
        data: {
          reference,
        },
      })
    }
  } catch (error) {
    logger.error(`Payment verification error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return next(new AppError("Payment verification failed", StatusCodes.INTERNAL_SERVER_ERROR))
  }
})

/**
 * @desc    Paystack webhook
 * @route   POST /api/payments/webhook/paystack
 * @access  Public
 */
export const paystackWebhook = asyncHandler(async (req: Request, res: Response) => {
  // Always return 200 to Paystack quickly, then process
  res.sendStatus(StatusCodes.OK)

  try {
    // Get the raw request body as a string
    const payload = JSON.stringify(req.body)
    const signature = req.headers["x-paystack-signature"] as string

    // Verify webhook signature using our utility function
    const { verifyWebhookSignature } = require("../utils/paystackUtils")
    if (!verifyWebhookSignature(payload, signature)) {
      logger.error("Invalid Paystack webhook signature")
      return
    }

    const event = req.body

    // Log the webhook event
    logger.info(`Received Paystack webhook: ${event.event}`)

    // Handle charge.success event
    if (event.event === "charge.success") {
      const { reference } = event.data

      try {
        const result = await paymentService.verifyPayment(reference)
        logger.info(
          `Webhook processed successfully for reference: ${reference}, status: ${result.success ? "success" : "failed"}`,
        )
      } catch (error) {
        logger.error(`Webhook processing error: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    // Handle other events if needed
    else if (event.event === "transfer.success") {
      // Handle successful transfers
      logger.info(`Transfer successful: ${event.data.reference}`)
    } else if (event.event === "transfer.failed") {
      // Handle failed transfers
      logger.error(`Transfer failed: ${event.data.reference}, reason: ${event.data.reason}`)
    }
  } catch (error) {
    logger.error(`Webhook error: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
})

/**
 * @desc    Get payment status
 * @route   GET /api/payments/status/:reference
 * @access  Private
 */
export const getPaymentStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { reference } = req.params

  if (!reference) {
    return next(new AppError("Payment reference is required", StatusCodes.BAD_REQUEST))
  }

  try {
    // Find transaction by reference
    const Wallet = require("../models/walletModel").Wallet
    const wallet = await Wallet.findOne({ "transactions.reference": reference })

    if (!wallet) {
      return next(new AppError("Transaction not found", StatusCodes.NOT_FOUND))
    }

    const transaction = wallet.transactions.find((t: any) => t.reference === reference)

    if (!transaction) {
      return next(new AppError("Transaction not found", StatusCodes.NOT_FOUND))
    }

    // If transaction is still pending, try to verify it
    if (transaction.status === "pending") {
      try {
        await paymentService.verifyPayment(reference)

        // Refresh wallet data to get updated transaction
        const updatedWallet = await Wallet.findOne({ "transactions.reference": reference })
        const updatedTransaction = updatedWallet.transactions.find((t: any) => t.reference === reference)

        return res.status(StatusCodes.OK).json({
          success: true,
          status: updatedTransaction.status,
          transaction: updatedTransaction,
        })
      } catch (error) {
        logger.error(`Payment status check error: ${error instanceof Error ? error.message : "Unknown error"}`)
        // Continue with the current transaction data
      }
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      status: transaction.status,
      transaction,
    })
  } catch (error) {
    logger.error(`Payment status check error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return next(new AppError("Failed to check payment status", StatusCodes.INTERNAL_SERVER_ERROR))
  }
})
