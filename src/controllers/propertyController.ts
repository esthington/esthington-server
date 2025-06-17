import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/appError";
import Property, {
  PropertyType,
  PlotStatus,
  PropertyPlot,
} from "../models/propertyModel";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
// Import the notification service
import notificationService from "../services/notificationService";
import { NotificationType } from "../models/notificationModel";
import User from "../models/userModel";
import {
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
  Wallet,
} from "../models/walletModel";
import { processReferralCommissions } from "../services/referralService";
import { v4 as uuidv4 } from "uuid";
import PropertyPayment, { PaymentStatus } from "../models/propertyPaymentModel";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

// @desc    Get all properties
// @route   GET /api/properties
// @access  Public
export const getAllProperties = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Number.parseInt(req.query.page as string) || 1;

    const properties = await Property.find()
      .populate("companyId", "name logo")
      .sort({ createdAt: -1 });

    // // Transform data to match client expectations
    // const transformedProperties = properties.map((property) => {
    //   const companyData = property.companyId as any;
    //   return {
    //     ...property.toObject(),
    //     companyName: companyData?.name || "",
    //     companyLogo: companyData?.logo || "",
    //   };
    // });

    res.status(StatusCodes.OK).json({
      success: true,
      data: properties,
    });
  }
);

export const getProperties = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Apply filters if provided
    if (req.query.featured) {
      filter.featured = req.query.featured === "true";
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.location) {
      filter.location = { $regex: req.query.location, $options: "i" };
    }

    if (req.query.minPrice) {
      filter.price = { $gte: Number.parseInt(req.query.minPrice as string) };
    }

    if (req.query.maxPrice) {
      if (filter.price) {
        filter.price.$lte = Number.parseInt(req.query.maxPrice as string);
      } else {
        filter.price = { $lte: Number.parseInt(req.query.maxPrice as string) };
      }
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      filter.$text = { $search: req.query.search as string };
    }

    const total = await Property.countDocuments(filter);
    const properties = await Property.find(filter)
      .populate("companyId", "name logo")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Transform data to match client expectations
    const transformedProperties = properties.map((property) => {
      const companyData = property.companyId as any;
      return {
        ...property.toObject(),
        companyName: companyData?.name || "",
        companyLogo: companyData?.logo || "",
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedProperties,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
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

    const property = await Property.findById(id).populate(
      "companyId",
      "name logo"
    );

    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    // Transform data to match client expectations
    const companyData = property.companyId as any;
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    console.log("data", property);

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedProperty,
    });
  }
);

