import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware";
import { upload } from "../middleware/uploadMiddleware";
import {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  uploadLogo,
  deleteLogo,
} from "../controllers/companyController";

const router = express.Router();


// Get all companies
router.get("/", protect, getCompanies);

// Get company by ID
router.get("/:id", protect, getCompanyById);

// Create company (admin only)
router.post(
  "/", protect,
  upload.fields([{ name: "logo", maxCount: 1 }]),
  createCompany
);

// Update company (admin only)
router.put(
  "/:id",
 protect,
  upload.fields([{ name: "logo", maxCount: 1 }]),
  updateCompany
);

// Delete company (admin only)
router.delete("/:id", protect, deleteCompany);

// Upload company logo (admin only)
router.post(
  "/:id/logo",
protect,
  upload.fields([{ name: "logo", maxCount: 1 }]),
  uploadLogo
);

// Delete company logo (admin only)
router.delete("/:id/logo", protect, deleteLogo);

export default router;
