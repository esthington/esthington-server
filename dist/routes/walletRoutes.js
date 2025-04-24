"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const walletController_1 = require("../controllers/walletController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const userModel_1 = require("../models/userModel");
const router = express_1.default.Router();
// User routes
router.get("/", authMiddleware_1.protect, walletController_1.getWallet);
router.get("/transactions", authMiddleware_1.protect, walletController_1.getTransactions);
router.get("/transactions/:id", authMiddleware_1.protect, walletController_1.getTransactionById);
router.post("/fund", authMiddleware_1.protect, walletController_1.fundWallet);
router.post("/withdraw", authMiddleware_1.protect, walletController_1.withdrawFromWallet);
router.post("/transfer", authMiddleware_1.protect, walletController_1.transferMoney);
// Admin routes
router.get("/admin/transactions", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), walletController_1.getAllTransactions);
router.put("/admin/transactions/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN), walletController_1.updateTransactionStatus);
exports.default = router;
//# sourceMappingURL=walletRoutes.js.map