/**
 * Achievement Routes
 * 
 * Express router for Achievement endpoints
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import { AchievementController } from '@controllers/achievement.controller';
import { authenticate } from '@middlewares/auth.middleware';

/**
 * Create achievement routes
 */
export function createAchievementRoutes(): Router {
  const router = Router();
  
  // Get controller instance from DI container
  const achievementController = container.resolve(AchievementController);

  /**
   * GET /achievements/me
   * Get current user's achievements
   * Requires authentication
   */
  router.get(
    '/me',
    authenticate,
    achievementController.getMyAchievements
  );

  return router;
}

export default createAchievementRoutes;

