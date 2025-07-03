import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  Referral,
  ReferralStatus,
  ReferralCommission,
} from "../models/referralModel";
import User, { AgentRank, type IUser } from "../models/userModel";
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from "../models/walletModel";
import { AppError } from "../utils/appError";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import config from "../config/config";

// @desc    Get user's referrals
// @route   GET /api/referrals
// @access  Private
export const getUserReferrals = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.user as IUser;

    const referrals = await Referral.find({ referrer: id })
      .sort({ createdAt: -1 })
      .populate("referrer", "firstName lastName email avatar profileImage")
      .populate("referred", "firstName lastName email avatar profileImage");

    res.status(StatusCodes.OK).json({
      success: true,
      data: referrals,
    });
  }
);

// @desc    Get referral stats
// @route   GET /api/referrals/stats
// @access  Private
export const getReferralStats = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.user as IUser;

    // Get total referrals
    const totalReferrals = await Referral.countDocuments({ referrer: id });

    // Get active referrals
    const activeReferrals = await Referral.countDocuments({
      referrer: id,
      status: ReferralStatus.ACTIVE,
    });

    // Get total earnings
    const earningsData = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(id),
          type: TransactionType.REFERRAL,
          status: TransactionStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalEarnings = earningsData.length > 0 ? earningsData[0].total : 0;

    // Get pending earnings
    const pendingEarningsData = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(id),
          type: TransactionType.REFERRAL,
          status: TransactionStatus.PENDING,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const pendingEarnings =
      pendingEarningsData.length > 0 ? pendingEarningsData[0].total : 0;

    // Calculate conversion rate
    const conversionRate =
      totalReferrals > 0
        ? Math.round((activeReferrals / totalReferrals) * 100)
        : 0;

    // Get referral link using userName instead of referralCode
    const user = await User.findById(id);
    const referralLink = user?.userName
      ? `${config.frontendUrl}/signup?ref=${user.userName}`
      : null;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        totalReferrals,
        activeReferrals,
        totalEarnings,
        pendingEarnings,
        conversionRate,
        referralLink,
      },
    });
  }
);

// @desc    Generate referral link
// @route   POST /api/referrals/generate-link
// @access  Private
export const generateReferralLink = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.user as IUser;

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }

    // Use userName as the referral code instead of generating a new one
    if (!user.userName) {
      throw new AppError(
        "User does not have a username",
        StatusCodes.BAD_REQUEST
      );
    }

    const referralLink = `${config.frontendUrl}/signup?ref=${user.userName}`;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        referralCode: user.userName,
        referralLink,
      },
    });
  }
);

// @desc    Get referral earnings
// @route   GET /api/referrals/earnings
// @access  Private
export const getReferralEarnings = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.user as IUser;
    const { startDate, endDate } = req.query;

    const query: any = {
      user: id,
      type: TransactionType.REFERRAL,
    };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const transactions = await Transaction.find(query).sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      success: true,
      data: transactions,
    });
  }
);

// @desc    Get referral commission rates
// @route   GET /api/referrals/commission-rates
// @access  Private
export const getReferralCommissionRates = asyncHandler(
  async (req: Request, res: Response) => {
    // Fetch commission rates from the database
    const commissionRates = await ReferralCommission.find().sort({ rank: 1 });

    // Format the response to match the expected structure
    const formattedRates: Record<
      string,
      { investment: number; property: number }
    > = {};

    commissionRates.forEach((rate) => {
      formattedRates[rate.rank] = {
        investment: rate.investmentRate,
        property: rate.propertyRate,
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedRates,
    });
  }
);

// @desc    Get agent rank information
// @route   GET /api/referrals/agent-rank
// @access  Private (Agent only)
export const getAgentRankInfo = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.user as IUser;

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }

    // Get current rank
    const currentRank = user.agentRank || AgentRank.BASIC;

    // Get total referrals
    const totalReferrals = await Referral.countDocuments({ referrer: id });

    // Define rank thresholds
    const rankThresholds: Record<AgentRank, { min: number; max: number; next: AgentRank }> = {
      [AgentRank.BASIC]: { min: 0, max: 9, next: AgentRank.STAR },
      [AgentRank.STAR]: { min: 10, max: 24, next: AgentRank.LEADER },
      [AgentRank.LEADER]: { min: 25, max: 49, next: AgentRank.MANAGER },
      [AgentRank.MANAGER]: { min: 50, max: 99, next: AgentRank.CHIEF },
      [AgentRank.CHIEF]: { min: 100, max: 199, next: AgentRank.AMBASSADOR },
      [AgentRank.AMBASSADOR]: {
        min: 200,
        max: Number.POSITIVE_INFINITY,
        next: AgentRank.AMBASSADOR,
      },
    };

    // Calculate progress to next rank
    const currentThreshold = rankThresholds[currentRank];
    const nextRank = currentThreshold.next;
    const requiredReferrals = currentThreshold.max + 1;
    const progress =
      currentRank === AgentRank.MANAGER
        ? 100
        : Math.min(
            Math.round(
              ((totalReferrals - currentThreshold.min) /
                (currentThreshold.max - currentThreshold.min + 1)) *
                100
            ),
            99
          );

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        currentRank,
        nextRank,
        progress,
        requiredReferrals,
        currentReferrals: totalReferrals,
      },
    });
  }
);

