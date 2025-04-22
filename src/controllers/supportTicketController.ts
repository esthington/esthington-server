import type { Request, Response, NextFunction } from "express";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/appError";
import SupportTicket from "../models/supportTicketModel";
import User from "../models/userModel";
import { uploadToCloudinary } from "../services/cloudinaryService";
import emailService from "../services/emailService";
import { StatusCodes } from "http-status-codes";

// Create a support ticket
export const createTicket = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { subject, category, priority, message } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user.id;

    // Validate required fields
    if (!subject || !category || !message) {
      return next(new AppError("Please provide all required fields", 400));
    }

    // Handle file uploads if any
    let attachments: string[] = [];

    if (req.files && Array.isArray(req.files)) {
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.path)
      );
      const results = await Promise.all(uploadPromises);
      attachments = results.map((result) => result.secure_url);
    }

    // Create the ticket
    const ticket = await SupportTicket.create({
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
  }
);

// Get user's support tickets
export const getUserTickets = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const filter: any = { user: userId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort("-updatedAt")
        .skip(skip)
        .limit(Number(limit)),
      SupportTicket.countDocuments(filter),
    ]);

    res.status(200).json({
      status: "success",
      results: tickets.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: tickets,
    });
  }
);

// Get ticket details
export const getTicketById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user.id;

    const ticket = await SupportTicket.findById(id)
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("closedBy", "name email")
      .populate("messages.sender", "name email role");

    if (!ticket) {
      return next(new AppError("Ticket not found", 404));
    }

    // Check if user is authorized to view this ticket
    if (ticket.user._id.toString() !== userId && req.user.role !== "admin") {
      return next(
        new AppError("You are not authorized to view this ticket", 403)
      );
    }

    res.status(200).json({
      status: "success",
      data: ticket,
    });
  }
);

// Reply to a ticket
export const replyToTicket = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { message } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user.id;

    if (!message) {
      return next(new AppError("Message is required", 400));
    }

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return next(new AppError("Ticket not found", 404));
    }

    // Check if user is authorized to reply to this ticket
    if (ticket.user.toString() !== userId && req.user.role !== "admin") {
      return next(
        new AppError("You are not authorized to reply to this ticket", 403)
      );
    }

    // Check if ticket is closed
    if (ticket.status === "closed") {
      return next(new AppError("Cannot reply to a closed ticket", 400));
    }

    // Handle file uploads if any
    let attachments: string[] = [];

    if (req.files && Array.isArray(req.files)) {
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.path)
      );
      const results = await Promise.all(uploadPromises);
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

    await ticket.save();

    // Send notification to the other party
    const recipientId =
      req.user.role === "admin" ? ticket.user : ticket.assignedTo;

    if (recipientId) {
      const recipient = await User.findById(recipientId);

      if (recipient) {
        // Send email notification
        await emailService.sendEmail(
          recipient.email,
          `New reply to your support ticket: ${ticket.subject}`,
          `There is a new reply to your support ticket. Please log in to view the message.`
        );

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
  }
);

// Update ticket status (admin only)
export const updateTicketStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const adminId = req.user.id;

    if (!["open", "in-progress", "resolved", "closed"].includes(status)) {
      return next(new AppError("Invalid status", 400));
    }

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return next(new AppError("Ticket not found", 404));
    }

    // Update ticket status
    ticket.status = status;

    // If closing the ticket, record who closed it and when
    if (status === "closed") {
      ticket.closedAt = new Date();
      ticket.closedBy = adminId;
    }

    await ticket.save();

    // Notify the user
    const user = await User.findById(ticket.user);

    if (user) {
      // Send email notification
      await emailService.sendEmail(
        user.email,
        `Support ticket status updated: ${ticket.subject}`,
        `Your support ticket status has been updated to: ${status}`
      );
      

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
  }
);

// Assign ticket to admin (admin only)
export const assignTicket = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return next(new AppError("Admin ID is required", 400));
    }

    // Verify that the assigned user is an admin
    const admin = await User.findById(adminId);

    if (!admin || admin.role !== "admin") {
      return next(new AppError("Invalid admin ID", 400));
    }

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return next(new AppError("Ticket not found", 404));
    }

    // Assign the ticket
    ticket.assignedTo = adminId;

    // Update status if it's open
    if (ticket.status === "open") {
      ticket.status = "in-progress";
    }

    await ticket.save();

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
  }
);

// Get all tickets (admin only)
export const getAllTickets = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, category, priority, page = 1, limit = 10 } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const skip = (Number(page) - 1) * Number(limit);

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate("user", "name email")
        .populate("assignedTo", "name email")
        .sort("-updatedAt")
        .skip(skip)
        .limit(Number(limit)),
      SupportTicket.countDocuments(filter),
    ]);

    res.status(200).json({
      status: "success",
      results: tickets.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: tickets,
    });
  }
);
