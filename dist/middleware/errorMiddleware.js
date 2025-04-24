"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.errorHandler = exports.handleValidationErrors = void 0;
const http_status_codes_1 = require("http-status-codes");
const appError_1 = require("../utils/appError");
const logger_1 = __importDefault(require("../utils/logger"));
const config_1 = __importDefault(require("../config/config"));
/**
 * Handle validation errors
 */
const handleValidationErrors = (err, req, res, next) => {
    if (!Array.isArray(err) || !err.every((e) => e.msg !== undefined)) {
        return next(err);
    }
    const errors = err.reduce((acc, curr) => {
        acc[curr.param] = curr.msg;
        return acc;
    }, {});
    res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Validation error",
        errors,
    });
};
exports.handleValidationErrors = handleValidationErrors;
/**
 * Handle MongoDB duplicate key errors
 */
const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return new appError_1.AppError(`Duplicate field value: ${value}. Please use another value for ${field}.`, http_status_codes_1.StatusCodes.BAD_REQUEST);
};
/**
 * Handle MongoDB validation errors
 */
const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map((el) => el.message);
    return new appError_1.AppError(`Invalid input data. ${errors.join(". ")}`, http_status_codes_1.StatusCodes.BAD_REQUEST);
};
/**
 * Handle JWT errors
 */
const handleJWTError = () => new appError_1.AppError("Invalid token. Please log in again.", http_status_codes_1.StatusCodes.UNAUTHORIZED);
/**
 * Handle JWT expired error
 */
const handleJWTExpiredError = () => new appError_1.AppError("Your token has expired. Please log in again.", http_status_codes_1.StatusCodes.UNAUTHORIZED);
/**
 * Send error response in development environment
 */
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};
/**
 * Send error response in production environment
 */
const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }
    else {
        // Programming or other unknown error: don't leak error details
        logger_1.default.error("ERROR 💥", err);
        res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Something went wrong",
        });
    }
};
/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR;
    err.status = err.status || "error";
    if (config_1.default.env === "development") {
        sendErrorDev(err, res);
    }
    else if (config_1.default.env === "production") {
        let error = Object.assign({}, err);
        error.message = err.message;
        if (err.code === 11000)
            error = handleDuplicateKeyError(err);
        if (err.name === "ValidationError")
            error = handleValidationError(err);
        if (err.name === "JsonWebTokenError")
            error = handleJWTError();
        if (err.name === "TokenExpiredError")
            error = handleJWTExpiredError();
        sendErrorProd(error, res);
    }
};
exports.errorHandler = errorHandler;
/**
 * Not found handler
 */
const notFound = (req, res, next) => {
    const error = new appError_1.AppError(`Not Found - ${req.originalUrl}`, http_status_codes_1.StatusCodes.NOT_FOUND);
    next(error);
};
exports.notFound = notFound;
//# sourceMappingURL=errorMiddleware.js.map