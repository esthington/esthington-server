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
exports.resetAdminPassword = exports.updateAdminPermissions = exports.deleteAdmin = exports.updateAdmin = exports.createAdmin = exports.getAdminById = exports.getAllAdmins = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const appError_1 = require("../utils/appError");
const userModel_1 = __importDefault(require("../models/userModel"));
const emailService_1 = __importDefault(require("../services/emailService"));
// Get all admins
exports.getAllAdmins = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const admins = yield userModel_1.default.find({ role: "admin" }).select("name email phone profileImage createdAt lastLogin permissions");
    res.status(200).json({
        status: "success",
        results: admins.length,
        data: {
            admins,
        },
    });
}));
// Get admin by ID
exports.getAdminById = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const admin = yield userModel_1.default.findOne({
        _id: req.params.id,
        role: "admin",
    }).select("name email phone profileImage createdAt lastLogin permissions");
    if (!admin) {
        return next(new appError_1.AppError("Admin not found", 404));
    }
    res.status(200).json({
        status: "success",
        data: {
            admin,
        },
    });
}));
// Create new admin
exports.createAdmin = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, username, email, phone, password, permissions, } = req.body;
    // Check if email already exists
    const existingUser = yield userModel_1.default.findOne({ email });
    if (existingUser) {
        return next(new appError_1.AppError("Email already in use", 400));
    }
    // Create new admin user
    const newAdmin = yield userModel_1.default.create({
        firstName,
        lastName,
        email,
        phone,
        password,
        role: "admin",
        permissions,
    });
    // Convert to plain object and remove password
    const adminObj = newAdmin.toObject();
    delete adminObj.password;
    // Send welcome email
    yield emailService_1.default.sendEmail(newAdmin.email, "Welcome to the Admin Team", `Hello ${newAdmin.firstName},\n\nYou have been added as an administrator. Please login with your email and the provided password.`, "");
    res.status(201).json({
        status: "success",
        data: {
            admin: adminObj,
        },
    });
}));
// Update admin
exports.updateAdmin = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, email, phone, permissions, active } = req.body;
    // Find admin
    const admin = yield userModel_1.default.findOne({ _id: req.params.id, role: "admin" });
    if (!admin) {
        return next(new appError_1.AppError("Admin not found", 404));
    }
    // Check if email is being changed and already exists
    if (email && email !== admin.email) {
        const existingUser = yield userModel_1.default.findOne({ email });
        if (existingUser) {
            return next(new appError_1.AppError("Email already in use", 400));
        }
        admin.email = email;
    }
    // Update fields
    if (firstName)
        admin.firstName = firstName;
    if (lastName)
        admin.lastName = lastName;
    if (phone)
        admin.phone = phone;
    if (permissions)
        admin.permissions = permissions;
    if (active !== undefined)
        admin.isActive = active;
    yield admin.save();
    // Remove password from output
    const adminObj = admin.toObject();
    delete adminObj.password;
    res.status(200).json({
        status: "success",
        data: {
            admin,
        },
    });
}));
// Delete admin
exports.deleteAdmin = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const admin = yield userModel_1.default.findOneAndDelete({
        _id: req.params.id,
        role: "admin",
    });
    if (!admin) {
        return next(new appError_1.AppError("Admin not found", 404));
    }
    res.status(204).json({
        status: "success",
        data: null,
    });
}));
// Update admin permissions
exports.updateAdminPermissions = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { permissions } = req.body;
    if (!permissions || !Array.isArray(permissions)) {
        return next(new appError_1.AppError("Permissions must be provided as an array", 400));
    }
    const admin = yield userModel_1.default.findOne({ _id: req.params.id, role: "admin" });
    if (!admin) {
        return next(new appError_1.AppError("Admin not found", 404));
    }
    admin.permissions = permissions;
    yield admin.save();
    res.status(200).json({
        status: "success",
        data: {
            permissions: admin.permissions,
        },
    });
}));
// Reset admin password
exports.resetAdminPassword = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return next(new appError_1.AppError("Password must be at least 8 characters", 400));
    }
    const admin = yield userModel_1.default.findOne({ _id: req.params.id, role: "admin" });
    if (!admin) {
        return next(new appError_1.AppError("Admin not found", 404));
    }
    admin.password = newPassword;
    admin.passwordChangedAt = new Date();
    yield admin.save();
    // Send password reset notification
    yield emailService_1.default.sendEmail(admin.email, "Your Password Has Been Reset", `Hello ${admin.firstName},\n\nYour password has been reset by a super admin. Please login with your new password.`);
    res.status(200).json({
        status: "success",
        message: "Password reset successfully",
    });
}));
//# sourceMappingURL=adminManagementController.js.map