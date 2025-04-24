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
exports.investInProperty = exports.deleteInvestment = exports.updateInvestment = exports.createInvestment = exports.getInvestmentById = exports.getUserInvestments = exports.getInvestments = void 0;
const http_status_codes_1 = require("http-status-codes");
const appError_1 = require("../utils/appError");
const investmentModel_1 = require("../models/investmentModel");
const asyncHandler_1 = require("../utils/asyncHandler");
const mongoose_1 = __importDefault(require("mongoose"));
const userModel_1 = __importDefault(require("../models/userModel"));
// @desc    Get all investment plans
// @route   GET /api/investments
// @access  Public
exports.getInvestments = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const investmentPlans = yield investmentModel_1.InvestmentPlan.find();
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: investmentPlans.length,
        data: investmentPlans,
    });
}));
// @desc    Get user investments
// @route   GET /api/investments/user
// @access  Private
exports.getUserInvestments = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user.id;
    const userInvestments = yield investmentModel_1.UserInvestment.find({
        user: userId,
    }).populate("plan");
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        count: userInvestments.length,
        data: userInvestments,
    });
}));
// @desc    Get investment plan by ID
// @route   GET /api/investments/:id
// @access  Public
exports.getInvestmentById = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid investment ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const investmentPlan = yield investmentModel_1.InvestmentPlan.findById(id);
    if (!investmentPlan) {
        return next(new appError_1.AppError("Investment plan not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        data: investmentPlan,
    });
}));
// @desc    Create investment plan (admin)
// @route   POST /api/investments
// @access  Private (Admin)
exports.createInvestment = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { title, description, type, minimumAmount, maximumAmount, expectedReturn, returnType, duration, payoutFrequency, riskLevel, isActive, startDate, endDate, targetAmount, images, documents, location, } = req.body;
    // Validate required fields
    if (!title ||
        !description ||
        !type ||
        !minimumAmount ||
        !maximumAmount ||
        !expectedReturn ||
        !returnType ||
        !duration ||
        !payoutFrequency ||
        !riskLevel ||
        !startDate ||
        !endDate ||
        !targetAmount) {
        return next(new appError_1.AppError("Please provide all required fields", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const investmentPlan = yield investmentModel_1.InvestmentPlan.create({
        title,
        description,
        type,
        minimumAmount,
        maximumAmount,
        expectedReturn,
        returnType,
        duration,
        payoutFrequency,
        riskLevel,
        isActive,
        startDate,
        endDate,
        targetAmount,
        creator: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || "",
        images,
        documents,
        location,
    });
    res.status(http_status_codes_1.StatusCodes.CREATED).json({
        success: true,
        message: "Investment plan created successfully",
        data: investmentPlan,
    });
}));
// @desc    Update investment plan (admin)
// @route   PUT /api/investments/:id
// @access  Private (Admin)
const updateInvestment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, description, type, minimumAmount, maximumAmount, expectedReturn, returnType, duration, payoutFrequency, riskLevel, isActive, startDate, endDate, targetAmount, images, documents, } = req.body;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return next(new appError_1.AppError("Invalid investment ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
        const investmentPlan = yield investmentModel_1.InvestmentPlan.findByIdAndUpdate(id, {
            title,
            description,
            type,
            minimumAmount,
            maximumAmount,
            expectedReturn,
            returnType,
            duration,
            payoutFrequency,
            riskLevel,
            isActive,
            startDate,
            endDate,
            targetAmount,
            images,
            documents,
        }, { new: true, runValidators: true });
        if (!investmentPlan) {
            return next(new appError_1.AppError("Investment plan not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            message: "Investment plan updated successfully",
            data: investmentPlan,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateInvestment = updateInvestment;
// @desc    Delete investment plan (admin)
// @route   DELETE /api/investments/:id
// @access  Private (Admin)
const deleteInvestment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return next(new appError_1.AppError("Invalid investment ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
        }
        const investmentPlan = yield investmentModel_1.InvestmentPlan.findByIdAndDelete(id);
        if (!investmentPlan) {
            return next(new appError_1.AppError("Investment plan not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        res.status(http_status_codes_1.StatusCodes.OK).json({
            success: true,
            message: "Investment plan deleted successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteInvestment = deleteInvestment;
// @desc    Invest in a property (user)
// @route   POST /api/investments/:id/invest
// @access  Private
exports.investInProperty = (0, asyncHandler_1.asyncHandler)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { amount } = req.body;
    if (!req.user) {
        return next(new appError_1.AppError("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        return next(new appError_1.AppError("Invalid investment ID", http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    const investmentPlan = yield investmentModel_1.InvestmentPlan.findById(id);
    if (!investmentPlan) {
        return next(new appError_1.AppError("Investment plan not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    if (amount < investmentPlan.minimumAmount) {
        return next(new appError_1.AppError(`Minimum investment amount is ₦${investmentPlan.minimumAmount}`, http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    if (amount > investmentPlan.maximumAmount) {
        return next(new appError_1.AppError(`Maximum investment amount is ₦${investmentPlan.maximumAmount}`, http_status_codes_1.StatusCodes.BAD_REQUEST));
    }
    // Get user email for payment
    const user = yield userModel_1.default.findById(userId);
    if (!user) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    // Initialize payment
    const paymentService = require("../services/paymentService").default;
    const paymentResponse = yield paymentService.initializeInvestment(userId, investmentPlan._id.toString(), amount, user.email);
    res.status(http_status_codes_1.StatusCodes.OK).json({
        success: true,
        message: "Investment payment initiated",
        data: paymentResponse,
    });
}));
//# sourceMappingURL=investmentController.js.map