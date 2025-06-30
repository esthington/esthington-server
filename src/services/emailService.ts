import nodemailer from "nodemailer";
import config from "../config/config";
import logger from "../utils/logger";
import { TransactionStatus } from "../models/walletModel";

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
   * @param link Verification link
   */
  async sendVerificationEmail(
    to: string,
    name: string,
    link: string
  ): Promise<void> {
    try {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification - Esthington</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #334155;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
        
        <!-- Icon that overlaps header and body -->
        <tr>
            <td style="position: relative; text-align: center; height: 0;">
                <div style="position: relative; top: -30px; display: inline-block; width: 62px; height: 62px; border-radius: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
                        <tr>
                            <td style="vertical-align: middle; text-align: center;">
                                <img src="https://www.esthingtonlinks.com/logo.png" alt="Esthington Logo" width="40" height="40" style="display: inline-block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
            <td style="padding: 0 30px 30px;">
                <!-- Title -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; text-align: center;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 5px; font-size: 20px; font-weight: 600; color: #1e293b;">Verify Your Email Address</h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">One quick step to secure your account</p>
                        </td>
                    </tr>
                </table>
                
                <!-- Message -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Dear ${name},
                            </p>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Thank you for registering with Esthington. To complete your registration and verify your email address, please click the button below:
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Verification Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="background-color: #342B81; border-radius: 8px;">
                                        <a href="${link}" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none;">
                                            Verify Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Alternative Link -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="text-align: center;">
                            <p style="margin: 0 0 10px; font-size: 14px; color: #64748b;">
                                If the button above doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #342B81; word-break: break-all;">
                                <a href="${link}" style="color: #342B81; text-decoration: none;">${link}</a>
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Security Notice -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 4px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="24" style="vertical-align: top; padding-right: 10px;">
                                        <!-- Warning Icon -->
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #f59e0b; color: white; text-align: center; line-height: 24px; font-weight: bold;">!</div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #92400e;">Security Notice</p>
                                        <p style="margin: 5px 0 0; font-size: 14px; color: #b45309;">
                                            This verification link will expire in 24 hours. If you didn't create an account with Esthington, please ignore this email.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Contact Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b; text-align: center;">
                                If you need assistance, please contact us at <a href="mailto:support@esthington.com" style="color: #342B81; text-decoration: none; font-weight: 500;">support@esthington.com</a> or call at <a href="tel:+18001234567" style="color: #342B81; text-decoration: none; font-weight: 500;">+1 800-123-4567</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      await this.sendEmail(to, "Verify Your Email Address - Esthington", html);
      logger.info(`Verification email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Failed to send verification email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
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
    try {
      const resetUrl = `${config.frontendUrl}/reset-password?resetToken=${token}`;
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Esthington</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #334155;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
        
        <!-- Icon that overlaps header and body -->
        <tr>
            <td style="position: relative; text-align: center; height: 0;">
                <div style="position: relative; top: -30px; display: inline-block; width: 62px; height: 62px; border-radius: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
                        <tr>
                            <td style="vertical-align: middle; text-align: center;">
                                <img src="https://www.esthingtonlinks.com/logo.png" alt="Esthington Logo" width="40" height="40" style="display: inline-block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
            <td style="padding: 0 30px 30px;">
                <!-- Title -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; text-align: center;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 5px; font-size: 20px; font-weight: 600; color: #1e293b;">Reset Your Password</h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Secure your account with a new password</p>
                        </td>
                    </tr>
                </table>
                
                <!-- Message -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Dear ${name},
                            </p>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                We received a request to reset your password for your Esthington account. To create a new password, please click the button below:
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Reset Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="background-color: #342B81; border-radius: 8px;">
                                        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none;">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Alternative Link -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="text-align: center;">
                            <p style="margin: 0 0 10px; font-size: 14px; color: #64748b;">
                                If the button above doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #342B81; word-break: break-all;">
                                <a href="${resetUrl}" style="color: #342B81; text-decoration: none;">${resetUrl}</a>
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Security Notice -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 4px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="24" style="vertical-align: top; padding-right: 10px;">
                                        <!-- Warning Icon -->
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #f59e0b; color: white; text-align: center; line-height: 24px; font-weight: bold;">!</div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #92400e;">Security Notice</p>
                                        <p style="margin: 5px 0 0; font-size: 14px; color: #b45309;">
                                            This password reset link will expire in 30 minutes. If you didn't request a password reset, please ignore this email or contact our support team immediately.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Security Tips -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="padding-bottom: 15px;">
                            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">Password Security Tips</h4>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.6; color: #64748b;">
                                <li style="margin-bottom: 8px;">Use a unique password that you don't use for other websites</li>
                                <li style="margin-bottom: 8px;">Include a mix of letters, numbers, and special characters</li>
                                <li style="margin-bottom: 8px;">Avoid using personal information in your password</li>
                                <li>Consider using a password manager for added security</li>
                            </ul>
                        </td>
                    </tr>
                </table>
                
                <!-- Contact Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b; text-align: center;">
                                If you need assistance, please contact us at <a href="mailto:support@esthington.com" style="color: #342B81; text-decoration: none; font-weight: 500;">support@esthington.com</a> or call at <a href="tel:+18001234567" style="color: #342B81; text-decoration: none; font-weight: 500;">+1 800-123-4567</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      await this.sendEmail(to, "Reset Your Password - Esthington", html);
      logger.info(`Password reset email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Failed to send password reset email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * Send welcome email
   * @param to Recipient email
   * @param name Recipient name
   */
  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    try {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Esthington</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #334155;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
        
        <!-- Icon that overlaps header and body -->
        <tr>
            <td style="position: relative; text-align: center; height: 0;">
                <div style="position: relative; top: -30px; display: inline-block; width: 62px; height: 62px; border-radius: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
                        <tr>
                            <td style="vertical-align: middle; text-align: center;">
                                <img src="https://www.esthingtonlinks.com/logo.png" alt="Esthington Logo" width="40" height="40" style="display: inline-block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
            <td style="padding: 0 30px 30px;">
                <!-- Title -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; text-align: center;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 5px; font-size: 20px; font-weight: 600; color: #1e293b;">Welcome to Esthington!</h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Your journey to premium real estate begins here</p>
                        </td>
                    </tr>
                </table>
                
                <!-- Welcome Message -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Dear ${name},
                            </p>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Thank you for joining Esthington! We're thrilled to welcome you to our community of property investors and homeowners.
                            </p>
                            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #334155;">
                                Your account has been successfully created, and you now have access to our full range of services and exclusive property listings.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Get Started Section -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="padding: 20px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-bottom: 15px;">
                                        <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">Get Started in 3 Simple Steps</h4>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 15px;">
                                            <tr>
                                                <td width="36" style="vertical-align: top;">
                                                    <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #342B81; color: white; text-align: center; line-height: 28px; font-weight: bold; font-size: 14px;">1</div>
                                                </td>
                                                <td style="vertical-align: middle;">
                                                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">Complete your profile</p>
                                                    <p style="margin: 5px 0 0; font-size: 14px; color: #64748b;">Add your preferences and investment goals</p>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 15px;">
                                            <tr>
                                                <td width="36" style="vertical-align: top;">
                                                    <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #342B81; color: white; text-align: center; line-height: 28px; font-weight: bold; font-size: 14px;">2</div>
                                                </td>
                                                <td style="vertical-align: middle;">
                                                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">Fund your wallet</p>
                                                    <p style="margin: 5px 0 0; font-size: 14px; color: #64748b;">Add funds to start investing in properties</p>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td width="36" style="vertical-align: top;">
                                                    <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #342B81; color: white; text-align: center; line-height: 28px; font-weight: bold; font-size: 14px;">3</div>
                                                </td>
                                                <td style="vertical-align: middle;">
                                                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">Explore properties</p>
                                                    <p style="margin: 5px 0 0; font-size: 14px; color: #64748b;">Browse our exclusive listings and make your first investment</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Explore Dashboard Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="background-color: #342B81; border-radius: 8px;">
                                        <a href="https://esthington.com/dashboard" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none;">
                                            Explore Your Dashboard
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Features Section -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="padding-bottom: 15px;">
                            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">What You Can Do with Esthington</h4>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="50%" style="padding-right: 10px; padding-bottom: 15px; vertical-align: top;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="vertical-align: top; padding-bottom: 5px;">
                                                    <img src="https://www.esthingtonlinks.com/icons/property.png" alt="Property Icon" width="24" height="24" style="display: inline-block;">
                                                </td>  height="24" style="display: inline-block;">
                                                </td>
                                                <td style="vertical-align: top; padding-left: 10px;">
                                                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">Invest in Properties</p>
                                                    <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">Access premium real estate opportunities</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td width="50%" style="padding-left: 10px; padding-bottom: 15px; vertical-align: top;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="vertical-align: top; padding-bottom: 5px;">
                                                    <img src="https://www.esthingtonlinks.com/icons/wallet.png" alt="Wallet Icon" width="24" height="24" style="display: inline-block;">
                                                </td>
                                                <td style="vertical-align: top; padding-left: 10px;">
                                                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">Manage Your Wallet</p>
                                                    <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">Track investments and returns</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td width="50%" style="padding-right: 10px; vertical-align: top;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="vertical-align: top; padding-bottom: 5px;">
                                                    <img src="https://www.esthingtonlinks.com/icons/community.png" alt="Community Icon" width="24" height="24" style="display: inline-block;">
                                                </td>
                                                <td style="vertical-align: top; padding-left: 10px;">
                                                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">Join Community</p>
                                                    <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">Connect with like-minded investors</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td width="50%" style="padding-left: 10px; vertical-align: top;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="vertical-align: top; padding-bottom: 5px;">
                                                    <img src="https://www.esthingtonlinks.com/icons/support.png" alt="Support Icon" width="24" height="24" style="display: inline-block;">
                                                </td>
                                                <td style="vertical-align: top; padding-left: 10px;">
                                                    <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">24/7 Support</p>
                                                    <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">Get help whenever you need it</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Social Media Links -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px; text-align: center;">
                    <tr>
                        <td style="padding-bottom: 15px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">Connect with us</p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                <tr>
                                    <td style="padding: 0 10px;">
                                        <a href="https://facebook.com/esthington" style="text-decoration: none;">
                                            <img src="https://www.esthingtonlinks.com/icons/facebook.png" alt="Facebook" width="32" height="32" style="display: inline-block;">
                                        </a>
                                    </td>
                                    <td style="padding: 0 10px;">
                                        <a href="https://twitter.com/esthington" style="text-decoration: none;">
                                            <img src="https://www.esthingtonlinks.com/icons/twitter.png" alt="Twitter" width="32" height="32" style="display: inline-block;">
                                        </a>
                                    </td>
                                    <td style="padding: 0 10px;">
                                        <a href="https://instagram.com/esthington" style="text-decoration: none;">
                                            <img src="https://www.esthingtonlinks.com/icons/instagram.png" alt="Instagram" width="32" height="32" style="display: inline-block;">
                                        </a>
                                    </td>
                                    <td style="padding: 0 10px;">
                                        <a href="https://linkedin.com/company/esthington" style="text-decoration: none;">
                                            <img src="https://www.esthingtonlinks.com/icons/linkedin.png" alt="LinkedIn" width="32" height="32" style="display: inline-block;">
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Contact Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b; text-align: center;">
                                If you need assistance, please contact us at <a href="mailto:support@esthington.com" style="color: #342B81; text-decoration: none; font-weight: 500;">support@esthington.com</a> or call at <a href="tel:+18001234567" style="color: #342B81; text-decoration: none; font-weight: 500;">+1 800-123-4567</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      await this.sendEmail(to, "Welcome to Esthington", html);
      logger.info(`Welcome email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Failed to send welcome email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * Send OTP verification email
   * @param to Recipient email
   * @param name Recipient name
   * @param otp One-time password code
   * @param expiryMinutes Minutes until OTP expires
   */
  async sendOTPVerificationEmail(
    to: string,
    name: string,
    otp: string,
    expiryMinutes = 10
  ): Promise<void> {
    try {
      // Format the OTP with spaces for better readability
      const formattedOTP = otp.split("").join(" ");

      // Create the HTML email content
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Verification Code - Esthington</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #334155;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
        
        <!-- Icon that overlaps header and body -->
        <tr>
            <td style="position: relative; text-align: center; height: 0;">
                <div style="position: relative; top: -30px; display: inline-block; width: 62px; height: 62px; border-radius: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
                        <tr>
                            <td style="vertical-align: middle; text-align: center;">
                                <img src="https://www.esthingtonlinks.com/logo.png" alt="Esthington Logo" width="40" height="40" style="display: inline-block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
            <td style="padding: 0 30px 30px;">
                <!-- Title -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; text-align: center;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 5px; font-size: 20px; font-weight: 600; color: #1e293b;">Security Verification Code</h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Valid for ${expiryMinutes} minutes</p>
                        </td>
                    </tr>
                </table>
                
                <!-- Message -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Dear ${name},
                            </p>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                You've requested a security verification code. Please use the code below to complete your verification:
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- OTP Code -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td align="center">
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; display: inline-block; min-width: 240px;">
                                <p style="margin: 0 0 5px; font-size: 14px; color: #64748b; text-align: center;">Your verification code</p>
                                <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #342B81; text-align: center;">${formattedOTP}</p>
                            </div>
                        </td>
                    </tr>
                </table>
                
                <!-- Security Notice -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 4px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="24" style="vertical-align: top; padding-right: 10px;">
                                        <!-- Warning Icon -->
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #f59e0b; color: white; text-align: center; line-height: 24px; font-weight: bold;">!</div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #92400e;">Security Notice</p>
                                        <p style="margin: 5px 0 0; font-size: 14px; color: #b45309;">
                                            This code will expire in ${expiryMinutes} minutes. If you didn't request this code, please secure your account immediately.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Additional Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 14px; line-height: 1.6; color: #64748b;">
                                For your security, please:
                            </p>
                            <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.6; color: #64748b;">
                                <li style="margin-bottom: 8px;">Never share this code with anyone</li>
                                <li style="margin-bottom: 8px;">Verify that the website URL is correct before entering the code</li>
                                <li>Our team will never ask for this code via phone or email</li>
                            </ul>
                        </td>
                    </tr>
                </table>
                
                <!-- Contact Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                                If you need assistance, please contact us at <a href="mailto:support@esthington.com" style="color: #342B81; text-decoration: none; font-weight: 500;">support@esthington.com</a> or call at <a href="tel:+18001234567" style="color: #342B81; text-decoration: none; font-weight: 500;">+1 800-123-4567</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      // Send the email
      await this.sendEmail(to, "Security Verification Code - Esthington", html);
      logger.info(`OTP verification email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Failed to send OTP verification email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
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

  /**
   * Send wallet funding email (original method)
   * @param to Recipient email
   * @param name Recipient name
   * @param amount Transaction amount
   * @param reference Transaction reference
   * @param transactionDate Transaction date
   * @param cardLastFour Last four digits of the card used (optional)
   * @param transactionId Transaction ID (optional)
   */
  async sendWalletFundingEmail(
    to: string,
    name: string,
    amount: number,
    reference: string,
    transactionDate: Date,
    cardLastFour?: string,
    transactionId?: string
  ): Promise<void> {
    // This method now calls the new sendWalletFundingSuccessEmail method
    // for backward compatibility
    return this.sendWalletFundingSuccessEmail(
      to,
      name,
      amount,
      reference,
      transactionDate,
      cardLastFour,
      transactionId
    );
  }

  /**
   * Send transaction status email based on status
   * @param to Recipient email
   * @param name Recipient name
   * @param amount Transaction amount
   * @param reference Transaction reference
   * @param status Transaction status
   * @param transactionDate Transaction date
   * @param cardLastFour Last four digits of the card used (optional)
   * @param transactionId Transaction ID (optional)
   * @param reason Reason for declined/failed transaction (optional)
   */
  async sendTransactionStatusEmail(
    to: string,
    name: string,
    amount: number,
    reference: string,
    status: TransactionStatus,
    transactionDate: Date,
    cardLastFour?: string,
    transactionId?: string,
    reason?: string
  ): Promise<void> {
    switch (status) {
      case TransactionStatus.COMPLETED:
        return this.sendWalletFundingSuccessEmail(
          to,
          name,
          amount,
          reference,
          transactionDate,
          cardLastFour,
          transactionId
        );
      case TransactionStatus.DECLINED:
        return this.sendWalletFundingDeclinedEmail(
          to,
          name,
          amount,
          reference,
          transactionDate,
          cardLastFour,
          reason
        );
      case TransactionStatus.PENDING:
        return this.sendWalletFundingPendingEmail(
          to,
          name,
          amount,
          reference,
          transactionDate,
          cardLastFour
        );
      case TransactionStatus.FAILED:
        return this.sendWalletFundingFailedEmail(
          to,
          name,
          amount,
          reference,
          transactionDate,
          cardLastFour,
          reason
        );
      default:
        logger.warn(`Unhandled transaction status for email: ${status}`);
        return this.sendWalletFundingSuccessEmail(
          to,
          name,
          amount,
          reference,
          transactionDate,
          cardLastFour,
          transactionId
        );
    }
  }

  /**
   * Send wallet funding success email
   * @param to Recipient email
   * @param name Recipient name
   * @param amount Transaction amount
   * @param reference Transaction reference
   * @param transactionDate Transaction date
   * @param cardLastFour Last four digits of the card used (optional)
   * @param transactionId Transaction ID (optional)
   */
  async sendWalletFundingSuccessEmail(
    to: string,
    name: string,
    amount: number,
    reference: string,
    transactionDate: Date,
    cardLastFour?: string,
    transactionId?: string
  ): Promise<void> {
    try {
      // Format the date
      const formattedDate = new Date(transactionDate).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );

      // Calculate base amount and tax fee
      const taxRate = 0.05; // 5% tax
      const baseAmount = amount / (1 + taxRate);
      const taxFee = amount - baseAmount;

      // Generate a unique invoice number
      const invoiceNumber = `INV-${Date.now()
        .toString()
        .slice(-8)}-${reference.slice(-4)}`;

      // Create the HTML email content
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice from Esthington</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #334155;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
        
        <!-- Icon that overlaps header and body -->
        <tr>
            <td style="position: relative; text-align: center; height: 0;">
                <div style="position: relative; top: -30px; display: inline-block; width: 62px; height: 62px; border-radius: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
                        <tr>
                            <td style="vertical-align: middle; text-align: center;">
                                <img src="https://www.esthingtonlinks.com/logo.png" alt="Esthington Logo" width="40" height="40" style="display: inline-block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
            <td style="padding: 0 30px 30px;">
                <!-- Title and Invoice Number -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; text-align: center;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 5px; font-size: 20px; font-weight: 600; color: #1e293b;">Invoice from Esthington</h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Invoice #${invoiceNumber}</p>
                        </td>
                    </tr>
                </table>
                
                <!-- Welcome Message -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Dear ${name},
                            </p>
                            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #334155;">
                                Thank you for your recent wallet funding transaction. Your funds have been successfully processed and added to your Esthington account.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Transaction Status -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 15px; border-radius: 4px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="24" style="vertical-align: top; padding-right: 10px;">
                                        <!-- Check Icon -->
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #10b981; color: white; text-align: center; line-height: 24px; font-weight: bold;">✓</div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #065f46;">Transaction Successful</p>
                                        <p style="margin: 5px 0 0; font-size: 14px; color: #047857;">Your funds have been successfully added to your wallet.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Payment Details Grid -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <!-- Amount Paid -->
                        <td width="33%" style="vertical-align: top;">
                            <p style="margin: 0 0 5px; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 500;">Amount paid:</p>
                            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">₦${amount.toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}</p>
                        </td>
                        
                        <!-- Date Paid -->
                        <td width="33%" style="vertical-align: top;">
                            <p style="margin: 0 0 5px; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 500;">Date paid:</p>
                            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${formattedDate}</p>
                        </td>
                        
                        <!-- Payment Method -->
                        <td width="33%" style="vertical-align: top;">
                            <p style="margin: 0 0 5px; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 500;">Payment method:</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="vertical-align: middle;">
                                        <!-- Mastercard SVG -->
                                        <span style="font-size: 16px; font-weight: 600; color: #1e293b;">•••• ${"Card: "}</span>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <span style="font-size: 16px; font-weight: 600; color: #1e293b;">•••• ${
                                          cardLastFour || "****"
                                        }</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Summary Section -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="padding-bottom: 10px;">
                            <h4 style="margin: 0; font-size: 12px; text-transform: uppercase; font-weight: 600; color: #1e293b;">Summary</h4>
                        </td>
                    </tr>
                    
                    <!-- Payment to Front -->
                    <tr>
                        <td style="border: 1px solid #e2e8f0; border-bottom: none; border-radius: 8px 8px 0 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 12px 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #1e293b;">Payment to Esthington</td>
                                                <td style="font-size: 14px; color: #1e293b; text-align: right;">₦${baseAmount.toLocaleString(
                                                  "en-US",
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  }
                                                )}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Tax Fee -->
                    <tr>
                        <td style="border: 1px solid #e2e8f0; border-top: none; border-bottom: none;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 12px 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #1e293b;">Tax fee</td>
                                                <td style="font-size: 14px; color: #1e293b; text-align: right;">₦${taxFee.toLocaleString(
                                                  "en-US",
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  }
                                                )}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Amount Paid -->
                    <tr>
                        <td style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background-color: #f8fafc;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 12px 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; font-weight: 600; color: #1e293b;">Amount paid</td>
                                                <td style="font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">₦${amount.toLocaleString(
                                                  "en-US",
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  }
                                                )}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Transaction Details -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Transaction Details</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Transaction ID:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${
                                                  transactionId || "N/A"
                                                }</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Reference Number:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${reference}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Contact Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                                If you have any questions, please contact us at <a href="mailto:support@esthington.com" style="color: #342B81; text-decoration: none; font-weight: 500;">support@esthington.com</a> or call at <a href="tel:+18001234567" style="color: #342B81; text-decoration: none; font-weight: 500;">+1 800-123-4567</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      // Send the email
      await this.sendEmail(to, "Wallet Funding Successful", html);
      logger.info(`Wallet funding success email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Failed to send wallet funding success email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * Send wallet funding declined email
   * @param to Recipient email
   * @param name Recipient name
   * @param amount Transaction amount
   * @param reference Transaction reference
   * @param transactionDate Transaction date
   * @param cardLastFour Last four digits of the card used (optional)
   * @param reason Reason for declined transaction (optional)
   */
  async sendWalletFundingDeclinedEmail(
    to: string,
    name: string,
    amount: number,
    reference: string,
    transactionDate: Date,
    cardLastFour?: string,
    reason?: string
  ): Promise<void> {
    try {
      // Format the date
      const formattedDate = new Date(transactionDate).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );

      // Create the HTML email content
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transaction Declined - Esthington</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #334155;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
       
        
        <!-- Icon that overlaps header and body -->
        <tr>
            <td style="position: relative; text-align: center; height: 0;">
                <div style="position: relative; top: -30px; display: inline-block; width: 62px; height: 62px; border-radius: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
                        <tr>
                            <td style="vertical-align: middle; text-align: center;">
                                <img src="https://www.esthingtonlinks.com/logo.png" alt="Esthington Logo" width="40" height="40" style="display: inline-block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
            <td style="padding: 0 30px 30px;">
                <!-- Title -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; text-align: center;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 5px; font-size: 20px; font-weight: 600; color: #1e293b;">Transaction Declined</h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Reference: ${reference}</p>
                        </td>
                    </tr>
                </table>
                
                <!-- Message -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Dear ${name},
                            </p>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                We regret to inform you that your recent wallet funding transaction has been declined.
                            </p>
                            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #334155;">
                                Please review the transaction details below and try again with a different payment method or contact your bank for more information.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Transaction Status -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 12px 15px; border-radius: 4px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="24" style="vertical-align: top; padding-right: 10px;">
                                        <!-- X Icon -->
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #e11d48; color: white; text-align: center; line-height: 24px; font-weight: bold;">✕</div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #9f1239;">Transaction Declined</p>
                                        <p style="margin: 5px 0 0; font-size: 14px; color: #be123c;">
                                            ${
                                              reason ||
                                              "Your payment could not be processed at this time."
                                            }
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Transaction Details -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Transaction Details</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Amount:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">₦${amount.toLocaleString(
                                                  "en-US",
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  }
                                                )}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Date:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${formattedDate}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Payment Method:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">Card •••• ${
                                                  cardLastFour || "****"
                                                }</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Reference Number:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${reference}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- What to do next -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td style="padding-bottom: 15px;">
                            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">What to do next</h4>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.6; color: #64748b;">
                                <li style="margin-bottom: 10px;">Check that your card has sufficient funds</li>
                                <li style="margin-bottom: 10px;">Verify your card details and try again</li>
                                <li style="margin-bottom: 10px;">Contact your bank to ensure they're not blocking the transaction</li>
                                <li>Try using a different payment method</li>
                            </ul>
                        </td>
                    </tr>
                </table>
                
                <!-- Try Again Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="background-color: #342B81; border-radius: 8px;">
                                        <a href="https://esthington.com/dashboard/fund-wallet" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none;">
                                            Try Again
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Contact Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                                If you need assistance, please contact us at <a href="mailto:support@esthington.com" style="color: #342B81; text-decoration: none; font-weight: 500;">support@esthington.com</a> or call at <a href="tel:+18001234567" style="color: #342B81; text-decoration: none; font-weight: 500;">+1 800-123-4567</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      // Send the email
      await this.sendEmail(to, "Transaction Declined - Esthington", html);
      logger.info(`Wallet funding declined email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Failed to send wallet funding declined email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * Send wallet funding pending email
   * @param to Recipient email
   * @param name Recipient name
   * @param amount Transaction amount
   * @param reference Transaction reference
   * @param transactionDate Transaction date
   * @param cardLastFour Last four digits of the card used (optional)
   */
  async sendWalletFundingPendingEmail(
    to: string,
    name: string,
    amount: number,
    reference: string,
    transactionDate: Date,
    cardLastFour?: string
  ): Promise<void> {
    try {
      // Format the date
      const formattedDate = new Date(transactionDate).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );

      // Create the HTML email content
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transaction Pending - Esthington</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #334155;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
      
        
        <!-- Icon that overlaps header and body -->
        <tr>
            <td style="position: relative; text-align: center; height: 0;">
                <div style="position: relative; top: -30px; display: inline-block; width: 62px; height: 62px; border-radius: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
                        <tr>
                            <td style="vertical-align: middle; text-align: center;">
                                <img src="https://www.esthingtonlinks.com/logo.png" alt="Esthington Logo" width="40" height="40" style="display: inline-block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
            <td style="padding: 0 30px 30px;">
                <!-- Title -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; text-align: center;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 5px; font-size: 20px; font-weight: 600; color: #1e293b;">Transaction Pending</h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Reference: ${reference}</p>
                        </td>
                    </tr>
                </table>
                
                <!-- Message -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Dear ${name},
                            </p>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                We're processing your wallet funding transaction. This usually takes just a few moments, but sometimes it can take longer depending on your payment provider.
                            </p>
                            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #334155;">
                                We'll notify you once the transaction is complete. No further action is required from you at this time.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Transaction Status -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 15px; border-radius: 4px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="24" style="vertical-align: top; padding-right: 10px;">
                                        <!-- Clock Icon -->
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #2563eb; color: white; text-align: center; line-height: 24px; font-weight: bold;">⌛</div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e40af;">Transaction Pending</p>
                                        <p style="margin: 5px 0 0; font-size: 14px; color: #3b82f6;">
                                            Your payment is being processed. Please allow a few moments.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Transaction Details -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Transaction Details</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Amount:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">₦${amount.toLocaleString(
                                                  "en-US",
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  }
                                                )}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Date:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${formattedDate}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Payment Method:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">Card •••• ${
                                                  cardLastFour || "****"
                                                }</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Reference Number:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${reference}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Check Status Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="background-color: #342B81; border-radius: 8px;">
                                        <a href="https://esthington.com/dashboard/my-transactions" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none;">
                                            Check Transaction Status
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Contact Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                                If you need assistance, please contact us at <a href="mailto:support@esthington.com" style="color: #342B81; text-decoration: none; font-weight: 500;">support@esthington.com</a> or call at <a href="tel:+18001234567" style="color: #342B81; text-decoration: none; font-weight: 500;">+1 800-123-4567</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      // Send the email
      await this.sendEmail(to, "Transaction Pending - Esthington", html);
      logger.info(`Wallet funding pending email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Failed to send wallet funding pending email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * Send wallet funding failed email
   * @param to Recipient email
   * @param name Recipient name
   * @param amount Transaction amount
   * @param reference Transaction reference
   * @param transactionDate Transaction date
   * @param cardLastFour Last four digits of the card used (optional)
   * @param reason Reason for failed transaction (optional)
   */
  async sendWalletFundingFailedEmail(
    to: string,
    name: string,
    amount: number,
    reference: string,
    transactionDate: Date,
    cardLastFour?: string,
    reason?: string
  ): Promise<void> {
    try {
      // Format the date
      const formattedDate = new Date(transactionDate).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );

      // Create the HTML email content
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transaction Failed - Esthington</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; color: #334155;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
     
        
        <!-- Icon that overlaps header and body -->
        <tr>
            <td style="position: relative; text-align: center; height: 0;">
                <div style="position: relative; top: -30px; display: inline-block; width: 62px; height: 62px; border-radius: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
                        <tr>
                            <td style="vertical-align: middle; text-align: center;">
                                <img src="https://www.esthingtonlinks.com/logo.png" alt="Esthington Logo" width="40" height="40" style="display: inline-block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
            <td style="padding: 0 30px 30px;">
                <!-- Title -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px; text-align: center;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 5px; font-size: 20px; font-weight: 600; color: #1e293b;">Transaction Failed</h3>
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Reference: ${reference}</p>
                        </td>
                    </tr>
                </table>
                
                <!-- Message -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                Dear ${name},
                            </p>
                            <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.6; color: #334155;">
                                We're sorry, but your recent wallet funding transaction has failed to complete.
                            </p>
                            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #334155;">
                                No funds have been deducted from your account. Please review the details below and try again.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Transaction Status -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                    <tr>
                        <td style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 15px; border-radius: 4px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="24" style="vertical-align: top; padding-right: 10px;">
                                        <!-- Exclamation Icon -->
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #dc2626; color: white; text-align: center; line-height: 24px; font-weight: bold;">!</div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #991b1b;">Transaction Failed</p>
                                        <p style="margin: 5px 0 0; font-size: 14px; color: #ef4444;">
                                            ${
                                              reason ||
                                              "We encountered a technical issue while processing your payment."
                                            }
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Transaction Details -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Transaction Details</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Amount:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">₦${amount.toLocaleString(
                                                  "en-US",
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  }
                                                )}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Date:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${formattedDate}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Payment Method:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">Card •••• ${
                                                  cardLastFour || "****"
                                                }</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="font-size: 14px; color: #64748b; width: 40%;">Reference Number:</td>
                                                <td style="font-size: 14px; color: #1e293b; font-weight: 500;">${reference}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Try Again Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="background-color: #342B81; border-radius: 8px;">
                                        <a href="https://esthington.com/dashboard/fund-wallet" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none;">
                                            Try Again
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <!-- Contact Information -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                                If you need assistance, please contact us at <a href="mailto:support@esthington.com" style="color: #342B81; text-decoration: none; font-weight: 500;">support@esthington.com</a> or call at <a href="tel:+18001234567" style="color: #342B81; text-decoration: none; font-weight: 500;">+1 800-123-4567</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `;

      // Send the email
      await this.sendEmail(to, "Transaction Failed - Esthington", html);
      logger.info(`Wallet funding failed email sent to ${to}`);
    } catch (error) {
      logger.error(
        `Failed to send wallet funding failed email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }
}

// Create a singleton instance
const emailService = new EmailService();

// Export the instance for use in other modules
export default emailService;
