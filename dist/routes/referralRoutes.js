"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const referralController_1 = require("../controllers/referralController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validators_1 = require("../utils/validators");
const userModel_1 = require("../models/userModel");
const validationMiddleware_1 = require("../middleware/validationMiddleware"); // Added import for validate
const router = express_1.default.Router();
// Public routes
router.get("/verify/:code", referralController_1.verifyReferralCode);
// Protected routes
router.use(authMiddleware_1.protect);
router.get("/", referralController_1.getUserReferrals);
router.get("/stats", referralController_1.getReferralStats);
router.post("/generate-link", referralController_1.generateReferralLink);
router.get("/earnings", referralController_1.getReferralEarnings);
router.get("/commission-rates", referralController_1.getReferralCommissionRates);
router.get("/agent-rank", (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.AGENT), referralController_1.getAgentRankInfo);
router.post("/process", (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), (0, validationMiddleware_1.validate)(validators_1.processReferralValidator), referralController_1.processReferral);
exports.default = router;
//# sourceMappingURL=referralRoutes.js.map