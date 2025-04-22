import jwt from "jsonwebtoken"
import config from "../config/config"
import logger from "./logger"

interface TokenPayload {
  id: string
  role: string
}


/**
 * Generate JWT token
 * @param userId User ID
 * @param role User role
 * @param expiresIn Token expiration time
 */
export const generateToken = (userId: string, role: string, expiresIn = config.jwtExpiresIn): string => {
  try {
    return jwt.sign({ id: userId, role }, config.jwtSecret, {
      expiresIn: Number.parseInt(config.jwtExpiresIn),
    });
  } catch (error) {
    logger.error(`JWT generation error: ${error instanceof Error ? error.message : "Unknown error"}`)
    throw error
  }
}

/**
 * Generate refresh token
 * @param userId User ID
 * @param role User role
 */
export const generateRefreshToken = (userId: string, role: string): string => {
  try {
    return jwt.sign({ id: userId, role }, config.jwtRefreshSecret, {
      expiresIn: Number.parseInt(config.jwtRefreshExpiresIn, 10),
    })
  } catch (error) {
    logger.error(`JWT refresh token generation error: ${error instanceof Error ? error.message : "Unknown error"}`)
    throw error
  }
}

/**
 * Verify JWT token
 * @param token JWT token
 */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload
  } catch (error) {
    logger.error(`JWT verification error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return null
  }
}

/**
 * Verify refresh token
 * @param token Refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, config.jwtRefreshSecret) as TokenPayload
  } catch (error) {
    logger.error(`JWT refresh token verification error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return null
  }
}
