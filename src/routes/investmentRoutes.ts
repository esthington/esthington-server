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
import {
  investmentPlanValidator,
  userInvestmentValidator,
} from "../utils/validators";
import { UserRole } from "../models/userModel";
import { validate } from "../middleware/validationMiddleware";
import { upload } from "../middleware/uploadMiddleware";

const router = express.Router();

// Public routes
router.get("/", getInvestments);
router.get("/:id", getInvestmentById);

// Protected routes (user)
router.get("/", protect, getUserInvestments);
router.get("/analytics", protect, getUserInvestmentAnalytics);
router.post("/:id/invest", protect, investInProperty);
router.post("/verify-payment", verifyInvestmentPayment);

// Admin routes
router.get("/analytics/platform", getInvestmentAnalytics);
router.get("/properties/available", getAvailableProperties);
router.post(
  "/",
  upload.array("documents", 5),
  protect,
  createInvestment
);
router.put(
  "/:id",
  upload.array("documents", 5),
  protect,
  updateInvestment
);
router.delete("/:id", protect, deleteInvestment);
router.patch("/:id/featured", protect, toggleFeatured);
router.patch("/:id/trending", protect, toggleTrending);
router.patch("/:id/status", protect, changeInvestmentStatus);
router.post("/process-payouts", protect, processInvestmentPayouts);

export default router;
