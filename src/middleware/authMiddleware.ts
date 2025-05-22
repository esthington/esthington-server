import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { verifyToken } from "../utils/jwtUtils";
import { AppError } from "../utils/appError";
import User, { UserRole, type IUser } from "../models/userModel";
import logger from "../utils/logger";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Protect routes - Verify JWT token and set user in request
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError(
          "Not authorized to access this route",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return next(
        new AppError(
          "Not authorized to access this route",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    // Check if user exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(
        new AppError("User account is deactivated", StatusCodes.FORBIDDEN)
      );
    }

    // Set user in request
    req.user = user;
    next();
  } catch (error) {
    logger.error(
      `Auth middleware error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    next(
      new AppError(
        "Not authorized to access this route",
        StatusCodes.UNAUTHORIZED
      )
    );
  }
};

/**
 * Restrict routes to specific roles
 * @param roles Array of allowed roles
 */
export const restrictTo = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log("req.user", req.user);
    if (!req.user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    const userRole = req.user.role.toUpperCase();
    console.log("User role (uppercase):", userRole);
    console.log(
      "Checking if role matches:",
      roles.map((r) => r.toString().toUpperCase())
    );

    // Check if the uppercase version of the role exists in our allowed roles
    if (!roles.some((role) => role.toString().toUpperCase() === userRole)) {
      console.log("Role check failed - unauthorized");
      return next(
        new AppError(
          "Not authorized to access this route",
          StatusCodes.FORBIDDEN
        )
      );
    }

    console.log("Role check passed - authorized");
    next();
  };
};

/**
 * Check if user is verified
 */
export const isVerified = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("User not found", StatusCodes.NOT_FOUND));
  }

  if (!req.user.isEmailVerified) {
    return next(
      new AppError("Please verify your email first", StatusCodes.FORBIDDEN)
    );
  }

  next();
};

// For backward compatibility with routes using admin middleware
export const admin = restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN);
