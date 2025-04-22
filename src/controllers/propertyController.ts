import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/appError";
import Property, { PropertyType } from "../models/propertyModel";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";

// Import the notification service at the top of the file
import notificationService from "../services/notificationService";
import { NotificationType } from "../models/notificationModel";
import User from "../models/userModel";

// @desc    Get all properties
// @route   GET /api/properties
// @access  Public
export const getProperties = asyncHandler(
  async (req: Request, res: Response) => {
    const properties = await Property.find();

    res.status(StatusCodes.OK).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  }
);

// @desc    Get property by ID
// @route   GET /api/properties/:id
// @access  Public
export const getPropertyById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);

    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: property,
    });
  }
);

// @desc    Create property
// @route   POST /api/properties
// @access  Private (Admin)
export const createProperty = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {
      title,
      description,
      type,
      price,
      location,
      features,
      images,
      documents,
      owner,
    } = req.body;


    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }
    
    // Validate required fields
    if (
      !title ||
      !description ||
      !type ||
      !price ||
      !location ||
      !features ||
      !owner
    ) {
      return next(
        new AppError(
          "Please provide all required fields",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const property = await Property.create({
      title,
      description,
      type,
      price,
      location,
      features,
      images,
      documents,
      owner: req.user.id,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Property created successfully",
      data: property,
    });
  }
);

// @desc    Update property
// @route   PUT /api/properties/:id
// @access  Private (Admin)
export const updateProperty = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      type,
      price,
      location,
      features,
      images,
      documents,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findByIdAndUpdate(
      id,
      {
        title,
        description,
        type,
        price,
        location,
        features,
        images,
        documents,
      },
      { new: true, runValidators: true }
    );

    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Property updated successfully",
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete property
// @route   DELETE /api/properties/:id
// @access  Private (Admin)
export const deleteProperty = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findByIdAndDelete(id);

    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload property images
// @route   POST /api/properties/:id/images
// @access  Private (Admin)
export const uploadPropertyImages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);

    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
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

    // Update property with image URLs
    property.images = images;
    await property.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Images uploaded successfully",
      data: { images },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete property image
// @route   DELETE /api/properties/:id/images/:imageId
// @access  Private (Admin)
export const deletePropertyImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, imageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);

    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    // Check if image exists
    const imageIndex = property.images.findIndex((image) => image === imageId);
    if (imageIndex === -1) {
      return next(new AppError("Image not found", StatusCodes.NOT_FOUND));
    }

    // Delete image from Cloudinary
    await deleteFromCloudinary(imageId);

    // Remove image from property
    property.images.splice(imageIndex, 1);
    await property.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Image deleted successfully",
      data: { images: property.images },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get property types
// @route   GET /api/properties/types
// @access  Public
export const getPropertyTypes = async (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    data: Object.values(PropertyType),
  });
};

// @desc    Get property locations
// @route   GET /api/properties/locations
// @access  Public
export const getPropertyLocations = async (req: Request, res: Response) => {
  try {
    const locations = await Property.aggregate([
      {
        $group: {
          _id: "$location.city",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("Error getting property locations:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve property locations",
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
};

// Add a new function to handle property purchases
// @desc    Purchase a property
// @route   POST /api/properties/:id/purchase
// @access  Private
export const purchaseProperty = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(400).json({ status: "fail", message: "User not authenticated" });
        return;
      }

      const userId = req.user?._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
        return;
      }

      const property = await Property.findById(id);
      if (!property) {
        next(new AppError("Property not found", StatusCodes.NOT_FOUND));
        return;
      }

      // In a real app, you would handle payment processing here
      // For now, we'll just create a notification

      // Create notification for buyer
      await notificationService.createNotification(
        userId,
        "Property Purchase Initiated",
        `Your purchase of ${property.title} has been initiated. Our team will contact you shortly.`,
        NotificationType.PROPERTY,
        `/dashboard/properties/${id.toString()}`,
        { propertyId: property._id }
      );

      // Create notification for property owner
      if (property.owner) {
        await notificationService.createNotification(
          property.owner.toString(),
          "Property Purchase Request",
          `A purchase request has been made for your property: ${property.title}.`,
          NotificationType.PROPERTY,
          `/dashboard/properties/${id}`,
          { propertyId: property._id }
        );
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Property purchase initiated successfully",
        data: property,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add this new function at the end of the file

// @desc    Initiate property purchase
// @route   POST /api/properties/:id/purchase/initiate
// @access  Private
export const initiatePropertyPurchase = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (property.status !== "available") {
      return next(
        new AppError(
          "Property is not available for purchase",
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
    const paymentResponse = await paymentService.initializePropertyPurchase(
      userId.toString(),
      property._id.toString(),
      property.price,
      user.email
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Property purchase initiated",
      data: paymentResponse,
    });
  }
);
