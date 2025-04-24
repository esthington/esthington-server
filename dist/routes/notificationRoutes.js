"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const notificationController_1 = require("../controllers/notificationController");
const router = express_1.default.Router();
// Protect all routes
router.use(authMiddleware_1.protect);
// Get user notifications
router.get("/", notificationController_1.getUserNotifications);
// Mark notification as read
router.patch("/:id/read", notificationController_1.markAsRead);
// Mark all notifications as read
router.patch("/read-all", notificationController_1.markAllAsRead);
// Delete notification
router.delete("/:id", notificationController_1.deleteNotification);
exports.default = router;
//# sourceMappingURL=notificationRoutes.js.map