import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "express-async-handler";
import { uploadToCloudinary } from "../services/cloudinaryService";
import AppError from "../utils/appError";
import Company from "../models/companyModel";

// @desc    Get all companies
// @route   GET /api/companies
// @access  Private
export const getCompanies = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const active = req.query.active as string;

    // Build query
    const query: any = {};

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Add active filter
    if (active !== undefined) {
      query.active = active === "true";
    }

    // Count total documents
    const total = await Company.countDocuments(query);

    // Get companies
    const companies = await Company.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const allCompanies = await Company.find()

    res.status(StatusCodes.OK).json({
      success: true,
      data: allCompanies,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  }
);

// @desc    Get company by ID
// @route   GET /api/companies/:id
// @access  Private
export const getCompanyById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const company = await Company.findById(req.params.id);

    if (!company) {
      next(new AppError("Company not found", StatusCodes.NOT_FOUND));
      return;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: company,
    });
  }
);

// @desc    Create company
// @route   POST /api/companies
// @access  Private (Admin)
export const createCompany = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED));
      return;
    }

    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      next(
        new AppError(
          "Not authorized to create companies",
          StatusCodes.FORBIDDEN
        )
      );
      return;
    }

    const { name, description, email, website, phone, address, active } =
      req.body;

    // Validate required fields
    if (!name || !description || !email) {
      next(
        new AppError(
          "Please provide name, description, and email",
          StatusCodes.BAD_REQUEST
        )
      );
      return;
    }

    // Check if company with same name or email already exists
    const existingCompany = await Company.findOne({
      $or: [{ name }, { email }],
    });

    if (existingCompany) {
      next(
        new AppError(
          "Company with this name or email already exists",
          StatusCodes.BAD_REQUEST
        )
      );
      return;
    }

    // Upload logo if provided
    let logoUrl = "";
    if (req.files && (req.files as any).logo) {
      const logoFile = (req.files as any).logo[0];
      const result = await uploadToCloudinary(logoFile.path, "companies/logos");
      logoUrl = result.secure_url;
    }

    // Create company
    const company = await Company.create({
      name,
      description,
      email,
      website,
      phone,
      address,
      active: active === "true",
      logo: logoUrl,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Company created successfully",
      data: company,
    });
  }
);

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Private (Admin)
export const updateCompany = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED));
      return;
    }

    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      next(
        new AppError(
          "Not authorized to update companies",
          StatusCodes.FORBIDDEN
        )
      );
      return;
    }

    const { name, description, email, website, phone, address, active } =
      req.body;

    // Find company
    const company = await Company.findById(req.params.id);

    if (!company) {
      next(new AppError("Company not found", StatusCodes.NOT_FOUND));
      return;
    }

    // Check if another company with same name or email exists
    if (name || email) {
      const existingCompany = await Company.findOne({
        _id: { $ne: req.params.id },
        $or: [
          { name: name || company.name },
          { email: email || company.email },
        ],
      });

      if (existingCompany) {
        next(
          new AppError(
            "Another company with this name or email already exists",
            StatusCodes.BAD_REQUEST
          )
        );
        return;
      }
    }

    // Upload logo if provided
    let logoUrl = company.logo;
    if (req.files && (req.files as any).logo) {
      const logoFile = (req.files as any).logo[0];
      const result = await uploadToCloudinary(logoFile.path, "companies/logos");
      logoUrl = result.secure_url;
    }

    // Update company
    company.name = name || company.name;
    company.description = description || company.description;
    company.email = email || company.email;
    company.website = website !== undefined ? website : company.website;
    company.phone = phone !== undefined ? phone : company.phone;
    company.address = address !== undefined ? address : company.address;
    company.active = active !== undefined ? active === "true" : company.active;
    company.logo = logoUrl;

    await company.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Company updated successfully",
      data: company,
    });
  }
);

// @desc    Delete company
// @route   DELETE /api/companies/:id
// @access  Private (Admin)
export const deleteCompany = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED));
      return;
    }

    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      next(
        new AppError(
          "Not authorized to delete companies",
          StatusCodes.FORBIDDEN
        )
      );
      return;
    }

    const company = await Company.findById(req.params.id);

    if (!company) {
      next(new AppError("Company not found", StatusCodes.NOT_FOUND));
      return;
    }

    // Check if company is used in properties
    // This would require importing the Property model and checking for references
    // For now, we'll just delete the company

    await company.deleteOne();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Company deleted successfully",
      data: {},
    });
  }
);

// @desc    Upload company logo
// @route   POST /api/companies/:id/logo
// @access  Private (Admin)
export const uploadLogo = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED));
      return;
    }

    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      next(
        new AppError(
          "Not authorized to update company logo",
          StatusCodes.FORBIDDEN
        )
      );
      return;
    }

    const company = await Company.findById(req.params.id);

    if (!company) {
      next(new AppError("Company not found", StatusCodes.NOT_FOUND));
      return;
    }

    if (!req.files || !(req.files as any).logo) {
      next(new AppError("Please upload a logo", StatusCodes.BAD_REQUEST));
      return;
    }

    const logoFile = (req.files as any).logo[0];
    const result = await uploadToCloudinary(logoFile.path, "companies/logos");

    company.logo = result.secure_url;
    await company.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Logo uploaded successfully",
      data: company,
    });
  }
);

// @desc    Delete company logo
// @route   DELETE /api/companies/:id/logo
// @access  Private (Admin)
export const deleteLogo = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED));
      return;
    }

    // Check if user is admin
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      next(
        new AppError(
          "Not authorized to delete company logo",
          StatusCodes.FORBIDDEN
        )
      );
      return;
    }

    const company = await Company.findById(req.params.id);

    if (!company) {
      next(new AppError("Company not found", StatusCodes.NOT_FOUND));
      return;
    }

    company.logo = "";
    await company.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Logo deleted successfully",
      data: company,
    });
  }
);
