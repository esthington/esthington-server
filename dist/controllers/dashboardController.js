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
exports.getAdminDashboard = exports.getAgentDashboard = exports.getUserDashboard = void 0;
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const userModel_1 = __importDefault(require("../models/userModel"));
const propertyModel_1 = __importDefault(require("../models/propertyModel"));
const referralModel_1 = require("../models/referralModel");
const walletModel_1 = require("../models/walletModel");
const marketplaceModel_1 = require("../models/marketplaceModel");
const investmentModel_1 = require("../models/investmentModel");
// Get user dashboard data
exports.getUserDashboard = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(400).json({ status: "fail", message: "User not authenticated" });
    }
    const userId = req.user.id;
    // Get user wallet
    const wallet = yield walletModel_1.Wallet.findOne({ user: userId });
    // Get user investments
    const investments = yield investmentModel_1.UserInvestment.find({ user: userId })
        .populate("property", "title location images")
        .sort({ createdAt: -1 })
        .limit(5);
    // Get total investment amount
    const totalInvestment = investments.reduce((sum, inv) => sum + inv.amount, 0);
    // Get recent transactions
    const recentTransactions = wallet
        ? wallet.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
        : [];
    // Get user properties
    const properties = yield propertyModel_1.default.find({ owner: userId }).sort({ createdAt: -1 }).limit(5);
    // Get user marketplace listings
    const marketplaceListings = yield marketplaceModel_1.MarketplaceListing.find({ seller: userId })
        .populate("property", "title location images")
        .sort({ createdAt: -1 })
        .limit(5);
    // Get user referrals if user is an agent
    const user = yield userModel_1.default.findById(userId);
    let referrals = [];
    if (user && user.role === "agent") {
        referrals = yield referralModel_1.Referral.find({ referrer: userId })
            .populate("referred", "name email")
            .sort({ createdAt: -1 })
            .limit(5);
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
    });
}));
// Get agent dashboard data
exports.getAgentDashboard = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(400).json({ status: "fail", message: "User not authenticated" });
    }
    const userId = req.user.id;
    // Get agent wallet
    const wallet = yield walletModel_1.Wallet.findOne({ user: userId });
    // Get agent properties
    const properties = yield propertyModel_1.default.find({ owner: userId }).sort({ createdAt: -1 });
    // Get agent marketplace listings
    const marketplaceListings = yield marketplaceModel_1.MarketplaceListing.find({ seller: userId })
        .populate("property", "title location images")
        .sort({ createdAt: -1 });
    // Get agent referrals
    const referrals = yield referralModel_1.Referral.find({ referrer: userId }).populate("referred", "name email").sort({ createdAt: -1 });
    // Calculate total commission earned
    const totalCommission = referrals.reduce((sum, ref) => sum + (ref.get('commission') || 0), 0);
    // Get recent transactions
    const recentTransactions = wallet
        ? wallet.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
        : [];
    // Calculate monthly referral stats
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const monthlyReferrals = Array(12).fill(0);
    const monthlyCommission = Array(12).fill(0);
    referrals.forEach((ref) => {
        const refDate = new Date(ref.createdAt);
        if (refDate.getFullYear() === currentYear) {
            const month = refDate.getMonth();
            monthlyReferrals[month]++;
            monthlyCommission[month] += ref.commission || 0;
        }
    });
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
    });
}));
// Get admin dashboard data
exports.getAdminDashboard = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Get counts
    const totalUsers = yield userModel_1.default.countDocuments();
    const totalProperties = yield propertyModel_1.default.countDocuments();
    const totalInvestments = yield investmentModel_1.UserInvestment.countDocuments();
    const activeListings = yield marketplaceModel_1.MarketplaceListing.countDocuments({
        status: "active",
    });
    // Get user counts by role
    const buyerCount = yield userModel_1.default.countDocuments({ role: "buyer" });
    const agentCount = yield userModel_1.default.countDocuments({ role: "agent" });
    const adminCount = yield userModel_1.default.countDocuments({ role: "admin" });
    // Get pending approvals
    const pendingProperties = yield propertyModel_1.default.countDocuments({ status: "pending" });
    const pendingInvestments = yield investmentModel_1.UserInvestment.countDocuments({
        status: "pending",
    });
    const pendingMarketplace = yield marketplaceModel_1.MarketplaceListing.countDocuments({
        status: "pending",
    });
    // Get total investment amount
    const investments = yield investmentModel_1.UserInvestment.find();
    const totalInvestmentAmount = investments.reduce((sum, inv) => sum + inv.amount, 0);
    // Get recent users
    const recentUsers = yield userModel_1.default.find().sort({ createdAt: -1 }).limit(5).select("name email role createdAt");
    // Get recent properties
    const recentProperties = yield propertyModel_1.default.find().sort({ createdAt: -1 }).limit(5).populate("owner", "name email");
    // Get recent investments
    const recentInvestments = yield investmentModel_1.UserInvestment.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "name email")
        .populate("property", "title");
    // Calculate monthly stats for current year
    const currentYear = new Date().getFullYear();
    // Monthly user registrations
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
    const monthlyUsers = Array(12).fill(0);
    userGrowth.forEach((item) => {
        monthlyUsers[item._id - 1] = item.count;
    });
    // Monthly investments
    const investmentGrowth = yield investmentModel_1.UserInvestment.aggregate([
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
    const monthlyInvestments = Array(12).fill(0);
    const monthlyInvestmentAmounts = Array(12).fill(0);
    investmentGrowth.forEach((item) => {
        monthlyInvestments[item._id - 1] = item.count;
        monthlyInvestmentAmounts[item._id - 1] = item.amount;
    });
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
    });
}));
//# sourceMappingURL=dashboardController.js.map