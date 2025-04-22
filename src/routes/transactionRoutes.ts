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
router.get("/stats", getTransactionStats)

// Routes restricted to admin
router.use(restrictTo(UserRole.ADMIN))
router.get("/", getAllTransactions)
router.get("/:id", getTransactionById)
router.patch("/:id/approve", approveTransaction)
router.patch("/:id/reject", rejectTransaction)

export default router
