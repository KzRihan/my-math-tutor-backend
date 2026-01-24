/**
 * Settings Controller
 * 
 * Handles HTTP requests for system settings operations
 */

import { Request, Response } from 'express';
import { singleton } from 'tsyringe';
import { SettingsService } from '@services/settings.service';
import { ActivityLoggerService } from '@services/activity-logger.service';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess } from '@utils/response';
import { createChildLogger } from '@utils/logger';

const logger = createChildLogger('settings-controller');

@singleton()
export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private activityLoggerService: ActivityLoggerService
  ) { }

  /**
   * Get system settings
   * GET /admin/settings/system
   */
  getSystemSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await this.settingsService.getSystemSettings();

    // Seed activity logs if this is the first time (optional - auto-seed on first access)
    const user = (req as any).user;
    if (user) {
      // This will be called but won't duplicate logs (check in seeder)
      const { seedActivityLogs } = await import('@utils/seed-activities');
      await seedActivityLogs(user.id, `${user.firstName} ${user.lastName}`, user.email).catch(() => { });
    }

    sendSuccess(res, settings, 'System settings retrieved successfully');
  });

  /**
   * Update system settings
   * PUT /admin/settings/system
   */
  updateSystemSettings = asyncHandler(async (req: Request, res: Response) => {
    const updates = req.body;
    const user = (req as any).user;
    const settings = await this.settingsService.updateSystemSettings(updates);

    // Log the activity
    if (user) {
      const changes = Object.keys(updates).join(', ');
      await this.activityLoggerService.logSystemAction(
        user.id,
        `${user.firstName} ${user.lastName}`,
        user.email,
        'settings_updated',
        `Updated system settings: ${changes}`,
        req
      );
    }

    logger.info('System settings updated by admin', { userId: user?.id });
    sendSuccess(res, settings, 'System settings updated successfully');
  });

  /**
   * Get storage statistics
   * GET /admin/settings/storage
   */
  getStorageStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await this.settingsService.getStorageStats();

    sendSuccess(res, stats, 'Storage stats retrieved successfully');
  });

  /**
   * Create backup
   * POST /admin/settings/backup
   */
  createBackup = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await this.settingsService.createBackup();

    // Log the activity
    if (user) {
      await this.activityLoggerService.logSystemAction(
        user.id,
        `${user.firstName} ${user.lastName}`,
        user.email,
        'backup_created',
        'Created database backup',
        req
      );
    }

    sendSuccess(res, result, 'Backup created successfully');
  });

  /**
   * Get activity logs
   * GET /admin/settings/logs?type=all&limit=50&offset=0
   */
  getActivityLogs = asyncHandler(async (req: Request, res: Response) => {
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await this.settingsService.getActivityLogs(type, limit, offset);

    sendSuccess(res, result, 'Activity logs retrieved successfully');
  });

  /**
   * Export activity logs
   * GET /admin/settings/logs/export?type=all
   */
  exportActivityLogs = asyncHandler(async (req: Request, res: Response) => {
    const type = req.query.type as string | undefined;

    const csv = await this.settingsService.exportActivityLogs(type);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${Date.now()}.csv`);
    res.send(csv);
  });

  /**
   * Delete all generated content
   * DELETE /admin/settings/content/generated
   */
  deleteGeneratedContent = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const userId = user?.id;

    const result = await this.settingsService.deleteAllGeneratedContent(userId);

    // Log the activity
    if (user) {
      await this.activityLoggerService.logSystemAction(
        user.id,
        `${user.firstName} ${user.lastName}`,
        user.email,
        'content_deleted',
        `Deleted ${result.deletedCount} AI-generated topics`,
        req
      );
    }

    logger.warn('Admin deleted all generated content', { userId, deletedCount: result.deletedCount });
    sendSuccess(res, result, 'Generated content deleted successfully');
  });

  /**
   * Reset all student progress
   * DELETE /admin/settings/progress/reset
   */
  resetAllProgress = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const userId = user?.id;

    const result = await this.settingsService.resetAllProgress(userId);

    // Log the activity
    if (user) {
      await this.activityLoggerService.logSystemAction(
        user.id,
        `${user.firstName} ${user.lastName}`,
        user.email,
        'progress_reset',
        `Reset progress for ${result.resetCount} enrollments`,
        req
      );
    }

    logger.warn('Admin reset all student progress', { userId, resetCount: result.resetCount });
    sendSuccess(res, result, 'Student progress reset successfully');
  });

  /**
   * Update admin password
   * PUT /admin/settings/password
   */
  updatePassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { currentPassword, newPassword } = req.body;

    const result = await this.settingsService.updateAdminPassword(userId, currentPassword, newPassword);

    sendSuccess(res, result, 'Password updated successfully');
  });

  /**
   * Get login activity
   * GET /admin/settings/security/login-activity
   */
  getLoginActivity = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    const activity = await this.settingsService.getLoginActivity(userId);

    sendSuccess(res, { activity }, 'Login activity retrieved successfully');
  });
}
