"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const marketplaceController_1 = require("../controllers/marketplaceController");
const validators_1 = require("../utils/validators");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Public routes
router.get("/", marketplaceController_1.getMarketplaceListings);
router.get("/:id", marketplaceController_1.getMarketplaceListingById);
// Protected routes
router.use(authMiddleware_1.protect);
// Express interest in a listing
router.post("/:id/interest", (0, validationMiddleware_1.validate)(validators_1.marketplaceInterestValidator), marketplaceController_1.expressInterest);
// Initiate purchase
router.post("/:id/purchase/initiate", marketplaceController_1.initiateMarketplacePurchase);
// Get interests for a listing (seller only)
router.get("/:id/interests", marketplaceController_1.getListingInterests);
// Agent/Admin routes
router.post("/", (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.AGENT, userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), (0, validationMiddleware_1.validate)(validators_1.marketplaceListingValidator), marketplaceController_1.createMarketplaceListing);
router.put("/:id", (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.AGENT, userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), (0, validationMiddleware_1.validate)(validators_1.marketplaceListingValidator), marketplaceController_1.updateMarketplaceListing);
router.delete("/:id", (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.AGENT, userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), marketplaceController_1.deleteMarketplaceListing);
router.post("/:id/images", (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.AGENT, userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), uploadMiddleware_1.upload.array("images", 5), marketplaceController_1.uploadMarketplaceImages);
exports.default = router;
//# sourceMappingURL=marketplaceRoutes.js.map