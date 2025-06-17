import express from "express";
import {
  getInvestmentDues,
  approveInvestmentDue,
  rejectInvestmentDue,
  getInvestmentDuesStats,
} from "../controllers/investmentDueController";
import { protect, restrictTo } from "../middleware/authMiddleware";
import { UserRole } from "../models/userModel";
const router = express.Router();
// Protect all routes
router.use(protect);
router.use(restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN));

// Get investment dues with pagination and filtering
router.get("/", getInvestmentDues);

// Get investment dues statistics
router.get("/stats", getInvestmentDuesStats);

// Approve investment due
router.patch("/:id/approve", approveInvestmentDue);

// Reject investment due
router.patch("/:id/reject", rejectInvestmentDue);

export default router;
