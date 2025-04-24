"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../../.env") });
const config = {
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/financial-dashboard",
    jwtSecret: process.env.JWT_SECRET || "your-secret-key",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key",
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || "",
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
    paystack: {
        secretKey: process.env.PAYSTACK_SECRET_KEY || "",
        publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
        testMode: ((_a = process.env.PAYSTACK_SECRET_KEY) === null || _a === void 0 ? void 0 : _a.startsWith("sk_test_")) || false,
        webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || "",
        baseUrl: "https://api.paystack.co",
    },
    frontendUrl: process.env.NODE_ENV === "production"
        ? process.env.CLIENT_LIVE_URL
        : process.env.CLIENT_LOCAL_URL,
    emailFrom: process.env.EMAIL_FROM || "noreply@example.com",
    smtpConfig: {
        host: process.env.SMTP_HOST || "",
        port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
        auth: {
            user: process.env.SMTP_USER || "",
            pass: process.env.SMTP_PASS || "",
        },
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
        apiKey: process.env.CLOUDINARY_API_KEY || "",
        apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    },
};
exports.default = config;
//# sourceMappingURL=config.js.map