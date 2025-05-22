import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import User from "../models/userModel";
import { Wallet } from "../models/walletModel";
import emailService from "../services/emailService";

// Get all users with filtering, sorting, and pagination
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (
      req.query.role &&
      ["buyer", "agent", "admin"].includes(req.query.role as string)
    ) {
      query.role = req.query.role;
    }

    if (req.query.active !== undefined) {
      query.active = req.query.active === "true";
    }

    if (req.query.verified !== undefined) {
      query.verified = req.query.verified === "true";
    }

    // Search by name or email
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, "i");
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    // Execute query with pagination
    const users = await User.find(query)
      .select("name email phone role active verified createdAt lastLogin")
      .sort((req.query.sort as string) || "-createdAt")
      .skip(skip)
      .limit(limit);

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
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Get user wallet
    const wallet = await Wallet.findOne({ user: user._id });

    res.status(200).json({
      status: "success",
      data: {
        user,
        walletBalance: wallet ? wallet.balance : 0,
      },
    });
  }
);

// Update user
export const updateUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { firstName, lastName, email, phone, role, active, verified } =
      req.body;

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
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (role && ["buyer", "agent", "admin"].includes(role)) user.role = role;
    if (active !== undefined) user.isActive = active;
    if (verified !== undefined) user.isEmailVerified = verified;

    await user.save();

    // Convert to plain object and remove password
    const userObject = user.toObject();
    delete (userObject as { password?: string }).password;

    res.status(200).json({
      status: "success",
      data: {
        userObject,
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
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return next(new AppError("Password must be at least 8 characters", 400));
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // Send password reset notification
    await emailService.sendEmail(
      user.email,
      "Your Password Has Been Reset",
      `Hello ${user.firstName},\n\nYour password has been reset by an administrator. Please login with your new password.`
    );

    res.status(200).json({
      status: "success",
      message: "Password reset successfully",
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
    await emailService.sendEmail(
      user.email,
      "Your Account Has Been Verified",
      `Hello ${user.firstName},\n\nYour account has been verified by an administrator. You now have full access to all features.`
    );

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
  }
);

// Get user statistics
export const getUserStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Get counts by role
    const buyerCount = await User.countDocuments({ role: "buyer" });
    const agentCount = await User.countDocuments({ role: "agent" });
    const adminCount = await User.countDocuments({ role: "admin" });

    // Get counts by verification status
    const verifiedCount = await User.countDocuments({ verified: true });
    const unverifiedCount = await User.countDocuments({ verified: false });

    // Get counts by active status
    const activeCount = await User.countDocuments({ active: true });
    const inactiveCount = await User.countDocuments({ active: false });

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
  }
);
