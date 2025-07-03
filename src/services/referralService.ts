import mongoose from "mongoose";
import User, { AgentRank } from "../models/userModel";
import { Referral, ReferralStatus } from "../models/referralModel";
import {
  PaymentMethod,
  Transaction,
  TransactionCheck,
  TransactionStatus,
  TransactionType,
  Wallet,
} from "../models/walletModel";
import PropertyPayment from "../models/propertyPaymentModel";
import notificationService from "./notificationService";
import logger from "../utils/logger";
import { NotificationType } from "../models/notificationModel";

// Commission rates for 3-level deep referral system
const COMMISSION_RATES = {
  LEVEL_1: 0.1, // 10% for direct referrals
  LEVEL_2: 0.03, // 3% for indirect referrals
  LEVEL_3: 0.01, // 1% for network bonus
};

// Rank thresholds based on cumulative indirect earnings
const RANK_THRESHOLDS = {
  [AgentRank.BASIC]: 0,
  [AgentRank.STAR]: 5000000, // ₦5,000,000 - ESTHINGTON STAR
  [AgentRank.LEADER]: 10000000, // ₦10,000,000 - ESTHINGTON LEADER
  [AgentRank.MANAGER]: 20000000, // ₦20,000,000 - ESTHINGTON MANAGER
  [AgentRank.CHIEF]: 50000000, // ₦50,000,000 - ESTHINGTON CHIEF
  [AgentRank.AMBASSADOR]: 100000000, // ₦100,000,000 - ESTHINGTON AMBASSADOR
};

/**
 * Process 3-level deep referral commissions with enhanced error handling and wallet verification
 */
