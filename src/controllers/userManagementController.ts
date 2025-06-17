import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import User, { UserRole, UserStatus } from "../models/userModel";
import { Wallet } from "../models/walletModel";
import emailService from "../services/emailService";
import type { UserStats } from "../types/user-management";

// Get all users with filtering, sorting, and pagination
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = {};

    // Role filter
    if (
      req.query.role &&
      Object.values(UserRole).includes(req.query.role as UserRole)
    ) {
      query.role = req.query.role;
    }

    // Status filter
    if (
      req.query.status &&
      Object.values(UserStatus).includes(req.query.status as UserStatus)
    ) {
      query.status = req.query.status;
    }

    // Active filter
    if (req.query.active !== undefined) {
      query.isActive = req.query.active === "true";
    }

    // Verified filter
    if (req.query.verified !== undefined) {
      query.isEmailVerified = req.query.verified === "true";
    }

    // Search by name or email
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, "i");
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { userName: searchRegex },
      ];
    }

    // Execute query with pagination
    const users = await User.find(query)
      .select("-password -resetPasswordToken -verificationToken -refreshToken")
      .sort((req.query.sort as string) || "-createdAt")
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await User.countDocuments(query);

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
  }
);

// Get user by ID with detailed information
export const getUserById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.params.id)
      .select("-password -resetPasswordToken -verificationToken -refreshToken")
      .lean();

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Get user wallet
    const wallet = await Wallet.findOne({ user: user._id });

    res.status(200).json({
      status: "success",
      data: {
        user: {
          ...user,
          walletBalance: wallet ? wallet.balance : 0,
        },
      },
    });
  }
);

// Update user
export const updateUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      isActive,
      isEmailVerified,
      address,
      businessName,
      city,
      country,
    } = req.body;

    // Find user
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if email is being changed and already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(new AppError("Email already in use", 400));
      }
      user.email = email;
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (businessName !== undefined) user.businessName = businessName;
    if (city !== undefined) user.city = city;
    if (country !== undefined) user.country = country;

    if (role && Object.values(UserRole).includes(role)) {
      user.role = role;
    }

    if (isActive !== undefined) user.isActive = isActive;
    if (isEmailVerified !== undefined) user.isEmailVerified = isEmailVerified;

    await user.save();

    // Convert to plain object and remove sensitive fields
    const userObject = user.toObject();
    delete (userObject as any).password;
    delete (userObject as any).resetPasswordToken;
    delete (userObject as any).verificationToken;
    delete (userObject as any).refreshToken;

    res.status(200).json({
      status: "success",
      data: {
        user: userObject,
      },
    });
  }
);

// Delete user
export const deleteUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Delete associated wallet
    await Wallet.findOneAndDelete({ user: req.params.id });

    res.status(204).json({
      status: "success",
      data: null,
    });
  }
);

// Reset user password
export const resetUserPassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Generate temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8);

    user.password = tempPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // Send password reset notification
    try {
      await emailService.sendEmail(
        user.email,
        "Your Password Has Been Reset",
        `Hello ${user.firstName},\n\nYour password has been reset by an administrator. Your temporary password is: ${tempPassword}\n\nPlease login and change your password immediately.`
      );
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }

    res.status(200).json({
      status: "success",
      message: "Password reset successfully",
      data: {
        tempPassword,
      },
    });
  }
);

// Verify user
export const verifyUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    user.isEmailVerified = true;
    await user.save();

    // Send verification notification
    try {
      await emailService.sendEmail(
        user.email,
        "Your Account Has Been Verified",
        `Hello ${user.firstName},\n\nYour account has been verified by an administrator. You now have full access to all features.`
      );
    } catch (error) {
      console.error("Failed to send verification email:", error);
    }

    res.status(200).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  }
);

// Get user statistics
export const getUserStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Get counts by role
    const buyerCount = await User.countDocuments({ role: UserRole.BUYER });
    const agentCount = await User.countDocuments({ role: UserRole.AGENT });
    const adminCount = await User.countDocuments({
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    });

    // Get counts by verification status
    const verifiedCount = await User.countDocuments({ isEmailVerified: true });
    const unverifiedCount = await User.countDocuments({
      isEmailVerified: false,
    });

    // Get counts by active status
    const activeCount = await User.countDocuments({ isActive: true });
    const inactiveCount = await User.countDocuments({ isActive: false });

    // Get new users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsersCount = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get monthly registration stats for current year
    const currentYear = new Date().getFullYear();

    const monthlyStats = await User.aggregate([
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

    const stats: UserStats = {
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
    };

    res.status(200).json({
      status: "success",
      data: stats,
    });
  }
);
