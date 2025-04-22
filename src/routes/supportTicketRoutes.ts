import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import multer from "multer"
import {
  createTicket,
  getUserTickets,
  getTicketById,
  replyToTicket,
  updateTicketStatus,
  assignTicket,
  getAllTickets,
} from "../controllers/supportTicketController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" })

// Protect all routes
router.use(protect)

// Routes for all authenticated users
router.post("/tickets", upload.array("attachments", 5), createTicket)
router.get("/tickets", getUserTickets)
router.get("/tickets/:id", getTicketById)
router.post("/tickets/:id/reply", upload.array("attachments", 5), replyToTicket)

// Admin-only routes
router.use(restrictTo(UserRole.ADMIN))
router.get("/admin/tickets", getAllTickets)
router.patch("/tickets/:id/status", updateTicketStatus)
router.patch("/tickets/:id/assign", assignTicket)

export default router
