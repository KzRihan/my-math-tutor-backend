/**
 * Achievement Controller
 * 
 * HTTP request handlers for Achievement endpoints
 */

import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { AchievementService } from '@services/achievement.service';
import { sendSuccess } from '@utils/response';
import { asyncHandler } from '@utils/async-handler';
import { createChildLogger } from '@utils/logger';

const controllerLogger = createChildLogger('achievement-controller');

@injectable()
export class AchievementController {
  constructor(
    @inject(AchievementService) private achievementService: AchievementService
  ) {}

  /**
   * Get current user's achievements
   * GET /api/v1/achievements/me
   */
  getMyAchievements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      sendSuccess(res, null, 'Authentication required');
      return;
    }

    controllerLogger.debug('Getting user achievements', { userId });

    const achievements = await this.achievementService.getUserAchievements(userId);

    sendSuccess(res, achievements);
  });
}

export default AchievementController;

