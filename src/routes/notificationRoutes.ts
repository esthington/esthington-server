import express from "express"
import { protect } from "../middleware/authMiddleware"
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notificationController"

const router = express.Router()

// Protect all routes
router.use(protect)

// Get user notifications
router.get("/", getUserNotifications)

// Mark notification as read
router.patch("/:id/read", markAsRead)

// Mark all notifications as read
router.patch("/read-all", markAllAsRead)

// Delete notification
router.delete("/:id", deleteNotification)

export default router
