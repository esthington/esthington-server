import nodemailer from "nodemailer";
import config from "../config/config";
import logger from "../utils/logger";

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Use a test account if SMTP config is not provided
    if (!config.smtpConfig.host || !config.smtpConfig.auth.user) {
      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: "ethereal.user@ethereal.email",
          pass: "ethereal_pass",
        },
      });
      logger.warn(
        "Using test email account. Emails will not be delivered to real recipients."
      );
    } else {
      this.transporter = nodemailer.createTransport({
        host: config.smtpConfig.host,
        port: config.smtpConfig.port,
        secure: config.smtpConfig.port === 465,
        auth: {
          user: config.smtpConfig.auth.user,
          pass: config.smtpConfig.auth.pass,
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
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    from = config.emailFrom
  ): Promise<void> {
    try {
      const mailOptions = {
        from: `Esthington <${from}>`,
        to,
        subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Email sending error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * Send verification email
   * @param to Recipient email
   * @param name Recipient name
   * @param token Verification token
   */
  async sendVerificationEmail(
    to: string,
    name: string,
    link: string
  ): Promise<void> {
    
    const html = `
      <h1>Email Verification</h1>
      <p>Hello ${name},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${link}">Verify Email</a></p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thank you,</p>
      <p>The Team</p>
    `;
    await this.sendEmail(to, "Email Verification", html);
  }

  /**
   * Send password reset email
   * @param to Recipient email
   * @param name Recipient name
   * @param token Reset token
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string
  ): Promise<void> {
    const resetUrl = `${config.frontendUrl}/reset-password?resetToken=${token}`;
    const html = `
      <h1>Password Reset</h1>
      <p>Hello ${name},</p>
      <p>You requested a password reset. Please click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thank you,</p>
      <p>The Team</p>
    `;

    await this.sendEmail(to, "Password Reset", html);
  }

  /**
   * Send welcome email
   * @param to Recipient email
   * @param name Recipient name
   */
  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const html = `
      <h1>Welcome to Our Platform!</h1>
      <p>Hello ${name},</p>
      <p>Thank you for joining our platform. We're excited to have you on board!</p>
      <p>If you have any questions, feel free to contact our support team.</p>
      <p>Best regards,</p>
      <p>The Team</p>
    `;

    await this.sendEmail(to, "Welcome to Our Platform", html);
  }

  /**
   * Send transaction confirmation email
   * @param to Recipient email
   * @param name Recipient name
   * @param transactionType Type of transaction
   * @param amount Transaction amount
   * @param reference Transaction reference
   */
  async sendTransactionEmail(
    to: string,
    name: string,
    transactionType: string,
    amount: number,
    reference: string
  ): Promise<void> {
    const html = `
      <h1>Transaction Confirmation</h1>
      <p>Hello ${name},</p>
      <p>Your ${transactionType} transaction of ₦${amount.toLocaleString()} has been processed.</p>
      <p>Transaction Reference: ${reference}</p>
      <p>If you did not authorize this transaction, please contact our support team immediately.</p>
      <p>Thank you,</p>
      <p>The Team</p>
    `;

    await this.sendEmail(to, "Transaction Confirmation", html);
  }
}

// Create a singleton instance
const emailService = new EmailService();

// Export the instance for use in other modules
export default emailService;