// @desc    Process referral (used when a referred user makes a purchase)
// @route   POST /api/referrals/process
// @access  Private
export const processReferral = asyncHandler(
  async (req: Request, res: Response) => {
    const { referredUserId, transactionType, amount } = req.body;

    if (!referredUserId || !transactionType || !amount) {
      throw new AppError(
        "Please provide all required fields",
        StatusCodes.BAD_REQUEST
      );
    }

    // Find the referral
    const referral = await Referral.findOne({ referred: referredUserId });
    if (!referral) {
      throw new AppError("Referral not found", StatusCodes.NOT_FOUND);
    }

    // Get referrer
    const referrer = await User.findById(referral.referrer);
    if (!referrer) {
      throw new AppError("Referrer not found", StatusCodes.NOT_FOUND);
    }

    const agentRank = referrer.agentRank || AgentRank.BASIC;

    // Get commission rates from the database
    const commissionRate = await ReferralCommission.findOne({
      rank: agentRank,
    });
    if (!commissionRate) {
      throw new AppError("Commission rate not found", StatusCodes.NOT_FOUND);
    }

    // Calculate commission
    let commission = 0;
    if (transactionType === "investment") {
      commission = (amount * commissionRate.investmentRate) / 100;
    } else if (transactionType === "property") {
      commission = (amount * commissionRate.propertyRate) / 100;
    }

    // Create transaction
    const transaction = await Transaction.create({
      user: referrer._id,
      type: TransactionType.REFERRAL,
      amount: commission,
      status: TransactionStatus.COMPLETED,
      description: `Referral commission for ${transactionType} purchase by ${referredUserId}`,
    });

    // Update referral status to active
    referral.status = ReferralStatus.ACTIVE;
    referral.earnings += commission;
    await referral.save();

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        commission,
        transaction,
      },
    });
  }
);

// @desc    Verify referral code
// @route   GET /api/referrals/verify/:code
// @access  Public
export const verifyReferralCode = asyncHandler(
  async (req: Request, res: Response) => {
    const { code } = req.params;

    // Use userName instead of referralCode
    const user = await User.findOne({ userName: code });
    if (!user) {
      throw new AppError("Invalid referral code", StatusCodes.BAD_REQUEST);
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        referrerId: user._id,
        referrerName: `${user.firstName} ${user.lastName}`,
      },
    });
  }
);

// ===== ADMIN ROUTES =====

// @desc    Get all referrals with filtering and pagination
// @route   GET /api/referrals/admin/referrals
// @access  Private (Admin only)
export const getAllReferrals = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Number.parseInt(page as string, 10);
    const limitNum = Number.parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      // Search in referrer and referred user fields
      query.$or = [
        { "referrer.firstName": { $regex: search, $options: "i" } },
        { "referrer.lastName": { $regex: search, $options: "i" } },
        { "referrer.email": { $regex: search, $options: "i" } },
        { "referred.firstName": { $regex: search, $options: "i" } },
        { "referred.lastName": { $regex: search, $options: "i" } },
        { "referred.email": { $regex: search, $options: "i" } },
      ];
    }

    // Execute query with lookup to populate referrer and referred
    const referrals = await Referral.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "referrer",
          foreignField: "_id",
          as: "referrer",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "referred",
          foreignField: "_id",
          as: "referred",
        },
      },
      { $unwind: "$referrer" },
      { $unwind: "$referred" },
      { $match: query },
      { $sort: { [sortBy as string]: sortOrder === "desc" ? -1 : 1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          status: 1,
          earnings: 1,
          createdAt: 1,
          updatedAt: 1,
          "referrer._id": 1,
          "referrer.firstName": 1,
          "referrer.lastName": 1,
          "referrer.email": 1,
          "referrer.userName": 1,
          "referrer.agentRank": 1,
          "referrer.avatar": 1,
          "referrer.profileImage": 1,
          "referred._id": 1,
          "referred.firstName": 1,
          "referred.lastName": 1,
          "referred.email": 1,
          "referred.avatar": 1,
          "referred.profileImage": 1,
        },
      },
    ]);

    // Get total count for pagination
    const totalCount = await Referral.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        referrals,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
      },
    });
  }
);

