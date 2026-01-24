/**
 * Email Worker
 * 
 * BullMQ worker that processes email jobs from the queue.
 * Demonstrates production-ready background job processing.
 */

import { Worker, Job, Processor } from 'bullmq';
import nodemailer from 'nodemailer';
import { config } from '@config/index';
import { createBullMQConnection } from '@infrastructure/redis/client';
import { EmailJobData, EmailJobType } from '@infrastructure/queue/producer';
import { createChildLogger } from '@utils/logger';

const workerLogger = createChildLogger('email-worker');

/** Worker instance */
let emailWorker: Worker<EmailJobData, void, EmailJobType> | null = null;

/** Nodemailer transporter instance */
let transporter: nodemailer.Transporter | null = null;

/**
 * Get or create the email transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
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

    workerLogger.info('Email transporter created', {
      host: config.email.host || 'smtp.gmail.com',
      port: config.email.port || 587,
      user: config.email.user,
    });
  }
  return transporter;
}

/**
 * Email processor function
 * Handles different email types and sends them
 */
const processEmail: Processor<EmailJobData, void, EmailJobType> = async (
  job: Job<EmailJobData, void, EmailJobType>
) => {
  const { name: emailType, data } = job;

  workerLogger.info(`Processing email job: ${job.id}`, {
    type: emailType,
    to: data.to,
    subject: data.subject,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Update job progress
    await job.updateProgress(10);

    // Get the appropriate email template based on type
    const emailContent = await renderEmailTemplate(emailType, data);
    await job.updateProgress(50);

    // Send the email
    await sendEmail({
      to: data.to,
      subject: data.subject,
      html: emailContent,
      attachments: data.attachments,
    });
    await job.updateProgress(100);

    workerLogger.info(`Email sent successfully: ${job.id}`, {
      type: emailType,
      to: data.to,
    });
  } catch (error) {
    workerLogger.error(`Email job failed: ${job.id}`, {
      type: emailType,
      error: error instanceof Error ? error.message : 'Unknown error',
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });

    throw error; // Rethrow to trigger retry
  }
};

/**
 * Render email template based on type
 * In production, this would use a template engine like Handlebars or EJS
 */
async function renderEmailTemplate(
  type: EmailJobType,
  data: EmailJobData
): Promise<string> {
  // Simulate template rendering
  const templates: Record<EmailJobType, (data: EmailJobData) => string> = {
    welcome: (d) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
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
            <p>Hello ${d.templateData?.['name'] || 'there'}!</p>
            <p>Thank you for joining us. We're excited to have you on board and can't wait to help you master mathematics!</p>
            <p>Get started by exploring our interactive lessons and AI-powered tutoring.</p>
            <p>Best regards,<br>The Math Tutor Team</p>
          </div>
        </div>
      </body>
      </html>
    `,

    'password-reset': (d) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
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
              <a href="${d.templateData?.['resetLink'] || '#'}" class="button">Reset Password</a>
            </p>
            <p><strong>This link expires in 1 hour.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>The Math Tutor Team</p>
          </div>
        </div>
      </body>
      </html>
    `,

    verification: (d) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
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
              <a href="${d.templateData?.['verifyLink'] || '#'}" class="button">Verify Email</a>
            </p>
            <p><strong>This link expires in 24 hours.</strong></p>
            <p>If you didn't create an account, please ignore this email.</p>
            <p>Best regards,<br>The Math Tutor Team</p>
          </div>
        </div>
      </body>
      </html>
    `,

    notification: (d) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${d.subject}</h1>
          </div>
          <div class="content">
            <p>${d.templateData?.['message'] || 'You have a new notification.'}</p>
            <p>Best regards,<br>The Math Tutor Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return templates[type](data);
}

/**
 * Send email using configured transport
 * Uses nodemailer with Gmail SMTP
 */
async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailJobData['attachments'];
}): Promise<void> {
  const transport = getTransporter();

  const fromEmail = config.email.from || config.email.user || 'noreply@mymathtutor.com';

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"My Math Tutor" <${fromEmail}>`,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    html: options.html,
  };

  // Add attachments if present
  if (options.attachments && options.attachments.length > 0) {
    mailOptions.attachments = options.attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    }));
  }

  workerLogger.debug('Sending email:', {
    from: mailOptions.from,
    to: mailOptions.to,
    subject: mailOptions.subject,
  });

  // Send the email
  const info = await transport.sendMail(mailOptions);

  workerLogger.info('Email sent:', {
    messageId: info.messageId,
    to: mailOptions.to,
  });
}

/**
 * Start the email worker
 */
export function startEmailWorker(): Worker<EmailJobData, void, EmailJobType> {
  if (emailWorker) {
    workerLogger.warn('Email worker already running');
    return emailWorker;
  }

  emailWorker = new Worker<EmailJobData, void, EmailJobType>(
    config.queue.emailQueueName,
    processEmail,
    {
      connection: createBullMQConnection('email-worker'),
      concurrency: 5, // Process 5 emails concurrently
      limiter: {
        max: 100,     // Max 100 jobs
        duration: 60000, // Per minute (rate limiting)
      },
    }
  );

  // Worker event handlers
  emailWorker.on('active', (job: Job<EmailJobData, void, EmailJobType>) => {
    console.log(`📧 [EMAIL WORKER] Job Started:`, {
      jobId: job.id,
      type: job.name,
      to: job.data.to,
      timestamp: new Date().toISOString(),
    });
  });

  emailWorker.on('completed', (job: Job<EmailJobData, void, EmailJobType>) => {
    console.log(`✅ [EMAIL WORKER] Job Completed:`, {
      jobId: job.id,
      type: job.name,
      to: job.data.to,
      timestamp: new Date().toISOString(),
    });
    workerLogger.debug(`Email job completed: ${job.id}`);
  });

  emailWorker.on('failed', (job: Job<EmailJobData, void, EmailJobType> | undefined, error: Error) => {
    console.log(`❌ [EMAIL WORKER] Job Failed:`, {
      jobId: job?.id,
      type: job?.name,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    workerLogger.error(`Email job failed: ${job?.id}`, { error: error.message });
  });

  emailWorker.on('error', (error: Error) => {
    console.log(`🔥 [EMAIL WORKER] Error:`, error.message);
    workerLogger.error('Email worker error:', error);
  });

  emailWorker.on('stalled', (jobId: string) => {
    console.log(`⚠️ [EMAIL WORKER] Job Stalled:`, { jobId });
    workerLogger.warn(`Email job stalled: ${jobId}`);
  });

  workerLogger.info('📧 Email worker started');

  return emailWorker;
}

/**
 * Stop the email worker gracefully
 */
export async function stopEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
    workerLogger.info('Email worker stopped');
  }
}

/**
 * Check if email worker is running
 */
export function isEmailWorkerRunning(): boolean {
  return emailWorker !== null && !emailWorker.closing;
}

export default {
  start: startEmailWorker,
  stop: stopEmailWorker,
  isRunning: isEmailWorkerRunning,
};
