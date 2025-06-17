import mongoose from "mongoose";
import User, { AgentRank } from "../models/userModel";
import { Referral, ReferralStatus } from "../models/referralModel";
import {PaymentMethod, Transaction, TransactionStatus, TransactionType, Wallet} from "../models/walletModel";
import PropertyPayment from "../models/propertyPaymentModel";
import notificationService from "./notificationService";
import logger from "../utils/logger";
import { NotificationType } from "../models/notificationModel";

// Commission rates for 3-level deep referral system
const COMMISSION_RATES = {
  LEVEL_1: 0.1, // 10% for direct referrals
  LEVEL_2: 0.03, // 3% for indirect referrals
  LEVEL_3: 0.01, // 1% for network bonus
}

// Rank thresholds based on cumulative indirect earnings
const RANK_THRESHOLDS = {
  [AgentRank.BRONZE]: 0,
  [AgentRank.SILVER]: 5000000, // ₦5,000,000 - ESTHINGTON STAR
  [AgentRank.GOLD]: 10000000, // ₦10,000,000 - ESTHINGTON LEADER
  [AgentRank.PLATINUM]: 20000000, // ₦20,000,000 - ESTHINGTON MANAGER
  [AgentRank.DIAMOND]: 50000000, // ₦50,000,000 - ESTHINGTON CHIEF
  [AgentRank.MASTER]: 100000000, // ₦100,000,000 - ESTHINGTON AMBASSADOR
}

/**
 * Process 3-level deep referral commissions with enhanced error handling and wallet verification
 */