// @desc    Create property
// @route   POST /api/properties
// @access  Private (Admin)
export const createProperty = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("===> Entered createProperty handler");

    if (!req.user) {
      console.log("User not authenticated");
      next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED));
      return;
    }

    console.log("Parsing property data from request body");
    const propertyData = JSON.parse(req.body.data || "{}");

    console.log("Validating required fields");
    if (
      !propertyData.title ||
      !propertyData.description ||
      !propertyData.location ||
      !propertyData.price ||
      !propertyData.plotSize ||
      !propertyData.totalPlots ||
      !propertyData.type ||
      !propertyData.companyId
    ) {
      console.log("Missing required fields");
      next(
        new AppError(
          "Please provide all required fields",
          StatusCodes.BAD_REQUEST
        )
      );
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    console.log("Handling file uploads", Object.keys(files));

    // Upload thumbnail
    let thumbnailUrl = "";
    if (files.thumbnail && files.thumbnail[0]) {
      console.log("Uploading thumbnail to Cloudinary");
      const thumbnailResult = await uploadToCloudinary(
        files.thumbnail[0].path,
        "properties/thumbnails"
      );
      thumbnailUrl = thumbnailResult.secure_url;
      console.log("Thumbnail uploaded:", thumbnailUrl);
    }

    // Upload gallery images
    const galleryUrls: string[] = [];
    if (files.gallery) {
      console.log("Uploading gallery images to Cloudinary");
      for (const file of files.gallery) {
        const result = await uploadToCloudinary(
          file.path,
          "properties/gallery"
        );
        galleryUrls.push(result.secure_url);
      }
      console.log("Gallery images uploaded:", galleryUrls);
    }

    // Upload plan file
    let planFileUrl = "";
    if (files.planFile && files.planFile[0]) {
      console.log("Uploading plan file to Cloudinary");
      const planResult = await uploadToCloudinary(
        files.planFile[0].path,
        "properties/plans"
      );
      planFileUrl = planResult.secure_url;
      console.log("Plan file uploaded:", planFileUrl);
    }

    // Upload documents
    const documentUrls: string[] = [];
    if (files.documents) {
      console.log("Uploading documents to Cloudinary");
      for (const file of files.documents) {
        const result = await uploadToCloudinary(
          file.path,
          "properties/documents"
        );
        documentUrls.push(result.secure_url);
      }
      console.log("Documents uploaded:", documentUrls);
    }

    console.log("Creating property in database", {
      ...propertyData,
      thumbnail: thumbnailUrl,
      gallery: galleryUrls,
      planFile: planFileUrl,
      documents: documentUrls,
    });
    const property = await Property.create({
      ...propertyData,
      thumbnail: thumbnailUrl,
      gallery: galleryUrls,
      planFile: planFileUrl,
      documents: documentUrls,
    });

    console.log("Populating company details");
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    console.log("Transforming property data for response");
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    console.log("Sending response");
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Property created successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Update property
// @route   PUT /api/properties/:id
// @access  Private (Admin)
export const updateProperty = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    // Parse the JSON data from the form
    const propertyData = JSON.parse(req.body.data || "{}");

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Upload thumbnail if provided
    if (files.thumbnail && files.thumbnail[0]) {
      // Delete old thumbnail if exists
      if (property.thumbnail) {
        await deleteFromCloudinary(property.thumbnail);
      }
      const thumbnailResult = await uploadToCloudinary(
        files.thumbnail[0].path,
        "properties/thumbnails"
      );
      propertyData.thumbnail = thumbnailResult.secure_url;
    }

    // Upload gallery images if provided
    if (files.gallery && files.gallery.length > 0) {
      const galleryUrls: string[] = [];
      for (const file of files.gallery) {
        const result = await uploadToCloudinary(
          file.path,
          "properties/gallery"
        );
        galleryUrls.push(result.secure_url);
      }
      propertyData.gallery = [...(property.gallery || []), ...galleryUrls];
    }

    // Upload plan file if provided
    if (files.planFile && files.planFile[0]) {
      // Delete old plan file if exists
      if (property.planFile) {
        await deleteFromCloudinary(property.planFile);
      }
      const planResult = await uploadToCloudinary(
        files.planFile[0].path,
        "properties/plans"
      );
      propertyData.planFile = planResult.secure_url;
    }

    // Upload documents if provided
    if (files.documents && files.documents.length > 0) {
      const documentUrls: string[] = [];
      for (const file of files.documents) {
        const result = await uploadToCloudinary(
          file.path,
          "properties/documents"
        );
        documentUrls.push(result.secure_url);
      }
      propertyData.documents = [...(property.documents || []), ...documentUrls];
    }

    // Update property
    const updatedProperty = await Property.findByIdAndUpdate(id, propertyData, {
      new: true,
      runValidators: true,
    }).populate("companyId", "name logo");

    if (!updatedProperty) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    // Transform data to match client expectations
    const companyData = updatedProperty.companyId as any;
    const transformedProperty = {
      ...updatedProperty.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Property updated successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Delete property
// @route   DELETE /api/properties/:id
// @access  Private (Admin)
export const deleteProperty = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    // Delete all associated files from Cloudinary
    if (property.thumbnail) {
      await deleteFromCloudinary(property.thumbnail);
    }

    if (property.gallery && property.gallery.length > 0) {
      for (const image of property.gallery) {
        await deleteFromCloudinary(image);
      }
    }

    if (property.planFile) {
      await deleteFromCloudinary(property.planFile);
    }

    if (property.documents && property.documents.length > 0) {
      for (const doc of property.documents) {
        await deleteFromCloudinary(doc);
      }
    }

    await Property.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Property deleted successfully",
    });
  }
);

