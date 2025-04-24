"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Public routes
router.get("/verify/:reference", paymentController_1.verifyPayment);
router.post("/webhook/paystack", paymentController_1.paystackWebhook);
// Protected routes
router.get("/status/:reference", authMiddleware_1.protect, paymentController_1.getPaymentStatus);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map