import type { Request, Response, NextFunction } from "express"
import { StatusCodes } from "http-status-codes"
import { type ValidationError } from "express-validator"
import { AppError } from "../utils/appError"
import logger from "../utils/logger"
import config from "../config/config"

/**
 * Handle validation errors
 */
export const handleValidationErrors = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (!Array.isArray(err) || !err.every((e) => (e as ValidationError).msg !== undefined)) {
    return next(err)
  }

  const errors = err.reduce((acc: Record<string, string>, curr: ValidationError) => {
    acc[(curr as ValidationError & { param: string }).param] = (curr as ValidationError & { msg: string }).msg
    return acc
  }, {})

  res.status(StatusCodes.BAD_REQUEST).json({
    success: false,
    message: "Validation error",
    errors,
  })
}

/**
 * Handle MongoDB duplicate key errors
 */
const handleDuplicateKeyError = (err: any) => {
  const field = Object.keys(err.keyValue)[0]
  const value = err.keyValue[field]
  return new AppError(
    `Duplicate field value: ${value}. Please use another value for ${field}.`,
    StatusCodes.BAD_REQUEST,
  )
}

/**
 * Handle MongoDB validation errors
 */
const handleValidationError = (err: any) => {
  const errors = Object.values(err.errors).map((el: any) => el.message)
  return new AppError(`Invalid input data. ${errors.join(". ")}`, StatusCodes.BAD_REQUEST)
}

/**
 * Handle JWT errors
 */
const handleJWTError = () => new AppError("Invalid token. Please log in again.", StatusCodes.UNAUTHORIZED)

/**
 * Handle JWT expired error
 */
const handleJWTExpiredError = () =>
  new AppError("Your token has expired. Please log in again.", StatusCodes.UNAUTHORIZED)

/**
 * Send error response in development environment
 */
const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack,
  })
}

/**
 * Send error response in production environment
 */
const sendErrorProd = (err: AppError, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    })
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error("ERROR 💥", err)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Something went wrong",
    })
  }
}

/**
 * Global error handler
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
  err.status = err.status || "error"

  if (config.env === "development") {
    sendErrorDev(err, res)
  } else if (config.env === "production") {
    let error = { ...err }
    error.message = err.message

    if (err.code === 11000) error = handleDuplicateKeyError(err)
    if (err.name === "ValidationError") error = handleValidationError(err)
    if (err.name === "JsonWebTokenError") error = handleJWTError()
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError()

    sendErrorProd(error, res)
  }
}

/**
 * Not found handler
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, StatusCodes.NOT_FOUND)
  next(error)
}
