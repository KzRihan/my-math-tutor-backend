/**
 * Seed Activity Logs
 * 
 * Creates sample activity logs for demonstration
 */

import { ActivityLog, ActivityType } from '@domain/models/activity-log.model';
import { createChildLogger } from '@utils/logger';

const logger = createChildLogger('seed-activities');

export async function seedActivityLogs(userId: string, userName: string, userEmail: string) {
  try {
    // Check if activities already exist
    const existingCount = await ActivityLog.countDocuments();
    if (existingCount > 0) {
      logger.info(`Activities already seeded (${existingCount} entries)`);
      return;
    }

    const now = new Date();
    const activities = [
      // Recent activities (last hour)
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.CONTENT,
        action: 'topic_created',
        message: 'Created topic: "Advanced Algebra"',
        icon: '📚',
        timestamp: new Date(now.getTime() - 10 * 60 * 1000), // 10 min ago
      },
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.AI,
        action: 'ai_generated',
        message: 'Generated lesson content using AI',
        icon: '🤖',
        timestamp: new Date(now.getTime() - 25 * 60 * 1000), // 25 min ago
      },
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.USER,
        action: 'profile_updated',
        message: 'Updated profile settings',
        icon: '👤',
        timestamp: new Date(now.getTime() - 45 * 60 * 1000), // 45 min ago
      },
      
      // Earlier today
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.CONTENT,
        action: 'lesson_updated',
        message: 'Updated lesson: "Introduction to Calculus"',
        icon: '✏️',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.SYSTEM,
        action: 'settings_updated',
        message: 'Updated system settings: emailNotifications, timezone',
        icon: '⚙️',
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
      },
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.AI,
        action: 'ai_generated',
        message: 'Generated quiz questions for topic: "Geometry Basics"',
        icon: '🤖',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
      },
      
      // Yesterday
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.CONTENT,
        action: 'topic_published',
        message: 'Published topic: "Trigonometry Fundamentals"',
        icon: '🚀',
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.SECURITY,
        action: 'password_changed',
        message: 'Changed account password',
        icon: '🔒',
        timestamp: new Date(now.getTime() - 26 * 60 * 60 * 1000), // 1 day 2 hours ago
      },
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.SYSTEM,
        action: 'backup_created',
        message: 'Created database backup',
        icon: '💾',
        timestamp: new Date(now.getTime() - 30 * 60 * 60 * 1000), // 1 day 6 hours ago
      },
      
      // 2 days ago
      {
        userId,
        userName,
        userEmail,
        type: ActivityType.CONTENT,
        action: 'topic_created',
        message: 'Created topic: "Linear Equations"',
        icon: '📚',
        timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2 days ago
      },
    ];

    await ActivityLog.insertMany(activities);
    logger.info(`Successfully seeded ${activities.length} activity logs`);
  } catch (error) {
    logger.error('Failed to seed activity logs', error);
    throw error;
  }
}
