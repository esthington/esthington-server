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
const notificationModel_1 = __importDefault(require("../models/notificationModel"));
const emailService_1 = __importDefault(require("./emailService"));
const userModel_1 = __importDefault(require("../models/userModel"));
const logger_1 = __importDefault(require("../utils/logger"));
class NotificationService {
    /**
     * Create a notification
     * @param userId User ID
     * @param title Notification title
     * @param message Notification message
     * @param type Notification type
     * @param link Optional link
     * @param metadata Optional metadata
     * @param sendEmail Whether to send an email notification
     */
    createNotification(userId_1, title_1, message_1, type_1, link_1, metadata_1) {
        return __awaiter(this, arguments, void 0, function* (userId, title, message, type, link, metadata, sendEmail = false) {
            try {
                // Create in-app notification
                yield notificationModel_1.default.create({
                    user: userId,
                    title,
                    message,
                    type,
                    link,
                    metadata,
                });
                // Send email notification if requested
                if (sendEmail) {
                    const user = yield userModel_1.default.findById(userId);
                    if (user) {
                        yield emailService_1.default.sendEmail(user.email, title, `<h1>${title}</h1><p>${message}</p><p>Please check your dashboard for more details.</p>`);
                    }
                }
            }
            catch (error) {
                logger_1.default.error(`Failed to create notification: ${error instanceof Error ? error.message : "Unknown error"}`);
                // Don't throw error to prevent transaction failures
            }
        });
    }
    /**
     * Mark notification as read
     * @param notificationId Notification ID
     * @param userId User ID
     */
    markAsRead(notificationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield notificationModel_1.default.findOneAndUpdate({ _id: notificationId, user: userId }, { isRead: true });
        });
    }
    /**
     * Mark all notifications as read for a user
     * @param userId User ID
     */
    markAllAsRead(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield notificationModel_1.default.updateMany({ user: userId, isRead: false }, { isRead: true });
        });
    }
    /**
     * Delete a notification
     * @param notificationId Notification ID
     * @param userId User ID
     */
    deleteNotification(notificationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield notificationModel_1.default.findOneAndDelete({ _id: notificationId, user: userId });
        });
    }
    /**
     * Get user notifications with pagination
     * @param userId User ID
     * @param page Page number
     * @param limit Items per page
     * @param onlyUnread Get only unread notifications
     */
    getUserNotifications(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 10, onlyUnread = false) {
            const query = { user: userId };
            if (onlyUnread) {
                query.isRead = false;
            }
            const skip = (page - 1) * limit;
            const [notifications, total, unreadCount] = yield Promise.all([
                notificationModel_1.default.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
                notificationModel_1.default.countDocuments(query),
                notificationModel_1.default.countDocuments({ user: userId, isRead: false }),
            ]);
            return { notifications, total, unreadCount };
        });
    }
}
exports.default = new NotificationService();
//# sourceMappingURL=notificationService.js.map