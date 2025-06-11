import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import mongoose, { SortOrder } from "mongoose";

import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";
import { v4 as uuidv4 } from "uuid";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService";

// Import models
import Investment from "../models/investmentModel";
import UserInvestment from "../models/userInvestmentModel";
import Property from "../models/propertyModel";
import User from "../models/userModel";
import {
  calculateExpectedReturns,
  generatePayoutSchedule,
} from "../utils/investmentUtils";
import {
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
  Wallet,
} from "../models/walletModel";
import notificationService from "../services/notificationService";
import { NotificationType } from "../models/notificationModel";

// Server-side enums
enum InvestmentStatus {
  DRAFT = "draft",
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

enum PayoutFrequency {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUALLY = "semi_annually",
  ANNUALLY = "annually",
  END_OF_TERM = "end_of_term",
}

enum ReturnType {
  FIXED = "fixed",
  VARIABLE = "variable",
  PROFIT_SHARING = "profit_sharing",
}

enum InvestmentType {
  REAL_ESTATE = "real_estate",
  BUSINESS = "business",
  AGRICULTURE = "agriculture",
  TECHNOLOGY = "technology",
  ENERGY = "energy",
  INFRASTRUCTURE = "infrastructure",
  OTHER = "other",
}

/**
 * Extract public ID from Cloudinary URL
 * @param url Cloudinary URL
 * @returns Public ID or null if not found
 */
const extractPublicIdFromUrl = (url: string): string | null => {
  try {
    // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/public_id.jpg
    const urlParts = url.split("/");
    const fileNameWithExtension = urlParts[urlParts.length - 1];
    const publicId = fileNameWithExtension.split(".")[0];
    return publicId || null;
  } catch (error) {
    console.error("Error extracting public ID from URL:", error);
    return null;
  }
};

// @desc    Get all investments
// @route   GET /api/investments
// @access  Public
export const getInvestments = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      status,
      type,
      featured,
      trending,
      sort,
      limit = 10,
      page = 1,
    } = req.query;

    // Build query
    const query: any = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by type
    if (type) {
      query.type = type;
    }

    // Filter by featured
    if (featured !== undefined) {
      query.featured = featured === "true";
    }

    // Filter by trending
    if (trending !== undefined) {
      query.trending = trending === "true";
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Sort options
    let sortOptions: Record<string, number> = {};
    if (sort) {
      const sortFields = (sort as string).split(",");
      sortFields.forEach((field) => {
        if (field.startsWith("-")) {
          sortOptions[field.substring(1)] = -1;
        } else {
          sortOptions[field] = 1;
        }
      });
    } else {
      sortOptions = { createdAt: -1 };
    }

    // Execute query
    const investments = await Investment.find(query)
      .sort(sortOptions as { [key: string]: SortOrder })
      .skip(skip)
      .limit(Number(limit))
      .populate("propertyId", "title location images");

    // Get total count
    const total = await Investment.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: investments.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: investments,
    });
  }
);

// @desc    Get user investments
// @route   GET /api/users/:userId/investments
// @access  Private
export const getUserInvestments = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;
    const { status, sort, limit = 10, page = 1 } = req.query;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Only allow users to view their own investments unless admin
    if (
      req.user.id !== userId &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return next(
        new AppError(
          "Not authorized to access these investments",
          StatusCodes.FORBIDDEN
        )
      );
    }

    // Build query
    const query: any = { userId };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Sort options
    let sortOptions: Record<string, number> = {};
    if (sort) {
      const sortFields = (sort as string).split(",");
      sortFields.forEach((field) => {
        if (field.startsWith("-")) {
          sortOptions[field.substring(1)] = -1;
        } else {
          sortOptions[field] = 1;
        }
      });
    } else {
      sortOptions = { createdAt: -1 };
    }

    const userInvestments = await UserInvestment.find(query)
      .sort(sortOptions as { [key: string]: SortOrder })
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: "investmentId",
        populate: {
          path: "propertyId",
          select: "title location images",
        },
      });

    // Get total count
    const total = await UserInvestment.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: userInvestments.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: userInvestments,
    });
  }
);

// @desc    Get investment by ID
// @route   GET /api/investments/:id
// @access  Public
export const getInvestmentById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investment = await Investment.findById(id).populate("propertyId");

    if (!investment) {
      return next(new AppError("Investment not found", StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: investment,
    });
  }
);

