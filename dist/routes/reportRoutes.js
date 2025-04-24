"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const reportController_1 = require("../controllers/reportController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Protect all routes
router.use(authMiddleware_1.protect);
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN));
router.get("/dashboard-stats", reportController_1.getDashboardStats);
router.get("/detailed", reportController_1.getDetailedReports);
router.get("/revenue", reportController_1.getRevenueReport);
router.get("/user-growth", reportController_1.getUserGrowthReport);
exports.default = router;
//# sourceMappingURL=reportRoutes.js.map