export const processReferralCommissions = async (
  userId: string,
  transactionType: "investment" | "property" | "marketplace",
  amount: number,
  session?: mongoose.ClientSession,
  paymentId?: string,
  transactionRef?: string
) => {
  try {
    logger.info(
      `Processing referral commissions for user ${userId}, type: ${transactionType}, amount: ${amount}, paymentId: ${paymentId}`
    );

    const referralChain = await getReferralChain(userId, 3);
    if (referralChain.length === 0) {
      logger.info("No referral chain found for user");
      return [];
    }

    const commissions = [];
    const commissionRecords = [];

    // Get system user and wallet
    const systemUser = await User.findOne({ email: "esthington@gmail.com" });
    if (!systemUser) throw new Error("System user not found");

    let systemWallet = await Wallet.findOne({ user: systemUser._id });
    if (!systemWallet) {
      logger.info(`Creating new system wallet for admin: ${systemUser._id}`);
      systemWallet = await Wallet.create({
        user: systemUser._id,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
      });
    }

    for (let level = 0; level < referralChain.length; level++) {
      const referrer = referralChain[level];
      let commissionRate = 0;

      switch (level) {
        case 0:
          commissionRate = COMMISSION_RATES.LEVEL_1;
          break;
        case 1:
          commissionRate = COMMISSION_RATES.LEVEL_2;
          break;
        case 2:
          commissionRate = COMMISSION_RATES.LEVEL_3;
          break;
        default:
          continue;
      }

      const commissionAmount = amount * commissionRate;
      const levelName =
        level === 0 ? "Direct" : level === 1 ? "Indirect" : "Network";

      try {
        let referrerWallet = await Wallet.findOne({ user: referrer._id });
        if (!referrerWallet) {
          logger.warn(
            `Wallet not found for referrer ${referrer._id}, creating`
          );
          referrerWallet = new Wallet({
            user: referrer._id,
            balance: 0,
            availableBalance: 0,
            pendingBalance: 0,
          });
          await referrerWallet.save({ session });
        }

        // Create INCOMING transaction for referrer
        const [commissionTransaction] = await Transaction.create(
          [
            {
              user: referrer._id,
              type: TransactionType.REFERRAL,
              amount: commissionAmount,
              status: TransactionStatus.COMPLETED,
              check: TransactionCheck.INCOMING,
              reference: `REF-${level + 1}-${Date.now()}-${userId}`,
              description: `${levelName} referral commission (Level ${
                level + 1
              }) from ${transactionType} transaction`,
              paymentMethod: PaymentMethod.WALLET,
              sender: userId,
              metadata: {
                referralLevel: level + 1,
                sourceUserId: userId,
                transactionType,
                originalAmount: amount,
                commissionRate,
                levelName,
                originalTransactionRef: transactionRef,
                paymentId,
              },
            },
          ],
          { session }
        );

        // Update referrer's wallet
        referrerWallet.balance += commissionAmount;
        referrerWallet.availableBalance += commissionAmount;
        await referrerWallet.save({ session });

        // SYSTEM DEBIT: Create OUTGOING transaction and update system wallet
        await Transaction.create(
          [
            {
              user: systemUser._id,
              type: TransactionType.REFERRAL,
              amount: commissionAmount,
              status: TransactionStatus.COMPLETED,
              check: TransactionCheck.OUTGOING,
              reference: transactionRef || `SYS-REF-${Date.now()}-${userId}`,
              description: `Referral commission paid to ${referrer.firstName} ${
                referrer.lastName
              } (Level ${level + 1})`,
              paymentMethod: PaymentMethod.WALLET,
              recipient: referrer._id,
              metadata: {
                referralLevel: level + 1,
                recipientUserId: referrer._id,
                transactionType,
                originalAmount: amount,
                commissionRate,
                levelName,
                originalTransactionRef: transactionRef,
                paymentId,
              },
            },
          ],
          { session }
        );

        systemWallet.balance -= commissionAmount;
        systemWallet.availableBalance -= commissionAmount;
        await systemWallet.save({ session });

        // Update referral record
        const levelField =
          level === 0
            ? "level1Earnings"
            : level === 1
            ? "level2Earnings"
            : "level3Earnings";

        await Referral.findOneAndUpdate(
          { referrer: referrer._id, referred: userId },
          {
            $inc: {
              earnings: commissionAmount,
              [levelField]: commissionAmount,
            },
            $set: {
              lastActivityDate: new Date(),
            },
          },
          { session }
        );

        // Create notification
        await notificationService.createNotification(
          referrer._id.toString(),
          "Referral Commission Earned",
          `You earned ₦${commissionAmount.toLocaleString()} from a Level ${
            level + 1
          } ${levelName.toLowerCase()} referral commission.`,
          NotificationType.TRANSACTION,
          "/dashboard/referrals",
          {
            transactionId: commissionTransaction._id,
            level: level + 1,
            commissionAmount,
            paymentId,
          }
        );

        // Collect records
        commissions.push({
          referrer: referrer._id,
          referrerName: `${referrer.firstName} ${referrer.lastName}`,
          level: level + 1,
          amount: commissionAmount,
          rate: commissionRate,
          transaction: commissionTransaction,
        });

        commissionRecords.push({
          referrerId: referrer._id,
          referrerName: `${referrer.firstName} ${referrer.lastName}`,
          referrerEmail: referrer.email,
          level: level + 1,
          amount: commissionAmount,
          transactionId: commissionTransaction._id,
          status: "paid",
          paidAt: new Date(),
        });
      } catch (err) {
        logger.error(
          `Error processing commission for level ${level + 1}:`,
          err
        );

        if (paymentId) {
          commissionRecords.push({
            referrerId: referrer._id,
            referrerName: `${referrer.firstName} ${referrer.lastName}`,
            referrerEmail: referrer.email,
            level: level + 1,
            amount: commissionAmount,
            status: "failed",
          });
        }
      }
    }

    // Update payment record with commissions
    if (paymentId && commissionRecords.length > 0) {
      try {
        await PropertyPayment.findByIdAndUpdate(
          paymentId,
          { $set: { commissions: commissionRecords } },
          { session }
        );
        logger.info(`Updated payment ${paymentId} with commissions`);
      } catch (error) {
        logger.error("Error updating payment commissions:", error);
      }
    }

    // Update referrer ranks
    try {
      await updateReferrerRanks(referralChain, session);
    } catch (rankError) {
      logger.error("Error updating ranks:", rankError);
    }

    return commissions;
  } catch (error) {
    logger.error("Error processing referral commissions:", error);
    throw error;
  }
};

/**
 * Get referral chain up to specified depth
 */
