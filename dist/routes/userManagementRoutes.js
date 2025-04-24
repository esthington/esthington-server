"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const userManagementController_1 = require("../controllers/userManagementController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Protect all routes
router.use(authMiddleware_1.protect);
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN));
router.get("/stats", userManagementController_1.getUserStats);
router.route("/").get(userManagementController_1.getAllUsers);
router.route("/:id").get(userManagementController_1.getUserById).patch(userManagementController_1.updateUser).delete(userManagementController_1.deleteUser);
router.patch("/:id/reset-password", userManagementController_1.resetUserPassword);
router.patch("/:id/verify", userManagementController_1.verifyUser);
exports.default = router;
//# sourceMappingURL=userManagementRoutes.js.map