"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = void 0;
/**
 * Wrapper for async route handlers to catch errors and pass them to the error middleware
 * @param fn Async function to wrap
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// Export both named and default for backward compatibility
exports.default = exports.asyncHandler;
//# sourceMappingURL=asyncHandler.js.map