"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const multer_1 = __importDefault(require("multer"));
const kycController_1 = require("../controllers/kycController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Configure multer for file uploads
const upload = (0, multer_1.default)({ dest: "uploads/" });
// Protect all routes
router.use(authMiddleware_1.protect);
// Routes for all authenticated users
router.post("/submit", upload.fields([
    { name: "idImage", maxCount: 1 },
    { name: "selfieImage", maxCount: 1 },
    { name: "addressProofImage", maxCount: 1 },
]), kycController_1.submitKYC);
router.get("/status", kycController_1.getKYCStatus);
// Admin-only routes
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN));
router.get("/", kycController_1.getAllKYCSubmissions);
router.patch("/:id/verify", kycController_1.verifyKYC);
router.patch("/:id/reject", kycController_1.rejectKYC);
exports.default = router;
//# sourceMappingURL=kycRoutes.js.map