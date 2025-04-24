"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePaystackReference = exports.isPaystackTestMode = exports.formatAmountFromPaystack = exports.formatAmountForPaystack = exports.verifyWebhookSignature = void 0;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("../config/config"));
/**
 * Verify Paystack webhook signature
 * @param payload Request body as string
 * @param signature X-Paystack-Signature header
 * @returns boolean indicating if signature is valid
 */
const verifyWebhookSignature = (payload, signature) => {
    if (!config_1.default.paystack.webhookSecret) {
        // If webhook secret is not configured, log a warning but allow in development
        if (config_1.default.env === "development") {
            return true;
        }
        return false;
    }
    const hash = crypto_1.default.createHmac("sha512", config_1.default.paystack.webhookSecret).update(payload).digest("hex");
    return hash === signature;
};
exports.verifyWebhookSignature = verifyWebhookSignature;
/**
 * Format amount to Paystack format (kobo)
 * @param amount Amount in naira
 * @returns Amount in kobo
 */
const formatAmountForPaystack = (amount) => {
    return Math.round(amount * 100);
};
exports.formatAmountForPaystack = formatAmountForPaystack;
/**
 * Format amount from Paystack format (kobo) to naira
 * @param amount Amount in kobo
 * @returns Amount in naira
 */
const formatAmountFromPaystack = (amount) => {
    return amount / 100;
};
exports.formatAmountFromPaystack = formatAmountFromPaystack;
/**
 * Check if Paystack is in test mode
 * @returns boolean indicating if Paystack is in test mode
 */
const isPaystackTestMode = () => {
    return config_1.default.paystack.testMode;
};
exports.isPaystackTestMode = isPaystackTestMode;
/**
 * Generate a unique reference for Paystack transactions
 * @param prefix Optional prefix for the reference
 * @returns Unique reference string
 */
const generatePaystackReference = (prefix = "tx") => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, "0");
    return `${prefix}_${timestamp}_${random}`;
};
exports.generatePaystackReference = generatePaystackReference;
//# sourceMappingURL=paystackUtils.js.map