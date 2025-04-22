import type { Request, Response, NextFunction } from "express"
import asyncHandler from "../utils/asyncHandler"
import AppError from "../utils/appError"
import User from "../models/userModel"
import Property from "../models/propertyModel"
import {Referral} from "../models/referralModel"
import { Wallet } from "../models/walletModel";
import { MarketplaceListing } from "../models/marketplaceModel";
import { UserInvestment } from "../models/investmentModel";

// Get summary statistics for admin dashboard
export const getDashboardStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const totalUsers = await User.countDocuments()
  const totalProperties = await Property.countDocuments()
  const totalInvestments = await UserInvestment.countDocuments();

  // Get total investment amount
  const investments = await UserInvestment.find();
  const totalInvestmentAmount = investments.reduce((sum, inv) => sum + inv.amount, 0)

  // Get total wallet balance
  const wallets = await Wallet.find()
  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0)

  // Get active marketplace listings
  const activeListings = await MarketplaceListing.countDocuments({
    status: "active",
  });

  // Get total referrals
  const totalReferrals = await Referral.countDocuments()

  res.status(200).json({
    status: "success",
    data: {
      totalUsers,
      totalProperties,
      totalInvestments,
      totalInvestmentAmount,
      totalWalletBalance,
      activeListings,
      totalReferrals,
    },
  })
})

// Get detailed reports for specific time periods
export const getDetailedReports = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { startDate, endDate, reportType } = req.query

  if (!startDate || !endDate) {
    return next(new AppError("Please provide start and end dates", 400))
  }

  const start = new Date(startDate as string)
  const end = new Date(endDate as string)

  let reportData

  switch (reportType) {
    case "investments":
      reportData = await UserInvestment.find({
        createdAt: { $gte: start, $lte: end },
      }).populate("user", "name email");
      break

    case "properties":
      reportData = await Property.find({
        createdAt: { $gte: start, $lte: end },
      })
      break

    case "users":
      reportData = await User.find({
        createdAt: { $gte: start, $lte: end },
      }).select("name email role createdAt")
      break

    case "transactions":
      reportData = await Wallet.aggregate([
        { $unwind: "$transactions" },
        { $match: { "transactions.date": { $gte: start, $lte: end } } },
        {
          $project: {
            userId: "$user",
            transaction: "$transactions",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: "$userDetails" },
        {
          $project: {
            _id: 0,
            userName: "$userDetails.name",
            userEmail: "$userDetails.email",
            type: "$transaction.type",
            amount: "$transaction.amount",
            date: "$transaction.date",
            status: "$transaction.status",
            description: "$transaction.description",
          },
        },
      ])
      break

    case "referrals":
      reportData = await Referral.find({
        createdAt: { $gte: start, $lte: end },
      })
        .populate("referrer", "name email")
        .populate("referred", "name email")
      break

    default:
      return next(new AppError("Invalid report type", 400))
  }

  res.status(200).json({
    status: "success",
    data: reportData,
  })
})

// Generate monthly revenue report
export const getRevenueReport = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { year } = req.query

  const currentYear = year ? Number.parseInt(year as string) : new Date().getFullYear()

  const monthlyRevenue = await Wallet.aggregate([
    { $unwind: "$transactions" },
    {
      $match: {
        "transactions.type": "deposit",
        "transactions.status": "completed",
        $expr: { $eq: [{ $year: "$transactions.date" }, currentYear] },
      },
    },
    {
      $group: {
        _id: { $month: "$transactions.date" },
        total: { $sum: "$transactions.amount" },
      },
    },
    { $sort: { _id: 1 } },
  ])

  // Format the result to include all months
  const formattedRevenue = Array(12).fill(0)
  monthlyRevenue.forEach((item) => {
    formattedRevenue[item._id - 1] = item.total
  })

  res.status(200).json({
    status: "success",
    data: {
      year: currentYear,
      monthlyRevenue: formattedRevenue,
    },
  })
})

// Get user growth report
export const getUserGrowthReport = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { year } = req.query

  const currentYear = year ? Number.parseInt(year as string) : new Date().getFullYear()

  const userGrowth = await User.aggregate([
    { $match: { $expr: { $eq: [{ $year: "$createdAt" }, currentYear] } } },
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  // Format the result to include all months
  const formattedGrowth = Array(12).fill(0)
  userGrowth.forEach((item) => {
    formattedGrowth[item._id - 1] = item.count
  })

  res.status(200).json({
    status: "success",
    data: {
      year: currentYear,
      monthlyGrowth: formattedGrowth,
    },
  })
})
