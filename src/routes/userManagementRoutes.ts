import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetUserPassword,
  verifyUser,
  getUserStats,
} from "../controllers/userManagementController";
import { UserRole } from "../models/userModel";

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(restrictTo(UserRole.SUPER_ADMIN, UserRole.ADMIN));

// Get user statistics
router.get("/stats", getUserStats);

// User CRUD routes
router.route("/").get(getAllUsers);

router.route("/:id").get(getUserById).patch(updateUser).delete(deleteUser);

// Special user operations
router.patch("/:id/reset-password", resetUserPassword);
router.patch("/:id/verify", verifyUser);

export default router;
