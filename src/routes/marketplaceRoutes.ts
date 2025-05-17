import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware";
import {
  getMarketplaceListings,
  getMarketplaceListingById,
  createMarketplaceListing,
  updateMarketplaceListing,
  deleteMarketplaceListing,
  uploadMarketplaceImages,
  initiateMarketplacePurchase,
  updateListingQuantity,
  featureListing,
} from "../controllers/marketplaceController";
import { upload } from "../middleware/uploadMiddleware";

const router = express.Router();

// Public routes
router.get("/listings", getMarketplaceListings);
router.get("/listings/:id", getMarketplaceListingById);

// Initiate purchase
router.post("/listings/:id/purchase/initiate", initiateMarketplacePurchase);

// Create listing
router.post(
  "/listings",
  protect,
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
    { name: "documents", maxCount: 5 },
  ]),
  createMarketplaceListing
);

// Update listing
router.put(
  "/listings/:id",
  protect,
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 5 },
    { name: "documents", maxCount: 5 },
  ]),
  updateMarketplaceListing
);

// Delete listing
router.delete("/listings/:id", protect,  deleteMarketplaceListing);

// Upload images
router.post("/listings/:id/images", protect, upload.array("images", 5), uploadMarketplaceImages);

// Feature listing (admin only)
router.patch("/listings/:id/feature", protect, featureListing);

export default router;
