/**
 * Admin Dashboard Controller
 * 
 * Handles HTTP requests for admin dashboard data.
 */

import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { AdminDashboardService } from '@services/admin-dashboard.service';
import { sendSuccess } from '@utils/response';
import { asyncHandler } from '@utils/async-handler';
import { createChildLogger } from '@utils/logger';

const controllerLogger = createChildLogger('admin-dashboard-controller');

export class AdminDashboardController {
  /**
   * Get dashboard data
   * GET /admin/dashboard
   */
  getDashboardData = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const dashboardService = container.resolve(AdminDashboardService);
    const data = await dashboardService.getDashboardData();

    controllerLogger.debug('Dashboard data retrieved successfully');
    sendSuccess(res, data, 'Dashboard data retrieved successfully');
  });
}
