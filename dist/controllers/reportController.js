"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserGrowthReport = exports.getRevenueReport = exports.getDetailedReports = exports.getDashboardStats = void 0;
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const appError_1 = __importDefault(require("../utils/appError"));
const userModel_1 = __importDefault(require("../models/userModel"));
const propertyModel_1 = __importDefault(require("../models/propertyModel"));
const referralModel_1 = require("../models/referralModel");
const walletModel_1 = require("../models/walletModel");
const marketplaceModel_1 = require("../models/marketplaceModel");
const investmentModel_1 = require("../models/investmentModel");
// Get summary statistics for admin dashboard
exports.getDashboardStats = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const totalUsers = yield userModel_1.default.countDocuments();
    const totalProperties = yield propertyModel_1.default.countDocuments();
    const totalInvestments = yield investmentModel_1.UserInvestment.countDocuments();
    // Get total investment amount
    const investments = yield investmentModel_1.UserInvestment.find();
    const totalInvestmentAmount = investments.reduce((sum, inv) => sum + inv.amount, 0);
    // Get total wallet balance
    const wallets = yield walletModel_1.Wallet.find();
    const totalWalletBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    // Get active marketplace listings
    const activeListings = yield marketplaceModel_1.MarketplaceListing.countDocuments({
        status: "active",
    });
    // Get total referrals
    const totalReferrals = yield referralModel_1.Referral.countDocuments();
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
    });
}));
// Get detailed reports for specific time periods
exports.getDetailedReports = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate, reportType } = req.query;
    if (!startDate || !endDate) {
        return next(new appError_1.default("Please provide start and end dates", 400));
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    let reportData;
    switch (reportType) {
        case "investments":
            reportData = yield investmentModel_1.UserInvestment.find({
                createdAt: { $gte: start, $lte: end },
            }).populate("user", "name email");
            break;
        case "properties":
            reportData = yield propertyModel_1.default.find({
                createdAt: { $gte: start, $lte: end },
            });
            break;
        case "users":
            reportData = yield userModel_1.default.find({
                createdAt: { $gte: start, $lte: end },
            }).select("name email role createdAt");
            break;
        case "transactions":
            reportData = yield walletModel_1.Wallet.aggregate([
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
            ]);
            break;
        case "referrals":
            reportData = yield referralModel_1.Referral.find({
                createdAt: { $gte: start, $lte: end },
            })
                .populate("referrer", "name email")
                .populate("referred", "name email");
            break;
        default:
            return next(new appError_1.default("Invalid report type", 400));
    }
    res.status(200).json({
        status: "success",
        data: reportData,
    });
}));
// Generate monthly revenue report
exports.getRevenueReport = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { year } = req.query;
    const currentYear = year ? Number.parseInt(year) : new Date().getFullYear();
    const monthlyRevenue = yield walletModel_1.Wallet.aggregate([
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
    ]);
    // Format the result to include all months
    const formattedRevenue = Array(12).fill(0);
    monthlyRevenue.forEach((item) => {
        formattedRevenue[item._id - 1] = item.total;
    });
    res.status(200).json({
        status: "success",
        data: {
            year: currentYear,
            monthlyRevenue: formattedRevenue,
        },
    });
}));
// Get user growth report
exports.getUserGrowthReport = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { year } = req.query;
    const currentYear = year ? Number.parseInt(year) : new Date().getFullYear();
    const userGrowth = yield userModel_1.default.aggregate([
        { $match: { $expr: { $eq: [{ $year: "$createdAt" }, currentYear] } } },
        {
            $group: {
                _id: { $month: "$createdAt" },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);
    // Format the result to include all months
    const formattedGrowth = Array(12).fill(0);
    userGrowth.forEach((item) => {
        formattedGrowth[item._id - 1] = item.count;
    });
    res.status(200).json({
        status: "success",
        data: {
            year: currentYear,
            monthlyGrowth: formattedGrowth,
        },
    });
}));
//# sourceMappingURL=reportController.js.map