export const processReferralCommissions = async (
  userId: string,
  transactionType: "investment" | "property" | "marketplace",
  amount: number,
  session?: mongoose.ClientSession,
  paymentId?: string,
  transactionRef?: string,
) => {
  try {
    logger.info(
      `Processing referral commissions for user ${userId}, type: ${transactionType}, amount: ${amount}, paymentId: ${paymentId}`,
    )

    // Find the user's referral chain (3 levels deep)
    const referralChain = await getReferralChain(userId, 3)

    if (referralChain.length === 0) {
      logger.info("No referral chain found for user")
      return []
    }

    const commissions = []
    const commissionRecords = []

    // Process each level of the referral chain
    for (let level = 0; level < referralChain.length; level++) {
      const referrer = referralChain[level]
      let commissionRate = 0

      // Determine commission rate based on level
      switch (level) {
        case 0:
          commissionRate = COMMISSION_RATES.LEVEL_1 // 10%
          break
        case 1:
          commissionRate = COMMISSION_RATES.LEVEL_2 // 3%
          break
        case 2:
          commissionRate = COMMISSION_RATES.LEVEL_3 // 1%
          break
        default:
          continue // Skip levels beyond 3
      }

      const commissionAmount = amount * commissionRate
      const levelName = level === 0 ? "Direct" : level === 1 ? "Indirect" : "Network"

      try {
        // Find or create referrer's wallet with verification
        let referrerWallet = await Wallet.findOne({ user: referrer._id })

        if (!referrerWallet) {
          logger.warn(`Wallet not found for referrer ${referrer._id}, creating new wallet`)
          referrerWallet = new Wallet({
            user: referrer._id,
            balance: 0,
            availableBalance: 0,
            pendingBalance: 0,
          })
          await referrerWallet.save({ session })
        }

        // Create commission transaction with retry logic
        let commissionTransaction
        let retryCount = 0
        const maxRetries = 3

        while (retryCount < maxRetries) {
          try {
            commissionTransaction = await Transaction.create(
              [
                {
                  user: referrer._id,
                  type: TransactionType.REFERRAL,
                  amount: commissionAmount,
                  status: TransactionStatus.COMPLETED,
                  reference: `REF-${level + 1}-${Date.now()}-${userId}`,
                  description: `${levelName} referral commission (Level ${
                    level + 1
                  }) from ${transactionType} transaction`,
                  paymentMethod: PaymentMethod.WALLET,
                  sender: userId,
                  metadata: {
                    referralLevel: level + 1,
                    sourceUserId: userId,
                    transactionType: transactionType,
                    originalAmount: amount,
                    commissionRate: commissionRate,
                    levelName: levelName,
                    originalTransactionRef: transactionRef,
                    paymentId: paymentId,
                  },
                },
              ],
              { session },
            )
            break // Success, exit retry loop
          } catch (transactionError) {
            retryCount++
            logger.error(`Error creating commission transaction (attempt ${retryCount}):`, transactionError)
            if (retryCount >= maxRetries) throw transactionError
            await new Promise((resolve) => setTimeout(resolve, 500)) // Wait before retry
          }
        }

        // Update referrer's wallet with verification and retry logic
        retryCount = 0
        while (retryCount < maxRetries) {
          try {
            // Double-check wallet exists and is valid
            if (!referrerWallet) {
              throw new Error(`Wallet not found for referrer ${referrer._id}`)
            }

            // Update wallet balances
            const previousBalance = referrerWallet.balance
            const previousAvailableBalance = referrerWallet.availableBalance

            referrerWallet.balance += commissionAmount
            referrerWallet.availableBalance += commissionAmount

            await referrerWallet.save({ session })

            logger.info(
              `Updated wallet for referrer ${referrer._id}: Balance ${previousBalance} -> ${referrerWallet.balance}, Available ${previousAvailableBalance} -> ${referrerWallet.availableBalance}`,
            )
            break // Success, exit retry loop
          } catch (walletError) {
            retryCount++
            logger.error(`Error updating referrer wallet (attempt ${retryCount}):`, walletError)
            if (retryCount >= maxRetries) throw walletError

            // Re-fetch wallet before retry
            referrerWallet = await Wallet.findOne({ user: referrer._id })
            if (!referrerWallet) {
              referrerWallet = new Wallet({
                user: referrer._id,
                balance: 0,
                availableBalance: 0,
                pendingBalance: 0,
              })
            }

            await new Promise((resolve) => setTimeout(resolve, 500)) // Wait before retry
          }
        }

        // Update referral earnings
        await Referral.findOneAndUpdate(
          { referrer: referrer._id, referred: userId },
          { $inc: { earnings: commissionAmount } },
          { session },
        )

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
            transactionId: commissionTransaction && commissionTransaction.length > 0 ? commissionTransaction[0]._id : undefined,
            level: level + 1,
            commissionAmount: commissionAmount,
            paymentId: paymentId,
          },
        )

        const commission = {
          referrer: referrer._id,
          referrerName: `${referrer.firstName} ${referrer.lastName}`,
          level: level + 1,
          amount: commissionAmount,
          rate: commissionRate,
          transaction: commissionTransaction && commissionTransaction.length > 0 ? commissionTransaction[0] : undefined,
        }

        commissions.push(commission)

        // Add to commission records for property payment
        commissionRecords.push({
          referrerId: referrer._id,
          referrerName: `${referrer.firstName} ${referrer.lastName}`,
          referrerEmail: referrer.email,
          level: level + 1,
          amount: commissionAmount,
          transactionId: commissionTransaction && commissionTransaction.length > 0 ? commissionTransaction[0]._id : undefined,
          status: "paid",
          paidAt: new Date(),
        })

        logger.info(
          `Level ${level + 1} commission of ₦${commissionAmount} awarded to referrer ${referrer._id} for payment ${paymentId}`,
        )
      } catch (levelError) {
        logger.error(`Error processing commission for level ${level + 1}:`, levelError)
        // Continue with next level rather than failing entire process

        // Add failed commission record if we have a payment ID
        if (paymentId) {
          commissionRecords.push({
            referrerId: referrer._id,
            referrerName: `${referrer.firstName} ${referrer.lastName}`,
            referrerEmail: referrer.email,
            level: level + 1,
            amount: commissionAmount,
            status: "failed",
          })
        }
      }
    }

    // Update property payment record if applicable
    if (paymentId && commissionRecords.length > 0) {
      try {
        await PropertyPayment.findByIdAndUpdate(paymentId, { $set: { commissions: commissionRecords } }, { session })
        logger.info(`Updated payment ${paymentId} with ${commissionRecords.length} commission records`)
      } catch (paymentUpdateError) {
        logger.error(`Error updating property payment with commissions:`, paymentUpdateError)
      }
    }

    // Update ranks for all referrers in the chain
    try {
      await updateReferrerRanks(referralChain, session)
    } catch (rankError) {
      logger.error("Error updating referrer ranks:", rankError)
    }

    return commissions
  } catch (error) {
    logger.error("Error processing referral commissions:", error)
    throw error
  }
}

