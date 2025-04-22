import Notification, { type NotificationType } from "../models/notificationModel"
import emailService from "./emailService"
import User from "../models/userModel"
import logger from "../utils/logger"

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
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    link?: string,
    metadata?: Record<string, any>,
    sendEmail = false, // Changed default to false to avoid excessive emails
  ): Promise<void> {
    try {
      // Create in-app notification
      await Notification.create({
        user: userId,
        title,
        message,
        type,
        link,
        metadata,
      })

      // Send email notification if requested
      if (sendEmail) {
        const user = await User.findById(userId)
        if (user) {
          await emailService.sendEmail(
            user.email,
            title,
            `<h1>${title}</h1><p>${message}</p><p>Please check your dashboard for more details.</p>`,
          )
        }
      }
    } catch (error) {
      logger.error(`Failed to create notification: ${error instanceof Error ? error.message : "Unknown error"}`)
      // Don't throw error to prevent transaction failures
    }
  }

  /**
   * Mark notification as read
   * @param notificationId Notification ID
   * @param userId User ID
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await Notification.findOneAndUpdate({ _id: notificationId, user: userId }, { isRead: true })
  }

  /**
   * Mark all notifications as read for a user
   * @param userId User ID
   */
  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany({ user: userId, isRead: false }, { isRead: true })
  }

  /**
   * Delete a notification
   * @param notificationId Notification ID
   * @param userId User ID
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await Notification.findOneAndDelete({ _id: notificationId, user: userId })
  }

  /**
   * Get user notifications with pagination
   * @param userId User ID
   * @param page Page number
   * @param limit Items per page
   * @param onlyUnread Get only unread notifications
   */
  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 10,
    onlyUnread = false,
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    const query: any = { user: userId }

    if (onlyUnread) {
      query.isRead = false
    }

    const skip = (page - 1) * limit

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: userId, isRead: false }),
    ])

    return { notifications, total, unreadCount }
  }
}

export default new NotificationService()
