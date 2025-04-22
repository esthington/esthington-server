import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import {
  getUserActivityLogs,
  getAllActivityLogs,
  getEntityActivityLogs,
  getActivityStats,
} from "../controllers/activityLogController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Protect all routes
router.use(protect)

// Routes for all authenticated users
router.get("/user", getUserActivityLogs)
router.get("/entity/:entity/:entityId", getEntityActivityLogs)

// Admin-only routes
router.use(restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN))
router.get("/", getAllActivityLogs)
router.get("/user/:userId", getUserActivityLogs)
router.get("/stats", getActivityStats)

export default router
