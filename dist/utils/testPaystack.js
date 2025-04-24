"use strict";
// import paystackService from "../services/paystackService2";
// import { generatePaystackReference, isPaystackTestMode } from "./paystackUtils";
// import logger from "./logger";
// /**
//  * Test Paystack integration
//  * This function can be used to test if Paystack is properly configured
//  */
// export const testPaystackIntegration = async (): Promise<boolean> => {
//   try {
//     // Check if we're in test mode
//     if (!isPaystackTestMode()) {
//       logger.warn(
//         "Paystack is not in test mode. Skipping test to avoid real charges."
//       );
//       return false;
//     }
//     // Generate a test reference
//     const reference = generatePaystackReference("test");
//     // Initialize a test transaction
//     const response = await paystackService.initializeTransaction(
//       "test@example.com",
//       100, // 1 Naira in kobo
//       reference,
//       "https://example.com/callback",
//       { test: true }
//     );
//     logger.info(
//       `Paystack test initialization successful: ${JSON.stringify(
//         response.data
//       )}`
//     );
//     return true;
//   } catch (error) {
//     logger.error(
//       `Paystack test failed: ${
//         error instanceof Error ? error.message : "Unknown error"
//       }`
//     );
//     return false;
//   }
// };
// /**
//  * This function can be called during server startup to verify Paystack configuration
//  */
// export const verifyPaystackConfig = async (): Promise<void> => {
//   if (!process.env.PAYSTACK_SECRET_KEY || !process.env.PAYSTACK_PUBLIC_KEY) {
//     logger.warn(
//       "Paystack API keys not configured. Payment features will not work."
//     );
//     return;
//   }
//   if (isPaystackTestMode()) {
//     logger.info("Paystack is configured in TEST mode");
//     // Optionally run a test transaction
//     if (process.env.NODE_ENV === "development") {
//       const testResult = await testPaystackIntegration();
//       if (testResult) {
//         logger.info("Paystack test integration successful");
//       } else {
//         logger.warn("Paystack test integration failed");
//       }
//     }
//   } else {
//     logger.info("Paystack is configured in LIVE mode");
//   }
// };
//# sourceMappingURL=testPaystack.js.map