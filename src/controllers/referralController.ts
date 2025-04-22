import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  Referral,
  ReferralStatus,
  ReferralCommission,
} from "../models/referralModel";
import User, { UserRole, AgentRank, type IUser } from "../models/userModel";
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from "../models/walletModel";
import { AppError } from "../utils/appError";
import asyncHandler from "express-async-handler";
import crypto from "crypto";
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
      .populate("referred", "firstName lastName email");

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

    // Get referral link
    const user = await User.findById(id);
    const referralLink = user?.referralCode
      ? `${config.frontendUrl}/signup?ref=${user.referralCode}`
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

    // Generate a unique referral code if not already present
    if (!user.referralCode) {
      const referralCode = crypto.randomBytes(6).toString("hex");
      user.referralCode = referralCode;
      await user.save();
    }

    const referralLink = `${config.frontendUrl}/signup?ref=${user.referralCode}`;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        referralCode: user.referralCode,
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
// @access  Private
export const getAgentRankInfo = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.user as IUser;

    const user = await User.findById(id);
    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }

    // Get current rank
    const currentRank = user.agentRank || AgentRank.BRONZE;

    // Get total referrals
    const totalReferrals = await Referral.countDocuments({ referrer: id });

    // Define rank thresholds
    const rankThresholds = {
      [AgentRank.BRONZE]: { min: 0, max: 9, next: AgentRank.SILVER },
      [AgentRank.SILVER]: { min: 10, max: 24, next: AgentRank.GOLD },
      [AgentRank.GOLD]: { min: 25, max: 49, next: AgentRank.PLATINUM },
      [AgentRank.PLATINUM]: {
        min: 50,
        max: Number.POSITIVE_INFINITY,
        next: AgentRank.PLATINUM,
      },
    };

    // Calculate progress to next rank
    const currentThreshold = rankThresholds[currentRank];
    const nextRank = currentThreshold.next;
    const requiredReferrals = currentThreshold.max + 1;
    const progress =
      currentRank === AgentRank.PLATINUM
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

    const agentRank = referrer.agentRank || AgentRank.BRONZE;

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

    const user = await User.findOne({ referralCode: code });
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
