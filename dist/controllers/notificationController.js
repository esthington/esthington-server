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
exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getUserNotifications = void 0;
const http_status_codes_1 = require("http-status-codes");
const appError_1 = require("../utils/appError");
const asyncHandler_1 = require("../utils/asyncHandler");
const notificationService_1 = __importDefault(require("../services/notificationService"));
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getUserNotifications = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    const { page = "1", limit = "10", unread = "false" } = req.query;
    const pageNum = Number.parseInt(page, 10);
    const limitNum = Number.parseInt(limit, 10);
    const onlyUnread = unread === "true";
    const { notifications, total, unreadCount } = yield notificationService_1.default.getUserNotifications(userId.toString(), pageNum, limitNum, onlyUnread);
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: notifications.length,
        total,
        unreadCount,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        notifications,
    });
}));
/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const { id } = req.params;
    const userId = req.user._id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid notification ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    yield notificationService_1.default.markAsRead(id, userId.toString());
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Notification marked as read",
    });
}));
/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user._id;
    yield notificationService_1.default.markAllAsRead(userId.toString());
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "All notifications marked as read",
    });
}));
/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
exports.deleteNotification = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const { id } = req.params;
    const userId = req.user._id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid notification ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    yield notificationService_1.default.deleteNotification(id, userId.toString());
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Notification deleted",
    });
}));
//# sourceMappingURL=notificationController.js.map