import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import Property from "../models/propertyModel";
import User from "../models/userModel";
import { Wallet } from "../models/walletModel";
import { MarketplaceListing } from "../models/marketplaceModel"
import UserInvestment from "../models/userInvestmentModel";
import emailService from "../services/emailService";

// Get all pending approvals
export const getPendingApprovals = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Get pending property approvals
    const pendingProperties = await Property.find({
      status: "pending",
    }).populate("owner", "name email");

    // Get pending investment approvals
    const pendingInvestments = await UserInvestment.find({ status: "pending" })
      .populate("user", "name email")
      .populate("property", "title location");

    // Get pending marketplace listings
    const pendingMarketplace = await MarketplaceListing.find({
      status: "pending",
    })
      .populate("seller", "name email")
      .populate("property", "title location");

    // Get pending withdrawal requests
    const pendingWithdrawals = await Wallet.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "withdrawal",
          "transactions.status": "pending",
        },
      },
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
          _id: "$transaction._id",
          userName: "$userDetails.name",
          userEmail: "$userDetails.email",
          userId: "$userId",
          amount: "$transaction.amount",
          date: "$transaction.date",
          description: "$transaction.description",
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        pendingProperties,
        pendingInvestments,
        pendingMarketplace,
        pendingWithdrawals,
        totalCount:
          pendingProperties.length +
          pendingInvestments.length +
          pendingMarketplace.length +
          pendingWithdrawals.length,
      },
    });
  }
);

// Approve or reject a property
export const updatePropertyApproval = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return next(
        new AppError("Status must be either approved or rejected", 400)
      );
    }

    const property = await Property.findById(id);

    if (!property) {
      return next(new AppError("Property not found", 404));
    }

    if (property.status !== ("pending" as string)) {
      return next(new AppError("Property is not pending approval", 400));
    }

    property.status = status;
    // if (status === "rejected" && rejectionReason) {
    //   property.rejectionReason = rejectionReason;
    // }

    // await property.save();

    // // Get owner details for notification
    // const owner = await User.findById(property.owner);

    // if (owner) {
    //   // Send email notification
    //   await emailService.sendEmail(
    //     owner.email,
    //     `Your property listing has been ${status}`,
    //     status === "approved"
    //       ? `Congratulations! Your property "${property.title}" has been approved and is now live.`
    //       : `Your property "${property.title}" has been rejected. Reason: ${
    //           rejectionReason || "No reason provided"
    //         }`
    //   );
    // }

    res.status(200).json({
      status: "success",
      data: property,
    });
  }
);

// Approve or reject an investment
export const updateInvestmentApproval = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return next(
        new AppError("Status must be either approved or rejected", 400)
      );
    }

    const investment = await UserInvestment.findById(id);

    if (!investment) {
      return next(new AppError("Investment not found", 404));
    }

    if (investment.status !== "pending") {
      return next(new AppError("Investment is not pending approval", 400));
    }

    investment.status = status;
    if (status === "rejected" && rejectionReason) {
      investment.rejectionReason = rejectionReason;
    }

    await investment.save();

    // Get user details for notification
    const user = await User.findById(investment.user);

    if (user) {
      // Send email notification
      await emailService.sendEmail(
        user.email,
        `Your investment has been ${status}`,
        status === "approved"
          ? `Congratulations! Your investment of ${investment.amount} has been approved.`
          : `Your investment has been rejected. Reason: ${
              rejectionReason || "No reason provided"
            }`
      );
    }

    res.status(200).json({
      status: "success",
      data: investment,
    });
  }
);

// Approve or reject a marketplace listing
export const updateMarketplaceApproval = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return next(
        new AppError("Status must be either approved or rejected", 400)
      );
    }

    const listing = await MarketplaceListing.findById(id);

    if (!listing) {
      return next(new AppError("Marketplace listing not found", 404));
    }

    if (listing.status !== "pending") {
      return next(new AppError("Listing is not pending approval", 400));
    }

    listing.status = status;
    // if (status === "rejected" && rejectionReason) {
    //   listing.rejectionReason = rejectionReason;
    // }

    await listing.save();

    // Get seller details for notification
    // const seller = await User.findById(listing.seller);

    // if (seller) {
    //   // Send email notification
    //   await emailService.sendEmail(
    //     seller.email,
    //     `Your marketplace listing has been ${status}`,
    //     status === "approved"
    //       ? `Congratulations! Your marketplace listing has been approved and is now live.`
    //       : `Your marketplace listing has been rejected. Reason: ${
    //           rejectionReason || "No reason provided"
    //         }`
    //   );
    // }

    res.status(200).json({
      status: "success",
      data: listing,
    });
  }
);

// Approve or reject a withdrawal request
export const updateWithdrawalApproval = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id, userId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["completed", "rejected"].includes(status)) {
      return next(
        new AppError("Status must be either completed or rejected", 400)
      );
    }

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return next(new AppError("Wallet not found", 404));
    }

    // Find the transaction in the wallet
    const transactionIndex = wallet.transactions.findIndex(
      (t) =>
        t._id.toString() === id &&
        t.type === "withdrawal" &&
        t.status === "pending"
    );

    if (transactionIndex === -1) {
      return next(
        new AppError("Pending withdrawal transaction not found", 404)
      );
    }

    // Update the transaction status
    wallet.transactions[transactionIndex].status = status;
    if (status === "rejected" && rejectionReason) {
      wallet.transactions[
        transactionIndex
      ].description = `${wallet.transactions[transactionIndex].description} - Rejected: ${rejectionReason}`;

      // If rejected, refund the amount to the wallet balance
      wallet.balance += wallet.transactions[transactionIndex].amount;
    }

    await wallet.save();

    // Get user details for notification
    const user = await User.findById(userId);

    if (user) {
      // Send email notification
      await emailService.sendEmail(
        user.email,
        `Your withdrawal request has been ${
          status === "completed" ? "approved" : "rejected"
        }`,
        status === "completed"
          ? `Your withdrawal request for ${wallet.transactions[transactionIndex].amount} has been processed successfully.`
          : `Your withdrawal request for ${
              wallet.transactions[transactionIndex].amount
            } has been rejected. Reason: ${
              rejectionReason || "No reason provided"
            }`
      );
    }

    res.status(200).json({
      status: "success",
      data: wallet.transactions[transactionIndex],
    });
  }
);
