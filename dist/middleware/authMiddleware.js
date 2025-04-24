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
exports.admin = exports.isVerified = exports.restrictTo = exports.protect = void 0;
const http_status_codes_1 = require("http-status-codes");
const jwtUtils_1 = require("../utils/jwtUtils");
const appError_1 = require("../utils/appError");
const userModel_1 = __importStar(require("../models/userModel"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Protect routes - Verify JWT token and set user in request
 */
const protect = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        let token;
        if (authHeader && authHeader.startsWith("Bearer")) {
            token = authHeader.split(" ")[1];
        }
        if (!token) {
            return next(new appError_1.AppError("Not authorized to access this route", http_status_codes_1.StatusCodes.UNAUTHORIZED));
        }
        // Verify token
        const decoded = (0, jwtUtils_1.verifyToken)(token);
        if (!decoded) {
            return next(new appError_1.AppError("Not authorized to access this route", http_status_codes_1.StatusCodes.UNAUTHORIZED));
        }
        // Check if user exists
        const user = yield userModel_1.default.findById(decoded.id);
        if (!user) {
            return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        // Check if user is active
        if (!user.isActive) {
            return next(new appError_1.AppError("User account is deactivated", http_status_codes_1.StatusCodes.FORBIDDEN));
        }
        // Set user in request
        req.user = user;
        next();
    }
    catch (error) {
        logger_1.default.error(`Auth middleware error: ${error instanceof Error ? error.message : "Unknown error"}`);
        next(new appError_1.AppError("Not authorized to access this route", http_status_codes_1.StatusCodes.UNAUTHORIZED));
    }
});
exports.protect = protect;
/**
 * Restrict routes to specific roles
 * @param roles Array of allowed roles
 */
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
        }
        if (!roles.includes(req.user.role)) {
            return next(new appError_1.AppError("Not authorized to access this route", http_status_codes_1.StatusCodes.FORBIDDEN));
        }
        next();
    };
};
exports.restrictTo = restrictTo;
/**
 * Check if user is verified
 */
const isVerified = (req, res, next) => {
    if (!req.user) {
        return next(new appError_1.AppError("User not found", http_status_codes_1.StatusCodes.NOT_FOUND));
    }
    if (!req.user.isEmailVerified) {
        return next(new appError_1.AppError("Please verify your email first", http_status_codes_1.StatusCodes.FORBIDDEN));
    }
    next();
};
exports.isVerified = isVerified;
// For backward compatibility with routes using admin middleware
exports.admin = (0, exports.restrictTo)(userModel_1.UserRole.ADMIN, userModel_1.UserRole.SUPER_ADMIN);
//# sourceMappingURL=authMiddleware.js.map