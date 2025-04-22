import type { Request, Response, NextFunction } from "express"
import { StatusCodes } from "http-status-codes"
import { AppError } from "../utils/appError"
import { asyncHandler } from "../utils/asyncHandler"
import notificationService from "../services/notificationService"
import mongoose from "mongoose"

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
export const getUserNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  const userId = req.user._id
  const { page = "1", limit = "10", unread = "false" } = req.query

  const pageNum = Number.parseInt(page as string, 10)
  const limitNum = Number.parseInt(limit as string, 10)
  const onlyUnread = unread === "true"

  const { notifications, total, unreadCount } = await notificationService.getUserNotifications(
    userId.toString(),
    pageNum,
    limitNum,
    onlyUnread,
  )

  res.status(StatusCodes.OK).json({
    success: true,
    count: notifications.length,
    total,
    unreadCount,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    notifications,
  })
})

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  const { id } = req.params
  const userId = req.user._id

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid notification ID", StatusCodes.BAD_REQUEST))
  }

  await notificationService.markAsRead(id, userId.toString())

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Notification marked as read",
  })
})

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  const userId = req.user._id

  await notificationService.markAllAsRead(userId.toString())

  res.status(StatusCodes.OK).json({
    success: true,
    message: "All notifications marked as read",
  })
})

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
export const deleteNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  const { id } = req.params
  const userId = req.user._id

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid notification ID", StatusCodes.BAD_REQUEST))
  }

  await notificationService.deleteNotification(id, userId.toString())

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Notification deleted",
  })
})
