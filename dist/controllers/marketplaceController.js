"use strict";
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
exports.initiateMarketplacePurchase = exports.getListingInterests = exports.expressInterest = exports.uploadMarketplaceImages = exports.deleteMarketplaceListing = exports.updateMarketplaceListing = exports.createMarketplaceListing = exports.getMarketplaceListingById = exports.getMarketplaceListings = void 0;
const http_status_codes_1 = require("http-status-codes");
const appError_1 = require("../utils/appError");
const marketplaceModel_1 = require("../models/marketplaceModel");
const cloudinaryService_1 = require("../services/cloudinaryService");
const asyncHandler_1 = require("../utils/asyncHandler");
const mongoose_1 = __importDefault(require("mongoose"));
const userModel_1 = __importDefault(require("../models/userModel"));
const notificationService_1 = __importDefault(require("../services/notificationService"));
const notificationModel_1 = require("../models/notificationModel");
// @desc    Get all marketplace listings
// @route   GET /api/marketplace
// @access  Public
exports.getMarketplaceListings = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const listings = yield marketplaceModel_1.MarketplaceListing.find({ status: "active" });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: listings.length,
        data: listings,
    });
}));
// @desc    Get marketplace listing by ID
// @route   GET /api/marketplace/:id
// @access  Public
exports.getMarketplaceListingById = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid listing ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.findById(id);
    if (!listing) {
        return next(new appError_1.AppError("Listing not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Increment view count
    listing.viewCount += 1;
    yield listing.save();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: listing,
    });
}));
// @desc    Create marketplace listing
// @route   POST /api/marketplace
// @access  Private (Agent)
exports.createMarketplaceListing = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, price, negotiable, type, propertyType, location, features, images, documents, expiresAt, } = req.body;
    // Validate required fields
    if (!title ||
        !description ||
        !price ||
        !type ||
        !propertyType ||
        !location ||
        !features ||
        !expiresAt) {
        return next(new appError_1.AppError("Please provide all required fields", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    if (!req.user) {
        return res
            .status(400)
            .json({ status: "fail", message: "User not authenticated" });
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.create({
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
        seller: req === null || req === void 0 ? void 0 : req.user.id,
        expiresAt,
    });
    res.status(http_status_codes_1.StatusCodes.CREATED).json({
        success: true,
        message: "Listing created successfully",
        data: listing,
    });
}));
// @desc    Update marketplace listing
// @route   PUT /api/marketplace/:id
// @access  Private (Agent)
exports.updateMarketplaceListing = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { title, description, price, negotiable, type, propertyType, location, features, images, documents, expiresAt, } = req.body;
    if (!req.user) {
        return res
            .status(400)
            .json({ status: "fail", message: "User not authenticated" });
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid listing ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.findById(id);
    if (!listing) {
        return next(new appError_1.AppError("Listing not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Check if user is the seller
    if (listing.seller.toString() !== req.user.id &&
        req.user.role !== "admin") {
        return next(new appError_1.AppError("Not authorized to update this listing", http_status_codes_1.StatusCodes.FORBIDDEN));
    }
    // Update listing
    const updatedListing = yield marketplaceModel_1.MarketplaceListing.findByIdAndUpdate(id, {
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
    }, { new: true, runValidators: true });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Listing updated successfully",
        data: updatedListing,
    });
}));
// @desc    Delete marketplace listing
// @route   DELETE /api/marketplace/:id
// @access  Private (Agent)
exports.deleteMarketplaceListing = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!req.user) {
        return res
            .status(400)
            .json({ status: "fail", message: "User not authenticated" });
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.findById(id);
    if (!listing) {
        return next(new appError_1.AppError("Listing not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Check if user is the seller
    if (listing.seller.toString() !== req.user.id &&
        req.user.role !== "admin") {
        return next(new appError_1.AppError("Not authorized to delete this listing", http_status_codes_1.StatusCodes.FORBIDDEN));
    }
    yield marketplaceModel_1.MarketplaceListing.findByIdAndDelete(id);
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Listing deleted successfully",
    });
}));
// @desc    Upload marketplace listing images
// @route   POST /api/marketplace/:id/images
// @access  Private (Agent)
exports.uploadMarketplaceImages = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid listing ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    if (!req.user) {
        return res
            .status(400)
            .json({ status: "fail", message: "User not authenticated" });
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.findById(id);
    if (!listing) {
        return next(new appError_1.AppError("Listing not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Check if user is the seller
    if (listing.seller.toString() !== req.user.id &&
        req.user.role !== "admin") {
        return next(new appError_1.AppError("Not authorized to update this listing", http_status_codes_1.StatusCodes.FORBIDDEN));
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
    // Update listing with image URLs
    listing.images = [...(listing.images || []), ...images];
    yield listing.save();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Images uploaded successfully",
        data: { images: listing.images },
    });
}));
// @desc    Express interest in a listing
// @route   POST /api/marketplace/:id/interest
// @access  Private
exports.expressInterest = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { message } = req.body;
    if (!req.user) {
        return res
            .status(400)
            .json({ status: "fail", message: "User not authenticated" });
    }
    const userId = req.user.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid listing ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.findById(id);
    if (!listing) {
        return next(new appError_1.AppError("Listing not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Check if user has already expressed interest
    const existingInterest = yield marketplaceModel_1.MarketplaceInterest.findOne({
        listing: id,
        user: userId,
    });
    if (existingInterest) {
        return next(new appError_1.AppError("You have already expressed interest in this listing", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Create interest
    const interest = yield marketplaceModel_1.MarketplaceInterest.create({
        listing: id,
        user: userId,
        message,
    });
    // Increment interest count
    listing.interestedCount += 1;
    yield listing.save();
    // Notify seller
    yield notificationService_1.default.createNotification(listing.seller.toString(), "New Interest in Your Listing", `Someone has expressed interest in your listing: ${listing.title}`, notificationModel_1.NotificationType.TRANSACTION, `/dashboard/marketplace/listings/${listing._id}/interests`, { listingId: listing._id, interestId: interest._id });
    res.status(http_status_codes_1.StatusCodes.CREATED).json({
        success: true,
        message: "Interest expressed successfully",
        data: interest,
    });
}));
// @desc    Get interests for a listing
// @route   GET /api/marketplace/:id/interests
// @access  Private (Seller only)
exports.getListingInterests = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!req.user) {
        return res
            .status(400)
            .json({ status: "fail", message: "User not authenticated" });
    }
    const userId = req.user.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid listing ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.findById(id);
    if (!listing) {
        return next(new appError_1.AppError("Listing not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Check if user is the seller
    if (listing.seller.toString() !== userId && req.user.role !== "admin") {
        return next(new appError_1.AppError("Not authorized to view interests", http_status_codes_1.StatusCodes.FORBIDDEN));
    }
    const interests = yield marketplaceModel_1.MarketplaceInterest.find({ listing: id }).populate("user", "firstName lastName email phone");
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: interests.length,
        data: interests,
    });
}));
// @desc    Initiate marketplace listing purchase
// @route   POST /api/marketplace/:id/purchase/initiate
// @access  Private
exports.initiateMarketplacePurchase = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    if (!req.user) {
        return res
            .status(400)
            .json({ status: "fail", message: "User not authenticated" });
    }
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid listing ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.findById(id);
    if (!listing) {
        return next(new appError_1.AppError("Listing not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    if (listing.status !== "active") {
        return next(new appError_1.AppError("Listing is not available for purchase", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Get user email for payment
    const user = yield userModel_1.default.findById(userId);
    if (!user) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Initialize payment
    const paymentService = require("../services/paymentService").default;
    const paymentResponse = yield paymentService.initializeMarketplacePurchase(userId.toString(), listing._id.toString(), listing.price, user.email);
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Marketplace purchase initiated",
        data: paymentResponse,
    });
}));
//# sourceMappingURL=marketplaceController.js.map