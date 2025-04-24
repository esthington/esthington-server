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
exports.getUserStats = exports.verifyUser = exports.resetUserPassword = exports.deleteUser = exports.updateUser = exports.getUserById = exports.getAllUsers = void 0;
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const appError_1 = __importDefault(require("../utils/appError"));
const userModel_1 = __importDefault(require("../models/userModel"));
const walletModel_1 = require("../models/walletModel");
const emailService_1 = __importDefault(require("../services/emailService"));
// Get all users with filtering, sorting, and pagination
exports.getAllUsers = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    // Build query
    const query = {};
    // Filter by role
    if (req.query.role &&
        ["buyer", "agent", "admin"].includes(req.query.role)) {
        query.role = req.query.role;
    }
    // Filter by active status
    if (req.query.active !== undefined) {
        query.active = req.query.active === "true";
    }
    // Filter by verification status
    if (req.query.verified !== undefined) {
        query.verified = req.query.verified === "true";
    }
    // Search by name or email
    if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, "i");
        query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }
    // Execute query with pagination
    const users = yield userModel_1.default.find(query)
        .select("name email phone role active verified createdAt lastLogin")
        .sort(req.query.sort || "-createdAt")
        .skip(skip)
        .limit(limit);
    // Get total count for pagination
    const total = yield userModel_1.default.countDocuments(query);
    res.status(200).json({
        status: "success",
        results: users.length,
        pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
            limit,
        },
        data: {
            users,
        },
    });
}));
// Get user by ID with detailed information
exports.getUserById = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield userModel_1.default.findById(req.params.id).select("-password");
    if (!user) {
        return next(new appError_1.default("User not found", 404));
    }
    // Get user wallet
    const wallet = yield walletModel_1.Wallet.findOne({ user: user._id });
    res.status(200).json({
        status: "success",
        data: {
            user,
            walletBalance: wallet ? wallet.balance : 0,
        },
    });
}));
// Update user
exports.updateUser = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, email, phone, role, active, verified } = req.body;
    // Find user
    const user = yield userModel_1.default.findById(req.params.id);
    if (!user) {
        return next(new appError_1.default("User not found", 404));
    }
    // Check if email is being changed and already exists
    if (email && email !== user.email) {
        const existingUser = yield userModel_1.default.findOne({ email });
        if (existingUser) {
            return next(new appError_1.default("Email already in use", 400));
        }
        user.email = email;
    }
    // Update fields
    if (firstName)
        user.firstName = firstName;
    if (lastName)
        user.lastName = lastName;
    if (phone)
        user.phone = phone;
    if (role && ["buyer", "agent", "admin"].includes(role))
        user.role = role;
    if (active !== undefined)
        user.isActive = active;
    if (verified !== undefined)
        user.isEmailVerified = verified;
    yield user.save();
    // Convert to plain object and remove password
    const userObject = user.toObject();
    delete userObject.password;
    res.status(200).json({
        status: "success",
        data: {
            userObject,
        },
    });
}));
// Delete user
exports.deleteUser = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield userModel_1.default.findByIdAndDelete(req.params.id);
    if (!user) {
        return next(new appError_1.default("User not found", 404));
    }
    // Delete associated wallet
    yield walletModel_1.Wallet.findOneAndDelete({ user: req.params.id });
    res.status(204).json({
        status: "success",
        data: null,
    });
}));
// Reset user password
exports.resetUserPassword = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return next(new appError_1.default("Password must be at least 8 characters", 400));
    }
    const user = yield userModel_1.default.findById(req.params.id);
    if (!user) {
        return next(new appError_1.default("User not found", 404));
    }
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    yield user.save();
    // Send password reset notification
    yield emailService_1.default.sendEmail(user.email, "Your Password Has Been Reset", `Hello ${user.firstName},\n\nYour password has been reset by an administrator. Please login with your new password.`);
    res.status(200).json({
        status: "success",
        message: "Password reset successfully",
    });
}));
// Verify user
exports.verifyUser = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield userModel_1.default.findById(req.params.id);
    if (!user) {
        return next(new appError_1.default("User not found", 404));
    }
    user.isEmailVerified = true;
    yield user.save();
    // Send verification notification
    yield emailService_1.default.sendEmail(user.email, "Your Account Has Been Verified", `Hello ${user.firstName},\n\nYour account has been verified by an administrator. You now have full access to all features.`);
    res.status(200).json({
        status: "success",
        data: {
            user: {
                id: user._id,
                name: user.firstName,
                email: user.email,
                verified: user.isEmailVerified,
            },
        },
    });
}));
// Get user statistics
exports.getUserStats = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Get counts by role
    const buyerCount = yield userModel_1.default.countDocuments({ role: "buyer" });
    const agentCount = yield userModel_1.default.countDocuments({ role: "agent" });
    const adminCount = yield userModel_1.default.countDocuments({ role: "admin" });
    // Get counts by verification status
    const verifiedCount = yield userModel_1.default.countDocuments({ verified: true });
    const unverifiedCount = yield userModel_1.default.countDocuments({ verified: false });
    // Get counts by active status
    const activeCount = yield userModel_1.default.countDocuments({ active: true });
    const inactiveCount = yield userModel_1.default.countDocuments({ active: false });
    // Get new users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsersCount = yield userModel_1.default.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
    });
    // Get monthly registration stats for current year
    const currentYear = new Date().getFullYear();
    const monthlyStats = yield userModel_1.default.aggregate([
        { $match: { $expr: { $eq: [{ $year: "$createdAt" }, currentYear] } } },
        {
            $group: {
                _id: { $month: "$createdAt" },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);
    const monthlyRegistrations = Array(12).fill(0);
    monthlyStats.forEach((item) => {
        monthlyRegistrations[item._id - 1] = item.count;
    });
    res.status(200).json({
        status: "success",
        data: {
            total: buyerCount + agentCount + adminCount,
            byRole: {
                buyers: buyerCount,
                agents: agentCount,
                admins: adminCount,
            },
            byVerification: {
                verified: verifiedCount,
                unverified: unverifiedCount,
            },
            byStatus: {
                active: activeCount,
                inactive: inactiveCount,
            },
            newUsersLast30Days: newUsersCount,
            monthlyRegistrations,
        },
    });
}));
//# sourceMappingURL=userManagementController.js.map