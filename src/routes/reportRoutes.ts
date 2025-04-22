import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import {
  getDashboardStats,
  getDetailedReports,
  getRevenueReport,
  getUserGrowthReport,
} from "../controllers/reportController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Protect all routes
router.use(protect)
router.use(restrictTo(UserRole.ADMIN))

router.get("/dashboard-stats", getDashboardStats)
router.get("/detailed", getDetailedReports)
router.get("/revenue", getRevenueReport)
router.get("/user-growth", getUserGrowthReport)

export default router
