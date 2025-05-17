import express from "express";
import {
  getWallet,
  getTransactions,
  fundWallet,
  withdrawFromWallet,
  transferMoney,
  getTransactionById,
  getAllTransactions,
  updateTransactionStatus,
  initializeWalletFunding,
  verifyWalletFunding,
  handlePaystackWebhook,
  searchWalletUsers,
} from "../controllers/walletController";
import { protect, restrictTo } from "../middleware/authMiddleware";
import { UserRole } from "../models/userModel";
import { verifyPayment } from "../controllers/paymentController";

const router = express.Router();

// Add this route BEFORE any middleware that requires authentication
// This needs to be a public route since Paystack will call it directly
router.post("/fund/webhook/paystack", handlePaystackWebhook)

// User routes
router.get("/", protect, getWallet);
router.get("/transactions", protect, getTransactions);
router.get("/transactions/:id", protect, getTransactionById);

// Protected routes (require authentication)
router.get("/users/search", protect, searchWalletUsers);

// Wallet funding routes
router.post("/fund", protect, fundWallet);
router.post("/fund/initialize", protect, initializeWalletFunding);
router.get("/fund/verify/:reference", protect, verifyPayment);

// Other wallet operations
router.post("/withdraw", protect, withdrawFromWallet);
router.post("/transfer", protect, transferMoney);

// Admin routes
router.get(
  "/admin/transactions",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getAllTransactions
);

router.put(
  "/admin/transactions/:id",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  updateTransactionStatus
);

export default router;
