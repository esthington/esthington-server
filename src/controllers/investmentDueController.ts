import type { Request, Response } from "express";
import UserInvestment from "../models/userInvestmentModel";
import mongoose from "mongoose";
import { Transaction, Wallet } from "../models/walletModel";

// Helper function to generate payouts for an investment
const generatePayoutsForInvestment = (userInvestment: any, investment: any) => {
  const payouts = [];
  const duration = investment.duration || 12; // Default 12 months
  const payoutFrequency = investment.payoutFrequency || "monthly";
  const totalReturn = userInvestment.expectedReturn;

  let payoutCount = duration;
  if (payoutFrequency === "quarterly") payoutCount = Math.ceil(duration / 3);
  else if (payoutFrequency === "semi-annually")
    payoutCount = Math.ceil(duration / 6);
  else if (payoutFrequency === "annually")
    payoutCount = Math.ceil(duration / 12);

  const payoutAmount = Math.round(totalReturn / payoutCount);

  for (let i = 1; i <= payoutCount; i++) {
    const payoutDate = new Date(userInvestment.startDate);

    if (payoutFrequency === "monthly") {
      payoutDate.setMonth(payoutDate.getMonth() + i);
    } else if (payoutFrequency === "quarterly") {
      payoutDate.setMonth(payoutDate.getMonth() + i * 3);
    } else if (payoutFrequency === "semi-annually") {
      payoutDate.setMonth(payoutDate.getMonth() + i * 6);
    } else if (payoutFrequency === "annually") {
      payoutDate.setFullYear(payoutDate.getFullYear() + i);
    }

    payouts.push({
      _id: new mongoose.Types.ObjectId(),
      date: payoutDate,
      amount:
        i === payoutCount
          ? totalReturn - payoutAmount * (payoutCount - 1)
          : payoutAmount, // Last payout gets remainder
      status: "pending",
      payoutNumber: i,
    });
  }

  return payouts;
};

