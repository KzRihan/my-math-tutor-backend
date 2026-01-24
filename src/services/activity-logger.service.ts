/**
 * Activity Logger Service
 * 
 * Central service for logging system activities
 */

import { singleton } from 'tsyringe';
import { Request } from 'express';
import { ActivityLogRepository } from '@repositories/activity-log.repository';
import { ActivityType } from '@domain/models/activity-log.model';
import { createChildLogger } from '@utils/logger';

const logger = createChildLogger('activity-logger-service');

export interface LogActivityData {
  userId: string;
  userName: string;
  userEmail: string;
  type: ActivityType;
  action: string;
  message: string;
  icon?: string;
  metadata?: Record<string, any>;
  req?: Request;
}

@singleton()
export class ActivityLoggerService {
  constructor(private activityLogRepository: ActivityLogRepository) {}

  /**
   * Log an activity
   */
  async log(data: LogActivityData): Promise<void> {
    try {
      // Extract IP and user agent if request is provided
      let ipAddress: string | undefined;
      let userAgent: string | undefined;

      if (data.req) {
        ipAddress = this.getIpAddress(data.req);
        userAgent = data.req.headers['user-agent'];
      }

      await this.activityLogRepository.create({
        userId: data.userId as any,
        userName: data.userName,
        userEmail: data.userEmail,
        type: data.type,
        action: data.action,
        message: data.message,
        icon: data.icon || this.getDefaultIcon(data.type),
        metadata: data.metadata || {},
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });

      logger.debug('Activity logged', {
        type: data.type,
        action: data.action,
        userId: data.userId,
      });
    } catch (error) {
      logger.error('Failed to log activity', error);
      // Don't throw - logging failure shouldn't break the main operation
    }
  }

  /**
   * Get default icon for activity type
   */
  private getDefaultIcon(type: ActivityType): string {
    const icons: Record<ActivityType, string> = {
      [ActivityType.CONTENT]: '📝',
      [ActivityType.AI]: '🤖',
      [ActivityType.USER]: '👤',
      [ActivityType.SYSTEM]: '⚙️',
      [ActivityType.SECURITY]: '🔒',
    };

    return icons[type] || '📋';
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
   * Quick logging methods for common activities
   */

  async logTopicCreated(userId: string, userName: string, userEmail: string, topicTitle: string, req?: Request) {
    await this.log({
      userId,
      userName,
      userEmail,
      type: ActivityType.CONTENT,
      action: 'topic_created',
      message: `Created topic: "${topicTitle}"`,
      icon: '📚',
      metadata: { topicTitle },
      req,
    });
  }

  async logTopicUpdated(userId: string, userName: string, userEmail: string, topicTitle: string, req?: Request) {
    await this.log({
      userId,
      userName,
      userEmail,
      type: ActivityType.CONTENT,
      action: 'topic_updated',
      message: `Updated topic: "${topicTitle}"`,
      icon: '✏️',
      metadata: { topicTitle },
      req,
    });
  }

  async logTopicDeleted(userId: string, userName: string, userEmail: string, topicTitle: string, req?: Request) {
    await this.log({
      userId,
      userName,
      userEmail,
      type: ActivityType.CONTENT,
      action: 'topic_deleted',
      message: `Deleted topic: "${topicTitle}"`,
      icon: '🗑️',
      metadata: { topicTitle },
      req,
    });
  }

  async logAIGeneration(userId: string, userName: string, userEmail: string, description: string, req?: Request) {
    await this.log({
      userId,
      userName,
      userEmail,
      type: ActivityType.AI,
      action: 'ai_generated',
      message: `Generated content: ${description}`,
      icon: '🤖',
      metadata: { description },
      req,
    });
  }

  async logUserAction(userId: string, userName: string, userEmail: string, action: string, message: string, req?: Request) {
    await this.log({
      userId,
      userName,
      userEmail,
      type: ActivityType.USER,
      action,
      message,
      icon: '👤',
      req,
    });
  }

  async logSystemAction(userId: string, userName: string, userEmail: string, action: string, message: string, req?: Request) {
    await this.log({
      userId,
      userName,
      userEmail,
      type: ActivityType.SYSTEM,
      action,
      message,
      icon: '⚙️',
      req,
    });
  }

  async logSecurityEvent(userId: string, userName: string, userEmail: string, event: string, req?: Request) {
    await this.log({
      userId,
      userName,
      userEmail,
      type: ActivityType.SECURITY,
      action: 'security_event',
      message: event,
      icon: '🔒',
      req,
    });
  }
}
