import express from "express";
import { protect } from "../middleware/authMiddleware";
import {
  requestOTP,
  verifyOTP,
  checkOTPValidity,
} from "../controllers/otpController";
import {
  updateProfile,
  changePassword,
  deleteAccount,
} from "../controllers/userController";

const router = express.Router();

// // All routes require authentication
// router.use(protect);

// OTP routes
router.post("/request-otp", protect, requestOTP);
router.post("/verify-otp", protect, verifyOTP);
router.get("/check-validity-period", protect, checkOTPValidity);

// Profile security routes
router.put("/update-profile", updateProfile);
router.post("/change-password", changePassword);
router.delete("/delete-account", deleteAccount);

export default router;