/**
 * Get referral chain up to specified depth
 */
export const getReferralChain = async (userId: string, depth = 3) => {
  const chain = []
  let currentUserId = userId

  for (let level = 0; level < depth; level++) {
    try {
      // Find who referred the current user
      const referral = await Referral.findOne({ referred: currentUserId }).populate("referrer")

      if (!referral || !referral.referrer) {
        break // No more referrers in the chain
      }

      // Skip system user referrals
      const referrer = referral.referrer as any
      if (referrer.userName === "system" || referrer.email === "esthington@gmail.com") {
        break
      }

      chain.push(referrer)
      currentUserId = referrer._id.toString()
    } catch (error) {
      logger.error(`Error finding referral for user ${currentUserId}:`, error)
      break
    }
  }

  return chain
}

/**
 * Get referral statistics for a user
 */
export const getReferralStats = async (userId: string) => {
  // Get direct referrals (Level 1)
  const directReferrals = await Referral.countDocuments({
    referrer: userId,
    status: ReferralStatus.ACTIVE,
  })

  // Get indirect referrals (Level 2)
  const level1Referrals = await Referral.find({ referrer: userId }).select("referred")
  const level1UserIds = level1Referrals.map((r) => r.referred)

  const indirectReferrals = await Referral.countDocuments({
    referrer: { $in: level1UserIds },
    status: ReferralStatus.ACTIVE,
  })

  // Get network referrals (Level 3)
  const level2Referrals = await Referral.find({
    referrer: { $in: level1UserIds },
  }).select("referred")
  const level2UserIds = level2Referrals.map((r) => r.referred)

  const networkReferrals = await Referral.countDocuments({
    referrer: { $in: level2UserIds },
    status: ReferralStatus.ACTIVE,
  })

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
  ])

  const earnings = {
    level1: 0,
    level2: 0,
    level3: 0,
    total: 0,
  }

  earningsByLevel.forEach((earning) => {
    switch (earning._id) {
      case 1:
        earnings.level1 = earning.total
        break
      case 2:
        earnings.level2 = earning.total
        break
      case 3:
        earnings.level3 = earning.total
        break
    }
  })

  earnings.total = earnings.level1 + earnings.level2 + earnings.level3

  return {
    referrals: {
      direct: directReferrals,
      indirect: indirectReferrals,
      network: networkReferrals,
      total: directReferrals + indirectReferrals + networkReferrals,
    },
    earnings,
  }
}

/**
 * Get user's current rank and progress to next rank
 */
export const getUserRankInfo = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user) {
    throw new Error("User not found")
  }

  const currentRank = user.agentRank || AgentRank.BRONZE

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
  ])

  const totalIndirectEarnings = indirectEarnings.length > 0 ? indirectEarnings[0].total : 0

  // Find next rank
  const ranks = Object.keys(RANK_THRESHOLDS) as AgentRank[]
  const currentRankIndex = ranks.indexOf(currentRank)
  const nextRank = currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : null

  const nextRankThreshold = nextRank ? RANK_THRESHOLDS[nextRank] : null
  const currentRankThreshold = RANK_THRESHOLDS[currentRank]

  const progress = nextRankThreshold
    ? Math.min(((totalIndirectEarnings - currentRankThreshold) / (nextRankThreshold - currentRankThreshold)) * 100, 100)
    : 100

  return {
    currentRank,
    nextRank,
    indirectEarnings: totalIndirectEarnings,
    nextRankThreshold,
    progress: Math.max(0, progress),
    rankNames: {
      [AgentRank.BRONZE]: "Bronze",
      [AgentRank.SILVER]: "Esthington Star",
      [AgentRank.GOLD]: "Esthington Leader",
      [AgentRank.PLATINUM]: "Esthington Manager",
      [AgentRank.DIAMOND]: "Esthington Chief",
      [AgentRank.MASTER]: "Esthington Ambassador",
    },
  }
}

