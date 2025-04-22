import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import crypto from "crypto";
import { Referral, ReferralStatus } from "../models/referralModel";
import { generateToken, generateRefreshToken } from "../utils/jwtUtils";
import emailService from "../services/emailService";
import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";
import logger from "../utils/logger";
import {
  registerBuyerSchema,
  registerAgentSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from "../validation/userValidation";
import User, { UserRole } from "../models/userModel";
import config from "../config/config";

// Get or create system user for default referrals
const getSystemReferrer = async () => {
  let systemUser = await User.findOne({ userName: "system" });

  if (!systemUser) {
    // Create a system user if it doesn't exist
    systemUser = new User({
      userName: "system",
      email: "esthington@gmail.com", // Use your actual system email
      password: crypto.randomBytes(20).toString("hex"), // Random secure password
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
      isActive: true,
    });
    await systemUser.save();
  }

  return systemUser;
};

/**
 * @desc    Register a new buyer
 * @route   POST /api/auth/register-buyer
 * @access  Public
 */
export const registerBuyer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = registerBuyerSchema.validate(req.body);

    if (error) {
      return next(
        new AppError(
          error.details.map((d) => d.message).join(", "),
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const { email, userName, password, referralCode } = value;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(
        new AppError(
          "User already exists with this email",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const usernameExists = await User.findOne({ userName });
    if (usernameExists) {
      return next(
        new AppError("Username is already taken", StatusCodes.BAD_REQUEST)
      );
    }

    let referrerId = null;

    if (referralCode?.trim()) {
      const referrerByCode = await User.findOne({ referralCode });
      if (referrerByCode) {
        referrerId = referrerByCode._id;
      } else {
        logger.warn(`Referral code ${referralCode} not found`);
      }
    }

    if (!referrerId) {
      const systemUser = await getSystemReferrer();
      referrerId = systemUser._id;
    }

    const user = new User({
      email,
      userName,
      password,
      role: UserRole.BUYER,
      referer: referrerId,
    });

    const { token } = user.generateVerificationToken();

    await user.save();

    try {
      await Referral.create({
        referrer: referrerId,
        referred: user._id,
        status: ReferralStatus.PENDING,
      });
    } catch (err) {
      logger.error(
        `Referral error: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }

    const verifyEmailLink = `${
      config.frontendUrl
    }/account-verify?token=${encodeURIComponent(token)}`;

    try {
      console.log("Step 10: Sending verification email");
      await emailService.sendVerificationEmail(
        user.email,
        user.userName,
        verifyEmailLink
      );
    } catch (err) {
      logger.error(
        `Email error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const esToken = generateToken(user._id.toString(), user.role, "30d");
    const refreshToken = generateRefreshToken(user?._id.toString(), user.role);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Remove password from response
    const userObj = user.toObject();
    delete (userObj as { password?: string }).password;
    delete userObj.refreshToken;

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Buyer registration successful. Please check your email.",
      token: esToken,
      refreshToken,
      user: userObj,
    });
  }
);

/**
 * @desc    Register a new agent
 * @route   POST /api/auth/register-agent
 * @access  Public
 */
export const registerAgent = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = registerAgentSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(
        new AppError(
          error.details.map((d) => d.message).join(", "),
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const { email, userName, password, referralCode } = value;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(
        new AppError(
          "User already exists with this email",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const usernameExists = await User.findOne({ userName });
    if (usernameExists) {
      return next(
        new AppError("Username is already taken", StatusCodes.BAD_REQUEST)
      );
    }

    let referrerId = null;

    if (referralCode?.trim()) {
      const referrerByCode = await User.findOne({ referralCode });
      if (referrerByCode) {
        referrerId = referrerByCode._id;
      } else {
        logger.warn(`Referral code ${referralCode} not found`);
      }
    }

    if (!referrerId) {
      const systemUser = await getSystemReferrer();
      referrerId = systemUser._id;
    }

    const user = new User({
      email,
      userName,
      password,
      role: UserRole.AGENT,
      referer: referrerId,
    });

    const { token } = user.generateVerificationToken();
    await user.save();

    try {
      await Referral.create({
        referrer: referrerId,
        referred: user._id,
        status: ReferralStatus.PENDING,
      });
    } catch (err) {
      logger.error(
        `Referral error: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }

    const verifyEmailLink = `${
      config.frontendUrl
    }/account-verify?token=${encodeURIComponent(token)}`;

    try {
      console.log("Step 10: Sending verification email");
      await emailService.sendVerificationEmail(
        user.email,
        user.userName,
        verifyEmailLink
      );
    } catch (err) {
      logger.error(
        `Email error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const esToken = generateToken(user._id.toString(), user.role, "30d");
    const refreshToken = generateRefreshToken(user?._id.toString(), user.role);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Remove password from response
    const userObj = user.toObject();
    delete (userObj as { password?: string }).password;
    delete userObj.refreshToken;

    console.log("Step 6: Agent registration completed");
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Seller registration successful. Please check your email.",
      token: esToken,
      refreshToken,
      user: userObj,
    });
  }
);

/**
 * @desc    Check if username is available
 * @route   GET /api/auth/check-username
 * @access  Public
 */
export const checkUsername = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { username } = req.query;

    if (!username) {
      return next(
        new AppError("Username parameter is required", StatusCodes.BAD_REQUEST)
      );
    }

    // Check if username exists in database
    const existingUser = await User.findOne({ userName: username });

    res.status(StatusCodes.OK).json({
      success: true,
      available: !existingUser,
    });
  }
);

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { verificationToken } = req.body;

  console.log("Verifying email...");
  console.log("Incoming verification token:", verificationToken);

  try {
    if (!verificationToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Verification token is required",
      });
    }

    const user = await User.findOne({ verificationToken });
    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid token",
        type: "invalidtoken",
      });
    }

    // Check if token has expired
    if (
      user.verificationTokenExpires &&
      user.verificationTokenExpires.getTime() < Date.now()
    ) {
      console.log("Token has expired:", user.verificationTokenExpires);

      // Generate new verification token
      const { token } = user.generateVerificationToken();
      await user.save();

      if (!config.frontendUrl) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: "Client URL is not defined",
        });
      }

      // Send new verification email
      try {
        const verifyEmailLink = `${
          config.frontendUrl
        }/account-verify?token=${encodeURIComponent(token)}`;
        await emailService.sendVerificationEmail(
          user.email,
          user.userName,
          verifyEmailLink
        );
      } catch (err) {
        logger.error(
          `Failed to send verification email: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      }

      // Generate tokens
      const esToken = generateToken(user._id.toString(), user.role); // 30 days in seconds
      const refreshToken = generateRefreshToken(user._id.toString(), user.role);

      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message:
          "Verification token expired. A new verification email has been sent.",
        type: "linkexpired",
        token: esToken,
        refreshToken,
      });
    }

    // Valid token, mark user as verified
    user.isEmailVerified = true;
    user.verificationToken = "";
    user.verificationTokenExpires = undefined;
    await user.save();

    const esToken = generateToken(user._id.toString(), user.role); // 30 days in seconds
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    console.log("User email verified:", user);
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Email verified successfully",
      type: "emailverified",
      token: esToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Error during email verification:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */

export const resedEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const {
    verificationToken,
    email,
  }: { verificationToken?: string; email?: string } = req.body;

  console.log("Verifying email2...");
  console.log("Incoming verification token2:", verificationToken);

  const user = req.user;

  if (!req.user) {
    return next(
      new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
    );
  }

  const userId = req.user._id;

  try {
    const currentUser = await User.findById(userId).select("-password");

    if (!currentUser) {
      return next(new AppError("Invalid user", StatusCodes.BAD_REQUEST));
    }
    if (verificationToken) {
      console.log("Verification token detected");

      const user = await User.findOne({ verificationToken });
      if (!user) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: "Invalid token" });
        return;
      }

      if (
        user.verificationTokenExpires &&
        user.verificationTokenExpires.getTime() < Date.now()
      ) {
        const { token } = user.generateVerificationToken();
        await user.save();

        const verifyEmailLink = `${
          config.frontendUrl
        }/account-verify?token=${encodeURIComponent(token)}`;

        try {
          console.log("Step 10: Sending verification email");
          await emailService.sendVerificationEmail(
            user.email,
            user.userName,
            verifyEmailLink
          );
        } catch (err) {
          logger.error(
            `Email error: ${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        }

        res.status(StatusCodes.UNAUTHORIZED).json({
          message:
            "Verification token expired. A new verification email has been sent.",
          type: "linkexpired",
        });
        return;
      } else {
        user.isEmailVerified = true;
        user.verificationToken = "";
        user.verificationTokenExpires = undefined;
        await user.save();

        console.log("User email verified:", user);
        res.status(StatusCodes.OK).json({
          message: "Email verified successfully",
          type: "emailverified",
        });
        return;
      }
    }

    if (email) {
      console.log("Resending verification email to:", email);
      const user = await User.findOne({ email });
      if (!user) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: "User not found" });
        return;
      }

      const { token } = user.generateVerificationToken();
      await user.save();

      if (!config.frontendUrl) {
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ message: "Client URL is not defined" });
        return;
      }

      const verifyEmailLink = `${
        config.frontendUrl
      }/account-verify/?token=${encodeURIComponent(token)}`;

      try {
        console.log("Step 10: Sending verification email");
        await emailService.sendVerificationEmail(
          user.email,
          user.userName,
          verifyEmailLink
        );
      } catch (err) {
        logger.error(
          `Email error: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }

      res
        .status(StatusCodes.OK)
        .json({ message: "A new verification email has been sent." });
      return;
    }

    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Verification token or email required" });
    return;
  } catch (error) {
    console.error("Error during email verification:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Internal server error" });
    return;
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("h1");
    // Validate request body using Joi
    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return next(new AppError(errorMessage, StatusCodes.BAD_REQUEST));
    }

    const { email, password } = value;

    // Find user
    const user = (await User.findOne({ email }).select(
      "+password"
    )) as InstanceType<typeof User>;
    if (!user) {
      return next(
        new AppError("Invalid credentials", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if password matches
    let isMatch = false;
    try {
      isMatch = await user.comparePassword(password);
    } catch (error) {
      logger.error(
        `Password comparison error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return next(
        new AppError("Authentication error", StatusCodes.INTERNAL_SERVER_ERROR)
      );
    }

    if (!isMatch) {
      return next(
        new AppError("Invalid credentials", StatusCodes.UNAUTHORIZED)
      );
    }

    // Check if user is verified
    if (!user.isEmailVerified) {
      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const token = generateToken(user._id.toString(), user.role, "30d");
      const refreshToken = generateRefreshToken(
        user?._id.toString(),
        user.role
      );

      // Save refresh token
      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false });

      // Remove password from response
      const userObj = user.toObject();
      delete (userObj as { password?: string }).password;
      delete userObj.refreshToken;

      res.status(StatusCodes.OK).json({
        success: true,
        token,
        refreshToken,
        user: userObj,
      });

      return;
    }

    // Check if user is active
    if (!user.isActive) {
      return next(
        new AppError(
          "Your account has been deactivated. Please contact support.",
          StatusCodes.FORBIDDEN
        )
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = generateToken(user._id.toString(), user.role, "30d");
    const refreshToken = generateRefreshToken(user?._id.toString(), user.role);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Remove password from response
    const userObj = user.toObject();
    delete (userObj as { password?: string }).password;
    delete userObj.refreshToken;

    res.status(StatusCodes.OK).json({
      success: true,
      token,
      refreshToken,
      user: userObj,
    });
  }
);

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Clear refresh token
    if (req.user) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.refreshToken = undefined;
        await user.save({ validateBeforeSave: false });
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Logged out successfully",
    });
  }
);

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Validate request body using Joi
    const { error, value } = refreshTokenSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return next(new AppError(errorMessage, StatusCodes.BAD_REQUEST));
    }

    const { refreshToken: refreshTokenFromBody } = value;

    // Find user with refresh token
    const user = await User.findOne({ refreshToken: refreshTokenFromBody });
    if (!user) {
      return next(
        new AppError("Invalid refresh token", StatusCodes.UNAUTHORIZED)
      );
    }

    // Generate new tokens
    const token = generateToken(user._id.toString(), user.role, "30d");
    const newRefreshToken = generateRefreshToken(
      user._id.toString(),
      user.role
    );

    // Update refresh token
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(StatusCodes.OK).json({
      success: true,
      token,
      refreshToken: newRefreshToken,
    });
  }
);

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Validate request body using Joi
    const { error, value } = forgotPasswordSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return next(new AppError(errorMessage, StatusCodes.BAD_REQUEST));
    }

    const { email } = value;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Generate reset token
    const { token, expires } = user.generatePasswordResetToken();
    await user.save();

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        token
      );

      user.resetPasswordToken = token;
      user.resetPasswordExpires = expires;
      await user.save();
    } catch (error) {
      // Revert token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      logger.error(
        `Failed to send password reset email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return next(
        new AppError(
          "Failed to send password reset email",
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Password reset email sent",
    });
  }
);

/**
 * @desc    Vverify password reset token
 * @route   POST /api/v1/auth/verifypasswordresettoken/resetToken=token
 * @access  Public
 */

export const verifyPasswordResetToken = async (req: Request, res: Response) => {
  const { resetToken } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({ message: "Invalid or expired token" });
      return;
    }

    res.status(200).json({ message: "Valid token", resetToken: resetToken });
    return;
  } catch (error) {
    res.status(500).json({ message: "Error verifying token", error });
    return;
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */

export const resetPassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { resetToken, password, confirmPassword } = req.body;
    console.log("data", resetToken, password);

    // Validate request body using Joi
    const { error, value } = resetPasswordSchema.validate(
      { password, confirmPassword },
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return next(new AppError(errorMessage, StatusCodes.BAD_REQUEST));
    }

    // Find user with token
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(
        new AppError("Invalid or expired reset token", StatusCodes.BAD_REQUEST)
      );
    }

    // Update password
    user.password = value.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Password reset successful",
    });
  }
);

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("hit me");
    const user = await User.findById(req.user?._id)
      .select("-password")
      .populate("referer", "userName email role"); // Populate the referer field

    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      user,
    });
  }
);
