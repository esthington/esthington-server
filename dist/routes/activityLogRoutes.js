"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const activityLogController_1 = require("../controllers/activityLogController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Protect all routes
router.use(authMiddleware_1.protect);
// Routes for all authenticated users
router.get("/user", activityLogController_1.getUserActivityLogs);
router.get("/entity/:entity/:entityId", activityLogController_1.getEntityActivityLogs);
// Admin-only routes
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN));
router.get("/", activityLogController_1.getAllActivityLogs);
router.get("/user/:userId", activityLogController_1.getUserActivityLogs);
router.get("/stats", activityLogController_1.getActivityStats);
exports.default = router;
//# sourceMappingURL=activityLogRoutes.js.map