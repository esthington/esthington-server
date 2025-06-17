import express from "express";
import {
  getAllProperties,
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadThumbnail,
  uploadGalleryImages,
  uploadPlanFile,
  uploadDocuments,
  deleteThumbnail,
  deleteGalleryImage,
  deletePlanFile,
  deleteDocument,
  getPropertyTypes,
  getPropertyLocations,
  getAmenities,
  downloadPropertyDocument,
  initiatePropertyPurchase,
  getUserProperties,
} from "../controllers/propertyController";
import { protect, restrictTo } from "../middleware/authMiddleware";
import { upload } from "../middleware/uploadMiddleware";
import { UserRole } from "../models/userModel";

const router = express.Router();

// Public routes
router.get("/all", getAllProperties);
router.get("/", getProperties);
router.get("/types", getPropertyTypes);
router.get("/locations", getPropertyLocations);
router.get("/amenities", getAmenities);

// IMPORTANT: Put specific routes BEFORE parameterized routes
// Get user's properties - MOVED BEFORE /:id route
router.get("/myproperties", protect, getUserProperties);

// Download property document - MOVED BEFORE /:id route
router.get("/myproperties/download", protect, downloadPropertyDocument);

// Purchase route - MOVED BEFORE /:id route
router.post("/:id/purchase/initiate", protect, initiatePropertyPurchase);

// Parameterized route - MOVED AFTER specific routes
router.get("/:id", getPropertyById);

// Admin routes
router.post(
  "/",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
    { name: "planFile", maxCount: 1 },
    { name: "documents", maxCount: 5 },
  ]),
  createProperty
);

router.put(
  "/:id",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
    { name: "planFile", maxCount: 1 },
    { name: "documents", maxCount: 5 },
  ]),
  updateProperty
);

router.delete(
  "/:id",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  deleteProperty
);

// Media routes
router.post(
  "/:id/thumbnail",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.single("thumbnail"),
  uploadThumbnail
);

router.post(
  "/:id/gallery",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.array("gallery", 10),
  uploadGalleryImages
);

router.post(
  "/:id/plan",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.single("planFile"),
  uploadPlanFile
);

router.post(
  "/:id/documents",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.array("documents", 5),
  uploadDocuments
);

router.delete(
  "/:id/thumbnail",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  deleteThumbnail
);

router.delete(
  "/:id/gallery",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  deleteGalleryImage
);

router.delete(
  "/:id/plan",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  deletePlanFile
);

router.delete(
  "/:id/documents",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  deleteDocument
);

export default router;
