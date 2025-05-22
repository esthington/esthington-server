import express from "express";
import {
  getUserReferrals,
  generateReferralLink,
  getReferralEarnings,
  getReferralCommissionRates,
  getAgentRankInfo,
  processReferral,
  verifyReferralCode,
  getReferralStats,
  // Admin-specific functions
  getAllReferrals,
  getReferralById,
  getRefereesByReferrerId,
  getReferralCommissionHistory,
  getReferralActivityLog,
  updateReferralStatus,
  deleteReferral,
} from "../controllers/referralController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

// Public routes
router.get("/verify/:code", verifyReferralCode);

// User referral routes - apply protect middleware to each route individually
router.get("/", protect, getUserReferrals);
router.get("/stats", protect, getReferralStats);
router.post("/generate-link", protect, generateReferralLink);
router.get("/earnings", protect, getReferralEarnings);
router.get("/commission-rates", protect, getReferralCommissionRates);

// Agent-specific routes
router.get("/agent-rank", protect, getAgentRankInfo);

// Admin routes
router.post("/process", protect, processReferral);

// Admin-only routes
router.get("/admin/referrals", protect, getAllReferrals);

router.get("/:id", protect, getReferralById);

router.get("/referrer/:id/referees", protect, getRefereesByReferrerId);

router.get("/:id/commissions", protect, getReferralCommissionHistory);

router.get("/:id/activity", protect, getReferralActivityLog);

router.patch("/:id/status", protect, updateReferralStatus);

router.delete("/:id", protect, deleteReferral);

export default router;
