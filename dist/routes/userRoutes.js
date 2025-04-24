"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const uploadMiddleware_1 = __importDefault(require("../middleware/uploadMiddleware"));
const userModel_1 = require("../models/userModel");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const authValidators_1 = require("../validators/authValidators");
const router = express_1.default.Router();
// User routes
router.put("/profile", authMiddleware_1.protect, uploadMiddleware_1.default.single("profileImage"), (0, validationMiddleware_1.validateWithJoi)(authValidators_1.updateProfileSchema), userController_1.updateProfile);
router.put("/change-password", authMiddleware_1.protect, (0, validationMiddleware_1.validateWithJoi)(authValidators_1.changePasswordSchema), userController_1.changePassword);
router.delete("/", authMiddleware_1.protect, userController_1.deleteAccount);
// Admin routes
router.get("/", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), userController_1.getUsers);
router.get("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), userController_1.getUserById);
router.put("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), userController_1.updateUser);
router.delete("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), userController_1.deleteUser);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map