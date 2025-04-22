import type { Request, Response, NextFunction } from "express"
import { StatusCodes } from "http-status-codes"
import User from "../models/userModel"
import { AppError } from "../utils/appError"
import { asyncHandler } from "../utils/asyncHandler"
import { uploadToCloudinary } from "../services/cloudinaryService"

// Update user profile
export const updateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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
  )

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
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await User.find().select("-password -refreshToken")

  res.status(StatusCodes.OK).json({
    success: true,
    count: users.length,
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

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      firstName,
      lastName,
      email,
      role,
      isActive,
      isEmailVerified,
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
