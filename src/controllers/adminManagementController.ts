import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/appError";
import User from "../models/userModel";
import emailService from "../services/emailService";

// Get all admins
export const getAllAdmins = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const admins = await User.find({ role: "admin" }).select(
      "name email phone profileImage createdAt lastLogin permissions"
    );

    res.status(200).json({
      status: "success",
      results: admins.length,
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
      role: "admin",
    }).select("name email phone profileImage createdAt lastLogin permissions");

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
      username,
      email,
      phone,
      password,
      permissions,
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("Email already in use", 400));
    }

    // Create new admin user
    const newAdmin = await User.create({
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
    delete (adminObj as { password?: string }).password;

    // Send welcome email
    await emailService.sendEmail(
      newAdmin.email,
      "Welcome to the Admin Team",
      `Hello ${newAdmin.firstName},\n\nYou have been added as an administrator. Please login with your email and the provided password.`,
      ""
    );

    res.status(201).json({
      status: "success",
      data: {
        admin: adminObj,
      },
    });
  }
);

// Update admin
export const updateAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { firstName, lastName, email, phone, permissions, active } = req.body;

    // Find admin
    const admin = await User.findOne({ _id: req.params.id, role: "admin" });

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
    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;
    if (phone) admin.phone = phone;
    if (permissions) admin.permissions = permissions;
    if (active !== undefined) admin.isActive = active;

    await admin.save();

    // Remove password from output
    const adminObj = admin.toObject();
    delete (adminObj as { password?: string }).password;

    res.status(200).json({
      status: "success",
      data: {
        admin,
      },
    });
  }
);

// Delete admin
export const deleteAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const admin = await User.findOneAndDelete({
      _id: req.params.id,
      role: "admin",
    });

    if (!admin) {
      return next(new AppError("Admin not found", 404));
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

    const admin = await User.findOne({ _id: req.params.id, role: "admin" });

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
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return next(new AppError("Password must be at least 8 characters", 400));
    }

    const admin = await User.findOne({ _id: req.params.id, role: "admin" });

    if (!admin) {
      return next(new AppError("Admin not found", 404));
    }

    admin.password = newPassword;
    admin.passwordChangedAt = new Date();
    await admin.save();

    // Send password reset notification
    await emailService.sendEmail(
      admin.email,
      "Your Password Has Been Reset",
      `Hello ${admin.firstName},\n\nYour password has been reset by a super admin. Please login with your new password.`
    );

    res.status(200).json({
      status: "success",
      message: "Password reset successfully",
    });
  }
);
