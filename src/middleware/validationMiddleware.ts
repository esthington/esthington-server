import type { Request, Response, NextFunction } from "express"
import { validationResult, type ValidationChain } from "express-validator"
import { StatusCodes } from "http-status-codes"
import type Joi from "joi"

/**
 * Middleware to validate request using express-validator
 * @param validations Array of validation chains
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)))

    // Check for validation errors
    const errors = validationResult(req)
    if (errors.isEmpty()) {
      return next()
    }

    // Format errors
    const formattedErrors = errors.array().reduce((acc: Record<string, string>, error: any) => {
      acc[error.param] = error.msg
      return acc
    }, {})

    // Return validation errors
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Validation error",
      errors: formattedErrors,
    })
  }
}

/**
 * Middleware to validate request using Joi schema
 * @param schema Joi schema
 */
export const validateWithJoi = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false })

    if (!error) {
      return next()
    }

    const errors = error.details.reduce((acc: Record<string, string>, detail: any) => {
      acc[detail.context.key] = detail.message.replace(/['"]/g, "")
      return acc
    }, {})

    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Validation error",
      errors,
    })
  }
}

/**
 * Unified validation function that can use either express-validator or Joi
 * @param schema Validation schema (express-validator chains or Joi schema)
 */
export const unifiedValidate = (schema: ValidationChain[] | Joi.ObjectSchema) => {
  // Check if it's a Joi schema (has validate method)
  if ("validate" in schema) {
    return validateWithJoi(schema as Joi.ObjectSchema)
  }

  // Otherwise assume it's express-validator chains
  return validate(schema as ValidationChain[])
}
