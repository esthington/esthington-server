import express from "express"
import {
  getUserReferrals,
  generateReferralLink,
  getReferralEarnings,
  getReferralCommissionRates,
  getAgentRankInfo,
  processReferral,
  verifyReferralCode,
  getReferralStats, // Added import for getReferralStats
} from "../controllers/referralController"
import { protect, restrictTo } from "../middleware/authMiddleware"
import { processReferralValidator } from "../utils/validators"
import { UserRole } from "../models/userModel"
import { validate } from "../middleware/validationMiddleware" // Added import for validate

const router = express.Router()

// Public routes
router.get("/verify/:code", verifyReferralCode)

// Protected routes
router.use(protect)

router.get("/", getUserReferrals)
router.get("/stats", getReferralStats)
router.post("/generate-link", generateReferralLink)
router.get("/earnings", getReferralEarnings)
router.get("/commission-rates", getReferralCommissionRates)
router.get("/agent-rank", restrictTo(UserRole.AGENT), getAgentRankInfo)
router.post(
  "/process",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(processReferralValidator),
  processReferral,
)

export default router
