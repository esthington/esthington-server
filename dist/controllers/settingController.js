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
exports.updateFeatureFlags = exports.getFeatureFlags = exports.deleteSetting = exports.createSetting = exports.updateSetting = exports.getSettingByKey = exports.getAllSettings = exports.getPublicSettings = void 0;
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const appError_1 = __importDefault(require("../utils/appError"));
const settingModel_1 = __importDefault(require("../models/settingModel"));
const http_status_codes_1 = require("http-status-codes");
// Get all public settings
exports.getPublicSettings = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const settings = yield settingModel_1.default.find({ isPublic: true });
    // Transform to key-value object
    const settingsObject = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
    }, {});
    res.status(200).json({
        status: "success",
        data: settingsObject,
    });
}));
// Get all settings (admin only)
exports.getAllSettings = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { category } = req.query;
    const filter = {};
    if (category)
        filter.category = category;
    const settings = yield settingModel_1.default.find(filter).sort("category key");
    res.status(200).json({
        status: "success",
        results: settings.length,
        data: settings,
    });
}));
// Get setting by key
exports.getSettingByKey = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { key } = req.params;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const setting = yield settingModel_1.default.findOne({ key });
    if (!setting) {
        return next(new appError_1.default("Setting not found", 404));
    }
    // Check if setting is public or user is admin
    if (!setting.isPublic && req.user.role !== "admin") {
        return next(new appError_1.default("You are not authorized to access this setting", 403));
    }
    res.status(200).json({
        status: "success",
        data: setting,
    });
}));
// Update setting (admin only)
exports.updateSetting = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { key } = req.params;
    const { value, isPublic, description } = req.body;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const adminId = req.user.id;
    if (value === undefined) {
        return next(new appError_1.default("Value is required", 400));
    }
    const setting = yield settingModel_1.default.findOne({ key });
    if (!setting) {
        return next(new appError_1.default("Setting not found", 404));
    }
    // Update setting
    setting.value = value;
    if (isPublic !== undefined)
        setting.isPublic = isPublic;
    if (description)
        setting.description = description;
    setting.updatedBy = adminId;
    setting.updatedAt = new Date();
    yield setting.save();
    res.status(200).json({
        status: "success",
        message: "Setting updated successfully",
        data: setting,
    });
}));
// Create setting (admin only)
exports.createSetting = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { key, value, category, description, isPublic } = req.body;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const adminId = req.user.id;
    // Validate required fields
    if (!key || value === undefined || !category || !description) {
        return next(new appError_1.default("Please provide all required fields", 400));
    }
    // Check if setting already exists
    const existingSetting = yield settingModel_1.default.findOne({ key });
    if (existingSetting) {
        return next(new appError_1.default("Setting with this key already exists", 400));
    }
    // Create setting
    const setting = yield settingModel_1.default.create({
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
}));
// Delete setting (admin only)
exports.deleteSetting = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { key } = req.params;
    const setting = yield settingModel_1.default.findOne({ key });
    if (!setting) {
        return next(new appError_1.default("Setting not found", 404));
    }
    yield setting.deleteOne();
    res.status(200).json({
        status: "success",
        message: "Setting deleted successfully",
    });
}));
// Get feature flags
exports.getFeatureFlags = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const settings = yield settingModel_1.default.find({
        category: "feature_flag",
        isPublic: true,
    });
    // Transform to key-value object
    const featureFlags = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
    }, {});
    res.status(200).json({
        status: "success",
        data: featureFlags,
    });
}));
// Update feature flags (admin only)
exports.updateFeatureFlags = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { flags } = req.body;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const adminId = req.user.id;
    if (!flags || typeof flags !== "object") {
        return next(new appError_1.default("Invalid feature flags", 400));
    }
    const updates = Object.entries(flags).map((_a) => __awaiter(void 0, [_a], void 0, function* ([key, value]) {
        // Find or create the feature flag
        const flag = yield settingModel_1.default.findOne({ key, category: "feature_flag" });
        if (flag) {
            flag.value = value;
            flag.updatedBy = adminId;
            flag.updatedAt = new Date();
            return flag.save();
        }
        else {
            return settingModel_1.default.create({
                key,
                value,
                category: "feature_flag",
                description: `Feature flag for ${key}`,
                isPublic: true,
                updatedBy: adminId,
                updatedAt: new Date(),
            });
        }
    }));
    yield Promise.all(updates);
    res.status(200).json({
        status: "success",
        message: "Feature flags updated successfully",
    });
}));
//# sourceMappingURL=settingController.js.map