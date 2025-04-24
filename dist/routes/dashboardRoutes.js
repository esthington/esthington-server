"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const dashboardController_1 = require("../controllers/dashboardController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Protect all routes
router.use(authMiddleware_1.protect);
router.get("/user", dashboardController_1.getUserDashboard);
router.get("/agent", (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.AGENT, userModel_1.UserRole.ADMIN), dashboardController_1.getAgentDashboard);
router.get("/admin", (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN), dashboardController_1.getAdminDashboard);
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map