// Get investment dues with pagination and sorting
export const getInvestmentDues = async (req: Request, res: Response) => {
  try {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const sortBy = (req.query.sortBy as string) || "startDate";
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    // Build aggregation pipeline to show ALL investments
    const pipeline: any[] = [
      // Match all investments (not just active ones)
      {
        $match: {
          expectedReturn: { $gt: 0 },
          startDate: { $exists: true },
        },
      },
      // Lookup user details
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                avatar: 1,
                userName: 1,
              },
            },
          ],
        },
      },
      // Lookup investment details
      {
        $lookup: {
          from: "investments",
          localField: "investmentId",
          foreignField: "_id",
          as: "investment",
          pipeline: [
            {
              $project: {
                title: 1,
                propertyId: 1,
                returnRate: 1,
                duration: 1,
                payoutFrequency: 1,
                type: 1,
              },
            },
          ],
        },
      },
      // Ensure we have user and investment data
      {
        $match: {
          user: { $ne: [] },
          investment: { $ne: [] },
        },
      },
      {
        $unwind: "$user",
      },
      {
        $unwind: "$investment",
      },
      // Add calculated fields
      {
        $addFields: {
          duration: { $ifNull: ["$investment.duration", 12] },
          payoutFrequency: {
            $ifNull: ["$investment.payoutFrequency", "monthly"],
          },
          monthsElapsed: {
            $divide: [
              { $subtract: [new Date(), "$startDate"] },
              1000 * 60 * 60 * 24 * 30, // Convert to months
            ],
          },
        },
      },
      // Calculate next payout date and determine if due
      {
        $addFields: {
          nextPayoutDate: {
            $dateAdd: {
              startDate: "$startDate",
              unit: "month",
              amount: { $ceil: "$monthsElapsed" },
            },
          },
          payoutAmount: {
            $divide: ["$expectedReturn", "$duration"],
          },
          isOverdue: {
            $and: [
              { $lt: ["$monthsElapsed", "$duration"] }, // Not completed
              {
                $lt: [
                  {
                    $dateAdd: {
                      startDate: "$startDate",
                      unit: "month",
                      amount: { $ceil: "$monthsElapsed" },
                    },
                  },
                  new Date(),
                ],
              },
            ],
          },
          isDue: {
            $and: [
              { $gte: ["$monthsElapsed", 1] }, // At least one month has passed
              { $lt: ["$monthsElapsed", "$duration"] }, // Not completed
              { $eq: ["$status", "active"] }, // Only active investments can have due payouts
            ],
          },
          progressPercentage: {
            $multiply: [
              {
                $divide: [{ $ifNull: ["$actualReturn", 0] }, "$expectedReturn"],
              },
              100,
            ],
          },
          investmentStatus: "$status", // Keep original investment status
        },
      },
      // Determine payout status based on investment status and due date
      {
        $addFields: {
          payoutStatus: {
            $cond: {
              if: { $eq: ["$status", "completed"] },
              then: "paid",
              else: {
                $cond: {
                  if: { $eq: ["$status", "cancelled"] },
                  then: "failed",
                  else: {
                    $cond: {
                      if: "$isDue",
                      then: "pending",
                      else: "not_due",
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];

    // Add search functionality
    if (search && search.trim()) {
      pipeline.push({
        $match: {
          $or: [
            { "user.firstName": { $regex: search, $options: "i" } },
            { "user.lastName": { $regex: search, $options: "i" } },
            { "user.email": { $regex: search, $options: "i" } },
            { "investment.title": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Filter by status
    if (status && status !== "all") {
      if (status === "pending") {
        pipeline.push({
          $match: { payoutStatus: "pending" },
        });
      } else if (status === "paid") {
        pipeline.push({
          $match: { payoutStatus: "paid" },
        });
      } else if (status === "failed") {
        pipeline.push({
          $match: { payoutStatus: "failed" },
        });
      } else if (status === "overdue") {
        pipeline.push({
          $match: { isOverdue: true },
        });
      }
    }

    // Add final formatting
    pipeline.push({
      $addFields: {
        payoutId: { $toString: "$_id" }, // Use investment ID as payout ID
        amount: "$payoutAmount",
        status: "$payoutStatus", // Use calculated payout status
        canApproveReject: "$isDue", // Only allow approve/reject for due investments
      },
    });

    // Add sorting
    const sortStage: any = {};
    if (sortBy === "nextPayoutDate") {
      sortStage["nextPayoutDate"] = 1;
    } else if (sortBy === "amount") {
      sortStage["payoutAmount"] = -1;
    } else if (sortBy === "user") {
      sortStage["user.firstName"] = 1;
    } else if (sortBy === "investment") {
      sortStage["investment.title"] = 1;
    } else {
      sortStage["startDate"] = -1;
    }

    pipeline.push({ $sort: sortStage });

    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const totalCountResult = await UserInvestment.aggregate(countPipeline);
    const total = totalCountResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    // Execute the main query
    const dues = await UserInvestment.aggregate(pipeline);

    const totalPages = Math.ceil(total / limit);

    console.log("Investment dues found:", dues.length);

    res.status(200).json({
      success: true,
      data: dues,
      total,
      totalPages,
      currentPage: page,
      message: "Investment dues retrieved successfully",
    });
  } catch (error: any) {
    console.error("Error fetching investment dues:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch investment dues",
      error: error.message,
    });
  }
};

// Get investment dues statistics
export const getInvestmentDuesStats = async (req: Request, res: Response) => {
  try {
    // Get comprehensive stats from all investments
    const stats = await UserInvestment.aggregate([
      {
        $match: {
          expectedReturn: { $gt: 0 },
          startDate: { $exists: true },
        },
      },
      {
        $lookup: {
          from: "investments",
          localField: "investmentId",
          foreignField: "_id",
          as: "investment",
        },
      },
      {
        $unwind: "$investment",
      },
      {
        $addFields: {
          monthsElapsed: {
            $divide: [
              { $subtract: [new Date(), "$startDate"] },
              1000 * 60 * 60 * 24 * 30,
            ],
          },
          duration: { $ifNull: ["$investment.duration", 12] },
        },
      },
      {
        $addFields: {
          isDue: {
            $and: [
              { $gte: ["$monthsElapsed", 1] },
              { $lt: ["$monthsElapsed", "$duration"] },
              { $eq: ["$status", "active"] },
            ],
          },
          isOverdue: {
            $and: [
              { $lt: ["$monthsElapsed", "$duration"] },
              { $eq: ["$status", "active"] },
              {
                $lt: [
                  {
                    $dateAdd: {
                      startDate: "$startDate",
                      unit: "month",
                      amount: { $ceil: "$monthsElapsed" },
                    },
                  },
                  new Date(),
                ],
              },
            ],
          },
          payoutAmount: {
            $divide: ["$expectedReturn", "$duration"],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: ["$isDue", 1, 0] },
          },
          paid: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          overdue: {
            $sum: { $cond: ["$isOverdue", 1, 0] },
          },
          totalAmount: { $sum: "$expectedReturn" },
          pendingAmount: {
            $sum: { $cond: ["$isDue", "$payoutAmount", 0] },
          },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, "$actualReturn", 0],
            },
          },
          overdueAmount: {
            $sum: { $cond: ["$isOverdue", "$payoutAmount", 0] },
          },
          activeInvestors: { $addToSet: "$userId" },
        },
      },
      {
        $addFields: {
          activeInvestors: { $size: "$activeInvestors" },
        },
      },
    ]);

    const result = stats[0] || {
      total: 0,
      pending: 0,
      paid: 0,
      failed: 0,
      overdue: 0,
      totalAmount: 0,
      pendingAmount: 0,
      paidAmount: 0,
      overdueAmount: 0,
      activeInvestors: 0,
    };

    res.status(200).json({
      success: true,
      data: result,
      message: "Investment dues statistics retrieved successfully",
    });
  } catch (error: any) {
    console.error("Error fetching investment dues stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch investment dues statistics",
      error: error.message,
    });
  }
};

// Approve investment due
export const approveInvestmentDue = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { notes, payoutId } = req.body;

    // Find the user investment
    const userInvestment = await UserInvestment.findById(id).session(session);
    if (!userInvestment) {
      await session.abortTransaction();
      res.status(404).json({
        success: false,
        message: "Investment not found",
      });
      return;
    }

    // Check if investment is active and due for payout
    if (userInvestment.status !== "active") {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: "Investment is not active",
      });
      return;
    }

    // Get investment details
    const investment = await mongoose
      .model("Investment")
      .findById(userInvestment.investmentId)
      .session(session);
    if (!investment) {
      await session.abortTransaction();
      res.status(404).json({
        success: false,
        message: "Investment details not found",
      });
      return;
    }

    // Check if payout is actually due
    const monthsElapsed = Math.floor(
      (new Date().getTime() - userInvestment.startDate.getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    );
    const duration = investment.duration || 12;

    if (monthsElapsed < 1 || monthsElapsed >= duration) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: "Investment payout is not due at this time",
      });
      return;
    }

    // Calculate payout amount
    const payoutAmount = Math.round(userInvestment.expectedReturn / duration);

    // Create transaction record
    const transaction = new Transaction({
      user: userInvestment.userId,
      type: "investment",
      amount: payoutAmount,
      status: "completed",
      reference: `INV_PAYOUT_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: `Investment payout for ${investment.title}`,
      date: new Date(),
      paymentMethod: "wallet",
      metadata: {
        investmentId: userInvestment.investmentId,
        payoutId: id,
        approvedBy: req.user?.["_id"] ?? null,
        notes,
      },
    });

    await transaction.save({ session });

    // Update user's wallet
    const wallet = await Wallet.findOne({
      user: userInvestment.userId,
    }).session(session);
    if (wallet) {
      wallet.balance += payoutAmount;
      wallet.availableBalance += payoutAmount;
      await wallet.save({ session });
    }

    // Update actual return
    userInvestment.actualReturn =
      (userInvestment.actualReturn || 0) + payoutAmount;

    // Check if investment is complete
    if (userInvestment.actualReturn >= userInvestment.expectedReturn) {
      userInvestment.status = "completed";
    }

    await userInvestment.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Investment payout approved successfully",
      data: {
        transaction: transaction._id,
        amount: payoutAmount,
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error approving investment due:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve investment payout",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Reject investment due
export const rejectInvestmentDue = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason, payoutId } = req.body;

    if (!reason || !reason.trim()) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
      return;
    }

    // Find the user investment
    const userInvestment = await UserInvestment.findById(id).session(session);
    if (!userInvestment) {
      await session.abortTransaction();
      res.status(404).json({
        success: false,
        message: "Investment not found",
      });
      return;
    }

    // Check if investment is active
    if (userInvestment.status !== "active") {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: "Investment is not active",
      });
      return;
    }

    // Get investment details
    const investment = await mongoose
      .model("Investment")
      .findById(userInvestment.investmentId)
      .session(session);
    if (!investment) {
      await session.abortTransaction();
      res.status(404).json({
        success: false,
        message: "Investment details not found",
      });
      return;
    }

    // Calculate payout amount for rejection record
    const duration = investment.duration || 12;
    const payoutAmount = Math.round(userInvestment.expectedReturn / duration);

    // Create transaction record for the rejection
    const transaction = new Transaction({
      user: userInvestment.userId,
      type: "investment",
      amount: payoutAmount,
      status: "failed",
      reference: `INV_PAYOUT_REJECTED_${Date.now()}_${Math.floor(
        Math.random() * 1000
      )}`,
      description: `Investment payout rejected for ${investment.title}`,
      date: new Date(),
      paymentMethod: "wallet",
      metadata: {
        investmentId: userInvestment.investmentId,
        payoutId: id,
        rejectedBy: req.user?.["_id"] ?? null,
        reason,
      },
    });

    await transaction.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Investment payout rejected successfully",
      data: {
        transaction: transaction._id,
        reason,
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error rejecting investment due:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject investment payout",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
