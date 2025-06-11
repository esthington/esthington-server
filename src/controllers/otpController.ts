import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import User from "../models/userModel";
import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";
import crypto from "crypto";
import emailService from "../services/emailService";

// Generate a random 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Request OTP for security verification
export const requestOTP = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    // Generate a new OTP
    const otp = generateOTP();

    // Set expiration time (10 minutes from now)
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    // Hash the OTP for storage
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    // Update user with new OTP and expiry
    const user = await User.findByIdAndUpdate(
      userId,
      {
        securityOTP: hashedOTP,
        securityOTPExpiry: otpExpiry,
      },
      { new: true }
    );

    // No need to call save() after findByIdAndUpdate as it already saves to the database

    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Send OTP via email
    if (user.email) {
      try {
        await emailService.sendOTPVerificationEmail(
          user.email,
          user.firstName || "User",
          otp,
          10 // 10 minutes expiry
        );
      } catch (error) {
        console.error("Failed to send email:", error);
        return next(
          new AppError(
            "Failed to send verification code",
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        );
      }
    } else {
      return next(
        new AppError(
          "No email address found for this account",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "OTP sent successfully to your email",
      expiresAt: otpExpiry,
    });
  }
);

// Verify OTP
export const verifyOTP = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("➡️ verifyOTP called");

    const { otp } = req.body;
    console.log("🛬 Received OTP from body:", otp);

    if (!otp) {
      console.log("❌ OTP not provided");
      return next(new AppError("OTP is required", StatusCodes.BAD_REQUEST));
    }

    if (!req.user) {
      console.log("❌ User not authenticated");
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    console.log("👤 Authenticated User ID:", userId);

    // Get user with OTP details
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found in DB");
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    console.log("✅ User found:", user.email || user._id);

    // Check if OTP exists and is not expired
    if (!user.securityOTP || !user.securityOTPExpiry) {
      console.log("❌ No OTP or OTP expiry found on user");
      return next(
        new AppError("No OTP requested or OTP expired", StatusCodes.BAD_REQUEST)
      );
    }

    console.log("📆 OTP Expiry:", user.securityOTPExpiry);

    // Check if OTP is expired
    if (new Date() > new Date(user.securityOTPExpiry)) {
      console.log("❌ OTP has expired");
      return next(new AppError("OTP has expired", StatusCodes.BAD_REQUEST));
    }

    // Hash the provided OTP for comparison
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
    console.log("🔐 Hashed OTP:", hashedOTP);

    // Verify OTP
    if (hashedOTP !== user.securityOTP) {
      console.log("❌ OTP does not match");
      return next(new AppError("Invalid OTP", StatusCodes.BAD_REQUEST));
    }

    console.log("✅ OTP verified successfully, clearing OTP data");

    // Clear OTP after successful verification
    await User.findByIdAndUpdate(userId, {
      securityOTP: "",
      securityOTPExpiry: new Date(0),
      securityOTPValidPeriod: new Date().getTime() + 60 * 60 * 1000, // 1 hour = 3600000 ms
    });

    

    console.log("🧹 OTP data cleared from user record");

    res.status(StatusCodes.OK).json({
      success: true,
      message: "OTP verified successfully",
    });
  }
);

// Check if user is within OTP validity period
export const checkOTPValidity = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("➡️ checkOTPValidity called");

    if (!req.user) {
      console.log("❌ User not authenticated");
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    console.log("👤 Checking validity period for User ID:", userId);

    // Get user with OTP validity details
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found in DB");
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    console.log("✅ User found:", user.email || user._id);

    // Check if user has a valid OTP validity period
    const now = new Date();
    const isWithinValidityPeriod = user.securityOTPValidPeriod
      ? now < new Date(user.securityOTPValidPeriod)
      : false;

    if (isWithinValidityPeriod) {
      console.log("✅ User is within OTP validity period");
      // Calculate remaining time in seconds
      const remainingTime = user.securityOTPValidPeriod
        ? Math.floor(
            (new Date(user.securityOTPValidPeriod).getTime() - now.getTime()) /
              1000
          )
        : 0;

      return res.status(StatusCodes.OK).json({
        success: true,
        isValid: true,
        message: "User is within OTP validity period",
        validUntil: user.securityOTPValidPeriod,
        remainingSeconds: remainingTime,
      });
    } else {
      console.log(
        "❌ User is not within OTP validity period or no validity period set"
      );
      return res.status(StatusCodes.OK).json({
        success: true,
        isValid: false,
        message:
          "User is not within OTP validity period or no validity period set",
      });
    }
  }
);
