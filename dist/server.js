"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_status_codes_1 = require("http-status-codes");
const db_1 = __importDefault(require("./config/db"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const walletRoutes_1 = __importDefault(require("./routes/walletRoutes"));
const bankAccountRoutes_1 = __importDefault(require("./routes/bankAccountRoutes"));
const propertyRoutes_1 = __importDefault(require("./routes/propertyRoutes"));
const investmentRoutes_1 = __importDefault(require("./routes/investmentRoutes"));
const referralRoutes_1 = __importDefault(require("./routes/referralRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const approvalRoutes_1 = __importDefault(require("./routes/approvalRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const adminManagementRoutes_1 = __importDefault(require("./routes/adminManagementRoutes"));
const userManagementRoutes_1 = __importDefault(require("./routes/userManagementRoutes"));
// Import the new routes
const transactionRoutes_1 = __importDefault(require("./routes/transactionRoutes"));
const kycRoutes_1 = __importDefault(require("./routes/kycRoutes"));
const supportTicketRoutes_1 = __importDefault(require("./routes/supportTicketRoutes"));
const settingRoutes_1 = __importDefault(require("./routes/settingRoutes"));
const activityLogRoutes_1 = __importDefault(require("./routes/activityLogRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
// Load environment variables
dotenv_1.default.config();
// Add the Paystack verification after database connection
// Connect to database
(0, db_1.default)();
// Verify Paystack configuration
// import { verifyPaystackConfig } from "./utils/testPaystack"
const logger_1 = __importDefault(require("./utils/logger"));
// verifyPaystackConfig().catch((err) => {
//   logger.error(`Error verifying Paystack configuration: ${err.message}`)
// })
// Initialize express app
const app = (0, express_1.default)();
// Middleware
// ✅ Allowed Origins
const allowedOrigins = [
    "http://localhost:3000"
];
// ✅ CORS Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.error("Blocked by CORS:", origin);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
    ],
}));
// ✅ Handle Preflight Requests
app.options("*", (0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use("/api/v1/auth", authRoutes_1.default);
app.use("/api/v1/users", userRoutes_1.default);
app.use("/api/v1/wallet", walletRoutes_1.default);
app.use("/api/v1/bank-accounts", bankAccountRoutes_1.default);
app.use("/api/v1/properties", propertyRoutes_1.default);
app.use("/api/v1/investments", investmentRoutes_1.default);
app.use("/api/v1/referrals", referralRoutes_1.default);
app.use("/api/v1/notifications", notificationRoutes_1.default);
// Add existing routes
app.use("/api/v1/reports", reportRoutes_1.default);
app.use("/api/v1/approvals", approvalRoutes_1.default);
app.use("/api/v1/dashboard", dashboardRoutes_1.default);
app.use("/api/v1/admin-management", adminManagementRoutes_1.default);
app.use("/api/v1/user-management", userManagementRoutes_1.default);
// Add the new routes
app.use("/api/v1/transactions", transactionRoutes_1.default);
app.use("/api/v1/kyc", kycRoutes_1.default);
app.use("/api/v1/support", supportTicketRoutes_1.default);
app.use("/api/v1/settings", settingRoutes_1.default);
app.use("/api/v1/activity-logs", activityLogRoutes_1.default);
app.use("/api/v1/payments", paymentRoutes_1.default);
// Health check route
app.get("/api/v1/health", (req, res) => {
    res.status(http_status_codes_1.StatusCodes.OK).json({ status: "ok" });
});
// 404 handler
const errorMiddleware_1 = require("./middleware/errorMiddleware");
app.use(errorMiddleware_1.notFound);
// Validation error handler
app.use(errorMiddleware_1.handleValidationErrors);
// Error handler
app.use(errorMiddleware_1.errorHandler);
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger_1.default.info(`Server running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map