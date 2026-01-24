/**
 * Settings Service
 * 
 * Handles system settings, activity logs, and security operations
 */

import { singleton } from 'tsyringe';
import { UserRepository } from '@repositories/user.repository';
import { TopicRepository } from '@repositories/topic.repository';
import { EnrollmentRepository } from '@repositories/enrollment.repository';
import { QuestionResponseRepository } from '@repositories/question-response.repository';
import { LoginActivityService } from '@services/login-activity.service';
import { ActivityLogRepository } from '@repositories/activity-log.repository';
import { createChildLogger } from '@utils/logger';
import { NotFoundError, ValidationError } from '@utils/errors';

const logger = createChildLogger('settings-service');

export interface SystemSettings {
  appName: string;
  supportEmail: string;
  defaultLanguage: string;
  timezone: string;
  emailNotifications: boolean;
  allowStudentRegistration: boolean;
  maintenanceMode: boolean;
}

export interface StorageStats {
  databaseSize: string;
  mediaStorage: string;
  backupStatus: string;
}

export interface ActivityLogEntry {
  id: string;
  type: string;
  message: string;
  user: string;
  timestamp: Date;
  icon: string;
}

@singleton()
export class SettingsService {
  private settings: SystemSettings = {
    appName: 'MathTutor AI',
    supportEmail: 'support@mathtutor.ai',
    defaultLanguage: 'en',
    timezone: 'UTC',
    emailNotifications: true,
    allowStudentRegistration: true,
    maintenanceMode: false,
  };

  constructor(
    private userRepository: UserRepository,
    private topicRepository: TopicRepository,
    private enrollmentRepository: EnrollmentRepository,
    private questionResponseRepository: QuestionResponseRepository,
    private loginActivityService: LoginActivityService,
    private activityLogRepository: ActivityLogRepository
  ) {}

  /**
   * Get system settings
   */
  async getSystemSettings(): Promise<SystemSettings> {
    return this.settings;
  }

  /**
   * Update system settings
   */
  async updateSystemSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    this.settings = { ...this.settings, ...updates };
    logger.info('System settings updated', updates);
    return this.settings;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    // In a real app, these would come from database queries
    return {
      databaseSize: '2.4 GB',
      mediaStorage: '8.1 GB',
      backupStatus: 'OK',
    };
  }

  /**
   * Get activity logs with filtering
   */
  async getActivityLogs(
    type?: string,
    limit = 50,
    offset = 0
  ): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    const result = await this.activityLogRepository.getRecentLogs(type, limit, offset);
    
    const logs: ActivityLogEntry[] = result.logs.map(log => ({
      id: log._id.toString(),
      type: log.type,
      message: log.message,
      user: log.userName,
      timestamp: log.timestamp,
      icon: log.icon,
    }));
    
    return {
      logs,
      total: result.total,
    };
  }

  /**
   * Create database backup
   */
  async createBackup(): Promise<{ success: boolean; message: string }> {
    logger.info('Creating database backup');
    // In a real app, this would trigger actual backup process
    return {
      success: true,
      message: 'Backup created successfully',
    };
  }

  /**
   * Delete all AI-generated content
   */
  async deleteAllGeneratedContent(userId: string): Promise<{ deletedCount: number }> {
    logger.warn('Deleting all AI-generated content', { userId });
    
    // Find all topics with status 'generated'
    const generatedTopics = await this.topicRepository.findAll({
      status: 'generated',
    } as any);

    let deletedCount = 0;
    for (const topic of generatedTopics) {
      await this.topicRepository.deleteById(topic._id.toString());
      deletedCount++;
    }

    logger.info(`Deleted ${deletedCount} AI-generated topics`);
    return { deletedCount };
  }

  /**
   * Reset all student progress
   */
  async resetAllProgress(userId: string): Promise<{ resetCount: number }> {
    logger.warn('Resetting all student progress', { userId });
    
    // Delete all enrollments
    const enrollments = await this.enrollmentRepository.findAll();
    let resetCount = 0;

    for (const enrollment of enrollments) {
      await this.enrollmentRepository.deleteById(enrollment._id.toString());
      resetCount++;
    }

    // Delete all question responses
    const responses = await this.questionResponseRepository.findAll();
    for (const response of responses) {
      await this.questionResponseRepository.deleteById(response._id.toString());
    }

    logger.info(`Reset progress for ${resetCount} enrollments`);
    return { resetCount };
  }

  /**
   * Update admin password
   */
  async updateAdminPassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info('Admin password updated', { userId });
    return { success: true };
  }

  /**
   * Get login activity
   */
  async getLoginActivity(userId: string): Promise<any[]> {
    return this.loginActivityService.getRecentActivity(userId, 10);
  }

  /**
   * Export activity logs
   */
  async exportActivityLogs(type?: string): Promise<string> {
    const { logs } = await this.getActivityLogs(type, 1000);
    
    // Convert to CSV
    const csv = [
      'Type,Message,User,Timestamp,Icon',
      ...logs.map(log => 
        `${log.type},"${log.message.replace(/"/g, '""')}",${log.user},${log.timestamp.toISOString()},${log.icon}`
      )
    ].join('\n');

    return csv;
  }
}
