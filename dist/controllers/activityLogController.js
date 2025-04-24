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
exports.getActivityStats = exports.getEntityActivityLogs = exports.getAllActivityLogs = exports.getUserActivityLogs = exports.logActivity = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const http_status_codes_1 = require("http-status-codes");
const appError_1 = require("../utils/appError");
const activityLogModel_1 = __importDefault(require("../models/activityLogModel"));
// Log activity (internal function)
const logActivity = (data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield activityLogModel_1.default.create({
            user: data.user,
            action: data.action,
            entity: data.entity,
            entityId: data.entityId,
            details: data.details,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            createdAt: new Date(),
        });
    }
    catch (error) {
        console.error("Error logging activity:", error);
    }
});
exports.logActivity = logActivity;
// Get user activity logs
exports.getUserActivityLogs = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.params.userId || req.user.id;
    const { page = 1, limit = 20, action, entity } = req.query;
    // Check if user is authorized to view these logs
    if (userId !== req.user.id && req.user.role !== "admin") {
        return next(new appError_1.AppError("You are not authorized to view these logs", 403));
    }
    const filter = { user: userId };
    if (action)
        filter.action = action;
    if (entity)
        filter.entity = entity;
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = yield Promise.all([
        activityLogModel_1.default.find(filter).sort("-createdAt").skip(skip).limit(Number(limit)).populate("user", "name email"),
        activityLogModel_1.default.countDocuments(filter),
    ]);
    res.status(200).json({
        status: "success",
        results: logs.length,
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        data: logs,
    });
}));
// Get all activity logs (admin only)
exports.getAllActivityLogs = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = 1, limit = 20, action, entity, userId, startDate, endDate } = req.query;
    const filter = {};
    if (action)
        filter.action = action;
    if (entity)
        filter.entity = entity;
    if (userId)
        filter.user = userId;
    if (startDate) {
        filter.createdAt = { $gte: new Date(startDate) };
    }
    if (endDate) {
        if (filter.createdAt) {
            filter.createdAt.$lte = new Date(endDate);
        }
        else {
            filter.createdAt = { $lte: new Date(endDate) };
        }
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = yield Promise.all([
        activityLogModel_1.default.find(filter).sort("-createdAt").skip(skip).limit(Number(limit)).populate("user", "name email"),
        activityLogModel_1.default.countDocuments(filter),
    ]);
    res.status(200).json({
        status: "success",
        results: logs.length,
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        data: logs,
    });
}));
// Get entity activity logs
exports.getEntityActivityLogs = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { entity, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const filter = { entity, entityId };
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = yield Promise.all([
        activityLogModel_1.default.find(filter).sort("-createdAt").skip(skip).limit(Number(limit)).populate("user", "name email"),
        activityLogModel_1.default.countDocuments(filter),
    ]);
    res.status(200).json({
        status: "success",
        results: logs.length,
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        data: logs,
    });
}));
// Get activity statistics (admin only)
exports.getActivityStats = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { period = "day", startDate, endDate } = req.query;
    let dateFilter = {};
    let groupBy = {};
    // Set date filter
    if (startDate && endDate) {
        dateFilter = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };
    }
    else {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        dateFilter = { $gte: thirtyDaysAgo };
    }
    // Set group by based on period
    if (period === "hour") {
        groupBy = {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
            hour: { $hour: "$createdAt" },
        };
    }
    else if (period === "day") {
        groupBy = {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
        };
    }
    else if (period === "month") {
        groupBy = {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
        };
    }
    else {
        return next(new appError_1.AppError("Invalid period. Use hour, day, or month", 400));
    }
    // Get activity counts by time period
    const activityByTime = yield activityLogModel_1.default.aggregate([
        { $match: { createdAt: dateFilter } },
        {
            $group: {
                _id: groupBy,
                count: { $sum: 1 },
            },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } },
    ]);
    // Get activity counts by action
    const activityByAction = yield activityLogModel_1.default.aggregate([
        { $match: { createdAt: dateFilter } },
        {
            $group: {
                _id: "$action",
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
    ]);
    // Get activity counts by entity
    const activityByEntity = yield activityLogModel_1.default.aggregate([
        { $match: { createdAt: dateFilter } },
        {
            $group: {
                _id: "$entity",
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
    ]);
    // Get top users by activity
    const topUsers = yield activityLogModel_1.default.aggregate([
        { $match: { createdAt: dateFilter } },
        {
            $group: {
                _id: "$user",
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "userDetails",
            },
        },
        { $unwind: "$userDetails" },
        {
            $project: {
                _id: 0,
                userId: "$_id",
                name: "$userDetails.name",
                email: "$userDetails.email",
                count: 1,
            },
        },
    ]);
    res.status(200).json({
        status: "success",
        data: {
            byTime: activityByTime,
            byAction: activityByAction,
            byEntity: activityByEntity,
            topUsers,
        },
    });
}));
//# sourceMappingURL=activityLogController.js.map