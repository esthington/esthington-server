import type { Request, Response } from "express";
import Company from "../models/companyModel";
import { Transaction, Wallet } from "../models/walletModel";
import { Referral } from "../models/referralModel";
import Investment from "../models/investmentModel";
import Property from "../models/propertyModel";
import User from "../models/userModel";
import UserInvestment from "../models/userInvestmentModel";
import PropertyPayment from "../models/propertyPaymentModel";
import MarketplaceListing from "../models/marketplaceModel";

export class DashboardController {
  // Get comprehensive dashboard statistics based on user role
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const { dateRange = "month", startDate, endDate } = req.query;
      const user = (req as any).user;

      // Calculate date range
      const now = new Date();
      let start: Date;
      let end: Date = now;

      switch (dateRange) {
        case "today":
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "quarter":
          start = new Date(
            now.getFullYear(),
            Math.floor(now.getMonth() / 3) * 3,
            1
          );
          break;
        case "year":
          start = new Date(now.getFullYear(), 0, 1);
          break;
        case "custom":
          start = startDate
            ? new Date(startDate as string)
            : new Date(now.getFullYear(), now.getMonth(), 1);
          end = endDate ? new Date(endDate as string) : now;
          break;
        default:
          start = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      let stats: any = {};

      if (user.role === "admin" || user.role === "super_admin") {
        stats = await DashboardController.getAdminStats(start, end);
      } else if (user.role === "agent") {
        stats = await DashboardController.getAgentStats(user._id, start, end);
      } else {
        stats = await DashboardController.getBuyerStats(user._id, start, end);
      }

      res.status(200).json({
        success: true,
        data: stats,
        message: "Dashboard statistics retrieved successfully",
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Admin dashboard statistics
  static async getAdminStats(start: Date, end: Date) {
    const [
      userStats,
      transactionStats,
      propertyStats,
      investmentStats,
      referralStats,
      companyStats,
      marketplaceStats,
      revenueStats,
    ] = await Promise.all([
      // User Statistics
      User.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            active: [{ $match: { isActive: true } }, { $count: "count" }],
            newThisMonth: [
              { $match: { createdAt: { $gte: start, $lte: end } } },
              { $count: "count" },
            ],
            previousMonth: [
              {
                $match: {
                  createdAt: {
                    $gte: new Date(
                      start.getFullYear(),
                      start.getMonth() - 1,
                      1
                    ),
                    $lt: start,
                  },
                },
              },
              { $count: "count" },
            ],
            byRole: [
              {
                $group: {
                  _id: "$role",
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),

      // Transaction Statistics
      Transaction.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            pending: [{ $match: { status: "pending" } }, { $count: "count" }],
            completed: [
              { $match: { status: "completed" } },
              { $count: "count" },
            ],
            totalVolume: [
              { $match: { status: "completed" } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
            monthlyVolume: [
              {
                $match: {
                  status: "completed",
                  createdAt: { $gte: start, $lte: end },
                },
              },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
            byType: [
              {
                $match: { status: "completed" },
              },
              {
                $group: {
                  _id: "$type",
                  count: { $sum: 1 },
                  volume: { $sum: "$amount" },
                },
              },
            ],
          },
        },
      ]),

      // Property Statistics
      Property.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            available: [
              { $match: { status: "Available" } },
              { $count: "count" },
            ],
            sold: [{ $match: { status: "Sold Out" } }, { $count: "count" }],
            featured: [{ $match: { featured: true } }, { $count: "count" }],
            totalValue: [
              { $group: { _id: null, total: { $sum: "$totalRevenue" } } },
            ],
            averagePrice: [{ $group: { _id: null, avg: { $avg: "$price" } } }],
            totalPlots: [
              { $group: { _id: null, total: { $sum: "$totalPlots" } } },
            ],
            soldPlots: [
              { $group: { _id: null, total: { $sum: "$soldPlots" } } },
            ],
          },
        },
      ]),

      // Investment Statistics
      Investment.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            active: [{ $match: { status: "active" } }, { $count: "count" }],
            totalValue: [
              { $group: { _id: null, total: { $sum: "$targetAmount" } } },
            ],
            totalRaised: [
              { $group: { _id: null, total: { $sum: "$raisedAmount" } } },
            ],
            totalInvestors: [
              { $group: { _id: null, total: { $sum: "$totalInvestors" } } },
            ],
            averageROI: [
              { $group: { _id: null, avg: { $avg: "$returnRate" } } },
            ],
            featured: [{ $match: { featured: true } }, { $count: "count" }],
            trending: [{ $match: { trending: true } }, { $count: "count" }],
          },
        },
      ]),

      // Referral Statistics
      Referral.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            active: [{ $match: { status: "active" } }, { $count: "count" }],
            totalEarnings: [
              { $group: { _id: null, total: { $sum: "$earnings" } } },
            ],
            topReferrers: [
              { $sort: { earnings: -1 } },
              { $limit: 5 },
              {
                $lookup: {
                  from: "users",
                  localField: "referrer",
                  foreignField: "_id",
                  as: "referrerInfo",
                },
              },
              { $unwind: "$referrerInfo" },
              {
                $project: {
                  name: {
                    $concat: [
                      "$referrerInfo.firstName",
                      " ",
                      "$referrerInfo.lastName",
                    ],
                  },
                  earnings: 1,
                  totalReferrals: 1,
                  activeReferrals: 1,
                },
              },
            ],
          },
        },
      ]),

      // Company Statistics
      Company.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            active: [{ $match: { active: true } }, { $count: "count" }],
          },
        },
      ]),

      // Marketplace Statistics
      MarketplaceListing.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            available: [
              { $match: { status: "available" } },
              { $count: "count" },
            ],
            sold: [{ $match: { status: "sold" } }, { $count: "count" }],
            totalRevenue: [
              { $group: { _id: null, total: { $sum: "$totalRevenue" } } },
            ],
            totalSales: [
              { $group: { _id: null, total: { $sum: "$soldQuantity" } } },
            ],
          },
        },
      ]),

      // Revenue Statistics
      PropertyPayment.aggregate([
        {
          $facet: {
            totalRevenue: [
              { $match: { status: "completed" } },
              { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ],
            monthlyRevenue: [
              {
                $match: {
                  status: "completed",
                  paymentDate: { $gte: start, $lte: end },
                },
              },
              { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ],
            totalCommissions: [
              { $match: { status: "completed" } },
              { $unwind: "$commissions" },
              { $group: { _id: null, total: { $sum: "$commissions.amount" } } },
            ],
          },
        },
      ]),
    ]);

    return {
      // User Stats
      totalUsers: userStats[0]?.total[0]?.count || 0,
      activeUsers: userStats[0]?.active[0]?.count || 0,
      newUsersThisMonth: userStats[0]?.newThisMonth[0]?.count || 0,
      userGrowthRate: calculateGrowthRate(
        userStats[0]?.newThisMonth[0]?.count || 0,
        userStats[0]?.previousMonth[0]?.count || 0
      ),
      usersByRole: userStats[0]?.byRole || [],

      // Transaction Stats
      totalTransactions: transactionStats[0]?.total[0]?.count || 0,
      pendingTransactions: transactionStats[0]?.pending[0]?.count || 0,
      completedTransactions: transactionStats[0]?.completed[0]?.count || 0,
      totalTransactionVolume: transactionStats[0]?.totalVolume[0]?.total || 0,
      monthlyTransactionVolume:
        transactionStats[0]?.monthlyVolume[0]?.total || 0,
      transactionsByType: transactionStats[0]?.byType || [],

      // Property Stats
      totalProperties: propertyStats[0]?.total[0]?.count || 0,
      availableProperties: propertyStats[0]?.available[0]?.count || 0,
      soldProperties: propertyStats[0]?.sold[0]?.count || 0,
      featuredProperties: propertyStats[0]?.featured[0]?.count || 0,
      totalPropertyValue: propertyStats[0]?.totalValue[0]?.total || 0,
      averagePropertyPrice: propertyStats[0]?.averagePrice[0]?.avg || 0,
      totalPlots: propertyStats[0]?.totalPlots[0]?.total || 0,
      soldPlots: propertyStats[0]?.soldPlots[0]?.total || 0,

      // Investment Stats
      totalInvestments: investmentStats[0]?.total[0]?.count || 0,
      activeInvestments: investmentStats[0]?.active[0]?.count || 0,
      totalInvestmentValue: investmentStats[0]?.totalValue[0]?.total || 0,
      totalRaisedAmount: investmentStats[0]?.totalRaised[0]?.total || 0,
      totalInvestors: investmentStats[0]?.totalInvestors[0]?.total || 0,
      averageROI: investmentStats[0]?.averageROI[0]?.avg || 0,
      featuredInvestments: investmentStats[0]?.featured[0]?.count || 0,
      trendingInvestments: investmentStats[0]?.trending[0]?.count || 0,

      // Referral Stats
      totalReferrals: referralStats[0]?.total[0]?.count || 0,
      activeReferrals: referralStats[0]?.active[0]?.count || 0,
      totalReferralEarnings: referralStats[0]?.totalEarnings[0]?.total || 0,
      topReferrers: referralStats[0]?.topReferrers || [],

      // Company Stats
      totalCompanies: companyStats[0]?.total[0]?.count || 0,
      activeCompanies: companyStats[0]?.active[0]?.count || 0,

      // Marketplace Stats
      totalMarketplaceListings: marketplaceStats[0]?.total[0]?.count || 0,
      availableMarketplaceListings:
        marketplaceStats[0]?.available[0]?.count || 0,
      soldMarketplaceListings: marketplaceStats[0]?.sold[0]?.count || 0,
      totalMarketplaceRevenue: marketplaceStats[0]?.totalRevenue[0]?.total || 0,
      totalMarketplaceSales: marketplaceStats[0]?.totalSales[0]?.total || 0,

      // Revenue Stats
      totalPlatformRevenue: revenueStats[0]?.totalRevenue[0]?.total || 0,
      monthlyPlatformRevenue: revenueStats[0]?.monthlyRevenue[0]?.total || 0,
      totalCommissionsPaid: revenueStats[0]?.totalCommissions[0]?.total || 0,
    };
  }

  // Agent dashboard statistics
  static async getAgentStats(agentId: string, start: Date, end: Date) {
    console.log("Agent Stats ID:", agentId);

    try {
      const [
        agentProperties,
        agentOwnedProperties,
        agentReferrals,
        agentCommissions,
        agentWallet,
        agentInvestments,
      ] = await Promise.all([
        // Agent's Properties (created by agent)
        Property.aggregate([
          { $match: { createdBy: agentId } },
          {
            $facet: {
              total: [{ $count: "count" }],
              available: [
                { $match: { status: "Available" } },
                { $count: "count" },
              ],
              sold: [{ $match: { status: "Sold Out" } }, { $count: "count" }],
              totalRevenue: [
                { $group: { _id: null, total: { $sum: "$totalRevenue" } } },
              ],
              totalPlots: [
                { $group: { _id: null, total: { $sum: "$totalPlots" } } },
              ],
              soldPlots: [
                { $group: { _id: null, total: { $sum: "$soldPlots" } } },
              ],
              recentSales: [
                { $match: { lastSaleDate: { $gte: start, $lte: end } } },
                { $count: "count" },
              ],
            },
          },
        ]),

        // Agent's Owned Properties (properties purchased by agent)
        PropertyPayment.aggregate([
          { $match: { buyerId: agentId } },
          {
            $facet: {
              totalOwnedProperties: [{ $count: "count" }],
              totalOwnedPlots: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: { $size: "$plotIds" } },
                  },
                },
              ],
              totalSpentOnProperties: [
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
              ],
              recentPurchases: [
                { $match: { paymentDate: { $gte: start, $lte: end } } },
                { $count: "count" },
              ],
              ownedPropertiesDetails: [
                {
                  $lookup: {
                    from: "properties",
                    localField: "propertyId",
                    foreignField: "_id",
                    as: "propertyDetails",
                  },
                },
                { $unwind: "$propertyDetails" },
                {
                  $group: {
                    _id: "$propertyDetails.title",
                    plotCount: { $sum: { $size: "$plotIds" } },
                    totalSpent: { $sum: "$totalAmount" },
                    location: { $first: "$propertyDetails.location" },
                  },
                },
              ],
            },
          },
        ]),

        // Agent's Referrals
        Referral.aggregate([
          { $match: { referrer: agentId } },
          {
            $facet: {
              total: [{ $count: "count" }],
              active: [{ $match: { status: "active" } }, { $count: "count" }],
              totalEarnings: [
                { $group: { _id: null, total: { $sum: "$earnings" } } },
              ],
              monthlyEarnings: [
                {
                  $match: { lastActivityDate: { $gte: start, $lte: end } },
                },
                { $group: { _id: null, total: { $sum: "$earnings" } } },
              ],
              level1Earnings: [
                { $group: { _id: null, total: { $sum: "$level1Earnings" } } },
              ],
              level2Earnings: [
                { $group: { _id: null, total: { $sum: "$level2Earnings" } } },
              ],
              level3Earnings: [
                { $group: { _id: null, total: { $sum: "$level3Earnings" } } },
              ],
            },
          },
        ]),

        // Agent's Commission Payments
        PropertyPayment.aggregate([
          { $unwind: "$commissions" },
          { $match: { "commissions.referrerId": agentId } },
          {
            $facet: {
              totalCommissions: [
                {
                  $group: { _id: null, total: { $sum: "$commissions.amount" } },
                },
              ],
              paidCommissions: [
                { $match: { "commissions.status": "paid" } },
                {
                  $group: { _id: null, total: { $sum: "$commissions.amount" } },
                },
              ],
              pendingCommissions: [
                { $match: { "commissions.status": "pending" } },
                {
                  $group: { _id: null, total: { $sum: "$commissions.amount" } },
                },
              ],
              monthlyCommissions: [
                {
                  $match: {
                    "commissions.paidAt": { $gte: start, $lte: end },
                    "commissions.status": "paid",
                  },
                },
                {
                  $group: { _id: null, total: { $sum: "$commissions.amount" } },
                },
              ],
            },
          },
        ]),

        // Agent's Wallet
        Wallet.findOne({ user: agentId }).select("balance availableBalance"),

        // Agent's Investments
        UserInvestment.aggregate([
          { $match: { userId: agentId } },
          {
            $facet: {
              total: [{ $count: "count" }],
              active: [{ $match: { status: "active" } }, { $count: "count" }],
              totalInvested: [
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
              totalReturns: [
                { $group: { _id: null, total: { $sum: "$actualReturn" } } },
              ],
              expectedReturns: [
                { $group: { _id: null, total: { $sum: "$expectedReturn" } } },
              ],
            },
          },
        ]),
      ]);

      console.log(
        "Agent Properties Result:",
        JSON.stringify(agentProperties, null, 2)
      );
      console.log(
        "Agent Referrals Result:",
        JSON.stringify(agentReferrals, null, 2)
      );

      return {
        // Property Stats (created by agent)
        totalProperties: agentProperties[0]?.total[0]?.count || 0,
        availableProperties: agentProperties[0]?.available[0]?.count || 0,
        soldProperties: agentProperties[0]?.sold[0]?.count || 0,
        totalPropertyRevenue: agentProperties[0]?.totalRevenue[0]?.total || 0,
        totalPlots: agentProperties[0]?.totalPlots[0]?.total || 0,
        soldPlots: agentProperties[0]?.soldPlots[0]?.total || 0,
        recentSales: agentProperties[0]?.recentSales[0]?.count || 0,

        // Owned Properties Stats (purchased by agent)
        totalOwnedProperties:
          agentOwnedProperties[0]?.totalOwnedProperties[0]?.count || 0,
        totalOwnedPlots:
          agentOwnedProperties[0]?.totalOwnedPlots[0]?.total || 0,
        totalSpentOnProperties:
          agentOwnedProperties[0]?.totalSpentOnProperties[0]?.total || 0,
        recentPropertyPurchases:
          agentOwnedProperties[0]?.recentPurchases[0]?.count || 0,
        ownedPropertiesDetails:
          agentOwnedProperties[0]?.ownedPropertiesDetails || [],

        // Referral Stats
        totalReferrals: agentReferrals[0]?.total[0]?.count || 0,
        activeReferrals: agentReferrals[0]?.active[0]?.count || 0,
        totalReferralEarnings: agentReferrals[0]?.totalEarnings[0]?.total || 0,
        monthlyReferralEarnings:
          agentReferrals[0]?.monthlyEarnings[0]?.total || 0,
        level1Earnings: agentReferrals[0]?.level1Earnings[0]?.total || 0,
        level2Earnings: agentReferrals[0]?.level2Earnings[0]?.total || 0,
        level3Earnings: agentReferrals[0]?.level3Earnings[0]?.total || 0,

        // Commission Stats
        totalCommissions: agentCommissions[0]?.totalCommissions[0]?.total || 0,
        paidCommissions: agentCommissions[0]?.paidCommissions[0]?.total || 0,
        pendingCommissions:
          agentCommissions[0]?.pendingCommissions[0]?.total || 0,
        monthlyCommissions:
          agentCommissions[0]?.monthlyCommissions[0]?.total || 0,

        // Wallet Stats
        walletBalance: agentWallet?.balance || 0,
        availableBalance: agentWallet?.availableBalance || 0,

        // Investment Stats
        totalInvestments: agentInvestments[0]?.total[0]?.count || 0,
        activeInvestments: agentInvestments[0]?.active[0]?.count || 0,
        totalInvested: agentInvestments[0]?.totalInvested[0]?.total || 0,
        totalReturns: agentInvestments[0]?.totalReturns[0]?.total || 0,
        expectedReturns: agentInvestments[0]?.expectedReturns[0]?.total || 0,
      };
    } catch (error) {
      console.error("Error in getAgentStats:", error);
      throw error;
    }
  }

  // Buyer dashboard statistics
  static async getBuyerStats(buyerId: string, start: Date, end: Date) {
    console.log("Buyer Stats ID:", buyerId);

    try {
      const [
        buyerInvestments,
        buyerProperties,
        buyerWallet,
        buyerTransactions,
        buyerMarketplace,
      ] = await Promise.all([
        // Buyer's Investments
        UserInvestment.aggregate([
          { $match: { userId: buyerId } },
          {
            $facet: {
              total: [{ $count: "count" }],
              active: [{ $match: { status: "active" } }, { $count: "count" }],
              completed: [
                { $match: { status: "completed" } },
                { $count: "count" },
              ],
              totalInvested: [
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
              totalReturns: [
                { $group: { _id: null, total: { $sum: "$actualReturn" } } },
              ],
              expectedReturns: [
                { $group: { _id: null, total: { $sum: "$expectedReturn" } } },
              ],
              monthlyReturns: [
                {
                  $unwind: "$payouts",
                },
                {
                  $match: {
                    "payouts.date": { $gte: start, $lte: end },
                    "payouts.status": "paid",
                  },
                },
                { $group: { _id: null, total: { $sum: "$payouts.amount" } } },
              ],
            },
          },
        ]),

        // Buyer's Property Purchases
        PropertyPayment.aggregate([
          { $match: { buyerId: buyerId } },
          {
            $facet: {
              totalPurchases: [{ $count: "count" }],
              totalSpent: [
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
              ],
              totalPlots: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: { $size: "$plotIds" } },
                  },
                },
              ],
              recentPurchases: [
                { $match: { paymentDate: { $gte: start, $lte: end } } },
                { $count: "count" },
              ],
              monthlySpent: [
                { $match: { paymentDate: { $gte: start, $lte: end } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
              ],
            },
          },
        ]),

        // Buyer's Wallet
        Wallet.findOne({ user: buyerId }).select(
          "balance availableBalance pendingBalance"
        ),

        // Buyer's Transactions
        Transaction.aggregate([
          { $match: { user: buyerId } },
          {
            $facet: {
              total: [{ $count: "count" }],
              deposits: [
                { $match: { type: "deposit" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
              withdrawals: [
                { $match: { type: "withdrawal" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
              monthlyDeposits: [
                {
                  $match: {
                    type: "deposit",
                    date: { $gte: start, $lte: end },
                  },
                },
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
              monthlyWithdrawals: [
                {
                  $match: {
                    type: "withdrawal",
                    date: { $gte: start, $lte: end },
                  },
                },
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
            },
          },
        ]),

        // Buyer's Marketplace Purchases
        MarketplaceListing.aggregate([
          { $unwind: "$purchases" },
          { $match: { "purchases.buyerId": buyerId } },
          {
            $facet: {
              totalPurchases: [{ $count: "count" }],
              totalSpent: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: "$purchases.totalAmount" },
                  },
                },
              ],
              totalItems: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: "$purchases.quantity" },
                  },
                },
              ],
              monthlyPurchases: [
                {
                  $match: {
                    "purchases.purchaseDate": { $gte: start, $lte: end },
                  },
                },
                { $count: "count" },
              ],
            },
          },
        ]),
      ]);

      console.log(
        "Buyer Properties Result:",
        JSON.stringify(buyerProperties, null, 2)
      );

      return {
        // Investment Stats
        totalInvestments: buyerInvestments[0]?.total[0]?.count || 0,
        activeInvestments: buyerInvestments[0]?.active[0]?.count || 0,
        completedInvestments: buyerInvestments[0]?.completed[0]?.count || 0,
        totalInvested: buyerInvestments[0]?.totalInvested[0]?.total || 0,
        totalReturns: buyerInvestments[0]?.totalReturns[0]?.total || 0,
        expectedReturns: buyerInvestments[0]?.expectedReturns[0]?.total || 0,
        monthlyReturns: buyerInvestments[0]?.monthlyReturns[0]?.total || 0,

        // Property Stats
        totalPropertyPurchases:
          buyerProperties[0]?.totalPurchases[0]?.count || 0,
        totalPropertySpent: buyerProperties[0]?.totalSpent[0]?.total || 0,
        totalPlotsOwned: buyerProperties[0]?.totalPlots[0]?.total || 0,
        recentPropertyPurchases:
          buyerProperties[0]?.recentPurchases[0]?.count || 0,
        monthlyPropertySpent: buyerProperties[0]?.monthlySpent[0]?.total || 0,

        // Wallet Stats
        walletBalance: buyerWallet?.balance || 0,
        availableBalance: buyerWallet?.availableBalance || 0,
        pendingBalance: buyerWallet?.pendingBalance || 0,

        // Transaction Stats
        totalTransactions: buyerTransactions[0]?.total[0]?.count || 0,
        totalDeposits: buyerTransactions[0]?.deposits[0]?.total || 0,
        totalWithdrawals: buyerTransactions[0]?.withdrawals[0]?.total || 0,
        monthlyDeposits: buyerTransactions[0]?.monthlyDeposits[0]?.total || 0,
        monthlyWithdrawals:
          buyerTransactions[0]?.monthlyWithdrawals[0]?.total || 0,

        // Marketplace Stats
        totalMarketplacePurchases:
          buyerMarketplace[0]?.totalPurchases[0]?.count || 0,
        totalMarketplaceSpent: buyerMarketplace[0]?.totalSpent[0]?.total || 0,
        totalItemsPurchased: buyerMarketplace[0]?.totalItems[0]?.total || 0,
        monthlyMarketplacePurchases:
          buyerMarketplace[0]?.monthlyPurchases[0]?.count || 0,
      };
    } catch (error) {
      console.error("Error in getBuyerStats:", error);
      throw error;
    }
  }

  // Get recent activity based on user role
  static async getRecentActivity(req: Request, res: Response) {
    try {
      const { limit = 10 } = req.query;
      const user = (req as any).user;

      let activities: any[] = [];

      if (user.role === "admin" || user.role === "super_admin") {
        activities = await DashboardController.getAdminActivity(Number(limit));
      } else if (user.role === "agent") {
        activities = await DashboardController.getAgentActivity(
          user._id,
          Number(limit)
        );
      } else {
        activities = await DashboardController.getBuyerActivity(
          user._id,
          Number(limit)
        );
      }

      res.status(200).json({
        success: true,
        data: activities,
        message: "Recent activity retrieved successfully",
      });
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch recent activity",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Admin recent activity
  static async getAdminActivity(limit: number) {
    const [
      recentTransactions,
      recentUsers,
      recentProperties,
      recentInvestments,
    ] = await Promise.all([
      Transaction.find()
        .populate("user", "firstName lastName avatar")
        .sort({ createdAt: -1 })
        .limit(Math.floor(limit / 4))
        .lean(),

      User.find()
        .sort({ createdAt: -1 })
        .limit(Math.floor(limit / 4))
        .lean(),

      Property.find()
        .populate("companyId", "name")
        .sort({ createdAt: -1 })
        .limit(Math.floor(limit / 4))
        .lean(),

      Investment.find()
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .limit(Math.floor(limit / 4))
        .lean(),
    ]);

    const activities = [
      ...recentTransactions.map((transaction) => ({
        id: transaction._id,
        type: "transaction" as const,
        title: getActivityTitle(transaction.type),
        description: transaction.description,
        user: transaction.user
          ? {
              id: (transaction.user as any)._id,
              name: `${(transaction.user as any).firstName} ${
                (transaction.user as any).lastName
              }`,
              avatar: (transaction.user as any).avatar,
            }
          : undefined,
        amount: transaction.amount,
        timestamp: transaction.createdAt,
        status: transaction.status,
      })),
      ...recentUsers.map((user) => ({
        id: user._id,
        type: "user_registration" as const,
        title: "New User Registration",
        description: `${user.firstName} ${user.lastName} joined as ${user.role}`,
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          avatar: user.avatar,
        },
        timestamp: user.createdAt,
        status: "completed" as const,
      })),
      ...recentProperties.map((property) => ({
        id: property._id,
        type: "property_listing" as const,
        title: "New Property Listed",
        description: `${property.title} in ${property.location}`,
        timestamp: property.createdAt,
        status: "completed" as const,
      })),
      ...recentInvestments.map((investment) => ({
        id: investment._id,
        type: "investment_created" as const,
        title: "New Investment Opportunity",
        description: `${investment.title} - ${investment.returnRate}% ROI`,
        timestamp: investment.createdAt,
        status: "completed" as const,
      })),
    ];

    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  // Agent recent activity
  static async getAgentActivity(agentId: string, limit: number) {
    const [agentTransactions, agentProperties, agentReferrals] =
      await Promise.all([
        Transaction.find({ user: agentId })
          .sort({ createdAt: -1 })
          .limit(Math.floor(limit / 3))
          .lean(),

        Property.find({ createdBy: agentId })
          .sort({ createdAt: -1 })
          .limit(Math.floor(limit / 3))
          .lean(),

        Referral.find({ referrer: agentId })
          .populate("referred", "firstName lastName")
          .sort({ createdAt: -1 })
          .limit(Math.floor(limit / 3))
          .lean(),
      ]);

    const activities = [
      ...agentTransactions.map((transaction) => ({
        id: transaction._id,
        type: "transaction" as const,
        title: getActivityTitle(transaction.type),
        description: transaction.description,
        amount: transaction.amount,
        timestamp: transaction.createdAt,
        status: transaction.status,
      })),
      ...agentProperties.map((property) => ({
        id: property._id,
        type: "property_listing" as const,
        title: "Property Listed",
        description: `${property.title} in ${property.location}`,
        timestamp: property.createdAt,
        status: "completed" as const,
      })),
      ...agentReferrals.map((referral) => ({
        id: referral._id,
        type: "referral" as const,
        title: "New Referral",
        description: `Referred ${(referral.referred as any)?.firstName} ${
          (referral.referred as any)?.lastName
        }`,
        timestamp: referral.createdAt,
        status: referral.status,
      })),
    ];

    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  // Buyer recent activity
  static async getBuyerActivity(buyerId: string, limit: number) {
    const [buyerTransactions, buyerInvestments, buyerProperties] =
      await Promise.all([
        Transaction.find({ user: buyerId })
          .sort({ createdAt: -1 })
          .limit(Math.floor(limit / 3))
          .lean(),

        UserInvestment.find({ userId: buyerId })
          .populate("investmentId", "title")
          .sort({ createdAt: -1 })
          .limit(Math.floor(limit / 3))
          .lean(),

        PropertyPayment.find({ buyerId: buyerId })
          .sort({ createdAt: -1 })
          .limit(Math.floor(limit / 3))
          .lean(),
      ]);

    const activities = [
      ...buyerTransactions.map((transaction) => ({
        id: transaction._id,
        type: "transaction" as const,
        title: getActivityTitle(transaction.type),
        description: transaction.description,
        amount: transaction.amount,
        timestamp: transaction.createdAt,
        status: transaction.status,
      })),
      ...buyerInvestments.map((investment) => ({
        id: investment._id,
        type: "investment" as const,
        title: "Investment Made",
        description: `Invested in ${
          (investment.investmentId as any)?.title || "Investment"
        }`,
        amount: investment.amount,
        timestamp: investment.createdAt,
        status: investment.status,
      })),
      ...buyerProperties.map((payment) => ({
        id: payment._id,
        type: "property_purchase" as const,
        title: "Property Purchase",
        description: `Purchased ${payment.plotIds.length} plot(s) in ${payment.propertyTitle}`,
        amount: payment.totalAmount,
        timestamp: payment.createdAt,
        status: payment.status,
      })),
    ];

    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  // Get dashboard analytics with charts data
  static async getDashboardAnalytics(req: Request, res: Response) {
    try {
      const { dateRange = "month" } = req.query;
      const user = (req as any).user;

      let analytics: any = {};

      if (user.role === "admin" || user.role === "super_admin") {
        analytics = await generateAdminAnalytics(dateRange as string);
      } else if (user.role === "agent") {
        analytics = await generateAgentAnalytics(user._id, dateRange as string);
      } else {
        analytics = await generateBuyerAnalytics(user._id, dateRange as string);
      }

      res.status(200).json({
        success: true,
        data: analytics,
        message: "Dashboard analytics retrieved successfully",
      });
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Admin Users Management
  static async getAdminUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search, role, status } = req.query;

      const query: any = {};

      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { userName: { $regex: search, $options: "i" } },
        ];
      }

      if (role) query.role = role;
      if (status) query.status = status;

      const users = await User.find(query)
        .select("-password -refreshToken")
        .sort({ createdAt: -1 })
        .limit(Number(limit) * Number(page))
        .skip((Number(page) - 1) * Number(limit));

      const total = await User.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch users",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Admin Transactions Management
  static async getAdminTransactions(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        status,
        startDate,
        endDate,
      } = req.query;

      const query: any = {};

      if (type) query.type = type;
      if (status) query.status = status;
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string),
        };
      }

      const transactions = await Transaction.find(query)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .limit(Number(limit) * Number(page))
        .skip((Number(page) - 1) * Number(limit));

      const total = await Transaction.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch transactions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Agent Properties Management
  static async getAgentProperties(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { page = 1, limit = 10, status } = req.query;

      const query: any = { createdBy: user._id };
      if (status) query.status = status;

      const properties = await Property.find(query)
        .populate("companyId", "name logo")
        .sort({ createdAt: -1 })
        .limit(Number(limit) * Number(page))
        .skip((Number(page) - 1) * Number(limit));

      const total = await Property.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          properties,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch agent properties",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Agent Referrals Management
  static async getAgentReferrals(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { page = 1, limit = 10, status } = req.query;

      const query: any = { referrer: user._id };
      if (status) query.status = status;

      const referrals = await Referral.find(query)
        .populate("referred", "firstName lastName email avatar")
        .sort({ createdAt: -1 })
        .limit(Number(limit) * Number(page))
        .skip((Number(page) - 1) * Number(limit));

      const total = await Referral.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          referrals,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch agent referrals",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Buyer Investments Management
  static async getBuyerInvestments(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { page = 1, limit = 10, status } = req.query;

      const query: any = { userId: user._id };
      if (status) query.status = status;

      const investments = await UserInvestment.find(query)
        .populate("investmentId", "title returnRate payoutFrequency")
        .sort({ createdAt: -1 })
        .limit(Number(limit) * Number(page))
        .skip((Number(page) - 1) * Number(limit));

      const total = await UserInvestment.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          investments,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch buyer investments",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Buyer Properties Management
  static async getBuyerProperties(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { page = 1, limit = 10, status } = req.query;

      const query: any = { buyerId: user._id };
      if (status) query.status = status;

      const properties = await PropertyPayment.find(query)
        .populate("propertyId", "title location")
        .sort({ createdAt: -1 })
        .limit(Number(limit) * Number(page))
        .skip((Number(page) - 1) * Number(limit));

      const total = await PropertyPayment.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          properties,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch buyer properties",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

// Helper functions
function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getActivityTitle(transactionType: string): string {
  switch (transactionType) {
    case "deposit":
      return "Wallet Deposit";
    case "withdrawal":
      return "Withdrawal Request";
    case "investment":
      return "Investment Made";
    case "property_purchase":
      return "Property Purchase";
    case "referral":
      return "Referral Commission";
    default:
      return "Transaction";
  }
}

async function generateAdminAnalytics(dateRange: string) {
  // Generate time series data for admin analytics
  const months = 6;
  const labels = [];
  const userData = [];
  const revenueData = [];
  const transactionData = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    labels.push(date.toLocaleDateString("en-US", { month: "short" }));

    // Get actual data for each month
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const [userCount, revenue, transactionCount] = await Promise.all([
      User.countDocuments({
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      PropertyPayment.aggregate([
        {
          $match: {
            status: "completed",
            paymentDate: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Transaction.countDocuments({
        status: "completed",
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
    ]);

    userData.push(userCount);
    revenueData.push(revenue[0]?.total || 0);
    transactionData.push(transactionCount);
  }

  return {
    userGrowth: {
      labels,
      datasets: [
        {
          label: "New Users",
          data: userData,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgb(59, 130, 246)",
          fill: true,
        },
      ],
    },
    revenueGrowth: {
      labels,
      datasets: [
        {
          label: "Revenue",
          data: revenueData,
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderColor: "rgb(16, 185, 129)",
          fill: true,
        },
      ],
    },
    transactionVolume: {
      labels,
      datasets: [
        {
          label: "Transactions",
          data: transactionData,
          backgroundColor: "rgba(236, 72, 153, 0.1)",
          borderColor: "rgb(236, 72, 153)",
          fill: true,
        },
      ],
    },
  };
}

async function generateAgentAnalytics(agentId: string, dateRange: string) {
  // Generate analytics for agent
  const months = 6;
  const labels = [];
  const commissionData = [];
  const referralData = [];
  const propertyData = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    labels.push(date.toLocaleDateString("en-US", { month: "short" }));

    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const [commissions, referrals, properties] = await Promise.all([
      PropertyPayment.aggregate([
        { $unwind: "$commissions" },
        {
          $match: {
            "commissions.referrerId": agentId,
            "commissions.paidAt": { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$commissions.amount" } } },
      ]),
      Referral.countDocuments({
        referrer: agentId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }),
      Property.aggregate([
        {
          $match: {
            createdBy: agentId,
            lastSaleDate: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalRevenue" } } },
      ]),
    ]);

    commissionData.push(commissions[0]?.total || 0);
    referralData.push(referrals);
    propertyData.push(properties[0]?.total || 0);
  }

  return {
    commissionEarnings: {
      labels,
      datasets: [
        {
          label: "Commission Earnings",
          data: commissionData,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgb(59, 130, 246)",
          fill: true,
        },
      ],
    },
    referralGrowth: {
      labels,
      datasets: [
        {
          label: "New Referrals",
          data: referralData,
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderColor: "rgb(16, 185, 129)",
          fill: true,
        },
      ],
    },
    propertyRevenue: {
      labels,
      datasets: [
        {
          label: "Property Revenue",
          data: propertyData,
          backgroundColor: "rgba(236, 72, 153, 0.1)",
          borderColor: "rgb(236, 72, 153)",
          fill: true,
        },
      ],
    },
  };
}

async function generateBuyerAnalytics(buyerId: string, dateRange: string) {
  // Generate analytics for buyer
  const months = 6;
  const labels = [];
  const investmentData = [];
  const returnsData = [];
  const spendingData = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    labels.push(date.toLocaleDateString("en-US", { month: "short" }));

    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const [investments, returns, spending] = await Promise.all([
      UserInvestment.aggregate([
        {
          $match: {
            userId: buyerId,
            createdAt: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      UserInvestment.aggregate([
        {
          $match: { userId: buyerId },
        },
        { $unwind: "$payouts" },
        {
          $match: {
            "payouts.date": { $gte: monthStart, $lte: monthEnd },
            "payouts.status": "paid",
          },
        },
        { $group: { _id: null, total: { $sum: "$payouts.amount" } } },
      ]),
      PropertyPayment.aggregate([
        {
          $match: {
            buyerId: buyerId,
            paymentDate: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    investmentData.push(investments[0]?.total || 0);
    returnsData.push(returns[0]?.total || 0);
    spendingData.push(spending[0]?.total || 0);
  }

  return {
    investmentGrowth: {
      labels,
      datasets: [
        {
          label: "Investments Made",
          data: investmentData,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgb(59, 130, 246)",
          fill: true,
        },
      ],
    },
    returnsReceived: {
      labels,
      datasets: [
        {
          label: "Returns Received",
          data: returnsData,
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderColor: "rgb(16, 185, 129)",
          fill: true,
        },
      ],
    },
    spendingPattern: {
      labels,
      datasets: [
        {
          label: "Total Spending",
          data: spendingData,
          backgroundColor: "rgba(236, 72, 153, 0.1)",
          borderColor: "rgb(236, 72, 153)",
          fill: true,
        },
      ],
    },
  };
}
