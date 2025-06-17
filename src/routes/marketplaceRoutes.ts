import express from "express";
import { protect } from "../middleware/authMiddleware";
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
  getUserMarketplacePurchases, // Add this new function
} from "../controllers/marketplaceController";
import { upload } from "../middleware/uploadMiddleware";

const router = express.Router();

// Public routes - specific routes FIRST
router.get("/listings", getMarketplaceListings);

// User purchases - BEFORE parameterized routes
router.get("/purchases", protect, getUserMarketplacePurchases);

// Parameterized routes - AFTER specific routes
router.get("/listings/:id", getMarketplaceListingById);

// Purchase initiation
router.post(
  "/listings/:id/purchase/initiate",
  protect,
  initiateMarketplacePurchase
);

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
router.delete("/listings/:id", protect, deleteMarketplaceListing);

// Upload images
router.post(
  "/listings/:id/images",
  protect,
  upload.array("images", 5),
  uploadMarketplaceImages
);

// Update quantity
router.patch("/listings/:id/quantity", protect, updateListingQuantity);

// Feature listing (admin only)
router.patch("/listings/:id/feature", protect, featureListing);

export default router;
