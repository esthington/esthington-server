import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  updateAdminPermissions,
  resetAdminPassword,
} from "../controllers/adminManagementController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Protect all routes
router.use(protect)
router.use(restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN))

router.route("/").get(getAllAdmins).post(createAdmin)

router.route("/:id").get(getAdminById).patch(updateAdmin).delete(deleteAdmin)

router.patch("/:id/permissions", updateAdminPermissions)
router.patch("/:id/reset-password", resetAdminPassword)

export default router