export const getReferralChain = async (userId: string, depth = 3) => {
  const chain = [];
  let currentUserId = userId;

  for (let level = 0; level < depth; level++) {
    try {
      // Find who referred the current user
      const referral = await Referral.findOne({
        referred: currentUserId,
      }).populate("referrer");

      if (!referral || !referral.referrer) {
        break; // No more referrers in the chain
      }

      // Skip system user referrals
      const referrer = referral.referrer as any;
      if (
        referrer.userName === "system" ||
        referrer.email === "esthington@gmail.com"
      ) {
        break;
      }

      chain.push(referrer);
      currentUserId = referrer._id.toString();
    } catch (error) {
      logger.error(`Error finding referral for user ${currentUserId}:`, error);
      break;
    }
  }

  return chain;
};

/**
 * Get referral statistics for a user
 */
export const getReferralStats = async (userId: string) => {
  // Get direct referrals (Level 1)
  const directReferrals = await Referral.countDocuments({
    referrer: userId,
    status: ReferralStatus.ACTIVE,
  });

  // Get indirect referrals (Level 2)
  const level1Referrals = await Referral.find({ referrer: userId }).select(
    "referred"
  );
  const level1UserIds = level1Referrals.map((r) => r.referred);

  const indirectReferrals = await Referral.countDocuments({
    referrer: { $in: level1UserIds },
    status: ReferralStatus.ACTIVE,
  });

  // Get network referrals (Level 3)
  const level2Referrals = await Referral.find({
    referrer: { $in: level1UserIds },
  }).select("referred");
  const level2UserIds = level2Referrals.map((r) => r.referred);

  const networkReferrals = await Referral.countDocuments({
    referrer: { $in: level2UserIds },
    status: ReferralStatus.ACTIVE,
  });

  // Get earnings by level
  const earningsByLevel = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        type: TransactionType.REFERRAL,
        status: TransactionStatus.COMPLETED,
      },
    },
    {
      $group: {
        _id: "$metadata.referralLevel",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const earnings = {
    level1: 0,
    level2: 0,
    level3: 0,
    total: 0,
  };

  earningsByLevel.forEach((earning) => {
    switch (earning._id) {
      case 1:
        earnings.level1 = earning.total;
        break;
      case 2:
        earnings.level2 = earning.total;
        break;
      case 3:
        earnings.level3 = earning.total;
        break;
    }
  });

  earnings.total = earnings.level1 + earnings.level2 + earnings.level3;

  return {
    referrals: {
      direct: directReferrals,
      indirect: indirectReferrals,
      network: networkReferrals,
      total: directReferrals + indirectReferrals + networkReferrals,
    },
    earnings,
  };
};

/**
 * Get user's current rank and progress to next rank
 */
export const getUserRankInfo = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const currentRank = user.agentRank || AgentRank.BASIC;

  // Calculate indirect earnings for rank progression
  const indirectEarnings = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        type: TransactionType.REFERRAL,
        status: TransactionStatus.COMPLETED,
        "metadata.referralLevel": { $in: [2, 3] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  const totalIndirectEarnings =
    indirectEarnings.length > 0 ? indirectEarnings[0].total : 0;

  // Find next rank
  const ranks = Object.keys(RANK_THRESHOLDS) as AgentRank[];
  const currentRankIndex = ranks.indexOf(currentRank);
  const nextRank =
    currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : null;

  const nextRankThreshold = nextRank ? RANK_THRESHOLDS[nextRank] : null;
  const currentRankThreshold = RANK_THRESHOLDS[currentRank];

  const progress = nextRankThreshold
    ? Math.min(
        ((totalIndirectEarnings - currentRankThreshold) /
          (nextRankThreshold - currentRankThreshold)) *
          100,
        100
      )
    : 100;

  return {
    currentRank,
    nextRank,
    indirectEarnings: totalIndirectEarnings,
    nextRankThreshold,
    progress: Math.max(0, progress),
    rankNames: {
      [AgentRank.BASIC]: "BASIC",
      [AgentRank.STAR]: "Esthington Star",
      [AgentRank.LEADER]: "Esthington Leader",
      [AgentRank.MANAGER]: "Esthington Manager",
      [AgentRank.CHIEF]: "Esthington Chief",
      [AgentRank.AMBASSADOR]: "Esthington Ambassador",
    },
  };
};

/**
 * Get referral commission history for a user
 */
export const getReferralCommissionHistory = async (
  userId: string,
  page = 1,
  limit = 10
) => {
  const skip = (page - 1) * limit;

  // Get commission transactions
  const transactions = await Transaction.find({
    user: userId,
    type: TransactionType.REFERRAL,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "firstName lastName email");

  const totalCount = await Transaction.countDocuments({
    user: userId,
    type: TransactionType.REFERRAL,
  });

  // Get commission summary
  const commissionSummary = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        type: TransactionType.REFERRAL,
      },
    },
    {
      $group: {
        _id: "$metadata.referralLevel",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
        avgAmount: { $avg: "$amount" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Get monthly commission trends
  const monthlyTrends = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        type: TransactionType.REFERRAL,
        createdAt: {
          $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
  ]);

  return {
    transactions,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    },
    summary: commissionSummary,
    monthlyTrends,
  };
};

/**
 * Get referral network for a user
 */
export const getReferralNetwork = async (userId: string) => {
  // Get direct referrals (Level 1)
  const directReferrals = await Referral.find({
    referrer: userId,
    status: ReferralStatus.ACTIVE,
  })
    .populate("referred", "firstName lastName email createdAt")
    .sort({ createdAt: -1 });

  // Get indirect referrals (Level 2)
  const level1UserIds = directReferrals.map((r) => r.referred);
  const indirectReferrals = await Referral.find({
    referrer: { $in: level1UserIds },
    status: ReferralStatus.ACTIVE,
  })
    .populate("referred", "firstName lastName email")
    .populate("referrer", "firstName lastName email")
    .sort({ createdAt: -1 });

  // Get network referrals (Level 3)
  const level2UserIds = indirectReferrals.map((r) => r.referred);
  const networkReferrals = await Referral.find({
    referrer: { $in: level2UserIds },
    status: ReferralStatus.ACTIVE,
  })
    .populate("referred", "firstName lastName email")
    .populate("referrer", "firstName lastName email")
    .sort({ createdAt: -1 });

  // Build network tree
  const networkTree = {
    user: await User.findById(userId, "firstName lastName email agentRank"),
    directReferrals: directReferrals.map((r) => ({
      user: r.referred,
      referralDate: r.createdAt,
      earnings: r.earnings,
      indirectReferrals: indirectReferrals
        .filter(
          (ir) => ir.referrer._id.toString() === r.referred._id.toString()
        )
        .map((ir) => ({
          user: ir.referred,
          referralDate: ir.createdAt,
          earnings: ir.earnings,
          networkReferrals: networkReferrals
            .filter(
              (nr) => nr.referrer._id.toString() === ir.referred._id.toString()
            )
            .map((nr) => ({
              user: nr.referred,
              referralDate: nr.createdAt,
              earnings: nr.earnings,
            })),
        })),
    })),
  };

  return {
    networkTree,
    stats: {
      directCount: directReferrals.length,
      indirectCount: indirectReferrals.length,
      networkCount: networkReferrals.length,
      totalCount:
        directReferrals.length +
        indirectReferrals.length +
        networkReferrals.length,
    },
  };
};
/**
 * Update agent ranks for all referrers in the referral chain based on their indirect earnings.
 * Promotes users if their indirect earnings cross the next rank threshold.
 */
async function updateReferrerRanks(
  referralChain: any[],
  session: mongoose.ClientSession | undefined
) {
  for (const referrer of referralChain) {
    // Calculate indirect earnings (Level 2 and 3)
    const indirectEarningsAgg = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(referrer._id),
          type: TransactionType.REFERRAL,
          status: TransactionStatus.COMPLETED,
          "metadata.referralLevel": { $in: [2, 3] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);
    const indirectEarnings =
      indirectEarningsAgg.length > 0 ? indirectEarningsAgg[0].total : 0;

    // Determine new rank
    let newRank = AgentRank.BASIC;
    for (const rank of Object.keys(RANK_THRESHOLDS) as AgentRank[]) {
      if (indirectEarnings >= RANK_THRESHOLDS[rank]) {
        newRank = rank;
      }
    }

    // Update rank if changed
    if (referrer.agentRank !== newRank) {
      await User.findByIdAndUpdate(
        referrer._id,
        { $set: { agentRank: newRank } },
        { session }
      );
      logger.info(
        `Updated agent rank for user ${referrer._id}: ${referrer.agentRank} -> ${newRank}`
      );
    }
  }
}
