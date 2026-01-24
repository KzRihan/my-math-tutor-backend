/**
 * User Routes
 * 
 * Express router for User endpoints.
 * Combines route definitions with validation and controller bindings.
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import { UserController } from '@controllers/user.controller';
import { 
  validate, 
  validateBody, 
  createUserSchema, 
  updateUserSchema, 
  userQuerySchema,
  idParamsSchema,
} from '@middlewares/validate.middleware';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { uploadProfileImage } from '@middlewares/upload.middleware';
import { UserRole } from '@domain/enums/user-status.enum';

/**
 * Create user routes
 * Factory function for dependency injection
 */
export function createUserRoutes(): Router {
  const router = Router();
  
  // Get controller instance from DI container
  const userController = container.resolve(UserController);

  // ============================================================
  // Public Routes
  // ============================================================

  /**
   * POST /users
   * Create a new user (registration)
   */
  router.post(
    '/',
    validateBody(createUserSchema),
    userController.create
  );

  /**
   * GET /users/verify-email
   * Verify email address
   */
  router.get('/verify-email', userController.verifyEmail);

  // ============================================================
  // Authenticated Routes
  // ============================================================

  /**
   * GET /users
   * Get paginated list of users
   * Requires authentication
   */
  router.get(
    '/',
    authenticate,
    validate({ query: userQuerySchema }),
    userController.getAll
  );

  /**
   * GET /users/statistics
   * Get user statistics
   * Requires admin role
   */
  router.get(
    '/statistics',
    authenticate,
    authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    userController.getStatistics
  );
  
  /**
   * GET /users/me/progress
   * Get current user's progress stats for progress page
   */
  router.get(
    '/me/progress',
    authenticate,
    userController.getMyProgress
  );

  /**
   * POST /users/me/mark-streak-popup
   * Mark streak popup as displayed
   */
  router.post(
    '/me/mark-streak-popup',
    authenticate,
    userController.markStreakPopupDisplayed
  );
  
  /**
   * GET /users/me
   * Get current user profile
   */
  router.get(
    '/me',
    authenticate,
    userController.getMe
  );

  /**
   * PATCH /users/me
   * Update current user profile (with optional profile image upload)
   */
  router.patch(
    '/me',
    authenticate,
    uploadProfileImage.single('profileImage'),
    userController.updateMe
  );

  /**
   * GET /users/:id
   * Get user by ID
   * Requires authentication
   */
  router.get(
    '/:id',
    authenticate,
    validate({ params: idParamsSchema }),
    userController.getById
  );

  /**
   * PATCH /users/:id
   * Update user
   * Requires authentication
   */
  router.patch(
    '/:id',
    authenticate,
    validate({ 
      params: idParamsSchema, 
      body: updateUserSchema 
    }),
    userController.update
  );

  /**
   * DELETE /users/:id
   * Delete user (soft delete)
   * Requires admin role
   */
  router.delete(
    '/:id',
    authenticate,
    authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    validate({ params: idParamsSchema }),
    userController.delete
  );

  return router;
}

export default createUserRoutes;
