import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import type { SortOrder } from "mongoose";
import BankAccount from "../models/bankAccountModel";
import { AppError } from "../utils/appError";
import { asyncHandler } from "../utils/asyncHandler";


// Add bank account
export const addBankAccount = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const {
      accountName,
      accountNumber,
      bankName,
      routingNumber,
      swiftCode,
      isDefault,
    } = req.body;

    // Check if account number already exists for this user
    const existingAccount = await BankAccount.findOne({
      user: userId,
      accountNumber,
      bankName,
    });

    if (existingAccount) {
      return next(
        new AppError("Bank account already exists", StatusCodes.BAD_REQUEST)
      );
    }

    // Check if this is the first account
    const count = await BankAccount.countDocuments({ user: userId });
    const shouldBeDefault = count === 0 || isDefault;

    // If this should be the default account, update all other accounts
    if (shouldBeDefault) {
      await BankAccount.updateMany({ user: userId }, { isDefault: false });
    }

    // Create bank account
    const bankAccount = await BankAccount.create({
      user: userId,
      accountName,
      accountNumber,
      bankName,
      routingNumber,
      swiftCode,
      isDefault: shouldBeDefault,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      bankAccount,
    });
  }
);

// Get user bank accounts with pagination, sorting, and filtering
export const getBankAccounts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("User not authenticated", StatusCodes.UNAUTHORIZED));
  }

  const userId = req.user._id;
  
  // Pagination parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  
  // Sorting parameters
  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;
  const sortOptions: { [key: string]: SortOrder } = {};
  sortOptions[sortBy] = sortOrder === 1 ? "asc" : "desc";
  
  // Filtering parameters
  const filterOptions: Record<string, any> = { user: userId };
  
  if (req.query.bankName) {
    filterOptions.bankName = { $regex: req.query.bankName, $options: 'i' };
  }
  
  if (req.query.isDefault === 'true') {
    filterOptions.isDefault = true;
  }

  try {
    // Get total count for pagination
    const totalCount = await BankAccount.countDocuments(filterOptions);
    
    // Get bank accounts with pagination, sorting, and filtering
    const bankAccounts = await BankAccount.find(filterOptions)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.status(StatusCodes.OK).json({
      success: true,
      count: bankAccounts.length,
      totalCount,
      pagination: {
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      bankAccounts,
    });
  } catch (error) {
    return next(new AppError(
      "Failed to retrieve bank accounts", 
      StatusCodes.INTERNAL_SERVER_ERROR
    ));
  }
});

// Update bank account
export const updateBankAccount = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { id } = req.params;
    const {
      accountName,
      accountNumber,
      bankName,
      routingNumber,
      swiftCode,
      isDefault,
    } = req.body;

    // Find bank account
    const bankAccount = await BankAccount.findOne({ _id: id, user: userId });
    if (!bankAccount) {
      return next(
        new AppError("Bank account not found", StatusCodes.NOT_FOUND)
      );
    }

    // If setting as default, update all other accounts
    if (isDefault && !bankAccount.isDefault) {
      await BankAccount.updateMany({ user: userId }, { isDefault: false });
    }

    // Update bank account
    bankAccount.accountName = accountName || bankAccount.accountName;
    bankAccount.accountNumber = accountNumber || bankAccount.accountNumber;
    bankAccount.bankName = bankName || bankAccount.bankName;
    bankAccount.routingNumber = routingNumber || bankAccount.routingNumber;
    bankAccount.swiftCode = swiftCode || bankAccount.swiftCode;
    bankAccount.isDefault =
      isDefault !== undefined ? isDefault : bankAccount.isDefault;

    await bankAccount.save();

    res.status(StatusCodes.OK).json({
      success: true,
      bankAccount,
    });
  }
);

// Delete bank account
export const deleteBankAccount = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { id } = req.params;

    // Find bank account
    const bankAccount = await BankAccount.findOne({ _id: id, user: userId });
    if (!bankAccount) {
      return next(
        new AppError("Bank account not found", StatusCodes.NOT_FOUND)
      );
    }

    // Delete bank account
    await BankAccount.deleteOne({ _id: bankAccount._id });

    // If this was the default account, set another account as default
    if (bankAccount.isDefault) {
      const anotherAccount = await BankAccount.findOne({ user: userId });
      if (anotherAccount) {
        anotherAccount.isDefault = true;
        await anotherAccount.save();
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Bank account deleted successfully",
    });
  }
);

// Set default bank account
export const setDefaultBankAccount = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError("User not authenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userId = req.user._id;
    const { id } = req.params;

    // Find bank account
    const bankAccount = await BankAccount.findOne({ _id: id, user: userId });
    if (!bankAccount) {
      return next(
        new AppError("Bank account not found", StatusCodes.NOT_FOUND)
      );
    }

    // Update all other accounts
    await BankAccount.updateMany({ user: userId }, { isDefault: false });

    // Set this account as default
    bankAccount.isDefault = true;
    await bankAccount.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Default bank account updated successfully",
      bankAccount,
    });
  }
);
