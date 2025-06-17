import type { Request, Response } from "express";
import Company from "../models/companyModel";
import { Transaction } from "../models/walletModel";
import { Referral } from "../models/referralModel";
import Investment from "../models/investmentModel";
import Property from "../models/propertyModel";
import User from "../models/userModel";


export class DashboardController {
  // Get comprehensive dashboard statistics
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const { dateRange = "month", startDate, endDate } = req.query;

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

      // Parallel queries for better performance
      const [
        userStats,
        transactionStats,
        propertyStats,
        investmentStats,
        referralStats,
        companyStats,
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
            },
          },
        ]),

        // Transaction Statistics
        Transaction.aggregate([
          {
            $facet: {
              total: [{ $count: "count" }],
              pending: [{ $match: { status: "pending" } }, { $count: "count" }],
              revenue: [
                { $match: { type: "deposit", status: "completed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
              monthlyRevenue: [
                {
                  $match: {
                    type: "deposit",
                    status: "completed",
                    createdAt: { $gte: start, $lte: end },
                  },
                },
                { $group: { _id: null, total: { $sum: "$amount" } } },
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
              averagePrice: [
                { $group: { _id: null, avg: { $avg: "$price" } } },
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
              totalInvestors: [
                { $group: { _id: null, total: { $sum: "$totalInvestors" } } },
              ],
              averageROI: [
                { $group: { _id: null, avg: { $avg: "$returnRate" } } },
              ],
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
      ]);

      // Process results
      const stats = {
        // User Stats
        totalUsers: userStats[0]?.total[0]?.count || 0,
        activeUsers: userStats[0]?.active[0]?.count || 0,
        newUsersThisMonth: userStats[0]?.newThisMonth[0]?.count || 0,
        userGrowthRate: calculateGrowthRate(
          userStats[0]?.newThisMonth[0]?.count || 0,
          userStats[0]?.previousMonth[0]?.count || 0
        ),

        // Financial Stats
        totalRevenue: transactionStats[0]?.revenue[0]?.total || 0,
        monthlyRevenue: transactionStats[0]?.monthlyRevenue[0]?.total || 0,
        totalTransactions: transactionStats[0]?.total[0]?.count || 0,
        pendingTransactions: transactionStats[0]?.pending[0]?.count || 0,

        // Property Stats
        totalProperties: propertyStats[0]?.total[0]?.count || 0,
        availableProperties: propertyStats[0]?.available[0]?.count || 0,
        soldProperties: propertyStats[0]?.sold[0]?.count || 0,
        featuredProperties: propertyStats[0]?.featured[0]?.count || 0,
        averagePropertyPrice: propertyStats[0]?.averagePrice[0]?.avg || 0,

        // Investment Stats
        totalInvestments: investmentStats[0]?.total[0]?.count || 0,
        activeInvestments: investmentStats[0]?.active[0]?.count || 0,
        totalInvestmentValue: investmentStats[0]?.totalValue[0]?.total || 0,
        totalInvestors: investmentStats[0]?.totalInvestors[0]?.total || 0,
        averageROI: investmentStats[0]?.averageROI[0]?.avg || 0,

        // Referral Stats
        totalReferrals: referralStats[0]?.total[0]?.count || 0,
        activeReferrals: referralStats[0]?.active[0]?.count || 0,
        totalReferralEarnings: referralStats[0]?.totalEarnings[0]?.total || 0,
        conversionRate: calculateConversionRate(
          referralStats[0]?.active[0]?.count || 0,
          referralStats[0]?.total[0]?.count || 0
        ),

        // Company Stats
        totalCompanies: companyStats[0]?.total[0]?.count || 0,
        activeCompanies: companyStats[0]?.active[0]?.count || 0,
      };

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

  // Get recent activity
  static async getRecentActivity(req: Request, res: Response) {
    try {
      const { limit = 10 } = req.query;

      // Get recent transactions
      const recentTransactions = await Transaction.find()
        .select("type description amount status createdAt user") // Explicitly select createdAt and other needed fields
        .populate({
          path: "user",
          select: "firstName lastName avatar",
          model: "User"
        })
        .sort({ createdAt: -1 })
        .limit(Number(limit) / 2)
        .lean({ getters: true }); // Use lean() to get plain JS objects with all selected fields

      // Get recent user registrations
      const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(Number(limit) / 2);

      // Combine and format activities
      const activities = [
        ...recentTransactions.map((transaction) => ({
          id: transaction._id,
          type: getActivityType(transaction.type),
          title: getActivityTitle(transaction.type),
          description: transaction.description,
          user:
            transaction.user &&
            typeof transaction.user === "object" &&
            "firstName" in transaction.user &&
            "lastName" in transaction.user
              ? {
                  id: transaction.user._id,
                  name: `${(transaction.user as any).firstName} ${(transaction.user as any).lastName}`,
                  avatar: (transaction.user as any).avatar,
                }
              : undefined,
          amount: transaction.amount,
          timestamp: (transaction as any)?.createdAt || new Date(),
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
      ];

      // Sort by timestamp and limit
      const sortedActivities = activities
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, Number(limit));

      res.status(200).json({
        success: true,
        data: sortedActivities,
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

  // Get dashboard analytics
  static async getDashboardAnalytics(req: Request, res: Response) {
    try {
      const { dateRange = "month" } = req.query;

      // Generate time series data based on date range
      const timeSeriesData = await generateTimeSeriesData(dateRange as string);

      // Get top performing properties
      const topProperties = await Property.aggregate([
        { $match: { status: "Sold Out" } },
        {
          $addFields: {
            totalSales: { $subtract: ["$totalPlots", "$availablePlots"] },
            revenue: {
              $multiply: [
                "$price",
                { $subtract: ["$totalPlots", "$availablePlots"] },
              ],
            },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $project: {
            id: "$_id",
            title: 1,
            location: 1,
            totalSales: 1,
            revenue: 1,
          },
        },
      ]);

      // Get top investors (this would need user investment data)
      const topInvestors = await Investment.aggregate([
        { $unwind: "$investors" },
        {
          $group: {
            _id: "$investors.userId",
            totalInvestment: { $sum: "$investors.amount" },
            investmentCount: { $sum: 1 },
          },
        },
        { $sort: { totalInvestment: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            id: "$_id",
            name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
            totalInvestment: 1,
            portfolioValue: { $multiply: ["$totalInvestment", 1.1] }, // Mock calculation
            roi: 10, // Mock ROI
          },
        },
      ]);

      const analytics = {
        ...timeSeriesData,
        topPerformingProperties: topProperties,
        topInvestors: topInvestors,
      };

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
}

// Helper functions
function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function calculateConversionRate(active: number, total: number): number {
  if (total === 0) return 0;
  return (active / total) * 100;
}

function getActivityType(transactionType: string): string {
  switch (transactionType) {
    case "deposit":
      return "property_purchase";
    case "withdrawal":
      return "withdrawal";
    case "investment":
      return "investment";
    default:
      return "transaction";
  }
}

function getActivityTitle(transactionType: string): string {
  switch (transactionType) {
    case "deposit":
      return "Property Purchase";
    case "withdrawal":
      return "Withdrawal Request";
    case "investment":
      return "New Investment";
    default:
      return "Transaction";
  }
}

async function generateTimeSeriesData(dateRange: string) {
  // This would generate time series data for charts
  // Implementation depends on your specific requirements
  const labels = [];
  const userData = [];
  const revenueData = [];
  const transactionData = [];

  // Generate mock data for now
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    labels.push(date.toLocaleDateString("en-US", { month: "short" }));
    userData.push(Math.floor(Math.random() * 50) + 10);
    revenueData.push(Math.floor(Math.random() * 50000) + 10000);
    transactionData.push(Math.floor(Math.random() * 100) + 20);
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
