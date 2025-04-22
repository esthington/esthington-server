import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import Setting from "../models/settingModel";
import { StatusCodes } from "http-status-codes";

// Get all public settings
export const getPublicSettings = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const settings = await Setting.find({ isPublic: true });

    // Transform to key-value object
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    res.status(200).json({
      status: "success",
      data: settingsObject,
    });
  }
);

// Get all settings (admin only)
export const getAllSettings = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { category } = req.query;

    const filter: any = {};
    if (category) filter.category = category;

    const settings = await Setting.find(filter).sort("category key");

    res.status(200).json({
      status: "success",
      results: settings.length,
      data: settings,
    });
  }
);

// Get setting by key
export const getSettingByKey = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { key } = req.params;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    const setting = await Setting.findOne({ key });

    if (!setting) {
      return next(new AppError("Setting not found", 404));
    }

    // Check if setting is public or user is admin
    if (!setting.isPublic && req.user.role !== "admin") {
      return next(
        new AppError("You are not authorized to access this setting", 403)
      );
    }

    res.status(200).json({
      status: "success",
      data: setting,
    });
  }
);

// Update setting (admin only)
export const updateSetting = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { key } = req.params;
    const { value, isPublic, description } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;

    const adminId = req.user.id;

    if (value === undefined) {
      return next(new AppError("Value is required", 400));
    }

    const setting = await Setting.findOne({ key });

    if (!setting) {
      return next(new AppError("Setting not found", 404));
    }

    // Update setting
    setting.value = value;
    if (isPublic !== undefined) setting.isPublic = isPublic;
    if (description) setting.description = description;
    setting.updatedBy = adminId;
    setting.updatedAt = new Date();

    await setting.save();

    res.status(200).json({
      status: "success",
      message: "Setting updated successfully",
      data: setting,
    });
  }
);

// Create setting (admin only)
export const createSetting = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { key, value, category, description, isPublic } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const adminId = req.user.id;

    // Validate required fields
    if (!key || value === undefined || !category || !description) {
      return next(new AppError("Please provide all required fields", 400));
    }

    // Check if setting already exists
    const existingSetting = await Setting.findOne({ key });

    if (existingSetting) {
      return next(new AppError("Setting with this key already exists", 400));
    }

    // Create setting
    const setting = await Setting.create({
      key,
      value,
      category,
      description,
      isPublic: isPublic || false,
      updatedBy: adminId,
      updatedAt: new Date(),
    });

    res.status(201).json({
      status: "success",
      message: "Setting created successfully",
      data: setting,
    });
  }
);

// Delete setting (admin only)
export const deleteSetting = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { key } = req.params;

    const setting = await Setting.findOne({ key });

    if (!setting) {
      return next(new AppError("Setting not found", 404));
    }

    await setting.deleteOne();

    res.status(200).json({
      status: "success",
      message: "Setting deleted successfully",
    });
  }
);

// Get feature flags
export const getFeatureFlags = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const settings = await Setting.find({
      category: "feature_flag",
      isPublic: true,
    });

    // Transform to key-value object
    const featureFlags = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, boolean>);

    res.status(200).json({
      status: "success",
      data: featureFlags,
    });
  }
);

// Update feature flags (admin only)
export const updateFeatureFlags = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { flags } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const adminId = req.user.id;

    if (!flags || typeof flags !== "object") {
      return next(new AppError("Invalid feature flags", 400));
    }

    const updates = Object.entries(flags).map(async ([key, value]) => {
      // Find or create the feature flag
      const flag = await Setting.findOne({ key, category: "feature_flag" });

      if (flag) {
        flag.value = value;
        flag.updatedBy = adminId;
        flag.updatedAt = new Date();
        return flag.save();
      } else {
        return Setting.create({
          key,
          value,
          category: "feature_flag",
          description: `Feature flag for ${key}`,
          isPublic: true,
          updatedBy: adminId,
          updatedAt: new Date(),
        });
      }
    });

    await Promise.all(updates);

    res.status(200).json({
      status: "success",
      message: "Feature flags updated successfully",
    });
  }
);
