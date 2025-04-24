"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const approvalController_1 = require("../controllers/approvalController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Protect all routes
router.use(authMiddleware_1.protect);
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN));
router.get("/pending", approvalController_1.getPendingApprovals);
router.patch("/property/:id", approvalController_1.updatePropertyApproval);
router.patch("/investment/:id", approvalController_1.updateInvestmentApproval);
router.patch("/marketplace/:id", approvalController_1.updateMarketplaceApproval);
router.patch("/withdrawal/:userId/:id", approvalController_1.updateWithdrawalApproval);
exports.default = router;
//# sourceMappingURL=approvalRoutes.js.map