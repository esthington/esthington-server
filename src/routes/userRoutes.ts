import express from "express"
import {
  updateProfile,
  changePassword,
  deleteAccount,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/userController"
import { protect, restrictTo } from "../middleware/authMiddleware"
import upload from "../middleware/uploadMiddleware"
import { UserRole } from "../models/userModel"
import { validateWithJoi } from "../middleware/validationMiddleware"
import { updateProfileSchema, changePasswordSchema } from "../validators/authValidators"

const router = express.Router()

// User routes
router.put("/profile", protect, upload.single("profileImage"), validateWithJoi(updateProfileSchema), updateProfile)
router.put("/change-password", protect, validateWithJoi(changePasswordSchema), changePassword)
router.delete("/", protect, deleteAccount)

// Admin routes
router.get("/", protect, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getUsers)
router.get("/:id", protect, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getUserById)
router.put("/:id", protect, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), updateUser)
router.delete("/:id", protect, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteUser)

export default router
