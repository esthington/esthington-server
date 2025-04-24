"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const propertyController_1 = require("../controllers/propertyController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validators_1 = require("../utils/validators");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const userModel_1 = require("../models/userModel");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const router = express_1.default.Router();
// Public routes
router.get("/", propertyController_1.getProperties);
router.get("/types", propertyController_1.getPropertyTypes);
router.get("/locations", propertyController_1.getPropertyLocations);
router.get("/:id", propertyController_1.getPropertyById);
// Admin routes
router.post("/", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), uploadMiddleware_1.upload.array("images", 5), (0, validationMiddleware_1.validate)(validators_1.propertyValidator), propertyController_1.createProperty);
router.put("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), uploadMiddleware_1.upload.array("images", 5), (0, validationMiddleware_1.validate)(validators_1.propertyValidator), propertyController_1.updateProperty);
router.delete("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), propertyController_1.deleteProperty);
router.post("/:id/images", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), uploadMiddleware_1.upload.array("images", 5), propertyController_1.uploadPropertyImages);
router.delete("/:id/images/:imageId", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), propertyController_1.deletePropertyImage);
router.post("/:id/purchase/initiate", authMiddleware_1.protect, propertyController_1.initiatePropertyPurchase);
exports.default = router;
//# sourceMappingURL=propertyRoutes.js.map