// @desc    Get specific referral by ID
// @route   GET /api/referrals/:id
// @access  Private
export const getReferralById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid referral ID", StatusCodes.BAD_REQUEST);
    }

    const referral = await Referral.findById(id)
      .populate(
        "referrer",
        "firstName lastName email phone userName profileImage agentRank avatar"
      )
      .populate("referred", "firstName lastName email avatar profileImage");

    if (!referral) {
      throw new AppError("Referral not found", StatusCodes.NOT_FOUND);
    }

    // Get additional stats
    const totalEarnings = referral.earnings;

    // Get pending earnings from transactions
    const pendingEarningsData = await Transaction.aggregate([
      {
        $match: {
          user: referral.referrer._id,
          type: TransactionType.REFERRAL,
          status: TransactionStatus.PENDING,
          description: { $regex: referral.referred._id.toString() },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const pendingEarnings =
      pendingEarningsData.length > 0 ? pendingEarningsData[0].total : 0;
    const paidEarnings = totalEarnings - pendingEarnings;

    // Get last active date
    const lastTransaction = await Transaction.findOne({
      user: referral.referrer._id,
      type: TransactionType.REFERRAL,
    }).sort({ createdAt: -1 });

    const lastActive = lastTransaction
      ? lastTransaction.get("createdAt")
      : referral.updatedAt;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ...referral.toObject(),
        stats: {
          totalEarnings,
          pendingEarnings,
          paidEarnings,
          lastActive,
        },
      },
    });
  }
);

// @desc    Get referees for a specific referrer
// @route   GET /api/referrals/referrer/:id/referees
// @access  Private
export const getRefereesByReferrerId = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid referrer ID", StatusCodes.BAD_REQUEST);
    }

    const query: any = { referrer: id };

    if (status && status !== "all") {
      query.status = status;
    }

    const referrals = await Referral.find(query)
      .populate("referred", "firstName lastName email avatar profileImage")
      .sort({ createdAt: -1 });

    // Enhance with transaction data
    const enhancedReferrals = await Promise.all(
      referrals.map(async (referral) => {
        const transactions = await Transaction.find({
          user: id,
          type: TransactionType.REFERRAL,
          description: { $regex: referral.referred._id.toString() },
        }).sort({ createdAt: -1 });

        return {
          ...referral.toObject(),
          transactions: transactions,
        };
      })
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: enhancedReferrals,
    });
  }
);

// @desc    Get commission history for a specific referral
// @route   GET /api/referrals/:id/commissions
// @access  Private
export const getReferralCommissionHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid referral ID", StatusCodes.BAD_REQUEST);
    }

    const referral = await Referral.findById(id)
      .populate("referrer", "firstName lastName avatar profileImage")
      .populate("referred", "firstName lastName avatar profileImage");

    if (!referral) {
      throw new AppError("Referral not found", StatusCodes.NOT_FOUND);
    }

    // Get all transactions related to this referral
    const transactions = await Transaction.find({
      user: referral.referrer,
      type: TransactionType.REFERRAL,
      description: { $regex: referral.referred._id.toString() },
    }).sort({ createdAt: -1 });

    // Group transactions by month for history
    const monthlyTransactions = transactions.reduce((acc: any, transaction) => {
      const date = new Date(
        (transaction as any).createdAt || transaction.get("createdAt")
      );
      const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;

      if (!acc[monthYear]) {
        acc[monthYear] = {
          month: date.toLocaleString("default", { month: "long" }),
          year: date.getFullYear(),
          transactions: [],
          total: 0,
        };
      }

      acc[monthYear].transactions.push(transaction);
      acc[monthYear].total += transaction.amount;

      return acc;
    }, {});

    // Convert to array and sort by date (newest first)
    const commissionHistory = Object.values(monthlyTransactions).sort(
      (a: any, b: any) => {
        return b.year - a.year || b.month - a.month;
      }
    );

    // Calculate summary stats
    const totalCommission = transactions.reduce((sum, t) => sum + t.amount, 0);
    const pendingCommission = transactions
      .filter((t) => t.status === TransactionStatus.PENDING)
      .reduce((sum, t) => sum + t.amount, 0);
    const paidCommission = transactions
      .filter((t) => t.status === TransactionStatus.COMPLETED)
      .reduce((sum, t) => sum + t.amount, 0);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        referral: {
          _id: referral._id,
          referrer: referral.referrer,
          referred: referral.referred,
          status: referral.status,
        },
        history: commissionHistory,
        summary: {
          totalCommission,
          pendingCommission,
          paidCommission,
        },
      },
    });
  }
);

