import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import User, { UserRole } from "../models/userModel";
import emailService from "../services/emailService";
import type { AdminData } from "../types/user-management";

// Get all admins
export const getAllAdmins = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = {
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    };

    // Role filter
    if (
      req.query.role &&
      [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(
        req.query.role as UserRole
      )
    ) {
      query.role = req.query.role;
    }

    // Status filter
    if (req.query.status !== undefined) {
      query.isActive = req.query.status === "active";
    }

    // Search filter
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, "i");
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { userName: searchRegex },
      ];
    }

    const admins = await User.find(query)
      .select("-password -resetPasswordToken -verificationToken -refreshToken")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: admins.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
      data: {
        admins,
      },
    });
  }
);

// Get admin by ID
export const getAdminById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const admin = await User.findOne({
      _id: req.params.id,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    }).select("-password -resetPasswordToken -verificationToken -refreshToken");

    if (!admin) {
      return next(new AppError("Admin not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        admin,
      },
    });
  }
);

// Create new admin
export const createAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      firstName,
      lastName,
      userName,
      email,
      phone,
      role,
      permissions,
    }: AdminData & { password?: string } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("Email already in use", 400));
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ userName });
    if (existingUsername) {
      return next(new AppError("Username already in use", 400));
    }

    // Generate temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8);

    // Create new admin user
    const newAdmin = await User.create({
      firstName,
      lastName,
      userName,
      email,
      phone,
      password: tempPassword,
      role: role || UserRole.ADMIN,
      permissions: permissions || [],
      isEmailVerified: true, // Admins are verified by default
    });

    // Convert to plain object and remove password
    const adminObj = newAdmin.toObject();
    delete (adminObj as any).password;
    delete (adminObj as any).resetPasswordToken;
    delete (adminObj as any).verificationToken;
    delete (adminObj as any).refreshToken;

    // Send welcome email
    try {
      await emailService.sendEmail(
        newAdmin.email,
        "Welcome to the Admin Team",
        `Hello ${newAdmin.firstName},\n\nYou have been added as an administrator. Your temporary password is: ${tempPassword}\n\nPlease login and change your password immediately.`
      );
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }

    res.status(201).json({
      status: "success",
      data: {
        admin: adminObj,
        tempPassword,
      },
    });
  }
);

// Update admin
export const updateAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { firstName, lastName, email, phone, permissions, isActive } =
      req.body;

    // Find admin
    const admin = await User.findOne({
      _id: req.params.id,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    });

    if (!admin) {
      return next(new AppError("Admin not found", 404));
    }

    // Check if email is being changed and already exists
    if (email && email !== admin.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(new AppError("Email already in use", 400));
      }
      admin.email = email;
    }

    // Update fields
    if (firstName !== undefined) admin.firstName = firstName;
    if (lastName !== undefined) admin.lastName = lastName;
    if (phone !== undefined) admin.phone = phone;
    if (permissions !== undefined) admin.permissions = permissions;
    if (isActive !== undefined) admin.isActive = isActive;

    await admin.save();

    // Remove sensitive fields from output
    const adminObj = admin.toObject();
    delete (adminObj as any).password;
    delete (adminObj as any).resetPasswordToken;
    delete (adminObj as any).verificationToken;
    delete (adminObj as any).refreshToken;

    res.status(200).json({
      status: "success",
      data: {
        admin: adminObj,
      },
    });
  }
);

// Delete admin
export const deleteAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const admin = await User.findOneAndDelete({
      _id: req.params.id,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    });

    if (!admin) {
      return next(new AppError("Admin not found", 404));
    }

    // Prevent deletion of super admin by regular admin
    if (
      admin.role === UserRole.SUPER_ADMIN &&
      req.user?.role !== UserRole.SUPER_ADMIN
    ) {
      return next(new AppError("Cannot delete super admin", 403));
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  }
);

// Update admin permissions
export const updateAdminPermissions = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return next(
        new AppError("Permissions must be provided as an array", 400)
      );
    }

    const admin = await User.findOne({
      _id: req.params.id,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    });

    if (!admin) {
      return next(new AppError("Admin not found", 404));
    }

    admin.permissions = permissions;
    await admin.save();

    res.status(200).json({
      status: "success",
      data: {
        permissions: admin.permissions,
      },
    });
  }
);

// Reset admin password
export const resetAdminPassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const admin = await User.findOne({
      _id: req.params.id,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    });

    if (!admin) {
      return next(new AppError("Admin not found", 404));
    }

    // Generate temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8);

    admin.password = tempPassword;
    admin.passwordChangedAt = new Date();
    await admin.save();

    // Send password reset notification
    try {
      await emailService.sendEmail(
        admin.email,
        "Your Password Has Been Reset",
        `Hello ${admin.firstName},\n\nYour password has been reset by a super admin. Your temporary password is: ${tempPassword}\n\nPlease login and change your password immediately.`
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
