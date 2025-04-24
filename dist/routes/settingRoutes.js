"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const settingController_1 = require("../controllers/settingController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Public routes
router.get("/public", settingController_1.getPublicSettings);
router.get("/features", settingController_1.getFeatureFlags);
// Protected routes
router.use(authMiddleware_1.protect);
router.get("/:key", settingController_1.getSettingByKey);
// Admin-only routes
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN));
router.get("/", settingController_1.getAllSettings);
router.post("/", settingController_1.createSetting);
router.patch("/:key", settingController_1.updateSetting);
router.delete("/:key", settingController_1.deleteSetting);
router.patch("/features/update", settingController_1.updateFeatureFlags);
exports.default = router;
//# sourceMappingURL=settingRoutes.js.map