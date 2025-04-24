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
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedValidate = exports.validateWithJoi = exports.validate = void 0;
const express_validator_1 = require("express-validator");
const http_status_codes_1 = require("http-status-codes");
/**
 * Middleware to validate request using express-validator
 * @param validations Array of validation chains
 */
const validate = (validations) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Run all validations
        yield Promise.all(validations.map((validation) => validation.run(req)));
        // Check for validation errors
        const errors = (0, express_validator_1.validationResult)(req);
        if (errors.isEmpty()) {
            return next();
        }
        // Format errors
        const formattedErrors = errors.array().reduce((acc, error) => {
            acc[error.param] = error.msg;
            return acc;
        }, {});
        // Return validation errors
        return res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({
            success: false,
            message: "Validation error",
            errors: formattedErrors,
        });
    });
};
exports.validate = validate;
/**
 * Middleware to validate request using Joi schema
 * @param schema Joi schema
 */
const validateWithJoi = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (!error) {
            return next();
        }
        const errors = error.details.reduce((acc, detail) => {
            acc[detail.context.key] = detail.message.replace(/['"]/g, "");
            return acc;
        }, {});
        return res.status(http_status_codes_1.StatusCodes.BAD_REQUEST).json({
            success: false,
            message: "Validation error",
            errors,
        });
    };
};
exports.validateWithJoi = validateWithJoi;
/**
 * Unified validation function that can use either express-validator or Joi
 * @param schema Validation schema (express-validator chains or Joi schema)
 */
const unifiedValidate = (schema) => {
    // Check if it's a Joi schema (has validate method)
    if ("validate" in schema) {
        return (0, exports.validateWithJoi)(schema);
    }
    // Otherwise assume it's express-validator chains
    return (0, exports.validate)(schema);
};
exports.unifiedValidate = unifiedValidate;
//# sourceMappingURL=validationMiddleware.js.map