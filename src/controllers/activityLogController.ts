import type { Request, Response, NextFunction } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { StatusCodes } from "http-status-codes"
import { AppError } from "../utils/appError"

import ActivityLog from "../models/activityLogModel"

// Log activity (internal function)
export const logActivity = async (data: {
  user: string
  action: string
  entity: string
  entityId?: string
  details?: any
  ipAddress?: string
  userAgent?: string
}) => {
  try {
    await ActivityLog.create({
      user: data.user,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error("Error logging activity:", error)
  }
}

// Get user activity logs
export const getUserActivityLogs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }
  const userId = req.params.userId || req.user.id
  const { page = 1, limit = 20, action, entity } = req.query

  // Check if user is authorized to view these logs
  if (userId !== req.user.id && req.user.role !== "admin") {
    return next(new AppError("You are not authorized to view these logs", 403))
  }

  const filter: any = { user: userId }
  if (action) filter.action = action
  if (entity) filter.entity = entity

  const skip = (Number(page) - 1) * Number(limit)

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter).sort("-createdAt").skip(skip).limit(Number(limit)).populate("user", "name email"),
    ActivityLog.countDocuments(filter),
  ])

  res.status(200).json({
    status: "success",
    results: logs.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    data: logs,
  })
})

// Get all activity logs (admin only)
export const getAllActivityLogs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 20, action, entity, userId, startDate, endDate } = req.query

  const filter: any = {}
  if (action) filter.action = action
  if (entity) filter.entity = entity
  if (userId) filter.user = userId

  if (startDate) {
    filter.createdAt = { $gte: new Date(startDate as string) }
  }

  if (endDate) {
    if (filter.createdAt) {
      filter.createdAt.$lte = new Date(endDate as string)
    } else {
      filter.createdAt = { $lte: new Date(endDate as string) }
    }
  }

  const skip = (Number(page) - 1) * Number(limit)

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter).sort("-createdAt").skip(skip).limit(Number(limit)).populate("user", "name email"),
    ActivityLog.countDocuments(filter),
  ])

  res.status(200).json({
    status: "success",
    results: logs.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    data: logs,
  })
})

// Get entity activity logs
export const getEntityActivityLogs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { entity, entityId } = req.params
  const { page = 1, limit = 20 } = req.query

  const filter = { entity, entityId }
  const skip = (Number(page) - 1) * Number(limit)

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter).sort("-createdAt").skip(skip).limit(Number(limit)).populate("user", "name email"),
    ActivityLog.countDocuments(filter),
  ])

  res.status(200).json({
    status: "success",
    results: logs.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    data: logs,
  })
})

// Get activity statistics (admin only)
export const getActivityStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { period = "day", startDate, endDate } = req.query

  let dateFilter: any = {}
  let groupBy: any = {}

  // Set date filter
  if (startDate && endDate) {
    dateFilter = {
      $gte: new Date(startDate as string),
      $lte: new Date(endDate as string),
    }
  } else {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)
    dateFilter = { $gte: thirtyDaysAgo }
  }

  // Set group by based on period
  if (period === "hour") {
    groupBy = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
      day: { $dayOfMonth: "$createdAt" },
      hour: { $hour: "$createdAt" },
    }
  } else if (period === "day") {
    groupBy = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
      day: { $dayOfMonth: "$createdAt" },
    }
  } else if (period === "month") {
    groupBy = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
    }
  } else {
    return next(new AppError("Invalid period. Use hour, day, or month", 400))
  }

  // Get activity counts by time period
  const activityByTime = await ActivityLog.aggregate([
    { $match: { createdAt: dateFilter } },
    {
      $group: {
        _id: groupBy,
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } },
  ])

  // Get activity counts by action
  const activityByAction = await ActivityLog.aggregate([
    { $match: { createdAt: dateFilter } },
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ])

  // Get activity counts by entity
  const activityByEntity = await ActivityLog.aggregate([
    { $match: { createdAt: dateFilter } },
    {
      $group: {
        _id: "$entity",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ])

  // Get top users by activity
  const topUsers = await ActivityLog.aggregate([
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
  ])

  res.status(200).json({
    status: "success",
    data: {
      byTime: activityByTime,
      byAction: activityByAction,
      byEntity: activityByEntity,
      topUsers,
    },
  })
})
