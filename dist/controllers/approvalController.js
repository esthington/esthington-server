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
exports.updateWithdrawalApproval = exports.updateMarketplaceApproval = exports.updateInvestmentApproval = exports.updatePropertyApproval = exports.getPendingApprovals = void 0;
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const appError_1 = __importDefault(require("../utils/appError"));
const propertyModel_1 = __importDefault(require("../models/propertyModel"));
const userModel_1 = __importDefault(require("../models/userModel"));
const walletModel_1 = require("../models/walletModel");
const marketplaceModel_1 = require("../models/marketplaceModel");
const investmentModel_1 = require("../models/investmentModel");
const emailService_1 = __importDefault(require("../services/emailService"));
// Get all pending approvals
exports.getPendingApprovals = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Get pending property approvals
    const pendingProperties = yield propertyModel_1.default.find({
        status: "pending",
    }).populate("owner", "name email");
    // Get pending investment approvals
    const pendingInvestments = yield investmentModel_1.UserInvestment.find({ status: "pending" })
        .populate("user", "name email")
        .populate("property", "title location");
    // Get pending marketplace listings
    const pendingMarketplace = yield marketplaceModel_1.MarketplaceListing.find({
        status: "pending",
    })
        .populate("seller", "name email")
        .populate("property", "title location");
    // Get pending withdrawal requests
    const pendingWithdrawals = yield walletModel_1.Wallet.aggregate([
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
            totalCount: pendingProperties.length +
                pendingInvestments.length +
                pendingMarketplace.length +
                pendingWithdrawals.length,
        },
    });
}));
// Approve or reject a property
exports.updatePropertyApproval = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    if (!["approved", "rejected"].includes(status)) {
        return next(new appError_1.default("Status must be either approved or rejected", 400));
    }
    const property = yield propertyModel_1.default.findById(id);
    if (!property) {
        return next(new appError_1.default("Property not found", 404));
    }
    if (property.status !== "pending") {
        return next(new appError_1.default("Property is not pending approval", 400));
    }
    property.status = status;
    if (status === "rejected" && rejectionReason) {
        property.rejectionReason = rejectionReason;
    }
    yield property.save();
    // Get owner details for notification
    const owner = yield userModel_1.default.findById(property.owner);
    if (owner) {
        // Send email notification
        yield emailService_1.default.sendEmail(owner.email, `Your property listing has been ${status}`, status === "approved"
            ? `Congratulations! Your property "${property.title}" has been approved and is now live.`
            : `Your property "${property.title}" has been rejected. Reason: ${rejectionReason || "No reason provided"}`);
    }
    res.status(200).json({
        status: "success",
        data: property,
    });
}));
// Approve or reject an investment
exports.updateInvestmentApproval = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    if (!["approved", "rejected"].includes(status)) {
        return next(new appError_1.default("Status must be either approved or rejected", 400));
    }
    const investment = yield investmentModel_1.UserInvestment.findById(id);
    if (!investment) {
        return next(new appError_1.default("Investment not found", 404));
    }
    if (investment.status !== "pending") {
        return next(new appError_1.default("Investment is not pending approval", 400));
    }
    investment.status = status;
    if (status === "rejected" && rejectionReason) {
        investment.rejectionReason = rejectionReason;
    }
    yield investment.save();
    // Get user details for notification
    const user = yield userModel_1.default.findById(investment.user);
    if (user) {
        // Send email notification
        yield emailService_1.default.sendEmail(user.email, `Your investment has been ${status}`, status === "approved"
            ? `Congratulations! Your investment of ${investment.amount} has been approved.`
            : `Your investment has been rejected. Reason: ${rejectionReason || "No reason provided"}`);
    }
    res.status(200).json({
        status: "success",
        data: investment,
    });
}));
// Approve or reject a marketplace listing
exports.updateMarketplaceApproval = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    if (!["approved", "rejected"].includes(status)) {
        return next(new appError_1.default("Status must be either approved or rejected", 400));
    }
    const listing = yield marketplaceModel_1.MarketplaceListing.findById(id);
    if (!listing) {
        return next(new appError_1.default("Marketplace listing not found", 404));
    }
    if (listing.status !== "pending") {
        return next(new appError_1.default("Listing is not pending approval", 400));
    }
    listing.status = status;
    if (status === "rejected" && rejectionReason) {
        listing.rejectionReason = rejectionReason;
    }
    yield listing.save();
    // Get seller details for notification
    const seller = yield userModel_1.default.findById(listing.seller);
    if (seller) {
        // Send email notification
        yield emailService_1.default.sendEmail(seller.email, `Your marketplace listing has been ${status}`, status === "approved"
            ? `Congratulations! Your marketplace listing has been approved and is now live.`
            : `Your marketplace listing has been rejected. Reason: ${rejectionReason || "No reason provided"}`);
    }
    res.status(200).json({
        status: "success",
        data: listing,
    });
}));
// Approve or reject a withdrawal request
exports.updateWithdrawalApproval = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, userId } = req.params;
    const { status, rejectionReason } = req.body;
    if (!["completed", "rejected"].includes(status)) {
        return next(new appError_1.default("Status must be either completed or rejected", 400));
    }
    const wallet = yield walletModel_1.Wallet.findOne({ user: userId });
    if (!wallet) {
        return next(new appError_1.default("Wallet not found", 404));
    }
    // Find the transaction in the wallet
    const transactionIndex = wallet.transactions.findIndex((t) => t._id.toString() === id &&
        t.type === "withdrawal" &&
        t.status === "pending");
    if (transactionIndex === -1) {
        return next(new appError_1.default("Pending withdrawal transaction not found", 404));
    }
    // Update the transaction status
    wallet.transactions[transactionIndex].status = status;
    if (status === "rejected" && rejectionReason) {
        wallet.transactions[transactionIndex].description = `${wallet.transactions[transactionIndex].description} - Rejected: ${rejectionReason}`;
        // If rejected, refund the amount to the wallet balance
        wallet.balance += wallet.transactions[transactionIndex].amount;
    }
    yield wallet.save();
    // Get user details for notification
    const user = yield userModel_1.default.findById(userId);
    if (user) {
        // Send email notification
        yield emailService_1.default.sendEmail(user.email, `Your withdrawal request has been ${status === "completed" ? "approved" : "rejected"}`, status === "completed"
            ? `Your withdrawal request for ${wallet.transactions[transactionIndex].amount} has been processed successfully.`
            : `Your withdrawal request for ${wallet.transactions[transactionIndex].amount} has been rejected. Reason: ${rejectionReason || "No reason provided"}`);
    }
    res.status(200).json({
        status: "success",
        data: wallet.transactions[transactionIndex],
    });
}));
//# sourceMappingURL=approvalController.js.map