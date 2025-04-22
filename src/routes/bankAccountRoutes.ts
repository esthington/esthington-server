import express from "express"
import {
  getBankAccounts,
  addBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
} from "../controllers/bankAccountController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.get("/", protect, getBankAccounts)
router.post("/", protect, addBankAccount)
router.put("/:id", protect, updateBankAccount)
router.delete("/:id", protect, deleteBankAccount)
router.put("/:id/default", protect, setDefaultBankAccount)

export default router
