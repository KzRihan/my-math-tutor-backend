/**
 * Login Activity Service
 * 
 * Handles login activity tracking and analysis
 */

import { singleton } from 'tsyringe';
import { Request } from 'express';
import { LoginActivityRepository } from '@repositories/login-activity.repository';
import { createChildLogger } from '@utils/logger';
const UAParser = require('ua-parser-js');

const logger = createChildLogger('login-activity-service');

export interface LoginAttemptData {
  userId: string;
  email: string;
  success: boolean;
  failureReason?: string;
}

@singleton()
export class LoginActivityService {
  constructor(private loginActivityRepository: LoginActivityRepository) { }

  /**
   * Log a login attempt
   */
  async logLoginAttempt(req: Request, data: LoginAttemptData): Promise<void> {
    try {
      // Extract IP address
      const ipAddress = this.getIpAddress(req);

      // Parse user agent
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const parser = new UAParser(userAgent);
      const result = parser.getResult();

      // Create login activity record
      await this.loginActivityRepository.create({
        userId: data.userId as any,
        email: data.email,
        ipAddress,
        userAgent,
        device: this.getDeviceType(result),
        browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
        os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
        success: data.success,
        failureReason: data.failureReason,
        timestamp: new Date(),
      });

      logger.info('Login attempt logged', {
        userId: data.userId,
        email: data.email,
        success: data.success,
        ipAddress,
      });
    } catch (error) {
      logger.error('Failed to log login attempt', error);
      // Don't throw error - logging failure shouldn't break login flow
    }
  }

  /**
   * Get recent login activity for a user
   */
  async getRecentActivity(userId: string, limit = 10) {
    const activities = await this.loginActivityRepository.getRecentActivity(userId, limit);

    return activities.map(activity => ({
      id: activity._id.toString(),
      email: activity.email,
      ipAddress: activity.ipAddress,
      device: activity.device,
      browser: activity.browser,
      os: activity.os,
      success: activity.success,
      failureReason: activity.failureReason,
      timestamp: activity.timestamp,
      formattedDevice: `${activity.browser} on ${activity.os}`,
    }));
  }

  /**
   * Get failed login attempts for security monitoring
   */
  async getFailedAttempts(email: string, hoursBack = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hoursBack);

    return this.loginActivityRepository.getFailedAttempts(email, since);
  }

  /**
   * Extract IP address from request
   */
  private getIpAddress(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'Unknown'
    );
  }

  /**
   * Determine device type from user agent
   */
  private getDeviceType(result: UAParser.IResult): string {
    if (result.device.type) {
      return result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1);
    }

    // Fallback detection
    const ua = result.ua?.toLowerCase() || '';
    if (ua.includes('mobile')) return 'Mobile';
    if (ua.includes('tablet')) return 'Tablet';
    return 'Desktop';
  }

  /**
   * Clean up old records (for maintenance jobs)
   */
  async cleanupOldRecords(daysToKeep = 90): Promise<number> {
    logger.info(`Cleaning up login activity records older than ${daysToKeep} days`);
    const deletedCount = await this.loginActivityRepository.cleanupOldRecords(daysToKeep);
    logger.info(`Deleted ${deletedCount} old login activity records`);
    return deletedCount;
  }
}
