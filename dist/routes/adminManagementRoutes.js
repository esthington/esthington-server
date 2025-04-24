"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const adminManagementController_1 = require("../controllers/adminManagementController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Protect all routes
router.use(authMiddleware_1.protect);
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN));
router.route("/").get(adminManagementController_1.getAllAdmins).post(adminManagementController_1.createAdmin);
router.route("/:id").get(adminManagementController_1.getAdminById).patch(adminManagementController_1.updateAdmin).delete(adminManagementController_1.deleteAdmin);
router.patch("/:id/permissions", adminManagementController_1.updateAdminPermissions);
router.patch("/:id/reset-password", adminManagementController_1.resetAdminPassword);
exports.default = router;
//# sourceMappingURL=adminManagementRoutes.js.map