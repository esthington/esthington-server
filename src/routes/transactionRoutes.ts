import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware";
import {
  getAllTransactions,
  getAllTransactionsAdmin,
  getTransactionById,
  approveTransaction,
  rejectTransaction,
  getTransactionStats,
} from "../controllers/transactionController";
import { UserRole } from "../models/userModel";

const router = express.Router();

// Protect all routes
router.use(protect);

// Routes accessible by all authenticated users
router.get("/user", getAllTransactions); // User's own transactions
router.get(
  "/stats",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getTransactionStats
);

// Admin routes - restricted to admin and super admin
router.get(
  "/",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getAllTransactionsAdmin
);
router.get("/:id", getTransactionById);
router.patch(
  "/:id/approve",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  approveTransaction
);
router.patch(
  "/:id/reject",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  rejectTransaction
);

export default router;
