import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetUserPassword,
  verifyUser,
  getUserStats,
} from "../controllers/userManagementController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Protect all routes
router.use(protect)
router.use(restrictTo(UserRole.ADMIN))

router.get("/stats", getUserStats)

router.route("/").get(getAllUsers)

router.route("/:id").get(getUserById).patch(updateUser).delete(deleteUser)

router.patch("/:id/reset-password", resetUserPassword)
router.patch("/:id/verify", verifyUser)

export default router
