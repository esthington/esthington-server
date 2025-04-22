import express from "express";
import {
  registerBuyer,
  registerAgent,
  checkUsername,
  verifyEmail,
  resedEmailVerification,
  login,
  logout,
  refreshToken,
  forgotPassword,
  getCurrentUser,
  verifyPasswordResetToken,
  resetPassword,
} from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

// router.post("/register", validate(registerValidator), register)
// Buyer routes
router.post("/buyer/register", registerBuyer);
// Seller routes
router.post("/agent/register", registerAgent);

router.get("/check-username", checkUsername);

router.post("/user/verify-email", verifyEmail);
router.post("/user/resend-verification", protect, resedEmailVerification);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/refresh-token", refreshToken);
router.post("/user/forgot-password", forgotPassword);
router.post("/user/verifypasswordresetoken", verifyPasswordResetToken);
router.post("/user/reset-password", resetPassword);
// router.post("/reset-password/:token", validate(resetPasswordSchema), resetPassword)
router.get("/me", protect, getCurrentUser);

export default router;
