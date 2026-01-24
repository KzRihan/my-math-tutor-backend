/**
 * Email Service
 * 
 * Sends emails directly using nodemailer with Gmail SMTP.
 * Provides a clean interface for sending various email types.
 */

import { injectable } from 'tsyringe';
import nodemailer from 'nodemailer';
import { config } from '@config/index';
import { createChildLogger } from '@utils/logger';

const emailLogger = createChildLogger('email-service');

/** Nodemailer transporter instance */
let transporter: nodemailer.Transporter | null = null;

/**
 * Get or create the email transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    // Validate email configuration
    if (!config.email.user || !config.email.pass) {
      emailLogger.warn('Email configuration incomplete. SMTP_EMAIL/SMTP_USER and SMTP_PASSWORD/SMTP_PASS must be set.');
      throw new Error('Email configuration is missing. Please set SMTP_EMAIL (or SMTP_USER) and SMTP_PASSWORD (or SMTP_PASS) environment variables.');
    }

    // Gmail SMTP configuration
    transporter = nodemailer.createTransport({
      host: config.email.host || 'smtp.gmail.com',
      port: config.email.port || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });

    emailLogger.info('Email transporter created', {
      host: config.email.host || 'smtp.gmail.com',
      port: config.email.port || 587,
      user: config.email.user,
    });
  }
  return transporter;
}

/**
 * Email service interface
 */
export interface IEmailService {
  sendWelcome(to: string, name: string): Promise<string>;
  sendPasswordReset(to: string, resetLink: string): Promise<string>;
  sendVerification(to: string, verifyLink: string): Promise<string>;
  sendNotification(to: string | string[], subject: string, message: string): Promise<string>;
}

/**
 * Email templates with beautiful HTML design
 */
const emailTemplates = {
  welcome: (name: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to My Math Tutor! 🎉</h1>
        </div>
        <div class="content">
          <p>Hello ${name}!</p>
          <p>Thank you for joining us. We're excited to have you on board and can't wait to help you master mathematics!</p>
          <p>Get started by exploring our interactive lessons and AI-powered tutoring.</p>
          <p>Best regards,<br>The Math Tutor Team</p>
        </div>
      </div>
    </body>
    </html>
  `,

  verification: (verifyLink: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #11998e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email ✉️</h1>
        </div>
        <div class="content">
          <p>Thank you for signing up!</p>
          <p>Please verify your email address by clicking the button below:</p>
          <p style="text-align: center;">
            <a href="${verifyLink}" class="button">Verify Email</a>
          </p>
          <p><strong>This link expires in 24 hours.</strong></p>
          <p>If you didn't create an account, please ignore this email.</p>
          <p>Best regards,<br>The Math Tutor Team</p>
        </div>
      </div>
    </body>
    </html>
  `,

  passwordReset: (resetLink: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request 🔐</h1>
        </div>
        <div class="content">
          <p>You requested to reset your password.</p>
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </p>
          <p><strong>This link expires in 1 hour.</strong></p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>The Math Tutor Team</p>
        </div>
      </div>
    </body>
    </html>
  `,

  notification: (subject: string, message: string) => {
    // Escape HTML to prevent XSS
    const escapeHtml = (text: string): string => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return text.replace(/[&<>"']/g, (m: string): string => {
        return map[m] ?? m;
      });
    };

    // Convert newlines to <br> tags for better formatting
    const formattedMessage = escapeHtml(message).replace(/\n/g, '<br>');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${escapeHtml(subject)}</h1>
        </div>
        <div class="content">
          <div>${formattedMessage}</div>
          <p>Best regards,<br>The Math Tutor Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
  },
};

/**
 * Send email using nodemailer
 */
async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<string> {
  const transport = getTransporter();
  
  const fromEmail = config.email.from || config.email.user || 'noreply@mymathtutor.com';
  
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"My Math Tutor" <${fromEmail}>`,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    html: options.html,
  };

  emailLogger.info('Sending email:', {
    from: mailOptions.from,
    to: mailOptions.to,
    subject: mailOptions.subject,
  });

  try {
    const info = await transport.sendMail(mailOptions);
    
    emailLogger.info('Email sent successfully:', {
      messageId: info.messageId,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });
    
    return info.messageId;
  } catch (error) {
    emailLogger.error('Failed to send email:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Email Service Implementation
 * Sends emails directly using nodemailer
 */
@injectable()
export class EmailService implements IEmailService {
  /**
   * Send welcome email to new user
   */
  async sendWelcome(to: string, name: string): Promise<string> {
    emailLogger.info('Sending welcome email', { to, name });
    
    return sendEmail({
      to,
      subject: 'Welcome to My Math Tutor!',
      html: emailTemplates.welcome(name),
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(to: string, resetLink: string): Promise<string> {
    emailLogger.info('Sending password reset email', { to });
    
    return sendEmail({
      to,
      subject: 'Reset Your Password',
      html: emailTemplates.passwordReset(resetLink),
    });
  }

  /**
   * Send email verification
   */
  async sendVerification(to: string, verifyLink: string): Promise<string> {
    emailLogger.info('Sending verification email', { to, verifyLink });
    
    return sendEmail({
      to,
      subject: 'Verify Your Email Address',
      html: emailTemplates.verification(verifyLink),
    });
  }

  /**
   * Send generic notification
   */
  async sendNotification(
    to: string | string[],
    subject: string,
    message: string
  ): Promise<string> {
    emailLogger.info('Sending notification email', { 
      to, 
      subject,
      recipientCount: Array.isArray(to) ? to.length : 1,
    });
    
    return sendEmail({
      to,
      subject,
      html: emailTemplates.notification(subject, message),
    });
  }
}

export default EmailService;
