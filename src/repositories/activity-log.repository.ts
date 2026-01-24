/**
 * Activity Log Repository
 * 
 * Data access layer for activity log operations
 */

import { singleton } from 'tsyringe';
import { IActivityLog, ActivityLogDocument, ActivityLog } from '@domain/models/activity-log.model';

/**
 * Activity Log Repository
 */
@singleton()
export class ActivityLogRepository {
  constructor() {}

  /**
   * Create a new activity log
   */
  async create(data: Partial<IActivityLog>): Promise<ActivityLogDocument> {
    const log = new ActivityLog(data);
    return log.save();
  }

  /**
   * Get recent activity logs with filtering
   */
  async getRecentLogs(
    type?: string,
    limit = 50,
    offset = 0
  ): Promise<{ logs: ActivityLogDocument[]; total: number }> {
    const filter: any = {};
    
    if (type && type !== 'all') {
      filter.type = type;
    }

    const [logs, total] = await Promise.all([
      ActivityLog
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      ActivityLog.countDocuments(filter),
    ]);

    return { logs, total };
  }

  /**
   * Get activity logs for a specific user
   */
  async getUserLogs(
    userId: string,
    limit = 50
  ): Promise<ActivityLogDocument[]> {
    return ActivityLog
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Clean up old activity logs
   */
  async cleanupOldLogs(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await ActivityLog.deleteMany({
      timestamp: { $lt: cutoffDate },
    });
    
    return result.deletedCount;
  }

  /**
   * Get activity stats by type
   */
  async getStatsByType(since?: Date): Promise<Record<string, number>> {
    const match: any = {};
    if (since) {
      match.timestamp = { $gte: since };
    }

    const stats = await ActivityLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const result: Record<string, number> = {};
    stats.forEach((stat) => {
      result[stat._id] = stat.count;
    });

    return result;
  }
}
