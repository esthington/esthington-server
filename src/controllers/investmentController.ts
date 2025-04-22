import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/appError";
import { InvestmentPlan, UserInvestment } from "../models/investmentModel";
import { asyncHandler } from "../utils/asyncHandler";
import mongoose from "mongoose";
import User from "../models/userModel";

// @desc    Get all investment plans
// @route   GET /api/investments
// @access  Public
export const getInvestments = asyncHandler(
  async (req: Request, res: Response) => {
    const investmentPlans = await InvestmentPlan.find();

    res.status(StatusCodes.OK).json({
      success: true,
      count: investmentPlans.length,
      data: investmentPlans,
    });
  }
);

// @desc    Get user investments
// @route   GET /api/investments/user
// @access  Private
export const getUserInvestments = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user.id;

    const userInvestments = await UserInvestment.find({
      user: userId,
    }).populate("plan");

    res.status(StatusCodes.OK).json({
      success: true,
      count: userInvestments.length,
      data: userInvestments,
    });
  }
);

// @desc    Get investment plan by ID
// @route   GET /api/investments/:id
// @access  Public
export const getInvestmentById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investmentPlan = await InvestmentPlan.findById(id);

    if (!investmentPlan) {
      return next(
        new AppError("Investment plan not found", StatusCodes.NOT_FOUND)
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: investmentPlan,
    });
  }
);

// @desc    Create investment plan (admin)
// @route   POST /api/investments
// @access  Private (Admin)
export const createInvestment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
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
      location,
    } = req.body;

    // Validate required fields
    if (
      !title ||
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
      !targetAmount
    ) {
      return next(
        new AppError(
          "Please provide all required fields",
          StatusCodes.BAD_REQUEST
        )
      );
    }

    const investmentPlan = await InvestmentPlan.create({
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
      creator: req.user?.id || "",
      images,
      documents,
      location,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Investment plan created successfully",
      data: investmentPlan,
    });
  }
);

// @desc    Update investment plan (admin)
// @route   PUT /api/investments/:id
// @access  Private (Admin)
export const updateInvestment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
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
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investmentPlan = await InvestmentPlan.findByIdAndUpdate(
      id,
      {
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
      },
      { new: true, runValidators: true }
    );

    if (!investmentPlan) {
      return next(
        new AppError("Investment plan not found", StatusCodes.NOT_FOUND)
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Investment plan updated successfully",
      data: investmentPlan,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete investment plan (admin)
// @route   DELETE /api/investments/:id
// @access  Private (Admin)
export const deleteInvestment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investmentPlan = await InvestmentPlan.findByIdAndDelete(id);

    if (!investmentPlan) {
      return next(
        new AppError("Investment plan not found", StatusCodes.NOT_FOUND)
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Investment plan deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Invest in a property (user)
// @route   POST /api/investments/:id/invest
// @access  Private
export const investInProperty = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { amount } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError("Invalid investment ID", StatusCodes.BAD_REQUEST)
      );
    }

    const investmentPlan = await InvestmentPlan.findById(id);
    if (!investmentPlan) {
      return next(
        new AppError("Investment plan not found", StatusCodes.NOT_FOUND)
      );
    }

    if (amount < investmentPlan.minimumAmount) {
      return next(
        new AppError(
          `Minimum investment amount is ₦${investmentPlan.minimumAmount}`,
          StatusCodes.BAD_REQUEST
        )
      );
    }

    if (amount > investmentPlan.maximumAmount) {
      return next(
        new AppError(
          `Maximum investment amount is ₦${investmentPlan.maximumAmount}`,
          StatusCodes.BAD_REQUEST
        )
      );
    }

    // Get user email for payment
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Initialize payment
    const paymentService = require("../services/paymentService").default;
    const paymentResponse = await paymentService.initializeInvestment(
      userId,
      investmentPlan._id.toString(),
      amount,
      user.email
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Investment payment initiated",
      data: paymentResponse,
    });
  }
);
