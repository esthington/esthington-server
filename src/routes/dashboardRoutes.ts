import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware";
import {
  getUserDashboard,
  getAgentDashboard,
  getAdminDashboard,
} from "../controllers/dashboardController";
import { UserRole } from "../models/userModel";

const router = express.Router();

// Protect all routes
router.use(protect);

router.get("/user", getUserDashboard);
router.get(
  "/agent",
  restrictTo(UserRole.AGENT, UserRole.ADMIN),
  getAgentDashboard
);
router.get("/admin", restrictTo(UserRole.ADMIN), getAdminDashboard);

export default router;
