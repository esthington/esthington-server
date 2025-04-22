import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import {
  getPendingApprovals,
  updatePropertyApproval,
  updateInvestmentApproval,
  updateMarketplaceApproval,
  updateWithdrawalApproval,
} from "../controllers/approvalController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Protect all routes
router.use(protect)
router.use(restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN))

router.get("/pending", getPendingApprovals)
router.patch("/property/:id", updatePropertyApproval)
router.patch("/investment/:id", updateInvestmentApproval)
router.patch("/marketplace/:id", updateMarketplaceApproval)
router.patch("/withdrawal/:userId/:id", updateWithdrawalApproval)

export default router
