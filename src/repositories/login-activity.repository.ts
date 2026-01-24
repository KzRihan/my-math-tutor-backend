/**
 * Login Activity Repository
 * 
 * Data access layer for login activity operations
 */

import { singleton } from 'tsyringe';
import { ILoginActivity, LoginActivityDocument, LoginActivity } from '@domain/models/login-activity.model';

/**
 * Login Activity Repository
 */
@singleton()
export class LoginActivityRepository {
  constructor() {}

  /**
   * Create a new login activity record
   */
  async create(data: Partial<ILoginActivity>): Promise<LoginActivityDocument> {
    const activity = new LoginActivity(data);
    return activity.save();
  }

  /**
   * Get recent login activity for a user
   */
  async getRecentActivity(userId: string, limit = 10): Promise<LoginActivityDocument[]> {
    return LoginActivity
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get failed login attempts within a time window
   */
  async getFailedAttempts(
    email: string,
    since: Date
  ): Promise<LoginActivityDocument[]> {
    return LoginActivity
      .find({
        email,
        success: false,
        timestamp: { $gte: since },
      })
      .sort({ timestamp: -1 })
      .exec();
  }

  /**
   * Clean up old login activity records
   */
  async cleanupOldRecords(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await LoginActivity.deleteMany({
      timestamp: { $lt: cutoffDate },
    });
    
    return result.deletedCount;
  }
}
