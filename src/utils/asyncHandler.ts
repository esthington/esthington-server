import type { Request, Response, NextFunction } from "express"

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>

/**
 * Wrapper for async route handlers to catch errors and pass them to the error middleware
 * @param fn Async function to wrap
 */
export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// Export both named and default for backward compatibility
export default asyncHandler
