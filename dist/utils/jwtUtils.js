"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyToken = exports.generateRefreshToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("./logger"));
/**
 * Generate JWT token
 * @param userId User ID
 * @param role User role
 * @param expiresIn Token expiration time
 */
const generateToken = (userId, role, expiresIn = config_1.default.jwtExpiresIn) => {
    try {
        return jsonwebtoken_1.default.sign({ id: userId, role }, config_1.default.jwtSecret, {
            expiresIn: Number.parseInt(config_1.default.jwtExpiresIn),
        });
    }
    catch (error) {
        logger_1.default.error(`JWT generation error: ${error instanceof Error ? error.message : "Unknown error"}`);
        throw error;
    }
};
exports.generateToken = generateToken;
/**
 * Generate refresh token
 * @param userId User ID
 * @param role User role
 */
const generateRefreshToken = (userId, role) => {
    try {
        return jsonwebtoken_1.default.sign({ id: userId, role }, config_1.default.jwtRefreshSecret, {
            expiresIn: Number.parseInt(config_1.default.jwtRefreshExpiresIn, 10),
        });
    }
    catch (error) {
        logger_1.default.error(`JWT refresh token generation error: ${error instanceof Error ? error.message : "Unknown error"}`);
        throw error;
    }
};
exports.generateRefreshToken = generateRefreshToken;
/**
 * Verify JWT token
 * @param token JWT token
 */
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.default.jwtSecret);
    }
    catch (error) {
        logger_1.default.error(`JWT verification error: ${error instanceof Error ? error.message : "Unknown error"}`);
        return null;
    }
};
exports.verifyToken = verifyToken;
/**
 * Verify refresh token
 * @param token Refresh token
 */
const verifyRefreshToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.default.jwtRefreshSecret);
    }
    catch (error) {
        logger_1.default.error(`JWT refresh token verification error: ${error instanceof Error ? error.message : "Unknown error"}`);
        return null;
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=jwtUtils.js.map