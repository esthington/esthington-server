"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiatePropertyPurchase = exports.purchaseProperty = exports.getPropertyLocations = exports.getPropertyTypes = exports.deletePropertyImage = exports.uploadPropertyImages = exports.deleteProperty = exports.updateProperty = exports.createProperty = exports.getPropertyById = exports.getProperties = void 0;
const http_status_codes_1 = require("http-status-codes");
const appError_1 = require("../utils/appError");
const propertyModel_1 = __importStar(require("../models/propertyModel"));
const cloudinaryService_1 = require("../services/cloudinaryService");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const mongoose_1 = __importDefault(require("mongoose"));
// Import the notification service at the top of the file
const notificationService_1 = __importDefault(require("../services/notificationService"));
const notificationModel_1 = require("../models/notificationModel");
const userModel_1 = __importDefault(require("../models/userModel"));
// @desc    Get all properties
// @route   GET /api/properties
// @access  Public
exports.getProperties = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const properties = yield propertyModel_1.default.find();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: properties.length,
        data: properties,
    });
}));
// @desc    Get property by ID
// @route   GET /api/properties/:id
// @access  Public
exports.getPropertyById = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid property ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const property = yield propertyModel_1.default.findById(id);
    if (!property) {
        return next(new appError_1.AppError("Property not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: property,
    });
}));
// @desc    Create property
// @route   POST /api/properties
// @access  Private (Admin)
exports.createProperty = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, type, price, location, features, images, documents, owner, } = req.body;
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    // Validate required fields
    if (!title ||
        !description ||
        !type ||
        !price ||
        !location ||
        !features ||
        !owner) {
        return next(new appError_1.AppError("Please provide all required fields", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const property = yield propertyModel_1.default.create({
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
    res.status(http_status_codes_1.StatusCodes.CREATED).json({
        success: true,
        message: "Property created successfully",
        data: property,
    });
}));
// @desc    Update property
// @route   PUT /api/properties/:id
// @access  Private (Admin)
const updateProperty = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, description, type, price, location, features, images, documents, } = req.body;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return next(new appError_1.AppError("Invalid property ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
        const property = yield propertyModel_1.default.findByIdAndUpdate(id, {
            title,
            description,
            type,
            price,
            location,
            features,
            images,
            documents,
        }, { new: true, runValidators: true });
        if (!property) {
            return next(new appError_1.AppError("Property not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            message: "Property updated successfully",
            data: property,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateProperty = updateProperty;
// @desc    Delete property
// @route   DELETE /api/properties/:id
// @access  Private (Admin)
const deleteProperty = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return next(new appError_1.AppError("Invalid property ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
        const property = yield propertyModel_1.default.findByIdAndDelete(id);
        if (!property) {
            return next(new appError_1.AppError("Property not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            message: "Property deleted successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteProperty = deleteProperty;
// @desc    Upload property images
// @route   POST /api/properties/:id/images
// @access  Private (Admin)
const uploadPropertyImages = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return next(new appError_1.AppError("Invalid property ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
        const property = yield propertyModel_1.default.findById(id);
        if (!property) {
            return next(new appError_1.AppError("Property not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        if (!req.files || Object.keys(req.files).length === 0) {
            return next(new appError_1.AppError("No files were uploaded", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
        // Upload images to Cloudinary
        const uploadPromises = Object.values(req.files).map((file) => __awaiter(void 0, void 0, void 0, function* () {
            if (Array.isArray(file)) {
                return Promise.all(file.map((f) => __awaiter(void 0, void 0, void 0, function* () { return (0, cloudinaryService_1.uploadToCloudinary)(f.path); })));
            }
            else {
                return (0, cloudinaryService_1.uploadToCloudinary)(file.path);
            }
        }));
        const results = yield Promise.all(uploadPromises);
        // Extract secure URLs from Cloudinary responses
        const images = results.flat().map((result) => result.secure_url);
        // Update property with image URLs
        property.images = images;
        yield property.save();
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            message: "Images uploaded successfully",
            data: { images },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.uploadPropertyImages = uploadPropertyImages;
// @desc    Delete property image
// @route   DELETE /api/properties/:id/images/:imageId
// @access  Private (Admin)
const deletePropertyImage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, imageId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return next(new appError_1.AppError("Invalid property ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
        const property = yield propertyModel_1.default.findById(id);
        if (!property) {
            return next(new appError_1.AppError("Property not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        // Check if image exists
        const imageIndex = property.images.findIndex((image) => image === imageId);
        if (imageIndex === -1) {
            return next(new appError_1.AppError("Image not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        // Delete image from Cloudinary
        yield (0, cloudinaryService_1.deleteFromCloudinary)(imageId);
        // Remove image from property
        property.images.splice(imageIndex, 1);
        yield property.save();
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            message: "Image deleted successfully",
            data: { images: property.images },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deletePropertyImage = deletePropertyImage;
// @desc    Get property types
// @route   GET /api/properties/types
// @access  Public
const getPropertyTypes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: Object.values(propertyModel_1.PropertyType),
    });
});
exports.getPropertyTypes = getPropertyTypes;
// @desc    Get property locations
// @route   GET /api/properties/locations
// @access  Public
const getPropertyLocations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const locations = yield propertyModel_1.default.aggregate([
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
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            data: locations,
        });
    }
    catch (error) {
        console.error("Error getting property locations:", error);
        res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to retrieve property locations",
            error: error instanceof Error ? error.message : "An unknown error occurred",
        });
    }
});
exports.getPropertyLocations = getPropertyLocations;
// Add a new function to handle property purchases
// @desc    Purchase a property
// @route   POST /api/properties/:id/purchase
// @access  Private
exports.purchaseProperty = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        if (!req.user) {
            res.status(400).json({ status: "fail", message: "User not authenticated" });
            return;
        }
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            next(new appError_1.AppError("Invalid property ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
            return;
        }
        const property = yield propertyModel_1.default.findById(id);
        if (!property) {
            next(new appError_1.AppError("Property not found", http_status_codes_1.StatusCodes.NOT_FOUND));
            return;
        }
        // In a real app, you would handle payment processing here
        // For now, we'll just create a notification
        // Create notification for buyer
        yield notificationService_1.default.createNotification(userId, "Property Purchase Initiated", `Your purchase of ${property.title} has been initiated. Our team will contact you shortly.`, notificationModel_1.NotificationType.PROPERTY, `/dashboard/properties/${id.toString()}`, { propertyId: property._id });
        // Create notification for property owner
        if (property.owner) {
            yield notificationService_1.default.createNotification(property.owner.toString(), "Property Purchase Request", `A purchase request has been made for your property: ${property.title}.`, notificationModel_1.NotificationType.PROPERTY, `/dashboard/properties/${id}`, { propertyId: property._id });
        }
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            message: "Property purchase initiated successfully",
            data: property,
        });
    }
    catch (error) {
        next(error);
    }
}));
// Add this new function at the end of the file
// @desc    Initiate property purchase
// @route   POST /api/properties/:id/purchase/initiate
// @access  Private
exports.initiatePropertyPurchase = (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid property ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const property = yield propertyModel_1.default.findById(id);
    if (!property) {
        return next(new appError_1.AppError("Property not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    if (property.status !== "available") {
        return next(new appError_1.AppError("Property is not available for purchase", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Get user email for payment
    const user = yield userModel_1.default.findById(userId);
    if (!user) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Initialize payment
    const paymentService = require("../services/paymentService").default;
    const paymentResponse = yield paymentService.initializePropertyPurchase(userId.toString(), property._id.toString(), property.price, user.email);
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Property purchase initiated",
        data: paymentResponse,
    });
}));
//# sourceMappingURL=propertyController.js.map