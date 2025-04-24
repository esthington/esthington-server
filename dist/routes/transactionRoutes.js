"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const transactionController_1 = require("../controllers/transactionController");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// Protect all routes
router.use(authMiddleware_1.protect);
// Routes accessible by all authenticated users
router.get("/stats", transactionController_1.getTransactionStats);
// Routes restricted to admin
router.use((0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN));
router.get("/", transactionController_1.getAllTransactions);
router.get("/:id", transactionController_1.getTransactionById);
router.patch("/:id/approve", transactionController_1.approveTransaction);
router.patch("/:id/reject", transactionController_1.rejectTransaction);
exports.default = router;
//# sourceMappingURL=transactionRoutes.js.map