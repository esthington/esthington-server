import type { Request, Response } from "express";
import UserInvestment from "../models/userInvestmentModel";
import Investment from "../models/investmentModel";
import mongoose from "mongoose";
import { Transaction, TransactionCheck, Wallet } from "../models/walletModel";

// Helper function to calculate payout schedule
const calculatePayoutSchedule = (
  startDate: Date,
  duration: number,
  payoutFrequency: string,
  expectedReturn: number
) => {
  const payouts = [];
  let payoutCount = duration; // Default monthly

  switch (payoutFrequency) {
    case "quarterly":
      payoutCount = Math.ceil(duration / 3);
      break;
    case "semi_annually":
      payoutCount = Math.ceil(duration / 6);
      break;
    case "annually":
      payoutCount = Math.ceil(duration / 12);
      break;
    case "end_of_term":
      payoutCount = 1;
      break;
  }

  const basePayoutAmount = Math.floor(expectedReturn / payoutCount);
  const remainder = expectedReturn - basePayoutAmount * payoutCount;

  for (let i = 1; i <= payoutCount; i++) {
    const payoutDate = new Date(startDate);

    switch (payoutFrequency) {
      case "monthly":
        payoutDate.setMonth(payoutDate.getMonth() + i);
        break;
      case "quarterly":
        payoutDate.setMonth(payoutDate.getMonth() + i * 3);
        break;
      case "semi_annually":
        payoutDate.setMonth(payoutDate.getMonth() + i * 6);
        break;
      case "annually":
        payoutDate.setFullYear(payoutDate.getFullYear() + i);
        break;
      case "end_of_term":
        payoutDate.setMonth(payoutDate.getMonth() + duration);
        break;
    }

    // Add remainder to last payout
    const amount =
      i === payoutCount ? basePayoutAmount + remainder : basePayoutAmount;

    payouts.push({
      payoutNumber: i,
      date: payoutDate,
      amount,
      isDue: payoutDate <= new Date(),
      isOverdue: payoutDate < new Date(),
    });
  }

  return payouts;
};

