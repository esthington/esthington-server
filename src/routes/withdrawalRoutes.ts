import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware";
import {
  createWithdrawalRequest,
  getUserWithdrawals,
  getAllWithdrawalsAdmin,
  getWithdrawalById,
  approveWithdrawal,
  rejectWithdrawal,
  getWithdrawalStats,
} from "../controllers/withdrawalController";
import { UserRole } from "../models/userModel";

const router = express.Router();

// User routes
router.post("/", protect, createWithdrawalRequest); // Create withdrawal request
router.get("/user", protect, getUserWithdrawals); // User's own withdrawals

// Admin routes - restricted to admin and super admin
router.get(
  "/admin",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getAllWithdrawalsAdmin
);
router.get(
  "/stats",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getWithdrawalStats
);
router.get("/:id", protect, getWithdrawalById);
router.patch(
  "/:id/approve",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  approveWithdrawal
);
router.patch(
  "/:id/reject",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  rejectWithdrawal
);

export default router;
