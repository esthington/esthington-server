import express from "express";
import {
  getInvestments,
  getUserInvestments,
  getInvestmentById,
  getAvailableProperties,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  toggleFeatured,
  toggleTrending,
  changeInvestmentStatus,
  investInProperty,
  verifyInvestmentPayment,
  getInvestmentAnalytics,
  getUserInvestmentAnalytics,
  processInvestmentPayouts,
} from "../controllers/investmentController";
import { protect, restrictTo } from "../middleware/authMiddleware";
import { UserRole } from "../models/userModel";
import { upload } from "../middleware/uploadMiddleware";

const router = express.Router();

// IMPORTANT: Put specific routes BEFORE parameterized routes

// Public routes - specific routes first
router.get("/", getInvestments);

// Analytics routes - BEFORE parameterized routes
router.get(
  "/analytics/platform",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getInvestmentAnalytics
);

// Properties routes - BEFORE parameterized routes
router.get(
  "/properties/available",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  getAvailableProperties
);

// Process payouts - BEFORE parameterized routes
router.post(
  "/process-payouts",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  processInvestmentPayouts
);

// Verify payment - BEFORE parameterized routes
router.post("/verify-payment", protect, verifyInvestmentPayment);

// User-specific routes - BEFORE parameterized routes
router.get("/user/my-investments", protect, getUserInvestments);
router.get("/user/analytics", protect, getUserInvestmentAnalytics);

// Parameterized routes - AFTER all specific routes
router.get("/:id", getInvestmentById);
router.post("/:id/invest", protect, investInProperty);

// Admin routes with parameterized IDs
router.post(
  "/",
  upload.array("documents", 5),
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  createInvestment
);

router.put(
  "/:id",
  upload.array("documents", 5),
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  updateInvestment
);

router.delete(
  "/:id",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  deleteInvestment
);

router.patch(
  "/:id/featured",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  toggleFeatured
);

router.patch(
  "/:id/trending",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  toggleTrending
);

router.patch(
  "/:id/status",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  changeInvestmentStatus
);

export default router;
