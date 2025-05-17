import type { Request, Response, NextFunction } from "express"
import asyncHandler from "../utils/asyncHandler"
import User from "../models/userModel"
import Property from "../models/propertyModel"
import {Referral} from "../models/referralModel"
import { Wallet } from "../models/walletModel";
import { MarketplaceListing } from "../models/marketplaceModel";
import UserInvestment from "../models/userInvestmentModel"

// Get user dashboard data
export const getUserDashboard = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(400).json({ status: "fail", message: "User not authenticated" });
  }
  const userId = req.user.id;

  // Get user wallet
  const wallet = await Wallet.findOne({ user: userId })

  // Get user investments
  const investments = await UserInvestment.find({ user: userId })
    .populate("property", "title location images")
    .sort({ createdAt: -1 })
    .limit(5);

  // Get total investment amount
  const totalInvestment = investments.reduce((sum: any, inv: any) => sum + inv.amount, 0)

  // Get recent transactions
  const recentTransactions = wallet
    ? wallet.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
    : []

  // Get user properties
  const properties = await Property.find({ owner: userId }).sort({ createdAt: -1 }).limit(5)

  // Get user marketplace listings
  const marketplaceListings = await MarketplaceListing.find({ seller: userId })
    .populate("property", "title location images")
    .sort({ createdAt: -1 })
    .limit(5);

  // Get user referrals if user is an agent
  const user = await User.findById(userId)
  let referrals: Array<{ referred: { name: string; email: string }; commission?: number; createdAt: Date }> = []

  if (user && user.role === "agent") {
    referrals = await Referral.find({ referrer: userId })
      .populate<{ referred: { name: string; email: string } }>("referred", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
  }

  res.status(200).json({
    status: "success",
    data: {
      walletBalance: wallet ? wallet.balance : 0,
      totalInvestment,
      recentTransactions,
      investments,
      properties,
      marketplaceListings,
      referrals,
    },
  })
})

// Get agent dashboard data
export const getAgentDashboard = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(400).json({ status: "fail", message: "User not authenticated" });
  }
  const userId = req.user.id;

  // Get agent wallet
  const wallet = await Wallet.findOne({ user: userId })

  // Get agent properties
  const properties = await Property.find({ owner: userId }).sort({ createdAt: -1 })

  // Get agent marketplace listings
  const marketplaceListings = await MarketplaceListing.find({ seller: userId })
    .populate("property", "title location images")
    .sort({ createdAt: -1 });

  // Get agent referrals
  const referrals = await Referral.find({ referrer: userId }).populate("referred", "name email").sort({ createdAt: -1 })

  // Calculate total commission earned
  const totalCommission = referrals.reduce((sum, ref) => sum + (ref.get('commission') || 0), 0)

  // Get recent transactions
  const recentTransactions = wallet
    ? wallet.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
    : []

  // Calculate monthly referral stats
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()

  const monthlyReferrals = Array(12).fill(0)
  const monthlyCommission = Array(12).fill(0)

  referrals.forEach((ref) => {
    const refDate = new Date(ref.createdAt)
    if (refDate.getFullYear() === currentYear) {
      const month = refDate.getMonth()
      monthlyReferrals[month]++
      monthlyCommission[month] += (ref as any).commission || 0
    }
  })

  res.status(200).json({
    status: "success",
    data: {
      walletBalance: wallet ? wallet.balance : 0,
      totalProperties: properties.length,
      totalListings: marketplaceListings.length,
      totalReferrals: referrals.length,
      totalCommission,
      recentTransactions,
      properties: properties.slice(0, 5),
      marketplaceListings: marketplaceListings.slice(0, 5),
      recentReferrals: referrals.slice(0, 5),
      monthlyReferrals,
      monthlyCommission,
      currentMonthReferrals: monthlyReferrals[currentMonth],
      currentMonthCommission: monthlyCommission[currentMonth],
    },
  })
})

// Get admin dashboard data
export const getAdminDashboard = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Get counts
  const totalUsers = await User.countDocuments()
  const totalProperties = await Property.countDocuments()
  const totalInvestments = await UserInvestment.countDocuments();
  const activeListings = await MarketplaceListing.countDocuments({
    status: "active",
  });

  // Get user counts by role
  const buyerCount = await User.countDocuments({ role: "buyer" })
  const agentCount = await User.countDocuments({ role: "agent" })
  const adminCount = await User.countDocuments({ role: "admin" })

  // Get pending approvals
  const pendingProperties = await Property.countDocuments({ status: "pending" })
  const pendingInvestments = await UserInvestment.countDocuments({
    status: "pending",
  });
  const pendingMarketplace = await MarketplaceListing.countDocuments({
    status: "pending",
  });

  // Get total investment amount
  const investments = await UserInvestment.find();
  const totalInvestmentAmount = investments.reduce((sum: any, inv: any) => sum + inv.amount, 0)

  // Get recent users
  const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select("name email role createdAt")

  // Get recent properties
  const recentProperties = await Property.find().sort({ createdAt: -1 }).limit(5).populate("owner", "name email")

  // Get recent investments
  const recentInvestments = await UserInvestment.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("user", "name email")
    .populate("property", "title");

  // Calculate monthly stats for current year
  const currentYear = new Date().getFullYear()

  // Monthly user registrations
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

  const monthlyUsers = Array(12).fill(0)
  userGrowth.forEach((item) => {
    monthlyUsers[item._id - 1] = item.count
  })

  // Monthly investments
  const investmentGrowth = await UserInvestment.aggregate([
    { $match: { $expr: { $eq: [{ $year: "$createdAt" }, currentYear] } } },
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const monthlyInvestments = Array(12).fill(0)
  const monthlyInvestmentAmounts = Array(12).fill(0)

  investmentGrowth.forEach((item: any) => {
    monthlyInvestments[item._id - 1] = item.count
    monthlyInvestmentAmounts[item._id - 1] = item.amount
  })

  res.status(200).json({
    status: "success",
    data: {
      totalUsers,
      totalProperties,
      totalInvestments,
      totalInvestmentAmount,
      activeListings,
      usersByRole: {
        buyers: buyerCount,
        agents: agentCount,
        admins: adminCount,
      },
      pendingApprovals: {
        properties: pendingProperties,
        investments: pendingInvestments,
        marketplace: pendingMarketplace,
        total: pendingProperties + pendingInvestments + pendingMarketplace,
      },
      recentUsers,
      recentProperties,
      recentInvestments,
      monthlyUsers,
      monthlyInvestments,
      monthlyInvestmentAmounts,
    },
  })
})