/**
 * Get referral commission history for a user
 */
export const getReferralCommissionHistory = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit

  // Get commission transactions
  const transactions = await Transaction.find({
    user: userId,
    type: TransactionType.REFERRAL,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "firstName lastName email")

  const totalCount = await Transaction.countDocuments({
    user: userId,
    type: TransactionType.REFERRAL,
  })

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
  ])

  // Get monthly commission trends
  const monthlyTrends = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        type: TransactionType.REFERRAL,
        createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) },
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
  ])

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
  }
}

/**
 * Get referral network for a user
 */
export const getReferralNetwork = async (userId: string) => {
  // Get direct referrals (Level 1)
  const directReferrals = await Referral.find({ referrer: userId, status: ReferralStatus.ACTIVE })
    .populate("referred", "firstName lastName email createdAt")
    .sort({ createdAt: -1 })

  // Get indirect referrals (Level 2)
  const level1UserIds = directReferrals.map((r) => r.referred)
  const indirectReferrals = await Referral.find({
    referrer: { $in: level1UserIds },
    status: ReferralStatus.ACTIVE,
  })
    .populate("referred", "firstName lastName email")
    .populate("referrer", "firstName lastName email")
    .sort({ createdAt: -1 })

  // Get network referrals (Level 3)
  const level2UserIds = indirectReferrals.map((r) => r.referred)
  const networkReferrals = await Referral.find({
    referrer: { $in: level2UserIds },
    status: ReferralStatus.ACTIVE,
  })
    .populate("referred", "firstName lastName email")
    .populate("referrer", "firstName lastName email")
    .sort({ createdAt: -1 })

  // Build network tree
  const networkTree = {
    user: await User.findById(userId, "firstName lastName email agentRank"),
    directReferrals: directReferrals.map((r) => ({
      user: r.referred,
      referralDate: r.createdAt,
      earnings: r.earnings,
      indirectReferrals: indirectReferrals
        .filter((ir) => ir.referrer._id.toString() === r.referred._id.toString())
        .map((ir) => ({
          user: ir.referred,
          referralDate: ir.createdAt,
          earnings: ir.earnings,
          networkReferrals: networkReferrals
            .filter((nr) => nr.referrer._id.toString() === ir.referred._id.toString())
            .map((nr) => ({
              user: nr.referred,
              referralDate: nr.createdAt,
              earnings: nr.earnings,
            })),
        })),
    })),
  }

  return {
    networkTree,
    stats: {
      directCount: directReferrals.length,
      indirectCount: indirectReferrals.length,
      networkCount: networkReferrals.length,
      totalCount: directReferrals.length + indirectReferrals.length + networkReferrals.length,
    },
  }
}
/**
 * Update agent ranks for all referrers in the referral chain based on their indirect earnings.
 * Promotes users if their indirect earnings cross the next rank threshold.
 */
async function updateReferrerRanks(referralChain: any[], session: mongoose.ClientSession | undefined) {
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
    const indirectEarnings = indirectEarningsAgg.length > 0 ? indirectEarningsAgg[0].total : 0;

    // Determine new rank
    let newRank = AgentRank.BRONZE;
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
      logger.info(`Updated agent rank for user ${referrer._id}: ${referrer.agentRank} -> ${newRank}`);
    }
  }
}

