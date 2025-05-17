import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import {
  getAllTransactions,
  getTransactionById,
  approveTransaction,
  rejectTransaction,
  getTransactionStats,
} from "../controllers/transactionController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Protect all routes
router.use(protect)

// Routes accessible by all authenticated users
router.get("/stats", protect, getTransactionStats)

// Routes restricted to admin
// router.use(restrictTo(UserRole.ADMIN))
router.get("/", protect, getAllTransactions)
router.get("/:id", protect, getTransactionById)
router.patch("/:id/approve", protect, approveTransaction)
router.patch("/:id/reject", protect, rejectTransaction)

export default router