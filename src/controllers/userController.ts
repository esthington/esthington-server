import type { Request, Response, NextFunction } from "express"
import { StatusCodes } from "http-status-codes"
import User from "../models/userModel"
import { AppError } from "../utils/appError"
import { asyncHandler } from "../utils/asyncHandler"
import { uploadToCloudinary } from "../services/cloudinaryService"

// Define a custom interface that extends Request to include the file property
interface RequestWithFile extends Request {
  file?: any // Use 'any' instead of Express.Multer.File
}

// Update user profile
export const updateProfile = asyncHandler(async (req: RequestWithFile, res: Response, next: NextFunction) => {
  const { firstName, lastName, email, phone, address } = req.body

  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  const userId = req.user._id

  // Check if email is already taken
  if (email && email !== req.user.email) {
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return next(new AppError("Email already in use", StatusCodes.BAD_REQUEST))
    }
  }

  // Upload profile image if provided
  let profileImage = req.user.profileImage
  if (req.file) {
    const result = await uploadToCloudinary(req.file.path)
    profileImage = result.secure_url
  }

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      firstName: firstName || req.user.firstName,
      lastName: lastName || req.user.lastName,
      email: email || req.user.email,
      phone: phone || req.user.phone,
      address: address || req.user.address,
      profileImage,
    },
    { new: true, runValidators: true },
  ).select("-password -refreshToken")

  if (!updatedUser) {
    return next(new AppError("User not found or could not be updated", StatusCodes.NOT_FOUND))
  }

  res.status(StatusCodes.OK).json({
    success: true,
    user: updatedUser,
  })
})

// Change password
export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { currentPassword, newPassword } = req.body

  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  const userId = req.user._id

  // Get user with password
  const user = await User.findById(userId).select("+password")
  if (!user) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND))
  }

  // Check if current password is correct
  const isMatch = await user.comparePassword(currentPassword)
  if (!isMatch) {
    return next(new AppError("Current password is incorrect", StatusCodes.BAD_REQUEST))
  }

  // Update password
  user.password = newPassword
  await user.save()

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Password updated successfully",
  })
})

// Delete account
export const deleteAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED))
  }

  const userId = req.user._id

  // Delete user
  const deletedUser = await User.findByIdAndDelete(userId)
  if (!deletedUser) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND))
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Account deleted successfully",
  })
})

// Admin: Get all users
export const getUsers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { search, role, status, sort = "-createdAt", page = 1, limit = 10 } = req.query

  // Build query
  const query: any = { role: { $nin: ["admin", "super_admin"] } }

  // Search filter
  if (search) {
    const searchRegex = new RegExp(String(search), "i")
    query.$or = [{ firstName: searchRegex }, { lastName: searchRegex }, { email: searchRegex }]
  }

  // Role filter
  if (role && role !== "all") {
    query.role = role
  }

  // Status filter
  if (status === "active") {
    query.isActive = true
  } else if (status === "inactive") {
    query.isActive = false
  }

  // Count total documents
  const totalUsers = await User.countDocuments(query)

  // Calculate pagination
  const pageNum = Number(page)
  const limitNum = Number(limit)
  const skip = (pageNum - 1) * limitNum

  // Execute query with pagination and sorting
  const users = await User.find(query).select("-password -refreshToken").sort(sort as string).skip(skip).limit(limitNum)

  res.status(StatusCodes.OK).json({
    success: true,
    count: users.length,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limitNum),
    currentPage: pageNum,
    users,
  })
})

// Admin: Get user by ID
export const getUserById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  const user = await User.findById(id).select("-password -refreshToken")
  if (!user) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND))
  }

  res.status(StatusCodes.OK).json({
    success: true,
    user,
  })
})

// Admin: Update user
export const updateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { firstName, lastName, email, role, isActive, isEmailVerified } = req.body

  // Check if email is already taken
  if (email) {
    const existingUser = await User.findOne({ email, _id: { $ne: id } })
    if (existingUser) {
      return next(new AppError("Email already in use", StatusCodes.BAD_REQUEST))
    }
  }

  const user = await User.findById(id).select("-password -refreshToken");

  if (!user) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND));
  }

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      firstName: firstName || (req.user ? req.user.firstName : undefined),
      lastName: lastName || (req.user ? req.user.lastName : undefined),
      email: email || (req.user ? req.user.email : undefined),
      role: role || (req.user ? req.user.role : undefined),
      isActive: typeof isActive !== "undefined" ? isActive : (req.user ? req.user.isActive : undefined),
      isEmailVerified: typeof isEmailVerified !== "undefined" ? isEmailVerified : (req.user ? req.user.isEmailVerified : undefined),
    },
    { new: true, runValidators: true },
  ).select("-password -refreshToken")

  if (!updatedUser) {
    return next(new AppError("User not found or could not be updated", StatusCodes.NOT_FOUND))
  }

  res.status(StatusCodes.OK).json({
    success: true,
    user: updatedUser,
  })
})

