"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.verifyReferralCode = exports.processReferral = exports.getAgentRankInfo = exports.getReferralCommissionRates = exports.getReferralEarnings = exports.generateReferralLink = exports.getReferralStats = exports.getUserReferrals = void 0;
const http_status_codes_1 = require("http-status-codes");
const referralModel_1 = require("../models/referralModel");
const userModel_1 = __importStar(require("../models/userModel"));
const walletModel_1 = require("../models/walletModel");
const appError_1 = require("../utils/appError");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config/config"));
// @desc    Get user's referrals
// @route   GET /api/referrals
// @access  Private
exports.getUserReferrals = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.user;
    const referrals = yield referralModel_1.Referral.find({ referrer: id })
        .sort({ createdAt: -1 })
        .populate("referred", "firstName lastName email");
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: referrals,
    });
}));
// @desc    Get referral stats
// @route   GET /api/referrals/stats
// @access  Private
exports.getReferralStats = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.user;
    // Get total referrals
    const totalReferrals = yield referralModel_1.Referral.countDocuments({ referrer: id });
    // Get active referrals
    const activeReferrals = yield referralModel_1.Referral.countDocuments({
        referrer: id,
        status: referralModel_1.ReferralStatus.ACTIVE,
    });
    // Get total earnings
    const earningsData = yield walletModel_1.Transaction.aggregate([
        {
            $match: {
                user: new mongoose_1.default.Types.ObjectId(id),
                type: walletModel_1.TransactionType.REFERRAL,
                status: walletModel_1.TransactionStatus.COMPLETED,
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
    const pendingEarningsData = yield walletModel_1.Transaction.aggregate([
        {
            $match: {
                user: new mongoose_1.default.Types.ObjectId(id),
                type: walletModel_1.TransactionType.REFERRAL,
                status: walletModel_1.TransactionStatus.PENDING,
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$amount" },
            },
        },
    ]);
    const pendingEarnings = pendingEarningsData.length > 0 ? pendingEarningsData[0].total : 0;
    // Calculate conversion rate
    const conversionRate = totalReferrals > 0
        ? Math.round((activeReferrals / totalReferrals) * 100)
        : 0;
    // Get referral link
    const user = yield userModel_1.default.findById(id);
    const referralLink = (user === null || user === void 0 ? void 0 : user.referralCode)
        ? `${config_1.default.frontendUrl}/signup?ref=${user.referralCode}`
        : null;
    res.status(http_status_codes_1.StatusCodes.OK).json({
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
}));
// @desc    Generate referral link
// @route   POST /api/referrals/generate-link
// @access  Private
exports.generateReferralLink = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.user;
    const user = yield userModel_1.default.findById(id);
    if (!user) {
        throw new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND);
    }
    // Generate a unique referral code if not already present
    if (!user.referralCode) {
        const referralCode = crypto_1.default.randomBytes(6).toString("hex");
        user.referralCode = referralCode;
        yield user.save();
    }
    const referralLink = `${config_1.default.frontendUrl}/signup?ref=${user.referralCode}`;
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: {
            referralCode: user.referralCode,
            referralLink,
        },
    });
}));
// @desc    Get referral earnings
// @route   GET /api/referrals/earnings
// @access  Private
exports.getReferralEarnings = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.user;
    const { startDate, endDate } = req.query;
    const query = {
        user: id,
        type: walletModel_1.TransactionType.REFERRAL,
    };
    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };
    }
    const transactions = yield walletModel_1.Transaction.find(query).sort({ createdAt: -1 });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: transactions,
    });
}));
// @desc    Get referral commission rates
// @route   GET /api/referrals/commission-rates
// @access  Private
exports.getReferralCommissionRates = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Fetch commission rates from the database
    const commissionRates = yield referralModel_1.ReferralCommission.find().sort({ rank: 1 });
    // Format the response to match the expected structure
    const formattedRates = {};
    commissionRates.forEach((rate) => {
        formattedRates[rate.rank] = {
            investment: rate.investmentRate,
            property: rate.propertyRate,
        };
    });
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: formattedRates,
    });
}));
// @desc    Get agent rank information
// @route   GET /api/referrals/agent-rank
// @access  Private
exports.getAgentRankInfo = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.user;
    const user = yield userModel_1.default.findById(id);
    if (!user) {
        throw new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND);
    }
    // Get current rank
    const currentRank = user.agentRank || userModel_1.AgentRank.BRONZE;
    // Get total referrals
    const totalReferrals = yield referralModel_1.Referral.countDocuments({ referrer: id });
    // Define rank thresholds
    const rankThresholds = {
        [userModel_1.AgentRank.BRONZE]: { min: 0, max: 9, next: userModel_1.AgentRank.SILVER },
        [userModel_1.AgentRank.SILVER]: { min: 10, max: 24, next: userModel_1.AgentRank.GOLD },
        [userModel_1.AgentRank.GOLD]: { min: 25, max: 49, next: userModel_1.AgentRank.PLATINUM },
        [userModel_1.AgentRank.PLATINUM]: {
            min: 50,
            max: Number.POSITIVE_INFINITY,
            next: userModel_1.AgentRank.PLATINUM,
        },
    };
    // Calculate progress to next rank
    const currentThreshold = rankThresholds[currentRank];
    const nextRank = currentThreshold.next;
    const requiredReferrals = currentThreshold.max + 1;
    const progress = currentRank === userModel_1.AgentRank.PLATINUM
        ? 100
        : Math.min(Math.round(((totalReferrals - currentThreshold.min) /
            (currentThreshold.max - currentThreshold.min + 1)) *
            100), 99);
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: {
            currentRank,
            nextRank,
            progress,
            requiredReferrals,
            currentReferrals: totalReferrals,
        },
    });
}));
// @desc    Process referral (used when a referred user makes a purchase)
// @route   POST /api/referrals/process
// @access  Private
exports.processReferral = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { referredUserId, transactionType, amount } = req.body;
    if (!referredUserId || !transactionType || !amount) {
        throw new appError_1.AppError("Please provide all required fields", http_status_codes_1.StatusCodes.BAD_REQUEST);
    }
    // Find the referral
    const referral = yield referralModel_1.Referral.findOne({ referred: referredUserId });
    if (!referral) {
        throw new appError_1.AppError("Referral not found", http_status_codes_1.StatusCodes.NOT_FOUND);
    }
    // Get referrer
    const referrer = yield userModel_1.default.findById(referral.referrer);
    if (!referrer) {
        throw new appError_1.AppError("Referrer not found", http_status_codes_1.StatusCodes.NOT_FOUND);
    }
    const agentRank = referrer.agentRank || userModel_1.AgentRank.BRONZE;
    // Get commission rates from the database
    const commissionRate = yield referralModel_1.ReferralCommission.findOne({
        rank: agentRank,
    });
    if (!commissionRate) {
        throw new appError_1.AppError("Commission rate not found", http_status_codes_1.StatusCodes.NOT_FOUND);
    }
    // Calculate commission
    let commission = 0;
    if (transactionType === "investment") {
        commission = (amount * commissionRate.investmentRate) / 100;
    }
    else if (transactionType === "property") {
        commission = (amount * commissionRate.propertyRate) / 100;
    }
    // Create transaction
    const transaction = yield walletModel_1.Transaction.create({
        user: referrer._id,
        type: walletModel_1.TransactionType.REFERRAL,
        amount: commission,
        status: walletModel_1.TransactionStatus.COMPLETED,
        description: `Referral commission for ${transactionType} purchase by ${referredUserId}`,
    });
    // Update referral status to active
    referral.status = referralModel_1.ReferralStatus.ACTIVE;
    referral.earnings += commission;
    yield referral.save();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: {
            commission,
            transaction,
        },
    });
}));
// @desc    Verify referral code
// @route   GET /api/referrals/verify/:code
// @access  Public
exports.verifyReferralCode = (0, express_async_handler_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code } = req.params;
    const user = yield userModel_1.default.findOne({ referralCode: code });
    if (!user) {
        throw new appError_1.AppError("Invalid referral code", http_status_codes_1.StatusCodes.BAD_REQUEST);
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: {
            referrerId: user._id,
            referrerName: `${user.firstName} ${user.lastName}`,
        },
    });
}));
//# sourceMappingURL=referralController.js.map