import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import multer from "multer"
import { submitKYC, getKYCStatus, verifyKYC, rejectKYC, getAllKYCSubmissions } from "../controllers/kycController"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" })

// Protect all routes
router.use(protect)

// Routes for all authenticated users
router.post(
  "/submit",
  upload.fields([
    { name: "idImage", maxCount: 1 },
    { name: "selfieImage", maxCount: 1 },
    { name: "addressProofImage", maxCount: 1 },
  ]),
  submitKYC,
)
router.get("/status", getKYCStatus)

// Admin-only routes
router.use(restrictTo(UserRole.ADMIN))
router.get("/", getAllKYCSubmissions)
router.patch("/:id/verify", verifyKYC)
router.patch("/:id/reject", rejectKYC)

export default router
