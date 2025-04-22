import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/appError";
import {
  MarketplaceListing,
  MarketplaceInterest,
} from "../models/marketplaceModel";
import { uploadToCloudinary } from "../services/cloudinaryService";
import { asyncHandler } from "../utils/asyncHandler";
import mongoose from "mongoose";
import User from "../models/userModel";
import notificationService from "../services/notificationService";
import { NotificationType } from "../models/notificationModel";

// @desc    Get all marketplace listings
// @route   GET /api/marketplace
// @access  Public
export const getMarketplaceListings = asyncHandler(
  async (req: Request, res: Response) => {
    const listings = await MarketplaceListing.find({ status: "active" });

    res.status(StatusCodes.OK).json({
      success: true,
      count: listings.length,
      data: listings,
    });
  }
);

// @desc    Get marketplace listing by ID
// @route   GET /api/marketplace/:id
// @access  Public
export const getMarketplaceListingById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Increment view count
    listing.viewCount += 1;
    await listing.save();

    res.status(StatusCodes.OK).json({
      success: true,
      data: listing,
    });
  }
);

// @desc    Create marketplace listing
// @route   POST /api/marketplace
// @access  Private (Agent)
export const createMarketplaceListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      title,
      description,
      price,
      negotiable,
      type,
      propertyType,
      location,
      features,
      images,
      documents,
      expiresAt,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !price ||
      !type ||
      !propertyType ||
      !location ||
      !features ||
      !expiresAt
    ) {
      return next(
        new AppError(
          "Please provide all required fields",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    if (!req.user) {
      return res
        .status(400)
        .json({ status: "fail", message: "User not authenticated" });
    }

    const listing = await MarketplaceListing.create({
      title,
      description,
      price,
      negotiable,
      type,
      propertyType,
      location,
      features,
      images,
      documents,
      seller: req?.user.id,
      expiresAt,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Listing created successfully",
      data: listing,
    });
  }
);

// @desc    Update marketplace listing
// @route   PUT /api/marketplace/:id
// @access  Private (Agent)
export const updateMarketplaceListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const {
      title,
      description,
      price,
      negotiable,
      type,
      propertyType,
      location,
      features,
      images,
      documents,
      expiresAt,
    } = req.body;

    if (!req.user) {
      return res
        .status(400)
        .json({ status: "fail", message: "User not authenticated" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the seller
    if (
      listing.seller.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new AppError(
          "Not authorized to update this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    // Update listing
    const updatedListing = await MarketplaceListing.findByIdAndUpdate(
      id,
      {
        title,
        description,
        price,
        negotiable,
        type,
        propertyType,
        location,
        features,
        images,
        documents,
        expiresAt,
      },
      { new: true, runValidators: true }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Listing updated successfully",
      data: updatedListing,
    });
  }
);

// @desc    Delete marketplace listing
// @route   DELETE /api/marketplace/:id
// @access  Private (Agent)
export const deleteMarketplaceListing = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return res
        .status(400)
        .json({ status: "fail", message: "User not authenticated" });
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the seller
    if (
      listing.seller.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new AppError(
          "Not authorized to delete this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    await MarketplaceListing.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Listing deleted successfully",
    });
  }
);

// @desc    Upload marketplace listing images
// @route   POST /api/marketplace/:id/images
// @access  Private (Agent)
export const uploadMarketplaceImages = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    if (!req.user) {
      return res
        .status(400)
        .json({ status: "fail", message: "User not authenticated" });
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the seller
    if (
      listing.seller.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new AppError(
          "Not authorized to update this listing",
          StatusCodes.FORBIDDEN
        )
      );
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return next(
        new AppError("No files were uploaded", StatusCodes.BAD_REQUEST)
      );
    }

    // Upload images to Cloudinary
    const uploadPromises = Object.values(req.files).map(async (file: any) => {
      if (Array.isArray(file)) {
        return Promise.all(file.map(async (f) => uploadToCloudinary(f.path)));
      } else {
        return uploadToCloudinary(file.path);
      }
    });

    const results = await Promise.all(uploadPromises);

    // Extract secure URLs from Cloudinary responses
    const images = results.flat().map((result) => result.secure_url);

    // Update listing with image URLs
    listing.images = [...(listing.images || []), ...images];
    await listing.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Images uploaded successfully",
      data: { images: listing.images },
    });
  }
);

// @desc    Express interest in a listing
// @route   POST /api/marketplace/:id/interest
// @access  Private
export const expressInterest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { message } = req.body;

    if (!req.user) {
      return res
        .status(400)
        .json({ status: "fail", message: "User not authenticated" });
    }

    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user has already expressed interest
    const existingInterest = await MarketplaceInterest.findOne({
      listing: id,
      user: userId,
    });

    if (existingInterest) {
      return next(
        new AppError(
          "You have already expressed interest in this listing",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // Create interest
    const interest = await MarketplaceInterest.create({
      listing: id,
      user: userId,
      message,
    });

    // Increment interest count
    listing.interestedCount += 1;
    await listing.save();

    // Notify seller
    await notificationService.createNotification(
      listing.seller.toString(),
      "New Interest in Your Listing",
      `Someone has expressed interest in your listing: ${listing.title}`,
      NotificationType.TRANSACTION,
      `/dashboard/marketplace/listings/${listing._id}/interests`,
      { listingId: listing._id, interestId: interest._id }
    );

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Interest expressed successfully",
      data: interest,
    });
  }
);

// @desc    Get interests for a listing
// @route   GET /api/marketplace/:id/interests
// @access  Private (Seller only)
export const getListingInterests = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return res
        .status(400)
        .json({ status: "fail", message: "User not authenticated" });
    }

    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is the seller
    if (listing.seller.toString() !== userId && req.user.role !== "admin") {
      return next(
        new AppError("Not authorized to view interests", StatusCodes.FORBIDDEN)
      );
    }

    const interests = await MarketplaceInterest.find({ listing: id }).populate(
      "user",
      "firstName lastName email phone"
    );

    res.status(StatusCodes.OK).json({
      success: true,
      count: interests.length,
      data: interests,
    });
  }
);

// @desc    Initiate marketplace listing purchase
// @route   POST /api/marketplace/:id/purchase/initiate
// @access  Private
export const initiateMarketplacePurchase = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return res
        .status(400)
        .json({ status: "fail", message: "User not authenticated" });
    }
    
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid listing ID", StatusCodes.BAD_REQUEST));
    }

    const listing = await MarketplaceListing.findById(id);
    if (!listing) {
      return next(new AppError("Listing not found", StatusCodes.NOT_FOUND));
    }

    if (listing.status !== "active") {
      return next(
        new AppError(
          "Listing is not available for purchase",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // Get user email for payment
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Initialize payment
    const paymentService = require("../services/paymentService").default;
    const paymentResponse = await paymentService.initializeMarketplacePurchase(
      userId.toString(),
      listing._id.toString(),
      listing.price,
      user.email
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Marketplace purchase initiated",
      data: paymentResponse,
    });
  }
);
