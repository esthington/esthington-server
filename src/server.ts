import express, { type Request, type Response } from "express"
import cors from "cors"
import dotenv from "dotenv"
import { StatusCodes } from "http-status-codes"
import connectDB from "./config/db"
import authRoutes from "./routes/authRoutes"
import userRoutes from "./routes/userRoutes"
import walletRoutes from "./routes/walletRoutes"
import bankAccountRoutes from "./routes/bankAccountRoutes"
import propertyRoutes from "./routes/propertyRoutes"
import investmentRoutes from "./routes/investmentRoutes"
import referralRoutes from "./routes/referralRoutes"
import notificationRoutes from "./routes/notificationRoutes"
import reportRoutes from "./routes/reportRoutes"
import approvalRoutes from "./routes/approvalRoutes"
import dashboardRoutes from "./routes/dashboardRoutes"
import adminManagementRoutes from "./routes/adminManagementRoutes"
import userManagementRoutes from "./routes/userManagementRoutes"

// Import the new routes
import transactionRoutes from "./routes/transactionRoutes"
import kycRoutes from "./routes/kycRoutes"
import supportTicketRoutes from "./routes/supportTicketRoutes"
import settingRoutes from "./routes/settingRoutes"
import activityLogRoutes from "./routes/activityLogRoutes"
import paymentRoutes from "./routes/paymentRoutes"

// Load environment variables
dotenv.config()

// Add the Paystack verification after database connection

// Connect to database
connectDB()

// Verify Paystack configuration
// import { verifyPaystackConfig } from "./utils/testPaystack"
import logger from "./utils/logger"
// verifyPaystackConfig().catch((err) => {
//   logger.error(`Error verifying Paystack configuration: ${err.message}`)
// })

// Initialize express app
const app = express()

// Middleware
// ✅ Allowed Origins
const allowedOrigins = [
  "http://localhost:3000"
];

// ✅ CORS Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
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
  })
);

// ✅ Handle Preflight Requests
app.options("*", cors());
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/users", userRoutes)
app.use("/api/v1/wallet", walletRoutes)
app.use("/api/v1/bank-accounts", bankAccountRoutes)
app.use("/api/v1/properties", propertyRoutes)
app.use("/api/v1/investments", investmentRoutes)
app.use("/api/v1/referrals", referralRoutes)
app.use("/api/v1/notifications", notificationRoutes)

// Add existing routes
app.use("/api/v1/reports", reportRoutes)
app.use("/api/v1/approvals", approvalRoutes)
app.use("/api/v1/dashboard", dashboardRoutes)
app.use("/api/v1/admin-management", adminManagementRoutes)
app.use("/api/v1/user-management", userManagementRoutes)

// Add the new routes
app.use("/api/v1/transactions", transactionRoutes)
app.use("/api/v1/kyc", kycRoutes)
app.use("/api/v1/support", supportTicketRoutes)
app.use("/api/v1/settings", settingRoutes)
app.use("/api/v1/activity-logs", activityLogRoutes)
app.use("/api/v1/payments", paymentRoutes)

// Health check route
app.get("/api/v1/health", (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ status: "ok" })
})

// 404 handler
import { handleValidationErrors, errorHandler, notFound } from "./middleware/errorMiddleware"
app.use(notFound)

// Validation error handler
app.use(handleValidationErrors)

// Error handler
app.use(errorHandler)

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})

export default app
