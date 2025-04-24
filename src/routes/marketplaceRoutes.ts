import express from "express"
import { protect, restrictTo } from "../middleware/authMiddleware"
import {
  getMarketplaceListings,
  getMarketplaceListingById,
  createMarketplaceListing,
  updateMarketplaceListing,
  deleteMarketplaceListing,
  uploadMarketplaceImages,
  expressInterest,
  getListingInterests,
  initiateMarketplacePurchase,
} from "../controllers/marketplaceController"
import { marketplaceListingValidator, marketplaceInterestValidator } from "../utils/validators"
import { validate } from "../middleware/validationMiddleware"
import { upload } from "../middleware/uploadMiddleware"
import { UserRole } from "../models/userModel"

const router = express.Router()

// Public routes
router.get("/", getMarketplaceListings)
router.get("/:id", getMarketplaceListingById)

// Protected routes
router.use(protect)

// Express interest in a listing
router.post("/:id/interest", expressInterest)

// Initiate purchase
router.post("/:id/purchase/initiate", initiateMarketplacePurchase)

// Get interests for a listing (seller only)
router.get("/:id/interests", getListingInterests)

// Agent/Admin routes
router.post(
  "/",
  restrictTo(UserRole.AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  createMarketplaceListing,
)

router.put(
  "/:id",
  restrictTo(UserRole.AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  updateMarketplaceListing,
)

router.delete("/:id", restrictTo(UserRole.AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteMarketplaceListing)

router.post(
  "/:id/images",
  restrictTo(UserRole.AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.array("images", 5),
  uploadMarketplaceImages,
)

export default router
