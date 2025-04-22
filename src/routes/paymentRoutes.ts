import express from "express"
import { verifyPayment, paystackWebhook, getPaymentStatus } from "../controllers/paymentController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

// Public routes
router.get("/verify/:reference", verifyPayment)
router.post("/webhook/paystack", paystackWebhook)

// Protected routes
router.get("/status/:reference", protect, getPaymentStatus)

export default router
