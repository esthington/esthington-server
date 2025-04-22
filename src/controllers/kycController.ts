import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import KYC, { type IKYC } from "../models/kycModel";
import User from "../models/userModel";
import { uploadToCloudinary } from "../services/cloudinaryService";
import emailService from "../services/emailService";
import mongoose from "mongoose";

// Define proper types for KYC status and document types
type KYCStatus = "pending" | "approved" | "rejected";
type IDType = "passport" | "nationalId" | "driverLicense";
type AddressProofType = "utilityBill" | "bankStatement" | "rentalAgreement";

// Submit KYC documents
export const submitKYC = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { idType, idNumber, addressProofType } = req.body as {
      idType: IDType;
      idNumber: string;
      addressProofType: AddressProofType;
    };

    if (!req.user) {
      return next(new AppError("User not authenticated", 401));
    }

    const userId = req.user.id;

    // Check if user already has a KYC submission
    const existingKYC = await KYC.findOne({ user: userId });

    if (existingKYC && existingKYC.status !== "rejected") {
      return next(
        new AppError("You already have a KYC submission in progress", 400)
      );
    }

    // Validate required fields
    if (!idType || !idNumber || !addressProofType) {
      return next(new AppError("Please provide all required fields", 400));
    }

    // Validate enum values
    const validIDTypes: IDType[] = ["passport", "nationalId", "driverLicense"];
    const validAddressProofTypes: AddressProofType[] = [
      "utilityBill",
      "bankStatement",
      "rentalAgreement",
    ];

    if (!validIDTypes.includes(idType)) {
      return next(new AppError("Invalid ID type", 400));
    }

    if (!validAddressProofTypes.includes(addressProofType)) {
      return next(new AppError("Invalid address proof type", 400));
    }

    // Check if required files are uploaded
    interface UploadedFiles {
      idImage?: Express.Multer.File[];
      selfieImage?: Express.Multer.File[];
      addressProofImage?: Express.Multer.File[];
    }

    const files = req.files as UploadedFiles;

    if (
      !files ||
      !files.idImage ||
      !files.selfieImage ||
      !files.addressProofImage
    ) {
      return next(new AppError("Please upload all required documents", 400));
    }

    // Upload files to Cloudinary
    const idImageResult = await uploadToCloudinary(files.idImage[0].path);
    const selfieImageResult = await uploadToCloudinary(
      files.selfieImage[0].path
    );
    const addressProofImageResult = await uploadToCloudinary(
      files.addressProofImage[0].path
    );

    // Create or update KYC submission
    const kycData: Partial<IKYC> = {
      user: new mongoose.Types.ObjectId(userId),
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
      kyc = await KYC.findByIdAndUpdate(existingKYC._id, kycData, {
        new: true,
        runValidators: true,
      });
    } else {
      kyc = await KYC.create(kycData);
    }

    // Update user's KYC status
    await User.findByIdAndUpdate(userId, { kycStatus: "pending" });

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
  }
);

// Get KYC status
export const getKYCStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("User not authenticated", 401));
    }

    const userId = req.user.id;

    const kyc = await KYC.findOne({ user: userId });

    if (!kyc) {
      return next(new AppError("No KYC submission found", 404));
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
  }
);

// Verify KYC submission (admin only)
export const verifyKYC = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return next(new AppError("User not authenticated", 401));
    }

    const adminId = req.user.id;

    const kyc = await KYC.findById(id);

    if (!kyc) {
      return next(new AppError("KYC submission not found", 404));
    }

    if (kyc.status !== "pending") {
      return next(
        new AppError("This KYC submission has already been processed", 400)
      );
    }

    // Update KYC status
    kyc.status = "approved";
    kyc.verifiedBy = new mongoose.Types.ObjectId(adminId);
    kyc.verifiedAt = new Date();
    await kyc.save();

    // Update user's KYC status
    await User.findByIdAndUpdate(kyc.user, { kycStatus: "verified" });

    // Get user details for notification
    const user = await User.findById(kyc.user);

    if (user && user.email) {
      // Send email notification
      await emailService.sendEmail(
        user.email,
        "KYC Verification Approved",
        "Congratulations! Your KYC verification has been approved. You now have full access to all platform features."
      );

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
  }
);

// Reject KYC submission (admin only)
export const rejectKYC = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.user) {
      return next(new AppError("User not authenticated", 401));
    }
    const adminId = req.user.id;

    if (!reason) {
      return next(new AppError("Rejection reason is required", 400));
    }

    const kyc = await KYC.findById(id);

    if (!kyc) {
      return next(new AppError("KYC submission not found", 404));
    }

    if (kyc.status !== "pending") {
      return next(
        new AppError("This KYC submission has already been processed", 400)
      );
    }

    // Update KYC status
    kyc.status = "rejected";
    kyc.rejectionReason = reason;
    kyc.verifiedBy = new mongoose.Types.ObjectId(adminId);
    kyc.verifiedAt = new Date();
    await kyc.save();

    // Update user's KYC status
    await User.findByIdAndUpdate(kyc.user, { kycStatus: "rejected" });

    // Get user details for notification
    const user = await User.findById(kyc.user);

    if (user && user.email) {
      // Send email notification
      await emailService.sendEmail(
        user.email,
        "KYC Verification Rejected",
        `Your KYC verification has been rejected. Reason: ${reason}. Please resubmit with the correct documents.`
      );

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
  }
);

// Get all KYC submissions (admin only)
export const getAllKYCSubmissions = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, page = 1, limit = 10 } = req.query;

    const filter: { status?: KYCStatus } = {};
    if (
      status &&
      ["pending", "approved", "rejected"].includes(status as string)
    ) {
      filter.status = status as KYCStatus;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [submissions, total] = await Promise.all([
      KYC.find(filter)
        .populate("user", "name email")
        .populate("verifiedBy", "name email")
        .sort("-submittedAt")
        .skip(skip)
        .limit(Number(limit)),
      KYC.countDocuments(filter),
    ]);

    res.status(200).json({
      status: "success",
      results: submissions.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: submissions,
    });
  }
);

// Get KYC submission details (admin only)
export const getKYCSubmission = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const kyc = await KYC.findById(id)
      .populate("user", "name email")
      .populate("verifiedBy", "name email");

    if (!kyc) {
      return next(new AppError("KYC submission not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: kyc,
    });
  }
);
