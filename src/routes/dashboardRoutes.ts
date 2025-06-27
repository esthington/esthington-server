import { Router, type Request, type Response } from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import { DashboardController } from "../controllers/dashboardController"
import { UserRole } from "../models/userModel"

const router = Router()

// Apply authentication middleware to all dashboard routes
router.use(protect)

// Dashboard statistics - role-based access
router.get("/stats", DashboardController.getDashboardStats)

// Recent activity - accessible to all authenticated users
router.get("/activity", DashboardController.getRecentActivity)

// Dashboard analytics - accessible to all authenticated users
router.get("/analytics", DashboardController.getDashboardAnalytics)

// Admin-only routes
router.get(
  "/admin/users", 
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), 
  DashboardController.getAdminUsers
)

router.get(
  "/admin/transactions", 
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), 
  DashboardController.getAdminTransactions
)

// Agent-specific routes
router.get(
  "/agent/properties", 
  restrictTo(UserRole.AGENT), 
  DashboardController.getAgentProperties
)

router.get(
  "/agent/referrals", 
  restrictTo(UserRole.AGENT), 
  DashboardController.getAgentReferrals
)

// Buyer-specific routes
router.get(
  "/buyer/investments", 
  restrictTo(UserRole.BUYER), 
  DashboardController.getBuyerInvestments
)

router.get(
  "/buyer/properties", 
  restrictTo(UserRole.BUYER), 
  DashboardController.getBuyerProperties
)

export default router
