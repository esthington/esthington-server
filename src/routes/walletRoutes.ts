import express from "express"
import {
  getWallet,
  getTransactions,
  fundWallet,
  withdrawFromWallet,
  transferMoney,
  getTransactionById,
  getAllTransactions,
  updateTransactionStatus,
} from "../controllers/walletController"
import { protect, restrictTo } from "../middleware/authMiddleware"
import { UserRole } from "../models/userModel"

const router = express.Router()

// User routes
router.get("/", protect, getWallet)
router.get("/transactions", protect, getTransactions)
router.get("/transactions/:id", protect, getTransactionById)
router.post("/fund", protect, fundWallet)
router.post("/withdraw", protect, withdrawFromWallet)
router.post("/transfer", protect, transferMoney)

// Admin routes
router.get("/admin/transactions", protect, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), getAllTransactions)
router.put(
  "/admin/transactions/:id",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  updateTransactionStatus,
)

export default router
