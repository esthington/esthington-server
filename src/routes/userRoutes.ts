import express from "express";
import {
  updateProfile,
  changePassword,
  deleteAccount,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  blacklistUser,
  // activateUser,
  resetUserPassword,
  getUserStats,
} from "../controllers/userController";
import { protect, restrictTo } from "../middleware/authMiddleware";
import upload from "../middleware/uploadMiddleware";
import { UserRole } from "../models/userModel";
import { validateWithJoi } from "../middleware/validationMiddleware";
// import {
//   userUpdateSchema,
//   passwordChangeSchema,
// } from "../validators/userValidators";

import { RequestHandler } from "express";

const router = express.Router();

// User routes (accessible by the user themselves)
router.put(
  "/profile",
  protect,
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "validID", maxCount: 1 },
  ]),
  updateProfile
);

router.put("/change-password", protect, changePassword);

router.delete("/", protect, deleteAccount);

// Admin routes (accessible only by admins and super admins)
router.get("/", protect, getUsers);

router.get("/stats", protect, getUserStats);

router.get("/:id", protect, getUserById);

router.put(
  "/:id",
  protect,
  upload.single("profileImage") as unknown as RequestHandler,
  updateUser
);

router.delete("/:id", protect, restrictTo(UserRole.SUPER_ADMIN), deleteUser);

router.put("/:id/blacklist", protect, blacklistUser);

// router.put(
//   "/:id/activate",
//   protect,
//   activateUser
// );

router.post("/:id/reset-password", protect, resetUserPassword);

export default router;