// @desc    Get properties available for investment
// @route   GET /api/properties/available-for-investment
// @access  Private (Admin)
export const getAvailableProperties = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError(
          "Not authorized to access this resource",
          StatusCodes.FORBIDDEN
        )
      );
    }

    // Find properties that don't have an investmentId
    const properties = await Property.find({
      investmentId: { $exists: false },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  }
);

// @desc    Create investment
// @route   POST /api/investments
// @access  Private (Admin)

export const createInvestment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError(
          "Not authorized to create investments",
          StatusCodes.FORBIDDEN
        )
      );
    }

    const {
      title,
      description,
      propertyId,
      minimumInvestment,
      targetAmount,
      returnRate,
      returnType,
      investmentPeriod,
      payoutFrequency,
      startDate,
      endDate,
      status,
      type,
      featured,
      trending,
      riskLevel,
      location,
      maxInvestors,
      investmentPlans,
      durations,
      amenities,
    } = req.body;

    if (
      !title ||
      !description ||
      !propertyId ||
      !minimumInvestment ||
      !targetAmount ||
      !returnRate ||
      !returnType ||
      !investmentPeriod ||
      !payoutFrequency ||
      !startDate ||
      !endDate ||
      !type
    ) {
      return next(
        new AppError(
          "Please provide all required fields",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    console.log("Creating investment...");

    if (
      returnType &&
      !Object.values(ReturnType).includes(returnType as ReturnType)
    ) {
      return next(new AppError("Invalid return type", StatusCodes.BAD_REQUEST));
    }

    if (
      payoutFrequency &&
      !Object.values(PayoutFrequency).includes(
        payoutFrequency as PayoutFrequency
      )
    ) {
      return next(
        new AppError("Invalid payout frequency", StatusCodes.BAD_REQUEST)
      );
    }

    if (
      status &&
      !Object.values(InvestmentStatus).includes(status as InvestmentStatus)
    ) {
      return next(new AppError("Invalid status", StatusCodes.BAD_REQUEST));
    }

    if (
      type &&
      !Object.values(InvestmentType).includes(type as InvestmentType)
    ) {
      return next(
        new AppError("Invalid investment type", StatusCodes.BAD_REQUEST)
      );
    }

    const property = await Property.findById(propertyId);

    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (property.investmentId) {
      return next(
        new AppError(
          "Property already has an investment",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    console.log("files", req.files);
    console.log("body", req.body);

    let documents: string[] = [];

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        const uploadPromises = (req.files as Express.Multer.File[]).map(
          async (file) => {
            const result = await uploadToCloudinary(file.path);
            return result.secure_url;
          }
        );
        documents = await Promise.all(uploadPromises);
      } catch (error) {
        return next(
          new AppError(
            "Error uploading documents",
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        );
      }
    }

    // Parse JSON fields
    let parsedInvestmentPlans = [];
    let parsedDurations = [];
    let parsedAmenities = [];

    try {
      parsedInvestmentPlans = investmentPlans
        ? JSON.parse(investmentPlans)
        : [];
      parsedDurations = durations ? JSON.parse(durations) : [];
      parsedAmenities = amenities ? JSON.parse(amenities) : [];
    } catch (error) {
      return next(
        new AppError(
          "Invalid JSON in investmentPlans, durations, or amenities",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const investment = await Investment.create({
      title,
      description,
      propertyId,
      minimumInvestment: Number(minimumInvestment),
      targetAmount: Number(targetAmount),
      raisedAmount: 0,
      returnRate: Number(returnRate),
      returnType,
      investmentPeriod: Number(investmentPeriod),
      payoutFrequency,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: status || InvestmentStatus.DRAFT,
      type,
      featured: featured === "true",
      trending: trending === "true",
      investors: [],
      totalInvestors: 0,
      documents,
      riskLevel: riskLevel || "medium",
      location,
      createdBy: req.user.id,
      maxInvestors: maxInvestors ? Number(maxInvestors) : undefined,
      investmentPlans: parsedInvestmentPlans,
      durations: parsedDurations,
      amenities: parsedAmenities,
    });

    await Property.findByIdAndUpdate(propertyId, {
      investmentId: investment._id,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Investment created successfully",
      data: investment,
    });
  }
);

// @desc    Update investment
// @route   PUT /api/investments/:id
// @access  Private (Admin)
export const updateInvestment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError(
          "Not authorized to update investments",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investment = await Investment.findById(id);
    if (!investment) {
      return next(new AppError("Investment not found", StatusCodes.NOT_FOUND));
    }

    const {
      title,
      description,
      minimumInvestment,
      targetAmount,
      returnRate,
      returnType,
      investmentPeriod,
      payoutFrequency,
      startDate,
      endDate,
      status,
      type,
      featured,
      trending,
      riskLevel,
      location,
      documentsToDelete,
      investmentPlans,
      durations,
      amenities,
      maxInvestors,
    } = req.body;

    // Validate enums
    if (
      returnType &&
      !Object.values(ReturnType).includes(returnType as ReturnType)
    ) {
      return next(new AppError("Invalid return type", StatusCodes.BAD_REQUEST));
    }

    if (
      payoutFrequency &&
      !Object.values(PayoutFrequency).includes(
        payoutFrequency as PayoutFrequency
      )
    ) {
      return next(
        new AppError("Invalid payout frequency", StatusCodes.BAD_REQUEST)
      );
    }

    if (
      status &&
      !Object.values(InvestmentStatus).includes(status as InvestmentStatus)
    ) {
      return next(new AppError("Invalid status", StatusCodes.BAD_REQUEST));
    }

    if (
      type &&
      !Object.values(InvestmentType).includes(type as InvestmentType)
    ) {
      return next(
        new AppError("Invalid investment type", StatusCodes.BAD_REQUEST)
      );
    }

    // Handle document deletion
    let documents = [...investment.documents];
    if (
      documentsToDelete &&
      Array.isArray(documentsToDelete) &&
      documentsToDelete.length > 0
    ) {
      try {
        const deletePromises = documentsToDelete.map(async (docUrl: string) => {
          const publicId = extractPublicIdFromUrl(docUrl);
          if (publicId) {
            await deleteFromCloudinary(publicId);
          }
        });
        await Promise.all(deletePromises);
        documents = documents.filter((doc) => !documentsToDelete.includes(doc));
      } catch (error) {
        console.error("Error deleting documents:", error);
      }
    }

    // Handle document uploads
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        const uploadPromises = (req.files as Express.Multer.File[]).map(
          async (file) => {
            const result = await uploadToCloudinary(file.path);
            return result.secure_url;
          }
        );
        const newDocuments = await Promise.all(uploadPromises);
        documents = [...documents, ...newDocuments];

        console.log("Uploaded documents:", documents);
      } catch (error) {
        return next(
          new AppError(
            "Error uploading documents",
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        );
      }
    }

    // Parse optional JSON fields
    let parsedInvestmentPlans = [];
    let parsedDurations = [];
    let parsedAmenities = [];

    try {
      parsedInvestmentPlans = investmentPlans
        ? JSON.parse(investmentPlans)
        : investment.investmentPlans;
      parsedDurations = durations
        ? JSON.parse(durations)
        : investment.durations;
      parsedAmenities = amenities
        ? JSON.parse(amenities)
        : investment.amenities;
    } catch (error) {
      return next(
        new AppError(
          "Invalid JSON in investmentPlans, durations, or amenities",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // Build update object
    const updateData: any = {
      title,
      description,
      minimumInvestment:
        minimumInvestment !== undefined ? Number(minimumInvestment) : undefined,
      targetAmount:
        targetAmount !== undefined ? Number(targetAmount) : undefined,
      returnRate: returnRate !== undefined ? Number(returnRate) : undefined,
      returnType,
      investmentPeriod:
        investmentPeriod !== undefined ? Number(investmentPeriod) : undefined,
      payoutFrequency,
      status,
      type,
      featured: featured !== undefined ? featured === "true" : undefined,
      trending: trending !== undefined ? trending === "true" : undefined,
      riskLevel,
      location,
      documents,
      investmentPlans: parsedInvestmentPlans,
      durations: parsedDurations,
      amenities: parsedAmenities,
      maxInvestors:
        maxInvestors !== undefined ? Number(maxInvestors) : undefined,
      updatedAt: new Date(),
    };

    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);

    // Remove undefined keys
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const updatedInvestment = await Investment.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).populate("propertyId");

    // Handle user investments on status change
    if (status && status !== investment.status) {
      if (status === InvestmentStatus.COMPLETED) {
        await UserInvestment.updateMany(
          { investmentId: id, status: { $ne: InvestmentStatus.CANCELLED } },
          { status: InvestmentStatus.COMPLETED }
        );
      } else if (status === InvestmentStatus.CANCELLED) {
        await UserInvestment.updateMany(
          { investmentId: id, status: InvestmentStatus.PENDING },
          { status: InvestmentStatus.CANCELLED }
        );
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Investment updated successfully",
      data: updatedInvestment,
    });
  }
);

// @desc    Delete investment
// @route   DELETE /api/investments/:id
// @access  Private (Admin)
export const deleteInvestment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError(
          "Not authorized to delete investments",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investment = await Investment.findById(id);
    if (!investment) {
      return next(new AppError("Investment not found", StatusCodes.NOT_FOUND));
    }

    // Check if there are any user investments
    const userInvestments = await UserInvestment.find({ investmentId: id });
    if (userInvestments.length > 0) {
      return next(
        new AppError(
          "Cannot delete investment with active user investments",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // Delete documents from cloudinary
    if (investment.documents && investment.documents.length > 0) {
      try {
        const deletePromises: Promise<void>[] = investment.documents.map(
          async (docUrl: string): Promise<void> => {
            const publicId: string | null = extractPublicIdFromUrl(docUrl);
            if (publicId) {
              await deleteFromCloudinary(publicId);
            }
          }
        );
        await Promise.all(deletePromises);
      } catch (error) {
        console.error("Error deleting documents:", error);
        // Continue with the deletion even if document deletion fails
      }
    }

    // Remove investment ID from property
    await Property.findByIdAndUpdate(investment.propertyId, {
      $unset: { investmentId: 1 },
    });

    // Delete investment
    await Investment.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Investment deleted successfully",
    });
  }
);

// @desc    Toggle featured status
// @route   PATCH /api/investments/:id/featured
// @access  Private (Admin)
export const toggleFeatured = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { featured } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError(
          "Not authorized to update investment status",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investment = await Investment.findById(id);
    if (!investment) {
      return next(new AppError("Investment not found", StatusCodes.NOT_FOUND));
    }

    const updatedInvestment = await Investment.findByIdAndUpdate(
      id,
      { featured: featured !== undefined ? featured : !investment.featured },
      { new: true }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Investment ${
        updatedInvestment?.featured ? "featured" : "unfeatured"
      } successfully`,
      data: updatedInvestment,
    });
  }
);

// @desc    Toggle trending status
// @route   PATCH /api/investments/:id/trending
// @access  Private (Admin)
export const toggleTrending = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { trending } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError(
          "Not authorized to update investment status",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investment = await Investment.findById(id);
    if (!investment) {
      return next(new AppError("Investment not found", StatusCodes.NOT_FOUND));
    }

    const updatedInvestment = await Investment.findByIdAndUpdate(
      id,
      { trending: trending !== undefined ? trending : !investment.trending },
      { new: true }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Investment ${
        updatedInvestment?.trending
          ? "marked as trending"
          : "removed from trending"
      } successfully`,
      data: updatedInvestment,
    });
  }
);

// @desc    Change investment status
// @route   PATCH /api/investments/:id/status
// @access  Private (Admin)
export const changeInvestmentStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError(
          "Not authorized to update investment status",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    if (!Object.values(InvestmentStatus).includes(status as InvestmentStatus)) {
      return next(new AppError("Invalid status", StatusCodes.BAD_REQUEST));
    }

    const investment = await Investment.findById(id);
    if (!investment) {
      return next(new AppError("Investment not found", StatusCodes.NOT_FOUND));
    }

    const updatedInvestment = await Investment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    // If status is completed, update all user investments to completed
    if (status === InvestmentStatus.COMPLETED) {
      await UserInvestment.updateMany(
        { investmentId: id, status: { $ne: InvestmentStatus.CANCELLED } },
        { status: InvestmentStatus.COMPLETED }
      );
    }

    // If status is cancelled, update all pending user investments to cancelled
    if (status === InvestmentStatus.CANCELLED) {
      await UserInvestment.updateMany(
        { investmentId: id, status: InvestmentStatus.PENDING },
        { status: InvestmentStatus.CANCELLED }
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Investment status updated successfully",
      data: updatedInvestment,
    });
  }
);


// @desc    Invest in property
// @route   POST /api/investments/:id/invest
// @access  Private
export const investInProperty = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { userId, amount, selectedPlan, selectedDuration, notes, calculatedReturns } = req.body

  console.log("Investment request body:", req.body)

  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  // Validate input
  if (!amount || amount < 100) {
    return next(new AppError("Amount must be at least 100", StatusCodes.BAD_REQUEST))
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST))
  }

  // Find the investment
  const investment = await Investment.findById(id)
  if (!investment) {
    return next(new AppError("Investment not found", StatusCodes.NOT_FOUND))
  }

  // Check if investment is active
  if (investment.status !== InvestmentStatus.ACTIVE) {
    return next(new AppError("This investment is not currently active", StatusCodes.BAD_REQUEST))
  }

  // Check minimum investment amount
  if (amount < investment.minimumInvestment) {
    return next(new AppError(`Minimum investment amount is ${investment.minimumInvestment}`, StatusCodes.BAD_REQUEST))
  }

  // Find the user
  const user = await User.findById(userId)
  if (!user) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND))
  }

  // Find user's wallet
  const userWallet = await Wallet.findOne({ user: userId })
  if (!userWallet) {
    return next(new AppError("User wallet not found", StatusCodes.NOT_FOUND))
  }

  // Check if user has sufficient balance
  if (userWallet.availableBalance < amount) {
    return next(new AppError("Insufficient wallet balance", StatusCodes.BAD_REQUEST))
  }

  // Find system/admin user (recipient)
  const systemUser = await User.findOne({ email: "esthington@gmail.com" })
  if (!systemUser) {
    return next(new AppError("System user not found", StatusCodes.NOT_FOUND))
  }

  // Find or create system wallet
  let systemWallet = await Wallet.findOne({ user: systemUser._id })
  if (!systemWallet) {
    systemWallet = await Wallet.create({
      user: systemUser._id,
      balance: 0,
      availableBalance: 0,
      pendingBalance: 0,
    })
  }

  // Use database transaction for atomicity
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Generate unique reference
    const reference = `INV-${investment._id}-${Date.now()}-${uuidv4().substring(0, 8)}`

    // 1. Create debit transaction for user (investment payment)
    const userTransaction = await Transaction.create(
      [
        {
          user: userId,
          type: TransactionType.INVESTMENT,
          amount: amount,
          status: TransactionStatus.COMPLETED,
          reference: reference,
          description: `Investment in ${investment.title} - ${selectedPlan} for ${selectedDuration}`,
          paymentMethod: PaymentMethod.WALLET,
          recipient: systemUser._id,
          investment: investment._id,
          metadata: {
            investmentTitle: investment.title,
            selectedPlan: selectedPlan,
            selectedDuration: selectedDuration,
            calculatedReturns: calculatedReturns,
            notes: notes,
          },
        },
      ],
      { session },
    )

    // 2. Create credit transaction for system (investment received)
    const systemTransaction = await Transaction.create(
      [
        {
          user: systemUser._id,
          type: TransactionType.INVESTMENT,
          amount: amount,
          status: TransactionStatus.COMPLETED,
          reference: reference,
          description: `Investment received from ${user.firstName} ${user.lastName} for ${investment.title}`,
          paymentMethod: PaymentMethod.WALLET,
          sender: userId,
          investment: investment._id,
          metadata: {
            investmentTitle: investment.title,
            selectedPlan: selectedPlan,
            selectedDuration: selectedDuration,
            investorName: `${user.firstName} ${user.lastName}`,
            calculatedReturns: calculatedReturns,
          },
        },
      ],
      { session },
    )

    // 3. Update user wallet (debit)
    userWallet.balance -= amount
    userWallet.availableBalance -= amount
    userWallet.pendingBalance += calculatedReturns?.totalAmount; // Optional: if you want to track pending investments
    await userWallet.save({ session })

    // 4. Update system wallet (credit)
    systemWallet.balance += amount
    systemWallet.availableBalance += amount
    await systemWallet.save({ session })

    // 5. Create user investment record
    const userInvestment = await UserInvestment.create(
      [
        {
          userId: userId,
          investmentId: id,
          amount: amount,
          status: InvestmentStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + (calculatedReturns.durationMonths || 12) * 30 * 24 * 60 * 60 * 1000),
          expectedReturn: calculatedReturns.totalReturn,
          actualReturn: 0,
          paymentReference: reference,
          selectedPlan: selectedPlan,
          selectedDuration: selectedDuration,
          notes: notes,
          calculatedReturns: calculatedReturns,
        },
      ],
      { session },
    )

    // 6. Update investment with new investor
    const investorData = {
      userId: userId,
      amount: amount,
      date: new Date(),
      planName: selectedPlan,
      selectedDuration: selectedDuration,
      durationMonths: calculatedReturns.durationMonths || 12,
      payoutDate: new Date(Date.now() + (calculatedReturns.durationMonths || 12) * 30 * 24 * 60 * 60 * 1000),
      isPaid: false,
      amountPaid: 0,
      transactionRef: reference,
      notes: notes,
    }

    await Investment.findByIdAndUpdate(
      id,
      {
        $push: { investors: investorData },
        $inc: {
          raisedAmount: amount,
          totalInvestors: 1,
        },
      },
      { session },
    )

    // 7. Create notifications
    await notificationService.createNotification(
      userId.toString(),
      "Investment Successful",
      `Your investment of ₦${amount.toLocaleString()} in ${investment.title} has been processed successfully.`,
      NotificationType.TRANSACTION,
      "/dashboard/investments/my-investments",
      {
        transactionId: userTransaction[0]._id,
        investmentId: investment._id,
      },
    )

    await notificationService.createNotification(
      systemUser._id.toString(),
      "New Investment Received",
      `New investment of ₦${amount.toLocaleString()} received from ${user.firstName} ${user.lastName} for ${investment.title}.`,
      NotificationType.TRANSACTION,
      "/admin/investments",
      {
        transactionId: systemTransaction[0]._id,
        investmentId: investment._id,
        investorId: userId,
      },
    )

    // Commit the transaction
    await session.commitTransaction()

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Investment successful! Your funds have been processed.",
      data: {
        userInvestment: userInvestment[0],
        transaction: userTransaction[0],
        updatedWalletBalance: userWallet.availableBalance,
        investmentDetails: {
          title: investment.title,
          amount: amount,
          selectedPlan: selectedPlan,
          selectedDuration: selectedDuration,
          expectedReturns: calculatedReturns,
          reference: reference,
        },
      },
    })
  } catch (error) {
    // Rollback the transaction on error
    await session.abortTransaction()
    console.error("Investment transaction failed:", error)

    return next(
      new AppError(
        `Investment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        StatusCodes.INTERNAL_SERVER_ERROR,
      ),
    )
  } finally {
    session.endSession()
  }
})

// @desc    Verify investment payment
// @route   POST /api/investments/:id/verify-payment
// @access  Private
export const verifyInvestmentPayment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { reference, amount } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user.id;

    if (!reference) {
      return next(
        new AppError("Payment reference is required", StatusCodes.BAD_REQUEST)
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investment = await Investment.findById(id);
    if (!investment) {
      return next(new AppError("Investment not found", StatusCodes.NOT_FOUND));
    }

    // Verify payment
    try {
      const paymentService = require("../services/paymentService");
      const verificationResult = await paymentService.verifyPayment(reference);

      if (!verificationResult.success) {
        return next(
          new AppError("Payment verification failed", StatusCodes.BAD_REQUEST)
        );
      }

      // Calculate expected return and payout dates
      const expectedReturn = calculateExpectedReturns(
        amount,
        investment.returnRate,
        investment.duration
      );
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + investment.duration);

      // Generate payout schedule
      const payouts = generatePayoutSchedule(
        amount,
        investment.returnRate,
        investment.duration,
        investment.payoutFrequency,
        startDate
      );

      // Create user investment
      const userInvestment = await UserInvestment.create({
        userId,
        investmentId: id,
        amount,
        status: InvestmentStatus.ACTIVE,
        startDate,
        endDate,
        expectedReturn,
        actualReturn: 0,
        nextPayoutDate: payouts.length > 0 ? payouts[0].date : undefined,
        payouts: payouts.map((payout) => ({
          date: payout.date,
          amount: payout.amount,
          status: "pending",
        })),
        paymentReference: reference,
      });

      // Update investment with new investor and raised amount
      await Investment.findByIdAndUpdate(id, {
        $push: { investors: { userId, amount, date: new Date() } },
        $inc: { raisedAmount: amount, totalInvestors: 1 },
      });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: "Investment successful",
        data: userInvestment,
      });
    } catch (error) {
      return next(
        new AppError(
          "Failed to verify payment",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }
  }
);

// @desc    Get investment analytics
// @route   GET /api/investments/analytics
// @access  Private (Admin)
export const getInvestmentAnalytics = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError("Not authorized to view analytics", StatusCodes.FORBIDDEN)
      );
    }

    // Get total investments
    const totalInvestments = await Investment.countDocuments();

    // Get total active investments
    const activeInvestments = await Investment.countDocuments({
      status: InvestmentStatus.ACTIVE,
    });

    // Get total raised amount
    const totalRaisedAggregate = await Investment.aggregate([
      {
        $group: {
          _id: null,
          totalRaised: { $sum: "$raisedAmount" },
        },
      },
    ]);
    const totalRaised =
      totalRaisedAggregate.length > 0 ? totalRaisedAggregate[0].totalRaised : 0;

    // Get total target amount
    const totalTargetAggregate = await Investment.aggregate([
      {
        $group: {
          _id: null,
          totalTarget: { $sum: "$targetAmount" },
        },
      },
    ]);
    const totalTarget =
      totalTargetAggregate.length > 0 ? totalTargetAggregate[0].totalTarget : 0;

    // Get total investors
    const totalInvestorsAggregate = await Investment.aggregate([
      {
        $group: {
          _id: null,
          totalInvestors: { $sum: "$totalInvestors" },
        },
      },
    ]);
    const totalInvestors =
      totalInvestorsAggregate.length > 0
        ? totalInvestorsAggregate[0].totalInvestors
        : 0;

    // Get investments by type
    const investmentsByType = await Investment.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalRaised: { $sum: "$raisedAmount" },
        },
      },
    ]);

    // Get investments by status
    const investmentsByStatus = await Investment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent investments
    const recentInvestments = await Investment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("propertyId", "title location images");

    // Get top performing investments
    const topPerformingInvestments = await Investment.aggregate([
      {
        $addFields: {
          percentageFunded: { $divide: ["$raisedAmount", "$targetAmount"] },
        },
      },
      {
        $sort: { percentageFunded: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "properties",
          localField: "propertyId",
          foreignField: "_id",
          as: "property",
        },
      },
      {
        $unwind: "$property",
      },
    ]);

    // Get monthly investment trends for the past year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const monthlyTrends = await UserInvestment.aggregate([
      {
        $match: {
          createdAt: { $gte: oneYearAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        totalInvestments,
        activeInvestments,
        totalRaised,
        totalTarget,
        totalInvestors,
        fundingPercentage:
          totalTarget > 0 ? (totalRaised / totalTarget) * 100 : 0,
        investmentsByType,
        investmentsByStatus,
        recentInvestments,
        topPerformingInvestments,
        monthlyTrends,
      },
    });
  }
);

// @desc    Get user investment analytics
// @route   GET /api/users/:userId/investments/analytics
// @access  Private
export const getUserInvestmentAnalytics = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Only allow users to view their own analytics unless admin
    if (
      req.user.id !== userId &&
      !["admin", "super_admin"].includes(req.user.role)
    ) {
      return next(
        new AppError(
          "Not authorized to view these analytics",
          StatusCodes.FORBIDDEN
        )
      );
    }

    // Get user investments
    const userInvestments = await UserInvestment.find({ userId });

    // Get total invested amount
    const totalInvestedAggregate = await UserInvestment.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: null,
          totalInvested: { $sum: "$amount" },
          totalExpectedReturn: { $sum: "$expectedReturn" },
        },
      },
    ]);

    const totalInvested =
      totalInvestedAggregate.length > 0
        ? totalInvestedAggregate[0].totalInvested
        : 0;
    const totalExpectedReturn =
      totalInvestedAggregate.length > 0
        ? totalInvestedAggregate[0].totalExpectedReturn
        : 0;
    const totalActualReturnAggregate = await UserInvestment.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: null,
          totalActualReturn: { $sum: "$actualReturn" },
        },
      },
    ]);
    const totalActualReturn =
      totalActualReturnAggregate.length > 0
        ? totalActualReturnAggregate[0].totalActualReturn
        : 0;

    // Get investments by status
    const investmentsByStatus = await UserInvestment.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // Get upcoming payouts
    const upcomingPayouts = await UserInvestment.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          nextPayoutDate: { $gte: new Date() },
        },
      },
      {
        $sort: { nextPayoutDate: 1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "investments",
          localField: "investmentId",
          foreignField: "_id",
          as: "investment",
        },
      },
      {
        $unwind: "$investment",
      },
      {
        $project: {
          _id: 1,
          amount: 1,
          nextPayoutDate: 1,
          expectedReturn: 1,
          investmentTitle: "$investment.title",
        },
      },
    ]);

    // Get monthly investment history
    const monthlyInvestments = await UserInvestment.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        totalInvestments: userInvestments.length,
        totalInvested,
        totalExpectedReturn,
        totalActualReturn,
        returnOnInvestment:
          totalInvested > 0
            ? (totalExpectedReturn / totalInvested - 1) * 100
            : 0,
        investmentsByStatus,
        upcomingPayouts,
        monthlyInvestments,
      },
    });
  }
);

// @desc    Process investment payouts (scheduled job)
// @route   POST /api/investments/process-payouts
// @access  Private (Admin/System)
export const processInvestmentPayouts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // This endpoint should be secured with a system API key or admin authentication
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is admin or super_admin
    if (!["admin", "super_admin"].includes(req.user.role)) {
      return next(
        new AppError("Not authorized to process payouts", StatusCodes.FORBIDDEN)
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all user investments with payouts due today
    const duePayouts = await UserInvestment.find({
      status: InvestmentStatus.ACTIVE,
      payouts: {
        $elemMatch: {
          date: {
            $gte: today,
            $lt: tomorrow,
          },
          status: "pending",
        },
      },
    }).populate("userId");

    if (duePayouts.length === 0) {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "No payouts due today",
        data: { processed: 0 },
      });
    }

    let processedCount = 0;
    const errors = [];

    // Process each payout
    for (const investment of duePayouts) {
      try {
        // Find the payout that's due today
        interface Payout {
          date: Date;
          amount: number;
          status: string;
          processedDate?: Date;
        }

        const payoutIndex: number = investment.payouts.findIndex(
          (p: Payout) =>
            p.date >= today && p.date < tomorrow && p.status === "pending"
        );

        if (payoutIndex !== -1) {
          // Update payout status
          investment.payouts[payoutIndex].status = "completed";
          investment.payouts[payoutIndex].processedDate = new Date();

          // Update actual return
          investment.actualReturn += investment.payouts[payoutIndex].amount;

          // Find next pending payout
          const nextPendingPayout:
            | {
                date: Date;
                amount: number;
                status: string;
                processedDate?: Date;
              }
            | undefined = investment.payouts.find(
            (p: {
              date: Date;
              amount: number;
              status: string;
              processedDate?: Date;
            }) => p.status === "pending"
          );
          if (nextPendingPayout) {
            investment.nextPayoutDate = nextPendingPayout.date;
          } else {
            // No more payouts, mark as completed if all payouts are done
            const allCompleted: boolean = investment.payouts.every(
              (p: Payout) => p.status === "completed"
            );
            if (allCompleted) {
              investment.status = InvestmentStatus.COMPLETED;
              investment.nextPayoutDate = undefined;
            }
          }

          await investment.save();
          processedCount++;

          // TODO: Send notification to user about payout
          // notificationService.sendPayoutNotification(investment.userId, investment.payouts[payoutIndex]);
        }
      } catch (error) {
        console.error(
          `Error processing payout for investment ${investment._id}:`,
          error
        );
        errors.push({
          investmentId: investment._id,
          error: (error as Error).message,
        });
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Processed ${processedCount} payouts`,
      data: {
        processed: processedCount,
        total: duePayouts.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  }
);