// @desc    Upload property thumbnail
// @route   POST /api/properties/:id/thumbnail
// @access  Private (Admin)
export const uploadThumbnail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (!req.file) {
      return next(
        new AppError("No file was uploaded", StatusCodes.BAD_REQUEST)
      );
    }

    // Delete old thumbnail if exists
    if (property.thumbnail) {
      await deleteFromCloudinary(property.thumbnail);
    }

    // Upload new thumbnail
    const result = await uploadToCloudinary(
      req.file.path,
      "properties/thumbnails"
    );

    // Update property
    property.thumbnail = result.secure_url;
    await property.save();

    // Populate company details
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    // Transform data to match client expectations
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Thumbnail uploaded successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Upload property gallery images
// @route   POST /api/properties/:id/gallery
// @access  Private (Admin)
export const uploadGalleryImages = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return next(
        new AppError("No files were uploaded", StatusCodes.BAD_REQUEST)
      );
    }

    // Upload gallery images
    const galleryUrls: string[] = [];
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.path, "properties/gallery");
      galleryUrls.push(result.secure_url);
    }

    // Update property
    property.gallery = [...(property.gallery || []), ...galleryUrls];
    await property.save();

    // Populate company details
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    // Transform data to match client expectations
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Gallery images uploaded successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Upload property plan file
// @route   POST /api/properties/:id/plan
// @access  Private (Admin)
export const uploadPlanFile = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (!req.file) {
      return next(
        new AppError("No file was uploaded", StatusCodes.BAD_REQUEST)
      );
    }

    // Delete old plan file if exists
    if (property.planFile) {
      await deleteFromCloudinary(property.planFile);
    }

    // Upload new plan file
    const result = await uploadToCloudinary(req.file.path, "properties/plans");

    // Update property
    property.planFile = result.secure_url;
    await property.save();

    // Populate company details
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    // Transform data to match client expectations
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Plan file uploaded successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Upload property documents
// @route   POST /api/properties/:id/documents
// @access  Private (Admin)
export const uploadDocuments = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return next(
        new AppError("No files were uploaded", StatusCodes.BAD_REQUEST)
      );
    }

    // Upload documents
    const documentUrls: string[] = [];
    for (const file of req.files) {
      const result = await uploadToCloudinary(
        file.path,
        "properties/documents"
      );
      documentUrls.push(result.secure_url);
    }

    // Update property
    property.documents = [...(property.documents || []), ...documentUrls];
    await property.save();

    // Populate company details
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    // Transform data to match client expectations
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Documents uploaded successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Delete property thumbnail
// @route   DELETE /api/properties/:id/thumbnail
// @access  Private (Admin)
export const deleteThumbnail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (!property.thumbnail) {
      return next(
        new AppError("No thumbnail to delete", StatusCodes.BAD_REQUEST)
      );
    }

    // Delete thumbnail from Cloudinary
    await deleteFromCloudinary(property.thumbnail);

    // Update property
    property.thumbnail = undefined;
    await property.save();

    // Populate company details
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    // Transform data to match client expectations
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Thumbnail deleted successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Delete property gallery image
// @route   DELETE /api/properties/:id/gallery
// @access  Private (Admin)
export const deleteGalleryImage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { imageUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    if (!imageUrl) {
      return next(
        new AppError("Image URL is required", StatusCodes.BAD_REQUEST)
      );
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (!property.gallery || !property.gallery.includes(imageUrl)) {
      return next(
        new AppError("Image not found in gallery", StatusCodes.NOT_FOUND)
      );
    }

    // Delete image from Cloudinary
    await deleteFromCloudinary(imageUrl);

    // Update property
    property.gallery = property.gallery.filter((url: any) => url !== imageUrl);
    await property.save();

    // Populate company details
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    // Transform data to match client expectations
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Gallery image deleted successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Delete property plan file
// @route   DELETE /api/properties/:id/plan
// @access  Private (Admin)
export const deletePlanFile = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (!property.planFile) {
      return next(
        new AppError("No plan file to delete", StatusCodes.BAD_REQUEST)
      );
    }

    // Delete plan file from Cloudinary
    await deleteFromCloudinary(property.planFile);

    // Update property
    property.planFile = undefined;
    await property.save();

    // Populate company details
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    // Transform data to match client expectations
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Plan file deleted successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Delete property document
// @route   DELETE /api/properties/:id/documents
// @access  Private (Admin)
export const deleteDocument = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { documentUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    if (!documentUrl) {
      return next(
        new AppError("Document URL is required", StatusCodes.BAD_REQUEST)
      );
    }

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    if (!property.documents || !property.documents.includes(documentUrl)) {
      return next(new AppError("Document not found", StatusCodes.NOT_FOUND));
    }

    // Delete document from Cloudinary
    await deleteFromCloudinary(documentUrl);

    // Update property
    property.documents = property.documents.filter(
      (url: any) => url !== documentUrl
    );
    await property.save();

    // Populate company details
    await property.populate("companyId", "name logo");
    const companyData = property.companyId as any;

    // Transform data to match client expectations
    const transformedProperty = {
      ...property.toObject(),
      companyName: companyData?.name || "",
      companyLogo: companyData?.logo || "",
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Document deleted successfully",
      data: transformedProperty,
    });
  }
);

// @desc    Get property types
// @route   GET /api/properties/types
// @access  Public
export const getPropertyTypes = asyncHandler(
  async (req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({
      success: true,
      types: Object.values(PropertyType),
    });
  }
);

