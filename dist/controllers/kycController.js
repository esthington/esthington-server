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
exports.getKYCSubmission = exports.getAllKYCSubmissions = exports.rejectKYC = exports.verifyKYC = exports.getKYCStatus = exports.submitKYC = void 0;
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const appError_1 = __importDefault(require("../utils/appError"));
const kycModel_1 = __importDefault(require("../models/kycModel"));
const userModel_1 = __importDefault(require("../models/userModel"));
const cloudinaryService_1 = require("../services/cloudinaryService");
const emailService_1 = __importDefault(require("../services/emailService"));
const mongoose_1 = __importDefault(require("mongoose"));
// Submit KYC documents
exports.submitKYC = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { idType, idNumber, addressProofType } = req.body;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", 401));
    }
    const userId = req.user.id;
    // Check if user already has a KYC submission
    const existingKYC = yield kycModel_1.default.findOne({ user: userId });
    if (existingKYC && existingKYC.status !== "rejected") {
        return next(new appError_1.default("You already have a KYC submission in progress", 400));
    }
    // Validate required fields
    if (!idType || !idNumber || !addressProofType) {
        return next(new appError_1.default("Please provide all required fields", 400));
    }
    // Validate enum values
    const validIDTypes = ["passport", "nationalId", "driverLicense"];
    const validAddressProofTypes = [
        "utilityBill",
        "bankStatement",
        "rentalAgreement",
    ];
    if (!validIDTypes.includes(idType)) {
        return next(new appError_1.default("Invalid ID type", 400));
    }
    if (!validAddressProofTypes.includes(addressProofType)) {
        return next(new appError_1.default("Invalid address proof type", 400));
    }
    const files = req.files;
    if (!files ||
        !files.idImage ||
        !files.selfieImage ||
        !files.addressProofImage) {
        return next(new appError_1.default("Please upload all required documents", 400));
    }
    // Upload files to Cloudinary
    const idImageResult = yield (0, cloudinaryService_1.uploadToCloudinary)(files.idImage[0].path);
    const selfieImageResult = yield (0, cloudinaryService_1.uploadToCloudinary)(files.selfieImage[0].path);
    const addressProofImageResult = yield (0, cloudinaryService_1.uploadToCloudinary)(files.addressProofImage[0].path);
    // Create or update KYC submission
    const kycData = {
        user: new mongoose_1.default.Types.ObjectId(userId),
        idType,
        idNumber,
        idImage: idImageResult.secure_url,
        selfieImage: selfieImageResult.secure_url,
        addressProofType,
        addressProofImage: addressProofImageResult.secure_url,
        status: "pending",
        submittedAt: new Date(),
        updatedAt: new Date(),
    };
    let kyc;
    if (existingKYC) {
        kyc = yield kycModel_1.default.findByIdAndUpdate(existingKYC._id, kycData, {
            new: true,
            runValidators: true,
        });
    }
    else {
        kyc = yield kycModel_1.default.create(kycData);
    }
    // Update user's KYC status
    yield userModel_1.default.findByIdAndUpdate(userId, { kycStatus: "pending" });
    // Send notification to admin (you would implement this)
    // await notificationService.sendAdminNotification({
    //   title: 'New KYC Submission',
    //   message: `User ${req.user.name} has submitted KYC documents for verification.`,
    //   type: 'kyc'
    // });
    res.status(201).json({
        status: "success",
        message: "KYC documents submitted successfully",
        data: {
            id: kyc ? kyc._id : null,
            status: kyc ? kyc.status : null,
            submittedAt: kyc ? kyc.submittedAt : null,
        },
    });
}));
// Get KYC status
exports.getKYCStatus = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", 401));
    }
    const userId = req.user.id;
    const kyc = yield kycModel_1.default.findOne({ user: userId });
    if (!kyc) {
        return next(new appError_1.default("No KYC submission found", 404));
    }
    res.status(200).json({
        status: "success",
        data: {
            id: kyc._id,
            status: kyc.status,
            idType: kyc.idType,
            idNumber: kyc.idNumber,
            idImage: kyc.idImage,
            selfieImage: kyc.selfieImage,
            addressProofType: kyc.addressProofType,
            addressProofImage: kyc.addressProofImage,
            submittedAt: kyc.submittedAt,
            updatedAt: kyc.updatedAt,
            rejectionReason: kyc.rejectionReason,
            verifiedAt: kyc.verifiedAt,
        },
    });
}));
// Verify KYC submission (admin only)
exports.verifyKYC = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", 401));
    }
    const adminId = req.user.id;
    const kyc = yield kycModel_1.default.findById(id);
    if (!kyc) {
        return next(new appError_1.default("KYC submission not found", 404));
    }
    if (kyc.status !== "pending") {
        return next(new appError_1.default("This KYC submission has already been processed", 400));
    }
    // Update KYC status
    kyc.status = "approved";
    kyc.verifiedBy = new mongoose_1.default.Types.ObjectId(adminId);
    kyc.verifiedAt = new Date();
    yield kyc.save();
    // Update user's KYC status
    yield userModel_1.default.findByIdAndUpdate(kyc.user, { kycStatus: "verified" });
    // Get user details for notification
    const user = yield userModel_1.default.findById(kyc.user);
    if (user && user.email) {
        // Send email notification
        yield emailService_1.default.sendEmail(user.email, "KYC Verification Approved", "Congratulations! Your KYC verification has been approved. You now have full access to all platform features.");
        // Send in-app notification (you would implement this)
        // await notificationService.sendNotification({
        //   userId: kyc.user,
        //   title: 'KYC Approved',
        //   message: 'Your KYC verification has been approved.',
        //   type: 'kyc'
        // });
    }
    res.status(200).json({
        status: "success",
        message: "KYC verification approved successfully",
        data: {
            id: kyc._id,
            status: kyc.status,
            verifiedAt: kyc.verifiedAt,
        },
    });
}));
// Reject KYC submission (admin only)
exports.rejectKYC = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { reason } = req.body;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", 401));
    }
    const adminId = req.user.id;
    if (!reason) {
        return next(new appError_1.default("Rejection reason is required", 400));
    }
    const kyc = yield kycModel_1.default.findById(id);
    if (!kyc) {
        return next(new appError_1.default("KYC submission not found", 404));
    }
    if (kyc.status !== "pending") {
        return next(new appError_1.default("This KYC submission has already been processed", 400));
    }
    // Update KYC status
    kyc.status = "rejected";
    kyc.rejectionReason = reason;
    kyc.verifiedBy = new mongoose_1.default.Types.ObjectId(adminId);
    kyc.verifiedAt = new Date();
    yield kyc.save();
    // Update user's KYC status
    yield userModel_1.default.findByIdAndUpdate(kyc.user, { kycStatus: "rejected" });
    // Get user details for notification
    const user = yield userModel_1.default.findById(kyc.user);
    if (user && user.email) {
        // Send email notification
        yield emailService_1.default.sendEmail(user.email, "KYC Verification Rejected", `Your KYC verification has been rejected. Reason: ${reason}. Please resubmit with the correct documents.`);
        // Send in-app notification (you would implement this)
        // await notificationService.sendNotification({
        //   userId: kyc.user,
        //   title: 'KYC Rejected',
        //   message: `Your KYC verification has been rejected. Reason: ${reason}`,
        //   type: 'kyc'
        // });
    }
    res.status(200).json({
        status: "success",
        message: "KYC verification rejected",
        data: {
            id: kyc._id,
            status: kyc.status,
            rejectionReason: kyc.rejectionReason,
            verifiedAt: kyc.verifiedAt,
        },
    });
}));
// Get all KYC submissions (admin only)
exports.getAllKYCSubmissions = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status &&
        ["pending", "approved", "rejected"].includes(status)) {
        filter.status = status;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [submissions, total] = yield Promise.all([
        kycModel_1.default.find(filter)
            .populate("user", "name email")
            .populate("verifiedBy", "name email")
            .sort("-submittedAt")
            .skip(skip)
            .limit(Number(limit)),
        kycModel_1.default.countDocuments(filter),
    ]);
    res.status(200).json({
        status: "success",
        results: submissions.length,
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        data: submissions,
    });
}));
// Get KYC submission details (admin only)
exports.getKYCSubmission = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const kyc = yield kycModel_1.default.findById(id)
        .populate("user", "name email")
        .populate("verifiedBy", "name email");
    if (!kyc) {
        return next(new appError_1.default("KYC submission not found", 404));
    }
    res.status(200).json({
        status: "success",
        data: kyc,
    });
}));
//# sourceMappingURL=kycController.js.map