// Admin: Delete user
export const deleteUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  // Delete user
  const deletedUser = await User.findByIdAndDelete(id)
  if (!deletedUser) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND))
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "User deleted successfully",
  })
})

// Admin: Blacklist user
export const blacklistUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select("-password -refreshToken")

  if (!user) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND))
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "User has been blacklisted",
    user,
  })
})

// Admin: Unblacklist user
export const unblacklistUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  const user = await User.findByIdAndUpdate(id, { isActive: true }, { new: true }).select("-password -refreshToken")

  if (!user) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND))
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "User has been removed from blacklist",
    user,
  })
})

// Admin: Get all admins
export const getAdmins = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const admins = await User.find({
    role: { $in: ["admin", "super_admin"] },
  }).select("-password -refreshToken")

  res.status(StatusCodes.OK).json({
    success: true,
    count: admins.length,
    admins,
  })
})

// Admin: Get admin by ID
export const getAdminById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  const admin = await User.findOne({
    _id: id,
    role: { $in: ["admin", "super_admin"] },
  }).select("-password -refreshToken")

  if (!admin) {
    return next(new AppError("Admin not found", StatusCodes.NOT_FOUND))
  }

  res.status(StatusCodes.OK).json({
    success: true,
    admin,
  })
})

// Admin: Add new admin
export const addAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { firstName, lastName, email, password, role } = req.body

  // Check if user is super_admin
  if (!req.user || req.user.role !== "super_admin") {
    return next(new AppError("Only super admins can add administrators", StatusCodes.FORBIDDEN))
  }

  // Check if email already exists
  const existingUser = await User.findOne({ email })
  if (existingUser) {
    return next(new AppError("Email already in use", StatusCodes.BAD_REQUEST))
  }

  // Create new admin
  const admin = await User.create({
    firstName,
    lastName,
    email,
    password,
    role: role || "admin",
    isEmailVerified: true, // Admins are automatically verified
    isActive: true,
  })

  // Remove sensitive data
  const adminData = await User.findById(admin._id).select("-password -refreshToken")

  res.status(StatusCodes.CREATED).json({
    success: true,
    admin: adminData,
  })
})

// Admin: Update admin
export const updateAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { firstName, lastName, email, role } = req.body

  // Check if user is super_admin
  if (!req.user || req.user.role !== "super_admin") {
    return next(new AppError("Only super admins can update administrators", StatusCodes.FORBIDDEN))
  }

  // Check if admin exists
  const admin = await User.findById(id)
  if (!admin) {
    return next(new AppError("Administrator not found", StatusCodes.NOT_FOUND))
  }

  // Check if trying to update a super_admin (only super_admin can update super_admin)
  if (admin.role === "super_admin" && req.user.role !== "super_admin") {
    return next(new AppError("You do not have permission to update a super admin", StatusCodes.FORBIDDEN))
  }

  // Check if email already exists
  if (email && email !== admin.email) {
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return next(new AppError("Email already in use", StatusCodes.BAD_REQUEST))
    }
  }

  // Update admin
  const updatedAdmin = await User.findByIdAndUpdate(
    id,
    {
      firstName: firstName || admin.firstName,
      lastName: lastName || admin.lastName,
      email: email || admin.email,
      role: role || admin.role,
    },
    { new: true, runValidators: true },
  ).select("-password -refreshToken")

  res.status(StatusCodes.OK).json({
    success: true,
    admin: updatedAdmin,
  })
})

// Admin: Delete admin
export const deleteAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  // Check if user is super_admin
  if (!req.user || req.user.role !== "super_admin") {
    return next(new AppError("Only super admins can delete administrators", StatusCodes.FORBIDDEN))
  }

  // Check if admin exists
  const admin = await User.findById(id)
  if (!admin) {
    return next(new AppError("Administrator not found", StatusCodes.NOT_FOUND))
  }

  // Check if trying to delete a super_admin
  if (admin.role === "super_admin") {
    return next(new AppError("Super admins cannot be deleted through this endpoint", StatusCodes.FORBIDDEN))
  }

  // Delete admin
  await User.findByIdAndDelete(id)

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Administrator deleted successfully",
  })
})

