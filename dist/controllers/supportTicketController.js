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
exports.getAllTickets = exports.assignTicket = exports.updateTicketStatus = exports.replyToTicket = exports.getTicketById = exports.getUserTickets = exports.createTicket = void 0;
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const appError_1 = __importDefault(require("../utils/appError"));
const supportTicketModel_1 = __importDefault(require("../models/supportTicketModel"));
const userModel_1 = __importDefault(require("../models/userModel"));
const cloudinaryService_1 = require("../services/cloudinaryService");
const emailService_1 = __importDefault(require("../services/emailService"));
const http_status_codes_1 = require("http-status-codes");
// Create a support ticket
exports.createTicket = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { subject, category, priority, message } = req.body;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user.id;
    // Validate required fields
    if (!subject || !category || !message) {
        return next(new appError_1.default("Please provide all required fields", 400));
    }
    // Handle file uploads if any
    let attachments = [];
    if (req.files && Array.isArray(req.files)) {
        const uploadPromises = req.files.map((file) => (0, cloudinaryService_1.uploadToCloudinary)(file.path));
        const results = yield Promise.all(uploadPromises);
        attachments = results.map((result) => result.secure_url);
    }
    // Create the ticket
    const ticket = yield supportTicketModel_1.default.create({
        user: userId,
        subject,
        category,
        priority: priority || "medium",
        messages: [
            {
                sender: userId,
                message,
                attachments,
                createdAt: new Date(),
            },
        ],
    });
    // Send notification to admin (you would implement this)
    // await notificationService.sendAdminNotification({
    //   title: 'New Support Ticket',
    //   message: `User ${req.user.name} has created a new support ticket: ${subject}`,
    //   type: 'support'
    // });
    res.status(201).json({
        status: "success",
        message: "Support ticket created successfully",
        data: {
            id: ticket._id,
            subject: ticket.subject,
            category: ticket.category,
            status: ticket.status,
            priority: ticket.priority,
            createdAt: ticket.createdAt,
        },
    });
}));
// Get user's support tickets
exports.getUserTickets = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { user: userId };
    if (status)
        filter.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = yield Promise.all([
        supportTicketModel_1.default.find(filter)
            .sort("-updatedAt")
            .skip(skip)
            .limit(Number(limit)),
        supportTicketModel_1.default.countDocuments(filter),
    ]);
    res.status(200).json({
        status: "success",
        results: tickets.length,
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        data: tickets,
    });
}));
// Get ticket details
exports.getTicketById = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user.id;
    const ticket = yield supportTicketModel_1.default.findById(id)
        .populate("user", "name email")
        .populate("assignedTo", "name email")
        .populate("closedBy", "name email")
        .populate("messages.sender", "name email role");
    if (!ticket) {
        return next(new appError_1.default("Ticket not found", 404));
    }
    // Check if user is authorized to view this ticket
    if (ticket.user._id.toString() !== userId && req.user.role !== "admin") {
        return next(new appError_1.default("You are not authorized to view this ticket", 403));
    }
    res.status(200).json({
        status: "success",
        data: ticket,
    });
}));
// Reply to a ticket
exports.replyToTicket = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { message } = req.body;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const userId = req.user.id;
    if (!message) {
        return next(new appError_1.default("Message is required", 400));
    }
    const ticket = yield supportTicketModel_1.default.findById(id);
    if (!ticket) {
        return next(new appError_1.default("Ticket not found", 404));
    }
    // Check if user is authorized to reply to this ticket
    if (ticket.user.toString() !== userId && req.user.role !== "admin") {
        return next(new appError_1.default("You are not authorized to reply to this ticket", 403));
    }
    // Check if ticket is closed
    if (ticket.status === "closed") {
        return next(new appError_1.default("Cannot reply to a closed ticket", 400));
    }
    // Handle file uploads if any
    let attachments = [];
    if (req.files && Array.isArray(req.files)) {
        const uploadPromises = req.files.map((file) => (0, cloudinaryService_1.uploadToCloudinary)(file.path));
        const results = yield Promise.all(uploadPromises);
        attachments = results.map((result) => result.secure_url);
    }
    // Add the reply
    ticket.messages.push({
        sender: userId,
        message,
        attachments,
        createdAt: new Date(),
    });
    // Update ticket status if it's an admin reply
    if (req.user.role === "admin" && ticket.status === "open") {
        ticket.status = "in-progress";
        // Assign the ticket to the admin if not already assigned
        if (!ticket.assignedTo) {
            ticket.assignedTo = userId;
        }
    }
    yield ticket.save();
    // Send notification to the other party
    const recipientId = req.user.role === "admin" ? ticket.user : ticket.assignedTo;
    if (recipientId) {
        const recipient = yield userModel_1.default.findById(recipientId);
        if (recipient) {
            // Send email notification
            yield emailService_1.default.sendEmail(recipient.email, `New reply to your support ticket: ${ticket.subject}`, `There is a new reply to your support ticket. Please log in to view the message.`);
            // Send in-app notification (you would implement this)
            // await notificationService.sendNotification({
            //   userId: recipientId,
            //   title: 'New Support Ticket Reply',
            //   message: `There is a new reply to your support ticket: ${ticket.subject}`,
            //   type: 'support'
            // });
        }
    }
    res.status(200).json({
        status: "success",
        message: "Reply added successfully",
        data: {
            id: ticket._id,
            status: ticket.status,
            updatedAt: ticket.updatedAt,
        },
    });
}));
// Update ticket status (admin only)
exports.updateTicketStatus = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    if (!req.user) {
        return next(new appError_1.default("User not authenticated", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
    const adminId = req.user.id;
    if (!["open", "in-progress", "resolved", "closed"].includes(status)) {
        return next(new appError_1.default("Invalid status", 400));
    }
    const ticket = yield supportTicketModel_1.default.findById(id);
    if (!ticket) {
        return next(new appError_1.default("Ticket not found", 404));
    }
    // Update ticket status
    ticket.status = status;
    // If closing the ticket, record who closed it and when
    if (status === "closed") {
        ticket.closedAt = new Date();
        ticket.closedBy = adminId;
    }
    yield ticket.save();
    // Notify the user
    const user = yield userModel_1.default.findById(ticket.user);
    if (user) {
        // Send email notification
        yield emailService_1.default.sendEmail(user.email, `Support ticket status updated: ${ticket.subject}`, `Your support ticket status has been updated to: ${status}`);
        //Send in-app notification (you would implement this)
        // await notificationService.sendNotification({
        //   userId: ticket.user,
        //   title: 'Support Ticket Updated',
        //   message: `Your support ticket status has been updated to: ${status}`,
        //   type: 'support'
        // });
    }
    res.status(200).json({
        status: "success",
        message: "Ticket status updated successfully",
        data: {
            id: ticket._id,
            status: ticket.status,
            updatedAt: ticket.updatedAt,
            closedAt: ticket.closedAt,
            closedBy: ticket.closedBy,
        },
    });
}));
// Assign ticket to admin (admin only)
exports.assignTicket = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { adminId } = req.body;
    if (!adminId) {
        return next(new appError_1.default("Admin ID is required", 400));
    }
    // Verify that the assigned user is an admin
    const admin = yield userModel_1.default.findById(adminId);
    if (!admin || admin.role !== "admin") {
        return next(new appError_1.default("Invalid admin ID", 400));
    }
    const ticket = yield supportTicketModel_1.default.findById(id);
    if (!ticket) {
        return next(new appError_1.default("Ticket not found", 404));
    }
    // Assign the ticket
    ticket.assignedTo = adminId;
    // Update status if it's open
    if (ticket.status === "open") {
        ticket.status = "in-progress";
    }
    yield ticket.save();
    res.status(200).json({
        status: "success",
        message: "Ticket assigned successfully",
        data: {
            id: ticket._id,
            assignedTo: ticket.assignedTo,
            status: ticket.status,
            updatedAt: ticket.updatedAt,
        },
    });
}));
// Get all tickets (admin only)
exports.getAllTickets = (0, asyncHandler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { status, category, priority, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status)
        filter.status = status;
    if (category)
        filter.category = category;
    if (priority)
        filter.priority = priority;
    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = yield Promise.all([
        supportTicketModel_1.default.find(filter)
            .populate("user", "name email")
            .populate("assignedTo", "name email")
            .sort("-updatedAt")
            .skip(skip)
            .limit(Number(limit)),
        supportTicketModel_1.default.countDocuments(filter),
    ]);
    res.status(200).json({
        status: "success",
        results: tickets.length,
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        data: tickets,
    });
}));
//# sourceMappingURL=supportTicketController.js.map