// Get investment dues with enhanced filtering and pagination
export const getInvestmentDues = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit as string) || 10)
    );
    const status = req.query.status as string;
    const sortBy = (req.query.sortBy as string) || "nextPayoutDate";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const search = req.query.search as string;
    const investmentType = req.query.investmentType as string;

    const skip = (page - 1) * limit;

    // Build match conditions
    const matchConditions: any = {
      status: "active", // Only active investments can have dues
      expectedReturn: { $gt: 0 },
      startDate: { $exists: true, $lte: new Date() },
    };

    // Build aggregation pipeline
    const pipeline: any[] = [
      { $match: matchConditions },

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
                phone: 1,
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
                investmentPeriod: 1,
                payoutFrequency: 1,
                type: 1,
                status: 1,
              },
            },
          ],
        },
      },

      // Filter out records without user or investment data
      {
        $match: {
          user: { $ne: [] },
          investment: { $ne: [] },
        },
      },

      { $unwind: "$user" },
      { $unwind: "$investment" },

      // Calculate payout details
      {
        $addFields: {
          duration: { $ifNull: ["$investment.investmentPeriod", 12] },
          payoutFrequency: {
            $ifNull: ["$investment.payoutFrequency", "monthly"],
          },

          // Calculate months elapsed since start
          monthsElapsed: {
            $divide: [
              { $subtract: [new Date(), "$startDate"] },
              1000 * 60 * 60 * 24 * 30.44, // More accurate month calculation
            ],
          },
        },
      },

      // Calculate payout schedule and current status
      {
        $addFields: {
          // Calculate total number of payouts
          totalPayouts: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$payoutFrequency", "quarterly"] },
                  then: { $ceil: { $divide: ["$duration", 3] } },
                },
                {
                  case: { $eq: ["$payoutFrequency", "semi_annually"] },
                  then: { $ceil: { $divide: ["$duration", 6] } },
                },
                {
                  case: { $eq: ["$payoutFrequency", "annually"] },
                  then: { $ceil: { $divide: ["$duration", 12] } },
                },
                { case: { $eq: ["$payoutFrequency", "end_of_term"] }, then: 1 },
              ],
              default: "$duration",
            },
          },

          // Calculate payout interval in months
          payoutIntervalMonths: {
            $switch: {
              branches: [
                { case: { $eq: ["$payoutFrequency", "quarterly"] }, then: 3 },
                {
                  case: { $eq: ["$payoutFrequency", "semi_annually"] },
                  then: 6,
                },
                { case: { $eq: ["$payoutFrequency", "annually"] }, then: 12 },
                {
                  case: { $eq: ["$payoutFrequency", "end_of_term"] },
                  then: "$duration",
                },
              ],
              default: 1,
            },
          },
        },
      },

      {
        $addFields: {
          // Calculate which payout period we're in
          currentPayoutPeriod: {
            $ceil: { $divide: ["$monthsElapsed", "$payoutIntervalMonths"] },
          },

          // Calculate payout amount
          payoutAmount: {
            $divide: ["$expectedReturn", "$totalPayouts"],
          },

          // Calculate next payout date
          nextPayoutDate: {
            $dateAdd: {
              startDate: "$startDate",
              unit: "month",
              amount: {
                $multiply: [
                  {
                    $ceil: {
                      $divide: ["$monthsElapsed", "$payoutIntervalMonths"],
                    },
                  },
                  "$payoutIntervalMonths",
                ],
              },
            },
          },
        },
      },

      {
        $addFields: {
          // Determine if payout is due
          isDue: {
            $and: [
              { $gte: ["$monthsElapsed", "$payoutIntervalMonths"] }, // At least one interval has passed
              { $lte: ["$currentPayoutPeriod", "$totalPayouts"] }, // Haven't exceeded total payouts
              { $lte: ["$nextPayoutDate", new Date()] }, // Payout date has arrived
            ],
          },

          // Determine if payout is overdue (more than 7 days past due date)
          isOverdue: {
            $and: [
              { $gte: ["$monthsElapsed", "$payoutIntervalMonths"] },
              { $lte: ["$currentPayoutPeriod", "$totalPayouts"] },
              {
                $lte: [
                  "$nextPayoutDate",
                  {
                    $dateSubtract: {
                      startDate: new Date(),
                      unit: "day",
                      amount: 7,
                    },
                  },
                ],
              },
            ],
          },

          // Calculate progress percentage
          progressPercentage: {
            $multiply: [
              {
                $divide: [{ $ifNull: ["$actualReturn", 0] }, "$expectedReturn"],
              },
              100,
            ],
          },

          // Calculate completed payouts
          completedPayouts: {
            $floor: {
              $divide: [
                { $ifNull: ["$actualReturn", 0] },
                { $divide: ["$expectedReturn", "$totalPayouts"] },
              ],
            },
          },
        },
      },

      // Determine final payout status
      {
        $addFields: {
          payoutStatus: {
            $cond: {
              if: { $gte: ["$actualReturn", "$expectedReturn"] },
              then: "completed",
              else: {
                $cond: {
                  if: "$isOverdue",
                  then: "overdue",
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

    // Add search filter
    if (search && search.trim()) {
      pipeline.push({
        $match: {
          $or: [
            { "user.firstName": { $regex: search, $options: "i" } },
            { "user.lastName": { $regex: search, $options: "i" } },
            { "user.email": { $regex: search, $options: "i" } },
            { "user.userName": { $regex: search, $options: "i" } },
            { "investment.title": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Add status filter
    if (status && status !== "all") {
      pipeline.push({
        $match: { payoutStatus: status },
      });
    }

    // Add investment type filter
    if (investmentType && investmentType !== "all") {
      pipeline.push({
        $match: { "investment.type": investmentType },
      });
    }

    // Add final projection
    pipeline.push({
      $project: {
        _id: 1,
        userId: 1,
        investmentId: 1,
        amount: 1,
        status: 1,
        startDate: 1,
        endDate: 1,
        expectedReturn: 1,
        actualReturn: 1,
        user: 1,
        investment: 1,
        payoutAmount: { $round: ["$payoutAmount", 2] },
        nextPayoutDate: 1,
        payoutStatus: 1,
        isDue: 1,
        isOverdue: 1,
        progressPercentage: { $round: ["$progressPercentage", 2] },
        currentPayoutPeriod: 1,
        totalPayouts: 1,
        completedPayouts: 1,
        remainingPayouts: { $subtract: ["$totalPayouts", "$completedPayouts"] },
        canApprove: "$isDue",
        daysOverdue: {
          $cond: {
            if: "$isOverdue",
            then: {
              $divide: [
                { $subtract: [new Date(), "$nextPayoutDate"] },
                1000 * 60 * 60 * 24,
              ],
            },
            else: 0,
          },
        },
      },
    });

    // Add sorting
    const sortStage: any = {};
    switch (sortBy) {
      case "nextPayoutDate":
        sortStage.nextPayoutDate = sortOrder;
        break;
      case "amount":
        sortStage.payoutAmount = sortOrder;
        break;
      case "user":
        sortStage["user.firstName"] = sortOrder;
        break;
      case "investment":
        sortStage["investment.title"] = sortOrder;
        break;
      case "status":
        sortStage.payoutStatus = sortOrder;
        break;
      default:
        sortStage.nextPayoutDate = 1;
    }

    pipeline.push({ $sort: sortStage });

    // Get total count
    const countPipeline = [...pipeline, { $count: "total" }];
    const totalResult = await UserInvestment.aggregate(countPipeline);
    const total = totalResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    // Execute query
    const dues = await UserInvestment.aggregate(pipeline);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: dues,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      message: "Investment dues retrieved successfully",
    });
  } catch (error: any) {
    console.error("Error fetching investment dues:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch investment dues",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get comprehensive investment dues statistics
export const getInvestmentDuesStats = async (req: Request, res: Response) => {
  try {
    const stats = await UserInvestment.aggregate([
      {
        $match: {
          status: "active",
          expectedReturn: { $gt: 0 },
          startDate: { $exists: true, $lte: new Date() },
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
      { $unwind: "$investment" },
      {
        $addFields: {
          duration: { $ifNull: ["$investment.investmentPeriod", 12] },
          payoutFrequency: {
            $ifNull: ["$investment.payoutFrequency", "monthly"],
          },
          monthsElapsed: {
            $divide: [
              { $subtract: [new Date(), "$startDate"] },
              1000 * 60 * 60 * 24 * 30.44,
            ],
          },
        },
      },
      {
        $addFields: {
          payoutIntervalMonths: {
            $switch: {
              branches: [
                { case: { $eq: ["$payoutFrequency", "quarterly"] }, then: 3 },
                {
                  case: { $eq: ["$payoutFrequency", "semi_annually"] },
                  then: 6,
                },
                { case: { $eq: ["$payoutFrequency", "annually"] }, then: 12 },
                {
                  case: { $eq: ["$payoutFrequency", "end_of_term"] },
                  then: "$duration",
                },
              ],
              default: 1,
            },
          },
          totalPayouts: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$payoutFrequency", "quarterly"] },
                  then: { $ceil: { $divide: ["$duration", 3] } },
                },
                {
                  case: { $eq: ["$payoutFrequency", "semi_annually"] },
                  then: { $ceil: { $divide: ["$duration", 6] } },
                },
                {
                  case: { $eq: ["$payoutFrequency", "annually"] },
                  then: { $ceil: { $divide: ["$duration", 12] } },
                },
                { case: { $eq: ["$payoutFrequency", "end_of_term"] }, then: 1 },
              ],
              default: "$duration",
            },
          },
        },
      },
      {
        $addFields: {
          nextPayoutDate: {
            $dateAdd: {
              startDate: "$startDate",
              unit: "month",
              amount: {
                $multiply: [
                  {
                    $ceil: {
                      $divide: ["$monthsElapsed", "$payoutIntervalMonths"],
                    },
                  },
                  "$payoutIntervalMonths",
                ],
              },
            },
          },
          payoutAmount: { $divide: ["$expectedReturn", "$totalPayouts"] },
        },
      },
      {
        $addFields: {
          isDue: {
            $and: [
              { $gte: ["$monthsElapsed", "$payoutIntervalMonths"] },
              { $lte: ["$nextPayoutDate", new Date()] },
            ],
          },
          isOverdue: {
            $and: [
              { $gte: ["$monthsElapsed", "$payoutIntervalMonths"] },
              {
                $lte: [
                  "$nextPayoutDate",
                  {
                    $dateSubtract: {
                      startDate: new Date(),
                      unit: "day",
                      amount: 7,
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalInvestments: { $sum: 1 },
          pendingPayouts: { $sum: { $cond: ["$isDue", 1, 0] } },
          overduePayouts: { $sum: { $cond: ["$isOverdue", 1, 0] } },
          completedInvestments: {
            $sum: {
              $cond: [{ $gte: ["$actualReturn", "$expectedReturn"] }, 1, 0],
            },
          },
          totalExpectedReturns: { $sum: "$expectedReturn" },
          totalActualReturns: { $sum: { $ifNull: ["$actualReturn", 0] } },
          pendingPayoutAmount: {
            $sum: { $cond: ["$isDue", "$payoutAmount", 0] },
          },
          overduePayoutAmount: {
            $sum: { $cond: ["$isOverdue", "$payoutAmount", 0] },
          },
          activeInvestors: { $addToSet: "$userId" },
          investmentTypes: { $addToSet: "$investment.type" },
        },
      },
      {
        $addFields: {
          activeInvestorsCount: { $size: "$activeInvestors" },
          investmentTypesCount: { $size: "$investmentTypes" },
          completionRate: {
            $multiply: [
              { $divide: ["$totalActualReturns", "$totalExpectedReturns"] },
              100,
            ],
          },
        },
      },
      {
        $project: {
          activeInvestors: 0,
          investmentTypes: 0,
        },
      },
    ]);

    const result = stats[0] || {
      totalInvestments: 0,
      pendingPayouts: 0,
      overduePayouts: 0,
      completedInvestments: 0,
      totalExpectedReturns: 0,
      totalActualReturns: 0,
      pendingPayoutAmount: 0,
      overduePayoutAmount: 0,
      activeInvestorsCount: 0,
      investmentTypesCount: 0,
      completionRate: 0,
    };

    // Round monetary values
    result.totalExpectedReturns =
      Math.round(result.totalExpectedReturns * 100) / 100;
    result.totalActualReturns =
      Math.round(result.totalActualReturns * 100) / 100;
    result.pendingPayoutAmount =
      Math.round(result.pendingPayoutAmount * 100) / 100;
    result.overduePayoutAmount =
      Math.round(result.overduePayoutAmount * 100) / 100;
    result.completionRate = Math.round(result.completionRate * 100) / 100;

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
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Approve investment payout with enhanced validation
export const approveInvestmentDue = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { notes, payoutAmount: customPayoutAmount } = req.body;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: "Invalid investment ID",
      });
      return;
    }

    // Find user investment with session
    const userInvestment = await UserInvestment.findById(id)
      .populate("investmentId")
      .session(session);

    if (!userInvestment) {
      await session.abortTransaction();
      res.status(404).json({
        success: false,
        message: "Investment not found",
      });
      return;
    }

    // Validate investment status
    if (userInvestment.status !== "active") {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: `Cannot approve payout for ${userInvestment.status} investment`,
      });
      return;
    }

    // Check if investment is complete
    if (userInvestment.actualReturn >= userInvestment.expectedReturn) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: "Investment has already been fully paid out",
      });
      return;
    }

    const investment = userInvestment.investmentId as any;
    const duration = investment.investmentPeriod || 12;
    const payoutFrequency = investment.payoutFrequency || "monthly";

    // Calculate if payout is actually due
    const monthsElapsed =
      (new Date().getTime() - userInvestment.startDate.getTime()) /
      (1000 * 60 * 60 * 24 * 30.44);

    let payoutIntervalMonths = 1;
    switch (payoutFrequency) {
      case "quarterly":
        payoutIntervalMonths = 3;
        break;
      case "semi_annually":
        payoutIntervalMonths = 6;
        break;
      case "annually":
        payoutIntervalMonths = 12;
        break;
      case "end_of_term":
        payoutIntervalMonths = duration;
        break;
    }

    if (monthsElapsed < payoutIntervalMonths) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: "Payout is not yet due based on the payout frequency",
      });
      return;
    }

    // Calculate payout amount
    const totalPayouts = Math.ceil(duration / payoutIntervalMonths);
    const standardPayoutAmount =
      Math.round((userInvestment.expectedReturn / totalPayouts) * 100) / 100;
    const payoutAmount = customPayoutAmount || standardPayoutAmount;

    // Validate payout amount
    const remainingAmount =
      userInvestment.expectedReturn - (userInvestment.actualReturn || 0);
    if (payoutAmount > remainingAmount) {
      await session.abortTransaction();
      res.status(400).json({
        success: false,
        message: `Payout amount (${payoutAmount}) exceeds remaining amount (${remainingAmount})`,
      });
      return;
    }

    // Find or create user wallet
    let wallet = await Wallet.findOne({ user: userInvestment.userId }).session(
      session
    );
    if (!wallet) {
      wallet = new Wallet({
        user: userInvestment.userId,
        balance: 0,
        availableBalance: 0,
      });
    }

    // Create transaction record
    const transactionRef = `INV_PAYOUT_${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}`;
    const transaction = new Transaction({
      user: userInvestment.userId,
      type: "investment_payout",
      amount: payoutAmount,
      status: "completed",
      reference: transactionRef,
      check: TransactionCheck.INCOMING,
      description: `Investment payout for "${investment.title}"`,
      date: new Date(),
      paymentMethod: "wallet",
      metadata: {
        investmentId: userInvestment.investmentId,
        userInvestmentId: userInvestment._id,
        approvedBy: req.user?.["_id"],
        notes: notes || "Payout approved by admin",
        payoutNumber: Math.ceil(monthsElapsed / payoutIntervalMonths),
      },
    });

    await transaction.save({ session });

    // Update wallet balance
    wallet.balance += payoutAmount;
    wallet.availableBalance += payoutAmount;
    await wallet.save({ session });

    // Update user investment
    userInvestment.actualReturn =
      (userInvestment.actualReturn || 0) + payoutAmount;

    // Check if investment is now complete
    if (userInvestment.actualReturn >= userInvestment.expectedReturn) {
      userInvestment.status = "completed";
    }

    // Update next payout date
    const nextPayoutDate = new Date(userInvestment.startDate);
    nextPayoutDate.setMonth(
      nextPayoutDate.getMonth() +
        (Math.ceil(monthsElapsed / payoutIntervalMonths) + 1) *
          payoutIntervalMonths
    );
    userInvestment.nextPayoutDate = nextPayoutDate;

    await userInvestment.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Investment payout approved and processed successfully",
      data: {
        transactionId: transaction._id,
        transactionRef,
        amount: payoutAmount,
        newWalletBalance: wallet.balance,
        investmentStatus: userInvestment.status,
        completionPercentage: Math.round(
          (userInvestment.actualReturn / userInvestment.expectedReturn) * 100
        ),
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error approving investment payout:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve investment payout",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

// Reject investment payout with detailed logging
export const rejectInvestmentDue = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
       res.status(400).json({
        success: false,
        message: "Invalid investment ID",
       });
       return;
    }

    if (!reason || !reason.trim()) {
      await session.abortTransaction();
       res.status(400).json({
        success: false,
        message: "Rejection reason is required",
       });
      return;
    }

    // Find user investment
    const userInvestment = await UserInvestment.findById(id)
      .populate("investmentId")
      .session(session);

    if (!userInvestment) {
      await session.abortTransaction();
       res.status(404).json({
        success: false,
        message: "Investment not found",
       });
      return;
    }

    if (userInvestment.status !== "active") {
      await session.abortTransaction();
       res.status(400).json({
        success: false,
        message: `Cannot reject payout for ${userInvestment.status} investment`,
       });
       return;
    }

    const investment = userInvestment.investmentId as any;

    // Create rejection transaction record
    const transactionRef = `INV_PAYOUT_REJECTED_${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}`;
    const transaction = new Transaction({
      user: userInvestment.userId,
      type: "investment_payout",
      amount: 0, // No amount for rejection
      check: TransactionCheck.INCOMING,
      status: "failed",
      reference: transactionRef,
      description: `Investment payout rejected for "${investment.title}"`,
      date: new Date(),
      paymentMethod: "wallet",
      metadata: {
        investmentId: userInvestment.investmentId,
        userInvestmentId: userInvestment._id,
        rejectedBy: req.user?.["_id"],
        rejectionReason: reason.trim(),
      },
    });

    await transaction.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Investment payout rejected successfully",
      data: {
        transactionId: transaction._id,
        transactionRef,
        rejectionReason: reason.trim(),
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error rejecting investment payout:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject investment payout",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    session.endSession();
  }
};