// @desc    Get activity log for a specific referral
// @route   GET /api/referrals/:id/activity
// @access  Private
export const getReferralActivityLog = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid referral ID", StatusCodes.BAD_REQUEST);
    }

    const referral = await Referral.findById(id)
      .populate("referrer", "firstName lastName avatar profileImage")
      .populate("referred", "firstName lastName avatar profileImage");

    if (!referral) {
      throw new AppError("Referral not found", StatusCodes.NOT_FOUND);
    }

    // Ensure referrer and referred are populated and have the required properties
    const getName = (user: any) => {
      if (
        user &&
        typeof user === "object" &&
        "firstName" in user &&
        "lastName" in user
      ) {
        return { firstName: user.firstName, lastName: user.lastName };
      }
      return { firstName: "Unknown", lastName: "" };
    };

    const referrerName = getName(referral.referrer);
    const referredName = getName(referral.referred);

    // Get all transactions related to this referral
    const transactions = await Transaction.find({
      user: referral.referrer,
      type: TransactionType.REFERRAL,
      description: { $regex: referral.referred._id.toString() },
    }).sort({ createdAt: -1 });

    // Create activity log entries
    const activityLog = [
      // Initial referral creation
      {
        date: referral.createdAt,
        type: "referral_created",
        title: "Referral Created",
        description: `${referrerName.firstName} ${referrerName.lastName} referred ${referredName.firstName} ${referredName.lastName}`,
      },
      // Status changes (derived from referral history if available, or just current status)
      {
        date: referral.updatedAt,
        type: "status_change",
        title: "Status Updated",
        description: `Referral status changed to ${referral.status}`,
      },
      // Transactions
      ...transactions.map((transaction) => ({
        date: transaction.get("createdAt"),
        type: "commission",
        title:
          "Commission " +
          (transaction.status === TransactionStatus.COMPLETED
            ? "Paid"
            : "Pending"),
        description: transaction.description,
        amount: transaction.amount,
        status: transaction.status,
      })),
    ];

    // Sort by date (newest first)
    activityLog.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        referral: {
          _id: referral._id,
          referrer: referral.referrer,
          referred: referral.referred,
          status: referral.status,
        },
        activityLog,
      },
    });
  }
);

// @desc    Update referral status
// @route   PATCH /api/referrals/:id/status
// @access  Private
export const updateReferralStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid referral ID", StatusCodes.BAD_REQUEST);
    }

    if (!Object.values(ReferralStatus).includes(status as ReferralStatus)) {
      throw new AppError("Invalid status value", StatusCodes.BAD_REQUEST);
    }

    const referral = await Referral.findById(id);
    if (!referral) {
      throw new AppError("Referral not found", StatusCodes.NOT_FOUND);
    }

    // Update status
    referral.status = status as ReferralStatus;
    await referral.save();

    res.status(StatusCodes.OK).json({
      success: true,
      data: referral,
    });
  }
);

// @desc    Delete referral
// @route   DELETE /api/referrals/:id
// @access  Private
export const deleteReferral = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid referral ID", StatusCodes.BAD_REQUEST);
    }

    const referral = await Referral.findById(id);
    if (!referral) {
      throw new AppError("Referral not found", StatusCodes.NOT_FOUND);
    }

    // Delete related transactions
    await Transaction.deleteMany({
      user: referral.referrer,
      type: TransactionType.REFERRAL,
      description: { $regex: referral.referred._id.toString() },
    });

    // Delete the referral
    await referral.deleteOne();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Referral and related transactions deleted successfully",
    });
  }
);
