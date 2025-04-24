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
exports.getCurrentUser = exports.resetPassword = exports.verifyPasswordResetToken = exports.forgotPassword = exports.refreshToken = exports.logout = exports.login = exports.resedEmailVerification = exports.verifyEmail = exports.checkUsername = exports.registerAgent = exports.registerBuyer = void 0;
const http_status_codes_1 = require("http-status-codes");
const crypto_1 = __importDefault(require("crypto"));
const referralModel_1 = require("../models/referralModel");
const jwtUtils_1 = require("../utils/jwtUtils");
const emailService_1 = __importDefault(require("../services/emailService"));
const appError_1 = require("../utils/appError");
const asyncHandler_1 = require("../utils/asyncHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const userValidation_1 = require("../validation/userValidation");
const userModel_1 = __importStar(require("../models/userModel"));
const config_1 = __importDefault(require("../config/config"));
// Get or create system user for default referrals
const getSystemReferrer = () => __awaiter(void 0, void 0, void 0, function* () {
    let systemUser = yield userModel_1.default.findOne({ userName: "system" });
    if (!systemUser) {
        // Create a system user if it doesn't exist
        systemUser = new userModel_1.default({
            userName: "system",
            email: "esthington@gmail.com", // Use your actual system email
            password: crypto_1.default.randomBytes(20).toString("hex"), // Random secure password
            role: userModel_1.UserRole.SUPER_ADMIN,
            isEmailVerified: true,
            isActive: true,
        });
        yield systemUser.save();
    }
    return systemUser;
});
/**
 * @desc    Register a new buyer
 * @route   POST /api/auth/register-buyer
 * @access  Public
 */
exports.registerBuyer = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { error, value } = userValidation_1.registerBuyerSchema.validate(req.body);
    if (error) {
        return next(new appError_1.AppError(error.details.map((d) => d.message).join(", "), http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const { email, userName, password, referralCode } = value;
    const userExists = yield userModel_1.default.findOne({ email });
    if (userExists) {
        return next(new appError_1.AppError("User already exists with this email", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const usernameExists = yield userModel_1.default.findOne({ userName });
    if (usernameExists) {
        return next(new appError_1.AppError("Username is already taken", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    let referrerId = null;
    if (referralCode === null || referralCode === void 0 ? void 0 : referralCode.trim()) {
        const referrerByCode = yield userModel_1.default.findOne({ referralCode });
        if (referrerByCode) {
            referrerId = referrerByCode._id;
        }
        else {
            logger_1.default.warn(`Referral code ${referralCode} not found`);
        }
    }
    if (!referrerId) {
        const systemUser = yield getSystemReferrer();
        referrerId = systemUser._id;
    }
    const user = new userModel_1.default({
        email,
        userName,
        password,
        role: userModel_1.UserRole.BUYER,
        referer: referrerId,
    });
    const { token } = user.generateVerificationToken();
    yield user.save();
    try {
        yield referralModel_1.Referral.create({
            referrer: referrerId,
            referred: user._id,
            status: referralModel_1.ReferralStatus.PENDING,
        });
    }
    catch (err) {
        logger_1.default.error(`Referral error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    const verifyEmailLink = `${config_1.default.frontendUrl}/account-verify?token=${encodeURIComponent(token)}`;
    try {
        console.log("Step 10: Sending verification email");
        yield emailService_1.default.sendVerificationEmail(user.email, user.userName, verifyEmailLink);
    }
    catch (err) {
        logger_1.default.error(`Email error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    // Update last login
    user.lastLogin = new Date();
    yield user.save();
    // Generate tokens
    const esToken = (0, jwtUtils_1.generateToken)(user._id.toString(), user.role, "30d");
    const refreshToken = (0, jwtUtils_1.generateRefreshToken)(user === null || user === void 0 ? void 0 : user._id.toString(), user.role);
    // Save refresh token
    user.refreshToken = refreshToken;
    yield user.save({ validateBeforeSave: false });
    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;
    res.status(http_status_codes_1.StatusCodes.CREATED).json({
        success: true,
        message: "Buyer registration successful. Please check your email.",
        token: esToken,
        refreshToken,
        user: userObj,
    });
}));
/**
 * @desc    Register a new agent
 * @route   POST /api/auth/register-agent
 * @access  Public
 */
exports.registerAgent = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { error, value } = userValidation_1.registerAgentSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        return next(new appError_1.AppError(error.details.map((d) => d.message).join(", "), http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const { email, userName, password, referralCode } = value;
    const userExists = yield userModel_1.default.findOne({ email });
    if (userExists) {
        return next(new appError_1.AppError("User already exists with this email", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const usernameExists = yield userModel_1.default.findOne({ userName });
    if (usernameExists) {
        return next(new appError_1.AppError("Username is already taken", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    let referrerId = null;
    if (referralCode === null || referralCode === void 0 ? void 0 : referralCode.trim()) {
        const referrerByCode = yield userModel_1.default.findOne({ referralCode });
        if (referrerByCode) {
            referrerId = referrerByCode._id;
        }
        else {
            logger_1.default.warn(`Referral code ${referralCode} not found`);
        }
    }
    if (!referrerId) {
        const systemUser = yield getSystemReferrer();
        referrerId = systemUser._id;
    }
    const user = new userModel_1.default({
        email,
        userName,
        password,
        role: userModel_1.UserRole.AGENT,
        referer: referrerId,
    });
    const { token } = user.generateVerificationToken();
    yield user.save();
    try {
        yield referralModel_1.Referral.create({
            referrer: referrerId,
            referred: user._id,
            status: referralModel_1.ReferralStatus.PENDING,
        });
    }
    catch (err) {
        logger_1.default.error(`Referral error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    const verifyEmailLink = `${config_1.default.frontendUrl}/account-verify?token=${encodeURIComponent(token)}`;
    try {
        console.log("Step 10: Sending verification email");
        yield emailService_1.default.sendVerificationEmail(user.email, user.userName, verifyEmailLink);
    }
    catch (err) {
        logger_1.default.error(`Email error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    // Update last login
    user.lastLogin = new Date();
    yield user.save();
    // Generate tokens
    const esToken = (0, jwtUtils_1.generateToken)(user._id.toString(), user.role, "30d");
    const refreshToken = (0, jwtUtils_1.generateRefreshToken)(user === null || user === void 0 ? void 0 : user._id.toString(), user.role);
    // Save refresh token
    user.refreshToken = refreshToken;
    yield user.save({ validateBeforeSave: false });
    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;
    console.log("Step 6: Agent registration completed");
    res.status(http_status_codes_1.StatusCodes.CREATED).json({
        success: true,
        message: "Seller registration successful. Please check your email.",
        token: esToken,
        refreshToken,
        user: userObj,
    });
}));
/**
 * @desc    Check if username is available
 * @route   GET /api/auth/check-username
 * @access  Public
 */
exports.checkUsername = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { username } = req.query;
    if (!username) {
        return next(new appError_1.AppError("Username parameter is required", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Check if username exists in database
    const existingUser = yield userModel_1.default.findOne({ userName: username });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        available: !existingUser,
    });
}));
/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { verificationToken } = req.body;
    console.log("Verifying email...");
    console.log("Incoming verification token:", verificationToken);
    try {
        if (!verificationToken) {
            return res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Verification token is required",
            });
        }
        const user = yield userModel_1.default.findOne({ verificationToken });
        if (!user) {
            return res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Invalid token",
                type: "invalidtoken",
            });
        }
        // Check if token has expired
        if (user.verificationTokenExpires &&
            user.verificationTokenExpires.getTime() < Date.now()) {
            console.log("Token has expired:", user.verificationTokenExpires);
            // Generate new verification token
            const { token } = user.generateVerificationToken();
            yield user.save();
            if (!config_1.default.frontendUrl) {
                return res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    message: "Client URL is not defined",
                });
            }
            // Send new verification email
            try {
                const verifyEmailLink = `${config_1.default.frontendUrl}/account-verify?token=${encodeURIComponent(token)}`;
                yield emailService_1.default.sendVerificationEmail(user.email, user.userName, verifyEmailLink);
            }
            catch (err) {
                logger_1.default.error(`Failed to send verification email: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            // Generate tokens
            const esToken = (0, jwtUtils_1.generateToken)(user._id.toString(), user.role); // 30 days in seconds
            const refreshToken = (0, jwtUtils_1.generateRefreshToken)(user._id.toString(), user.role);
            return res.status(http_status_codes_1.StatusCodes.UNAUTHORIZED).json({
                success: false,
                message: "Verification token expired. A new verification email has been sent.",
                type: "linkexpired",
                token: esToken,
                refreshToken,
            });
        }
        // Valid token, mark user as verified
        user.isEmailVerified = true;
        user.verificationToken = "";
        user.verificationTokenExpires = undefined;
        yield user.save();
        const esToken = (0, jwtUtils_1.generateToken)(user._id.toString(), user.role); // 30 days in seconds
        const refreshToken = (0, jwtUtils_1.generateRefreshToken)(user._id.toString(), user.role);
        console.log("User email verified:", user);
        return res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            message: "Email verified successfully",
            type: "emailverified",
            token: esToken,
            refreshToken,
        });
    }
    catch (error) {
        console.error("Error during email verification:", error);
        return res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error",
        });
    }
}));
/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
const resedEmailVerification = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { verificationToken, email, } = req.body;
    console.log("Verifying email2...");
    console.log("Incoming verification token2:", verificationToken);
    const user = req.user;
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    try {
        const currentUser = yield userModel_1.default.findById(userId).select("-password");
        if (!currentUser) {
            return next(new appError_1.AppError("Invalid user", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
        if (verificationToken) {
            console.log("Verification token detected");
            const user = yield userModel_1.default.findOne({ verificationToken });
            if (!user) {
                res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({ message: "Invalid token" });
                return;
            }
            if (user.verificationTokenExpires &&
                user.verificationTokenExpires.getTime() < Date.now()) {
                const { token } = user.generateVerificationToken();
                yield user.save();
                const verifyEmailLink = `${config_1.default.frontendUrl}/account-verify?token=${encodeURIComponent(token)}`;
                try {
                    console.log("Step 10: Sending verification email");
                    yield emailService_1.default.sendVerificationEmail(user.email, user.userName, verifyEmailLink);
                }
                catch (err) {
                    logger_1.default.error(`Email error: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
                res.status(http_status_codes_1.StatusCodes.UNAUTHORIZED).json({
                    message: "Verification token expired. A new verification email has been sent.",
                    type: "linkexpired",
                });
                return;
            }
            else {
                user.isEmailVerified = true;
                user.verificationToken = "";
                user.verificationTokenExpires = undefined;
                yield user.save();
                console.log("User email verified:", user);
                res.status(http_status_codes_1.StatusCodes.OK).json({
                    message: "Email verified successfully",
                    type: "emailverified",
                });
                return;
            }
        }
        if (email) {
            console.log("Resending verification email to:", email);
            const user = yield userModel_1.default.findOne({ email });
            if (!user) {
                res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({ message: "User not found" });
                return;
            }
            const { token } = user.generateVerificationToken();
            yield user.save();
            if (!config_1.default.frontendUrl) {
                res
                    .status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR)
                    .json({ message: "Client URL is not defined" });
                return;
            }
            const verifyEmailLink = `${config_1.default.frontendUrl}/account-verify/?token=${encodeURIComponent(token)}`;
            try {
                console.log("Step 10: Sending verification email");
                yield emailService_1.default.sendVerificationEmail(user.email, user.userName, verifyEmailLink);
            }
            catch (err) {
                logger_1.default.error(`Email error: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            res
                .status(http_status_codes_1.StatusCodes.OK)
                .json({ message: "A new verification email has been sent." });
            return;
        }
        res
            .status(http_status_codes_1.StatusCodes.BAD_REQUEST)
            .json({ message: "Verification token or email required" });
        return;
    }
    catch (error) {
        console.error("Error during email verification:", error);
        res
            .status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR)
            .json({ message: "Internal server error" });
        return;
    }
});
exports.resedEmailVerification = resedEmailVerification;
/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("h1");
    // Validate request body using Joi
    const { error, value } = userValidation_1.loginSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const errorMessage = error.details
            .map((detail) => detail.message)
            .join(", ");
        return next(new appError_1.AppError(errorMessage, http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const { email, password } = value;
    // Find user
    const user = (yield userModel_1.default.findOne({ email }).select("+password"));
    if (!user) {
        return next(new appError_1.AppError("Invalid credentials", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    // Check if password matches
    let isMatch = false;
    try {
        isMatch = yield user.comparePassword(password);
    }
    catch (error) {
        logger_1.default.error(`Password comparison error: ${error instanceof Error ? error.message : "Unknown error"}`);
        return next(new appError_1.AppError("Authentication error", http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR));
    }
    if (!isMatch) {
        return next(new appError_1.AppError("Invalid credentials", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    // Check if user is verified
    if (!user.isEmailVerified) {
        // Update last login
        user.lastLogin = new Date();
        yield user.save();
        // Generate tokens
        const token = (0, jwtUtils_1.generateToken)(user._id.toString(), user.role, "30d");
        const refreshToken = (0, jwtUtils_1.generateRefreshToken)(user === null || user === void 0 ? void 0 : user._id.toString(), user.role);
        // Save refresh token
        user.refreshToken = refreshToken;
        yield user.save({ validateBeforeSave: false });
        // Remove password from response
        const userObj = user.toObject();
        delete userObj.password;
        delete userObj.refreshToken;
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            token,
            refreshToken,
            user: userObj,
        });
        return;
    }
    // Check if user is active
    if (!user.isActive) {
        return next(new appError_1.AppError("Your account has been deactivated. Please contact support.", http_status_codes_1.StatusCodes.FORBIDDEN));
    }
    // Update last login
    user.lastLogin = new Date();
    yield user.save();
    // Generate tokens
    const token = (0, jwtUtils_1.generateToken)(user._id.toString(), user.role, "30d");
    const refreshToken = (0, jwtUtils_1.generateRefreshToken)(user === null || user === void 0 ? void 0 : user._id.toString(), user.role);
    // Save refresh token
    user.refreshToken = refreshToken;
    yield user.save({ validateBeforeSave: false });
    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        token,
        refreshToken,
        user: userObj,
    });
}));
/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Clear refresh token
    if (req.user) {
        const user = yield userModel_1.default.findById(req.user._id);
        if (user) {
            user.refreshToken = undefined;
            yield user.save({ validateBeforeSave: false });
        }
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Logged out successfully",
    });
}));
/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
exports.refreshToken = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate request body using Joi
    const { error, value } = userValidation_1.refreshTokenSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const errorMessage = error.details
            .map((detail) => detail.message)
            .join(", ");
        return next(new appError_1.AppError(errorMessage, http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const { refreshToken: refreshTokenFromBody } = value;
    // Find user with refresh token
    const user = yield userModel_1.default.findOne({ refreshToken: refreshTokenFromBody });
    if (!user) {
        return next(new appError_1.AppError("Invalid refresh token", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    // Generate new tokens
    const token = (0, jwtUtils_1.generateToken)(user._id.toString(), user.role, "30d");
    const newRefreshToken = (0, jwtUtils_1.generateRefreshToken)(user._id.toString(), user.role);
    // Update refresh token
    user.refreshToken = newRefreshToken;
    yield user.save({ validateBeforeSave: false });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        token,
        refreshToken: newRefreshToken,
    });
}));
/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate request body using Joi
    const { error, value } = userValidation_1.forgotPasswordSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const errorMessage = error.details
            .map((detail) => detail.message)
            .join(", ");
        return next(new appError_1.AppError(errorMessage, http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const { email } = value;
    // Find user
    const user = yield userModel_1.default.findOne({ email });
    if (!user) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Generate reset token
    const { token, expires } = user.generatePasswordResetToken();
    yield user.save();
    // Send reset email
    try {
        yield emailService_1.default.sendPasswordResetEmail(user.email, `${user.firstName} ${user.lastName}`, token);
        user.resetPasswordToken = token;
        user.resetPasswordExpires = expires;
        yield user.save();
    }
    catch (error) {
        // Revert token if email fails
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        yield user.save();
        logger_1.default.error(`Failed to send password reset email: ${error instanceof Error ? error.message : "Unknown error"}`);
        return next(new appError_1.AppError("Failed to send password reset email", http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Password reset email sent",
    });
}));
/**
 * @desc    Vverify password reset token
 * @route   POST /api/v1/auth/verifypasswordresettoken/resetToken=token
 * @access  Public
 */
const verifyPasswordResetToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { resetToken } = req.body;
    try {
        const user = yield userModel_1.default.findOne({
            resetPasswordToken: resetToken,
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) {
            res.status(400).json({ message: "Invalid or expired token" });
            return;
        }
        res.status(200).json({ message: "Valid token", resetToken: resetToken });
        return;
    }
    catch (error) {
        res.status(500).json({ message: "Error verifying token", error });
        return;
    }
});
exports.verifyPasswordResetToken = verifyPasswordResetToken;
/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { resetToken, password, confirmPassword } = req.body;
    console.log("data", resetToken, password);
    // Validate request body using Joi
    const { error, value } = userValidation_1.resetPasswordSchema.validate({ password, confirmPassword }, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const errorMessage = error.details
            .map((detail) => detail.message)
            .join(", ");
        return next(new appError_1.AppError(errorMessage, http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Find user with token
    const user = yield userModel_1.default.findOne({
        resetPasswordToken: resetToken,
        resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
        return next(new appError_1.AppError("Invalid or expired reset token", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Update password
    user.password = value.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    yield user.save();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Password reset successful",
    });
}));
/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getCurrentUser = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("hit me");
    const user = yield userModel_1.default.findById((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)
        .select("-password")
        .populate("referer", "userName email role"); // Populate the referer field
    if (!user) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        user,
    });
}));
//# sourceMappingURL=authController.js.map