// Admin: Suspend admin
export const suspendAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  // Check if user is super_admin
  if (!req.user || req.user.role !== "super_admin") {
    return next(new AppError("Only super admins can suspend administrators", StatusCodes.FORBIDDEN))
  }

  // Check if admin exists
  const admin = await User.findById(id)
  if (!admin) {
    return next(new AppError("Administrator not found", StatusCodes.NOT_FOUND))
  }

  // Check if trying to suspend a super_admin
  if (admin.role === "super_admin") {
    return next(new AppError("Super admins cannot be suspended", StatusCodes.FORBIDDEN))
  }

  // Suspend admin
  const suspendedAdmin = await User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select(
    "-password -refreshToken",
  )

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Administrator suspended successfully",
    admin: suspendedAdmin,
  })
})

// Admin: Activate admin
export const activateAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  // Check if user is super_admin
  if (!req.user || req.user.role !== "super_admin") {
    return next(new AppError("Only super admins can activate administrators", StatusCodes.FORBIDDEN))
  }

  // Check if admin exists
  const admin = await User.findById(id)
  if (!admin) {
    return next(new AppError("Administrator not found", StatusCodes.NOT_FOUND))
  }

  // Activate admin
  const activatedAdmin = await User.findByIdAndUpdate(id, { isActive: true }, { new: true }).select(
    "-password -refreshToken",
  )

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Administrator activated successfully",
    admin: activatedAdmin,
  })
})

// Admin: Reset user password
export const resetUserPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params

  // Check if user has admin privileges
  if (!req.user || !["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Only administrators can reset user passwords", StatusCodes.FORBIDDEN))
  }

  // Check if user exists
  const user = await User.findById(id)
  if (!user) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND))
  }

  // Check if admin is trying to reset super_admin password
  if (user.role === "super_admin" && req.user.role !== "super_admin") {
    return next(new AppError("Only super admins can reset super admin passwords", StatusCodes.FORBIDDEN))
  }

  // Generate temporary password
  const tempPassword = generateRandomPassword(10)

  // Update user password
  user.password = tempPassword
  await user.save()

  // In production, you would send this password via email
  // For now, we'll return it in the response
  res.status(StatusCodes.OK).json({
    success: true,
    message: "User password has been reset",
    tempPassword,
  })
})

// Admin: Get user statistics
export const getUserStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Check if user has admin privileges
  if (!req.user || !["admin", "super_admin"].includes(req.user.role)) {
    return next(new AppError("Only administrators can access user statistics", StatusCodes.FORBIDDEN))
  }

  // Basic counts
  const totalUsers = await User.countDocuments({
    role: { $nin: ["admin", "super_admin"] },
  })

  const activeUsers = await User.countDocuments({
    role: { $nin: ["admin", "super_admin"] },
    isActive: true,
  })

  const inactiveUsers = await User.countDocuments({
    role: { $nin: ["admin", "super_admin"] },
    isActive: false,
  })

  const verifiedUsers = await User.countDocuments({
    role: { $nin: ["admin", "super_admin"] },
    isEmailVerified: true,
  })

  // New users in the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const newUsers = await User.countDocuments({
    role: { $nin: ["admin", "super_admin"] },
    createdAt: { $gte: thirtyDaysAgo },
  })

  // User registration trends (last 6 months)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const registrationTrends = await User.aggregate([
    {
      $match: {
        role: { $nin: ["admin", "super_admin"] },
        createdAt: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
    {
      $project: {
        _id: 0,
        date: {
          $concat: [
            { $toString: "$_id.year" },
            "-",
            {
              $cond: {
                if: { $lt: ["$_id.month", 10] },
                then: { $concat: ["0", { $toString: "$_id.month" }] },
                else: { $toString: "$_id.month" },
              },
            },
          ],
        },
        count: 1,
      },
    },
  ])

  // Role distribution
  const roleDistribution = await User.aggregate([
    {
      $match: {
        role: { $nin: ["admin", "super_admin"] },
      },
    },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        role: "$_id",
        count: 1,
      },
    },
  ])

  res.status(StatusCodes.OK).json({
    success: true,
    stats: {
      totalUsers,
      activeUsers,
      inactiveUsers,
      verifiedUsers,
      newUsers,
      registrationTrends,
      roleDistribution,
    },
  })
})

function generateRandomPassword(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

