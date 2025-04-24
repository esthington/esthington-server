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
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getUsers = exports.deleteAccount = exports.changePassword = exports.updateProfile = void 0;
const http_status_codes_1 = require("http-status-codes");
const userModel_1 = __importDefault(require("../models/userModel"));
const appError_1 = require("../utils/appError");
const asyncHandler_1 = require("../utils/asyncHandler");
const cloudinaryService_1 = require("../services/cloudinaryService");
// Update user profile
exports.updateProfile = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, email, phone, address } = req.body;
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    // Check if email is already taken
    if (email && email !== req.user.email) {
        const existingUser = yield userModel_1.default.findOne({ email });
        if (existingUser) {
            return next(new appError_1.AppError("Email already in use", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
    }
    // Upload profile image if provided
    let profileImage = req.user.profileImage;
    if (req.file) {
        const result = yield (0, cloudinaryService_1.uploadToCloudinary)(req.file.path);
        profileImage = result.secure_url;
    }
    // Update user
    const updatedUser = yield userModel_1.default.findByIdAndUpdate(userId, {
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName,
        email: email || req.user.email,
        phone: phone || req.user.phone,
        address: address || req.user.address,
        profileImage,
    }, { new: true, runValidators: true });
    if (!updatedUser) {
        return next(new appError_1.AppError("User not found or could not be updated", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        user: updatedUser,
    });
}));
// Change password
exports.changePassword = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { currentPassword, newPassword } = req.body;
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    // Get user with password
    const user = yield userModel_1.default.findById(userId).select("+password");
    if (!user) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Check if current password is correct
    const isMatch = yield user.comparePassword(currentPassword);
    if (!isMatch) {
        return next(new appError_1.AppError("Current password is incorrect", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Update password
    user.password = newPassword;
    yield user.save();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Password updated successfully",
    });
}));
// Delete account
exports.deleteAccount = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    // Delete user
    const deletedUser = yield userModel_1.default.findByIdAndDelete(userId);
    if (!deletedUser) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Account deleted successfully",
    });
}));
// Admin: Get all users
exports.getUsers = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield userModel_1.default.find().select("-password -refreshToken");
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: users.length,
        users,
    });
}));
// Admin: Get user by ID
exports.getUserById = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const user = yield userModel_1.default.findById(id).select("-password -refreshToken");
    if (!user) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        user,
    });
}));
// Admin: Update user
exports.updateUser = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { firstName, lastName, email, role, isActive, isEmailVerified } = req.body;
    // Check if email is already taken
    if (email) {
        const existingUser = yield userModel_1.default.findOne({ email, _id: { $ne: id } });
        if (existingUser) {
            return next(new appError_1.AppError("Email already in use", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
    }
    // Update user
    const updatedUser = yield userModel_1.default.findByIdAndUpdate(id, {
        firstName,
        lastName,
        email,
        role,
        isActive,
        isEmailVerified,
    }, { new: true, runValidators: true }).select("-password -refreshToken");
    if (!updatedUser) {
        return next(new appError_1.AppError("User not found or could not be updated", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        user: updatedUser,
    });
}));
// Admin: Delete user
exports.deleteUser = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    // Delete user
    const deletedUser = yield userModel_1.default.findByIdAndDelete(id);
    if (!deletedUser) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "User deleted successfully",
    });
}));
//# sourceMappingURL=userController.js.map