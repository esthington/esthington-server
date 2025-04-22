import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import {
  getPublicSettings,
  getAllSettings,
  getSettingByKey,
  updateSetting,
  createSetting,
  deleteSetting,
  getFeatureFlags,
  updateFeatureFlags,
} from "../controllers/settingController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Public routes
router.get("/public", getPublicSettings)
router.get("/features", getFeatureFlags)

// Protected routes
router.use(protect)
router.get("/:key", getSettingByKey)

// Admin-only routes
router.use(restrictTo(UserRole.ADMIN))
router.get("/", getAllSettings)
router.post("/", createSetting)
router.patch("/:key", updateSetting)
router.delete("/:key", deleteSetting)
router.patch("/features/update", updateFeatureFlags)

export default router
