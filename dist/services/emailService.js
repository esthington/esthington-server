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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
class EmailService {
    constructor() {
        // Use a test account if SMTP config is not provided
        if (!config_1.default.smtpConfig.host || !config_1.default.smtpConfig.auth.user) {
            this.transporter = nodemailer_1.default.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: "ethereal.user@ethereal.email",
                    pass: "ethereal_pass",
                },
            });
            logger_1.default.warn("Using test email account. Emails will not be delivered to real recipients.");
        }
        else {
            this.transporter = nodemailer_1.default.createTransport({
                host: config_1.default.smtpConfig.host,
                port: config_1.default.smtpConfig.port,
                secure: config_1.default.smtpConfig.port === 465,
                auth: {
                    user: config_1.default.smtpConfig.auth.user,
                    pass: config_1.default.smtpConfig.auth.pass,
                },
            });
        }
    }
    /**
     * Send email
     * @param to Recipient email
     * @param subject Email subject
     * @param html Email content (HTML)
     * @param from Sender email (optional)
     */
    sendEmail(to_1, subject_1, html_1) {
        return __awaiter(this, arguments, void 0, function* (to, subject, html, from = config_1.default.emailFrom) {
            try {
                const mailOptions = {
                    from: `Esthington <${from}>`,
                    to,
                    subject,
                    html,
                };
                yield this.transporter.sendMail(mailOptions);
                logger_1.default.info(`Email sent to ${to}`);
            }
            catch (error) {
                logger_1.default.error(`Email sending error: ${error instanceof Error ? error.message : "Unknown error"}`);
                throw error;
            }
        });
    }
    /**
     * Send verification email
     * @param to Recipient email
     * @param name Recipient name
     * @param token Verification token
     */
    sendVerificationEmail(to, name, link) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = `
      <h1>Email Verification</h1>
      <p>Hello ${name},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${link}">Verify Email</a></p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thank you,</p>
      <p>The Team</p>
    `;
            yield this.sendEmail(to, "Email Verification", html);
        });
    }
    /**
     * Send password reset email
     * @param to Recipient email
     * @param name Recipient name
     * @param token Reset token
     */
    sendPasswordResetEmail(to, name, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const resetUrl = `${config_1.default.frontendUrl}/reset-password?resetToken=${token}`;
            const html = `
      <h1>Password Reset</h1>
      <p>Hello ${name},</p>
      <p>You requested a password reset. Please click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thank you,</p>
      <p>The Team</p>
    `;
            yield this.sendEmail(to, "Password Reset", html);
        });
    }
    /**
     * Send welcome email
     * @param to Recipient email
     * @param name Recipient name
     */
    sendWelcomeEmail(to, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = `
      <h1>Welcome to Our Platform!</h1>
      <p>Hello ${name},</p>
      <p>Thank you for joining our platform. We're excited to have you on board!</p>
      <p>If you have any questions, feel free to contact our support team.</p>
      <p>Best regards,</p>
      <p>The Team</p>
    `;
            yield this.sendEmail(to, "Welcome to Our Platform", html);
        });
    }
    /**
     * Send transaction confirmation email
     * @param to Recipient email
     * @param name Recipient name
     * @param transactionType Type of transaction
     * @param amount Transaction amount
     * @param reference Transaction reference
     */
    sendTransactionEmail(to, name, transactionType, amount, reference) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = `
      <h1>Transaction Confirmation</h1>
      <p>Hello ${name},</p>
      <p>Your ${transactionType} transaction of ₦${amount.toLocaleString()} has been processed.</p>
      <p>Transaction Reference: ${reference}</p>
      <p>If you did not authorize this transaction, please contact our support team immediately.</p>
      <p>Thank you,</p>
      <p>The Team</p>
    `;
            yield this.sendEmail(to, "Transaction Confirmation", html);
        });
    }
}
// Create a singleton instance
const emailService = new EmailService();
// Export the instance for use in other modules
exports.default = emailService;
//# sourceMappingURL=emailService.js.map