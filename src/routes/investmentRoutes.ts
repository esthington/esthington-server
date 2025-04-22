import express from "express"
import {
  getInvestments,
  getUserInvestments,
  getInvestmentById,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  investInProperty,
} from "../controllers/investmentController"
import { protect, restrictTo } from "../middleware/authMiddleware"
import { investmentPlanValidator, userInvestmentValidator } from "../utils/validators"
import { UserRole } from "../models/userModel"
import { validate } from "../middleware/validationMiddleware"

const router = express.Router()

// Public routes
router.get("/", getInvestments)
router.get("/:id", getInvestmentById)

// Private routes
router.get("/user", protect, getUserInvestments)
router.post("/:id/invest", protect, validate(userInvestmentValidator), investInProperty)

// Admin routes
router.post(
  "/",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(investmentPlanValidator),
  createInvestment,
)
router.put(
  "/:id",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(investmentPlanValidator),
  updateInvestment,
)
router.delete("/:id", protect, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteInvestment)

export default router