// @desc    Get property locations
// @route   GET /api/properties/locations
// @access  Public
export const getPropertyLocations = asyncHandler(
  async (req: Request, res: Response) => {
    const locations = await Property.aggregate([
      {
        $group: {
          _id: "$location",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      locations: locations.map((item) => item._id),
    });
  }
);

// @desc    Get property amenities
// @route   GET /api/properties/amenities
// @access  Public
export const getAmenities = asyncHandler(
  async (req: Request, res: Response) => {
    // Common amenities list
    const commonAmenities = [
      "Electricity",
      "Road Access",
      "Security",
      "Water",
      "Drainage System",
      "Perimeter Fencing",
      "Recreational Areas",
      "Shopping Centers",
      "Schools",
      "Hospitals",
      "Public Transport",
      "Internet Access",
    ];

    // Get unique amenities from database
    const dbAmenities = await Property.aggregate([
      { $unwind: "$amenities" },
      { $group: { _id: "$amenities" } },
      { $sort: { _id: 1 } },
    ]);

    // Combine common amenities with unique ones from database
    const uniqueAmenities = new Set([
      ...commonAmenities,
      ...dbAmenities.map((item) => item._id),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      amenities: Array.from(uniqueAmenities),
    });
  }
);

// @desc    Initiate property purchase using wallet
// @route   POST /api/properties/:id/purchase
// @access  Private
export const initiatePropertyPurchase = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { plotIds, notes } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("Invalid property ID", StatusCodes.BAD_REQUEST));
    }

    if (!plotIds || !Array.isArray(plotIds) || plotIds.length === 0) {
      return next(
        new AppError("Plot IDs are required", StatusCodes.BAD_REQUEST)
      );
    }

    console.log("===> Entered initiatePropertyPurchase handler", plotIds);
    console.log("User ID:", userId);

    // Add timeout promise to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Property purchase timeout after 30 seconds")),
        30000
      );
    });

    try {
      await Promise.race([
        timeoutPromise,
        (async () => {
          // Find the property
          console.log("===> Step 1: Finding property");
          const property = await Property.findById(id);
          console.log("===> Step 1 completed, property found:", !!property);
          if (!property) {
            throw new AppError("Property not found", StatusCodes.NOT_FOUND);
          }

          // Release any expired reservations first
          if (typeof property.releaseExpiredReservations === "function") {
            property.releaseExpiredReservations();
            await property.save();
          }

          // Validate plot IDs and availability
          console.log("===> Step 2: Validating plots");
          const validPlots = property.plots.filter(
            (plot: PropertyPlot) =>
              plotIds.includes(plot.plotId) &&
              plot.status === PlotStatus.AVAILABLE
          );

          if (validPlots.length !== plotIds.length) {
            const unavailablePlots = plotIds.filter(
              (plotId: string) =>
                !property.plots.some(
                  (plot: PropertyPlot) =>
                    plot.plotId === plotId &&
                    plot.status === PlotStatus.AVAILABLE
                )
            );

            throw new AppError(
              `One or more plots are invalid or not available: ${unavailablePlots.join(
                ", "
              )}`,
              StatusCodes.BAD_REQUEST
            );
          }
          console.log("===> Step 2 completed, valid plots:", validPlots.length);

          // Check if any plots are already owned by this user
          const alreadyOwnedPlots = property.plots.filter(
            (plot: PropertyPlot) =>
              plotIds.includes(plot.plotId) &&
              plot.buyerId &&
              plot.buyerId.toString() === userId.toString()
          );

          if (alreadyOwnedPlots.length > 0) {
            throw new AppError(
              `You already own the following plots: ${alreadyOwnedPlots
                .map((p: PropertyPlot) => p.plotId)
                .join(", ")}`,
              StatusCodes.BAD_REQUEST
            );
          }

          // Calculate total price
          const totalPrice = validPlots.reduce(
            (sum: number, plot: PropertyPlot) => sum + Number(plot.price),
            0
          );

          // Find the buyer and wallets
          console.log("===> Step 3: Finding buyer and wallets");
          const [buyer, buyerWallet, systemUser] = await Promise.all([
            User.findById(userId),
            Wallet.findOne({ user: userId }),
            User.findOne({ email: "esthington@gmail.com" }),
          ]);
          console.log(
            "===> Step 3 completed, entities found:",
            !!buyer,
            !!buyerWallet,
            !!systemUser
          );

          if (!buyer) {
            throw new AppError("Buyer not found", StatusCodes.NOT_FOUND);
          }

          if (!buyerWallet) {
            throw new AppError("Buyer wallet not found", StatusCodes.NOT_FOUND);
          }

          if (!systemUser) {
            throw new AppError("System user not found", StatusCodes.NOT_FOUND);
          }

          // Check if buyer has sufficient balance
          if (buyerWallet.availableBalance < totalPrice) {
            throw new AppError(
              `Insufficient wallet balance. Required: ₦${totalPrice.toLocaleString()}, Available: ₦${buyerWallet.availableBalance.toLocaleString()}`,
              StatusCodes.BAD_REQUEST
            );
          }

          // Find or create system wallet
          let systemWallet = await Wallet.findOne({ user: systemUser._id });
          if (!systemWallet) {
            systemWallet = await Wallet.create({
              user: systemUser._id,
              balance: 0,
              availableBalance: 0,
              pendingBalance: 0,
            });
          }

          console.log("===> Step 4: Starting database transaction");
          const session = await mongoose.startSession();
          session.startTransaction();
          console.log("===> Step 4 completed, transaction started");

          try {
            // Generate unique reference
            const reference = `PROP-${id}-${Date.now()}-${uuidv4().substring(
              0,
              8
            )}`;

            // Prepare plot details for metadata
            const plotDetails = validPlots.map((plot: PropertyPlot) => ({
              plotId: plot.plotId,
              price: plot.price,
              size: plot.size,
              coordinates: plot.coordinates,
            }));

            console.log("===> Step 5: Creating transactions");
            // Create buyer transaction (debit)
            const buyerTransaction = await Transaction.create(
              [
                {
                  user: userId,
                  type: TransactionType.PROPERTY_PURCHASE,
                  amount: totalPrice,
                  status: TransactionStatus.COMPLETED,
                  reference: reference,
                  description: `Property purchase: ${property.title} - ${plotIds.length} plot(s)`,
                  paymentMethod: PaymentMethod.WALLET,
                  recipient: systemUser._id,
                  metadata: {
                    propertyId: id,
                    propertyTitle: property.title,
                    plotIds: plotIds,
                    plotDetails: plotDetails,
                    plotCount: plotIds.length,
                    location: property.location,
                    propertyType: property.type,
                  },
                },
              ],
              { session }
            );

            // Create system transaction (credit)
            const systemTransaction = await Transaction.create(
              [
                {
                  user: systemUser._id,
                  type: TransactionType.PROPERTY_PURCHASE,
                  amount: totalPrice,
                  status: TransactionStatus.COMPLETED,
                  reference: reference,
                  description: `Property sale received from ${buyer.firstName} ${buyer.lastName} for ${property.title}`,
                  paymentMethod: PaymentMethod.WALLET,
                  sender: userId,
                  metadata: {
                    propertyId: id,
                    propertyTitle: property.title,
                    plotIds: plotIds,
                    plotDetails: plotDetails,
                    buyerName: `${buyer.firstName} ${buyer.lastName}`,
                    buyerEmail: buyer.email,
                    location: property.location,
                    propertyType: property.type,
                  },
                },
              ],
              { session }
            );
            console.log("===> Step 5 completed, transactions created");

            console.log("===> Step 6: Updating wallets");
            // Update buyer wallet (debit)
            buyerWallet.balance -= totalPrice;
            buyerWallet.availableBalance -= totalPrice;
            await buyerWallet.save({ session });

            // Update system wallet (credit)
            systemWallet.balance += totalPrice;
            systemWallet.availableBalance += totalPrice;
            await systemWallet.save({ session });
            console.log("===> Step 6 completed, wallets updated");

            // Create property payment record
            console.log("===> Step 7: Creating property payment record");
            const propertyPayment = await PropertyPayment.create(
              [
                {
                  propertyId: id,
                  propertyTitle: property.title,
                  buyerId: userId,
                  buyerName: `${buyer.firstName} ${buyer.lastName}`,
                  buyerEmail: buyer.email,
                  plotIds: plotIds,
                  plotDetails: plotDetails,
                  totalAmount: totalPrice,
                  paymentDate: new Date(),
                  paymentMethod: "wallet",
                  transactionRef: reference,
                  transactionId: buyerTransaction[0]._id,
                  status: PaymentStatus.COMPLETED,
                  commissions: [], // Will be populated after processing referrals
                  metadata: {
                    notes: notes,
                    location: property.location,
                    propertyType: property.type,
                  },
                },
              ],
              { session }
            );
            console.log(
              "===> Step 7 completed, payment record created:",
              propertyPayment[0]._id
            );

            console.log("===> Step 8: Updating plot statuses");
            // Update plot statuses and associate with buyer
            const updateResult = await Property.findByIdAndUpdate(
              id,
              {
                $set: {
                  "plots.$[elem].status": PlotStatus.SOLD,
                  "plots.$[elem].soldDate": new Date(),
                  "plots.$[elem].buyerId": userId,
                  "plots.$[elem].buyerName": `${buyer.firstName} ${buyer.lastName}`,
                  "plots.$[elem].buyerEmail": buyer.email,
                  "plots.$[elem].transactionRef": reference,
                  "plots.$[elem].paymentId": propertyPayment[0]._id, // Link to payment record
                  "plots.$[elem].notes": notes,
                },
              },
              {
                arrayFilters: [{ "elem.plotId": { $in: plotIds } }],
                session,
                new: true,
              }
            );

            if (!updateResult) {
              throw new Error("Failed to update plot ownership");
            }

            // Manually recalculate and update property counts to ensure accuracy
            const soldPlotsCount = updateResult.plots.filter(
              (plot: PropertyPlot) => plot.status === PlotStatus.SOLD
            ).length;
            const availablePlotsCount = updateResult.plots.filter(
              (plot: PropertyPlot) => plot.status === PlotStatus.AVAILABLE
            ).length;
            const reservedPlotsCount = updateResult.plots.filter(
              (plot: PropertyPlot) => plot.status === PlotStatus.RESERVED
            ).length;

            interface PlotWithPrice extends PropertyPlot {
              price: number;
              status: PlotStatus;
            }

            const calculatedTotalRevenue = (
              updateResult.plots as PlotWithPrice[]
            )
              .filter((plot: PlotWithPrice) => plot.status === PlotStatus.SOLD)
              .reduce(
                (sum: number, plot: PlotWithPrice) => sum + plot.price,
                0
              );

            // Update the property with correct counts
            await Property.findByIdAndUpdate(
              id,
              {
                $set: {
                  soldPlots: soldPlotsCount,
                  availablePlots: availablePlotsCount,
                  reservedPlots: reservedPlotsCount,
                  totalRevenue: calculatedTotalRevenue,
                  lastSaleDate: new Date(),
                  status: availablePlotsCount === 0 ? "Sold Out" : "Available",
                },
              },
              { session }
            );

            console.log("===> Step 8 completed, plots updated");

            console.log("===> Step 9: Processing referral commissions");
            let commissions: any[] = [];
            try {
              commissions =
                (await processReferralCommissions(
                  userId.toString(),
                  "property",
                  totalPrice,
                  session,
                  propertyPayment[0]._id.toString(),
                  reference
                )) ?? [];
              console.log(
                "===> Step 9 completed, commissions processed:",
                commissions.length
              );
            } catch (commissionError) {
              console.error(
                "Referral commission processing failed:",
                commissionError
              );
              // Continue without commissions rather than failing the entire transaction
              commissions = [];
            }

            console.log("===> Step 10: Creating property ownership record");
            // Create property ownership record
            const propertyOwnership = {
              propertyId: id,
              buyerId: userId,
              plotIds: plotIds,
              purchaseDate: new Date(),
              purchasePrice: totalPrice,
              transactionRef: reference,
              paymentId: propertyPayment[0]._id,
              status: "Owned",
              plotDetails: plotDetails,
            };

            // Add to buyer's property portfolio (if the field exists)
            try {
              await User.findByIdAndUpdate(
                userId,
                {
                  $push: { propertyPortfolio: propertyOwnership },
                },
                { session }
              );
            } catch (portfolioError) {
              console.error(
                "Failed to update property portfolio:",
                portfolioError
              );
              // Continue without portfolio update
            }
            console.log("===> Step 10 completed, ownership record created");

            console.log("===> Step 11: Creating notifications");
            // Create notifications (make them non-blocking)
            try {
              await Promise.all([
                notificationService.createNotification(
                  userId.toString(),
                  "Property Purchase Successful",
                  `Your purchase of ${plotIds.length} plot(s) in ${
                    property.title
                  } for ₦${totalPrice.toLocaleString()} has been completed successfully.`,
                  NotificationType.PROPERTY,
                  `/dashboard/properties/${id}`,
                  {
                    transactionId: buyerTransaction[0]._id,
                    propertyId: id,
                    plotIds: plotIds,
                    amount: totalPrice,
                    paymentId: propertyPayment[0]._id,
                  }
                ),
                notificationService.createNotification(
                  systemUser._id.toString(),
                  "New Property Sale",
                  `New property sale of ₦${totalPrice.toLocaleString()} received from ${
                    buyer.firstName
                  } ${buyer.lastName} for ${property.title}.`,
                  NotificationType.PROPERTY,
                  "/admin/properties",
                  {
                    transactionId: systemTransaction[0]._id,
                    buyerId: userId,
                    plotIds: plotIds,
                    amount: totalPrice,
                    paymentId: propertyPayment[0]._id,
                  }
                ),
              ]);

              // Send notifications for referral commissions
              if (commissions && commissions.length > 0) {
                const commissionNotifications = commissions.map(
                  (commission: any) =>
                    notificationService.createNotification(
                      commission.referrer.toString(),
                      "Property Sale Commission",
                      `You earned ₦${commission.amount.toLocaleString()} commission from a Level ${
                        commission.level
                      } property sale referral.`,
                      NotificationType.TRANSACTION,
                      "/dashboard/referrals",
                      {
                        transactionId: commission.transaction._id,
                        level: commission.level,
                        amount: commission.amount,
                        sourceTransaction: reference,
                        paymentId: propertyPayment[0]._id,
                      }
                    )
                );
                await Promise.all(commissionNotifications);
              }
            } catch (notificationError) {
              console.error(
                "Failed to create notifications:",
                notificationError
              );
              // Continue without notifications
            }
            console.log("===> Step 11 completed, notifications created");

            console.log("===> Step 12: Committing transaction");
            // Commit the transaction
            await session.commitTransaction();
            console.log("===> Step 12 completed, transaction committed");

            // Return success response
            res.status(StatusCodes.OK).json({
              success: true,
              message: "Property purchase completed successfully",
              data: {
                transaction: buyerTransaction[0],
                reference: reference,
                propertyId: id,
                plotIds: plotIds,
                totalPrice: totalPrice,
                paymentId: propertyPayment[0]._id,
                buyerWallet: {
                  balance: buyerWallet.availableBalance,
                },
                commissions: commissions || [],
              },
            });
          } catch (error) {
            // Rollback the transaction on error
            await session.abortTransaction();
            console.error("Property purchase transaction failed:", error);
            throw error;
          } finally {
            session.endSession();
          }
        })(),
      ]);
    } catch (error) {
      console.error("Property purchase failed or timed out:", error);
      return next(
        new AppError(
          `Property purchase failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }
  }
);

// @desc    Get user's properties
// @route   GET /api/user/properties
// @access  Private
export const getUserProperties = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?._id) {
      throw new AppError("User not authenticated", StatusCodes.UNAUTHORIZED);
    }

    const userId = req.user._id;

    // Find all property payments made by this user
    const payments = await PropertyPayment.find({ buyerId: userId })
      .sort({ paymentDate: -1 })
      .lean();

    // Get unique property IDs from payments
    const propertyIds = [
      ...new Set(payments.map((payment) => payment.propertyId)),
    ];

    // Find all properties where the user has purchased plots
    const userProperties = await Property.find({
      $or: [{ _id: { $in: propertyIds } }, { "plots.buyerId": userId }],
    })
      .select("-__v")
      .populate("companyId", "name logo")
      .lean();

    // Transform the data to include only user's plots and calculate totals
    const transformedProperties = userProperties.map((property) => {
      // Filter to only the plots owned by this user
      const userPlots = property.plots.filter(
        (plot: any) =>
          plot.buyerId && plot.buyerId.toString() === userId.toString()
      );

      // Calculate user's total investment in this property
      const totalInvestment = userPlots.reduce(
        (sum: any, plot: any) => sum + Number(plot.price),
        0
      );

      // Get company details
      const companyData = property.companyId as any;

      return {
        _id: property._id,
        title: property.title,
        description: property.description,
        location: property.location,
        type: property.type,
        status: property.status,
        thumbnail: property.thumbnail,
        planFile: property.planFile,
        documents: property.documents,
        companyName: companyData?.name || "",
        companyLogo: companyData?.logo || "",
        userPlots,
        totalInvestment,
        plotsOwned: userPlots.length,
        plotSize: property.plotSize,
        // Remove all plots from the response for security
        plots: undefined,
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedProperties,
      message: "User properties fetched successfully",
    });
  }
);

// @desc    Generate and download property document
// @route   GET /api/user/properties/download
// @access  Private
export const downloadPropertyDocument = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?._id) {
      throw new AppError("User not authenticated", StatusCodes.UNAUTHORIZED);
    }

    const userId = req.user._id;
    const { propertyId, documentType, plotId } = req.query;

    if (!propertyId || !documentType) {
      throw new AppError(
        "Property ID and document type are required",
        StatusCodes.BAD_REQUEST
      );
    }

    if (!mongoose.Types.ObjectId.isValid(propertyId as string)) {
      throw new AppError("Invalid property ID", StatusCodes.BAD_REQUEST);
    }

    // Find the property
    const property = await Property.findById(propertyId).populate(
      "companyId",
      "name logo"
    );

    if (!property) {
      throw new AppError("Property not found", StatusCodes.NOT_FOUND);
    }

    // Verify ownership
    const userPlots = property.plots.filter(
      (plot: any) =>
        plot.buyerId && plot.buyerId.toString() === userId.toString()
    );

    if (userPlots.length === 0) {
      throw new AppError(
        "You don't own any plots in this property",
        StatusCodes.FORBIDDEN
      );
    }

    // If plotId is specified, verify that the user owns this specific plot
    if (plotId) {
      const ownedPlot = userPlots.find((plot: any) => plot.plotId === plotId);
      if (!ownedPlot) {
        throw new AppError(
          "You don't own this specific plot",
          StatusCodes.FORBIDDEN
        );
      }
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }

    // Generate the document based on type
    const tempFilePath = path.join(
      __dirname,
      `../temp/${documentType}-${propertyId}-${Date.now()}.pdf`
    );

    try {
      // Create a PDF document
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(tempFilePath);

      doc.pipe(stream);

      // Add company logo if available
      const companyData = property.companyId as any;
      if (companyData?.logo) {
        doc.image(companyData.logo, 50, 45, { width: 100 });
        doc.moveDown(2);
      }

      // Add document title
      doc
        .fontSize(25)
        .text(`${documentType.toString().toUpperCase()} DOCUMENT`, {
          align: "center",
        });
      doc.moveDown();

      // Add property details
      doc.fontSize(14).text(`Property: ${property.title}`, { align: "left" });
      doc.fontSize(12).text(`Location: ${property.location}`);
      doc.fontSize(12).text(`Type: ${property.type}`);
      doc.moveDown();

      // Add user details
      doc
        .fontSize(14)
        .text(`Owner: ${user.firstName} ${user.lastName}`, { align: "left" });
      doc.fontSize(12).text(`Email: ${user.email}`);
      doc.moveDown();

      // Add plot details
      if (plotId) {
        const plot = userPlots.find((p: any) => p.plotId === plotId);
        if (plot) {
          doc.fontSize(14).text(`Plot Details:`, { align: "left" });
          doc.fontSize(12).text(`Plot ID: ${plot.plotId}`);
          doc.fontSize(12).text(`Size: ${plot.size}`);
          doc
            .fontSize(12)
            .text(`Price: ₦${Number(plot.price).toLocaleString()}`);
          doc
            .fontSize(12)
            .text(
              `Purchase Date: ${
                plot.soldDate
                  ? new Date(plot.soldDate).toLocaleDateString()
                  : "N/A"
              }`
            );
        }
      } else {
        doc
          .fontSize(14)
          .text(`Plots Owned: ${userPlots.length}`, { align: "left" });
        doc.moveDown();

        doc.fontSize(14).text(`Plot Details:`, { align: "left" });
        userPlots.forEach((plot: any, index: any) => {
          doc
            .fontSize(12)
            .text(
              `Plot ${index + 1}: ${plot.plotId} - ${plot.size} - ₦${Number(
                plot.price
              ).toLocaleString()}`
            );
        });
      }

      doc.moveDown(2);

      // Add legal text based on document type
      if (documentType === "deed") {
        doc
          .fontSize(12)
          .text(
            `This deed certifies that the above-named owner has purchased and fully paid for the specified plot(s) in the property described above. This ownership is subject to the terms and conditions outlined in the purchase agreement.`,
            { align: "justify" }
          );
      } else if (documentType === "plan") {
        doc
          .fontSize(12)
          .text(
            `This document provides the layout and planning details for the specified plot(s) in the property described above. All development must conform to local building codes and regulations.`,
            { align: "justify" }
          );
      } else {
        doc
          .fontSize(12)
          .text(
            `This document serves as proof of ownership for the specified plot(s) in the property described above. The owner has full rights as outlined in the purchase agreement.`,
            { align: "justify" }
          );
      }

      doc.moveDown(2);

      // Add date and signature
      const currentDate = new Date().toLocaleDateString();
      doc.fontSize(12).text(`Date: ${currentDate}`, { align: "right" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Signature: _______________________`, { align: "right" });

      // Finalize the PDF
      doc.end();

      // Wait for the stream to finish
      await new Promise<void>((resolve, reject) => {
        stream.on("finish", () => resolve());
        stream.on("error", reject);
      });

      // Set headers for download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${documentType}-${propertyId}${
          plotId ? `-${plotId}` : ""
        }.pdf`
      );

      // Send the file
      const fileStream = fs.createReadStream(tempFilePath);
      fileStream.pipe(res);

      // Clean up the file after sending
      fileStream.on("end", () => {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error("Error deleting temporary file:", err);
        });
      });
    } catch (error) {
      console.error("Error generating document:", error);
      // Clean up if there was an error
      if (fs.existsSync(tempFilePath)) {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error("Error deleting temporary file:", err);
        });
      }
      throw new AppError(
        "Failed to generate document",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);
