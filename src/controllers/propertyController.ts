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

// Import the notification service
import notificationService from "../services/notificationService";
import { NotificationType } from "../models/notificationModel";
import User from "../models/userModel";

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

    console.log("Creating property in database", {...propertyData,
      thumbnail: thumbnailUrl,
      gallery: galleryUrls,
      planFile: planFileUrl,
      documents: documentUrls});
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
    property.gallery = property.gallery.filter((url) => url !== imageUrl);
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
      (url) => url !== documentUrl
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

// @desc    Initiate property purchase
// @route   POST /api/properties/:id/purchase/initiate
// @access  Private
export const initiatePropertyPurchase = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { plotIds } = req.body;

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

    const property = await Property.findById(id);
    if (!property) {
      return next(new AppError("Property not found", StatusCodes.NOT_FOUND));
    }

    // Validate plot IDs
    const validPlots = property.plots.filter(
      (plot) => plotIds.includes(plot.plotId) && plot.status === "Available"
    );

    if (validPlots.length !== plotIds.length) {
      return next(
        new AppError(
          "One or more plots are invalid or not available",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // Calculate total price
    const totalPrice = validPlots.reduce(
      (sum, plot) => sum + Number(plot.price),
      0
    );

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
      totalPrice,
      user.email,
      plotIds
    );

    // Create notification for buyer
    await notificationService.createNotification(
      userId.toString(),
      "Property Purchase Initiated",
      `Your purchase of ${plotIds.length} plot(s) in ${property.title} has been initiated.`,
      NotificationType.PROPERTY,
      `/dashboard/properties/${id}`,
      { propertyId: property._id, plotIds }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Property purchase initiated",
      data: paymentResponse,
    });
  }
);
