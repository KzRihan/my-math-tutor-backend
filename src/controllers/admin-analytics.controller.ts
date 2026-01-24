/**
 * Admin Analytics Controller
 * 
 * Handles HTTP requests for admin analytics data.
 */

import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { AdminAnalyticsService } from '@services/admin-analytics.service';
import { sendSuccess } from '@utils/response';
import { createChildLogger } from '@utils/logger';
import { asyncHandler } from '@utils/async-handler';

const controllerLogger = createChildLogger('admin-analytics-controller');

/**
 * Get comprehensive analytics data
 */
export const getAnalyticsData = asyncHandler(async (req: Request, res: Response) => {
  const timeRange = (req.query.timeRange as '7d' | '30d' | '90d' | '1y') || '7d';
  
  controllerLogger.info('Fetching analytics data', { timeRange });
  
  const analyticsService = container.resolve(AdminAnalyticsService);
  const data = await analyticsService.getAnalyticsData(timeRange);
  
  controllerLogger.info('Analytics data fetched successfully', { 
    timeRange,
    topicsCount: data.topicPerformance.length,
  });
  
  return sendSuccess(res, data, 'Analytics data retrieved successfully');
});
