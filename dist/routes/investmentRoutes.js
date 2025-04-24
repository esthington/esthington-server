"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const investmentController_1 = require("../controllers/investmentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validators_1 = require("../utils/validators");
const userModel_1 = require("../models/userModel");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const router = express_1.default.Router();
// Public routes
router.get("/", investmentController_1.getInvestments);
router.get("/:id", investmentController_1.getInvestmentById);
// Private routes
router.get("/user", authMiddleware_1.protect, investmentController_1.getUserInvestments);
router.post("/:id/invest", authMiddleware_1.protect, (0, validationMiddleware_1.validate)(validators_1.userInvestmentValidator), investmentController_1.investInProperty);
// Admin routes
router.post("/", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), (0, validationMiddleware_1.validate)(validators_1.investmentPlanValidator), investmentController_1.createInvestment);
router.put("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), (0, validationMiddleware_1.validate)(validators_1.investmentPlanValidator), investmentController_1.updateInvestment);
router.delete("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), investmentController_1.deleteInvestment);
exports.default = router;
//# sourceMappingURL=investmentRoutes.js.map