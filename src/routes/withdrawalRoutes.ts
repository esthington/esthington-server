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

// Protect all routes
router.use(protect);

// User routes
router.post("/", createWithdrawalRequest); // Create withdrawal request
router.get("/user", getUserWithdrawals); // User's own withdrawals

// Admin routes - restricted to admin and super admin
router.get(
  "/admin",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getAllWithdrawalsAdmin
);
router.get(
  "/stats",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getWithdrawalStats
);
router.get("/:id", getWithdrawalById);
router.patch(
  "/:id/approve",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  approveWithdrawal
);
router.patch(
  "/:id/reject",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  rejectWithdrawal
);

export default router;
