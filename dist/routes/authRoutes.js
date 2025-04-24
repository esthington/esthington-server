"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// router.post("/register", validate(registerValidator), register)
// Buyer routes
router.post("/buyer/register", authController_1.registerBuyer);
// Seller routes
router.post("/agent/register", authController_1.registerAgent);
router.get("/check-username", authController_1.checkUsername);
router.post("/user/verify-email", authController_1.verifyEmail);
router.post("/user/resend-verification", authMiddleware_1.protect, authController_1.resedEmailVerification);
router.post("/login", authController_1.login);
router.post("/logout", authMiddleware_1.protect, authController_1.logout);
router.post("/refresh-token", authController_1.refreshToken);
router.post("/user/forgot-password", authController_1.forgotPassword);
router.post("/user/verifypasswordresetoken", authController_1.verifyPasswordResetToken);
router.post("/user/reset-password", authController_1.resetPassword);
// router.post("/reset-password/:token", validate(resetPasswordSchema), resetPassword)
router.get("/me", authMiddleware_1.protect, authController_1.getCurrentUser);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map