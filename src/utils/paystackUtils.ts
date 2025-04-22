import crypto from "crypto"
import config from "../config/config"

/**
 * Verify Paystack webhook signature
 * @param payload Request body as string
 * @param signature X-Paystack-Signature header
 * @returns boolean indicating if signature is valid
 */
export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  if (!config.paystack.webhookSecret) {
    // If webhook secret is not configured, log a warning but allow in development
    if (config.env === "development") {
      return true
    }
    return false
  }

  const hash = crypto.createHmac("sha512", config.paystack.webhookSecret).update(payload).digest("hex")

  return hash === signature
}

/**
 * Format amount to Paystack format (kobo)
 * @param amount Amount in naira
 * @returns Amount in kobo
 */
export const formatAmountForPaystack = (amount: number): number => {
  return Math.round(amount * 100)
}

/**
 * Format amount from Paystack format (kobo) to naira
 * @param amount Amount in kobo
 * @returns Amount in naira
 */
export const formatAmountFromPaystack = (amount: number): number => {
  return amount / 100
}

/**
 * Check if Paystack is in test mode
 * @returns boolean indicating if Paystack is in test mode
 */
export const isPaystackTestMode = (): boolean => {
  return config.paystack.testMode
}

/**
 * Generate a unique reference for Paystack transactions
 * @param prefix Optional prefix for the reference
 * @returns Unique reference string
 */
export const generatePaystackReference = (prefix = "tx"): string => {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0")
  return `${prefix}_${timestamp}_${random}`
}
