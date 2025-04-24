import express from "express"
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadPropertyImages,
  deletePropertyImage,
  getPropertyTypes,
  getPropertyLocations,
  initiatePropertyPurchase,
} from "../controllers/propertyController"
import { protect, restrictTo } from "../middleware/authMiddleware"
import { propertyValidator } from "../utils/validators"
import { upload } from "../middleware/uploadMiddleware"
import { UserRole } from "../models/userModel"
import { validate } from "../middleware/validationMiddleware"

const router = express.Router()

// Public routes
router.get("/", getProperties)
router.get("/types", getPropertyTypes)
router.get("/locations", getPropertyLocations)
router.get("/:id", getPropertyById)

// Admin routes
router.post(
  "/",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.array("images", 5),
  createProperty,
)
router.put(
  "/:id",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.array("images", 5),
  updateProperty,
)
router.delete("/:id", protect, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteProperty)
router.post(
  "/:id/images",
  protect,
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  upload.array("images", 5),
  uploadPropertyImages,
)
router.delete("/:id/images/:imageId", protect, restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN), deletePropertyImage)

router.post("/:id/purchase/initiate", protect, initiatePropertyPurchase)

export default router
