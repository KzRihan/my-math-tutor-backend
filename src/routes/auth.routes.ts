/**
 * Authentication Routes
 * 
 * Express router for authentication endpoints.
 * Handles signup, signin, email verification, and password reset.
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import { AuthController } from '@controllers/auth.controller';
import { 
  validateBody,
  registerUserSchema,
  loginSchema,
  verifyEmailTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailOnlySchema,
} from '@middlewares/validate.middleware';
import { googleSigninSchema, appleSigninSchema } from '@validations/social-auth.validation';
// import { authRateLimiter } from '@middlewares/rate-limiter.middleware'; // COMMENTED OUT - Rate limiting disabled

/**
 * Create auth routes
 * Factory function for dependency injection
 */
export function createAuthRoutes(): Router {
  const router = Router();
  
  // Get controller instance from DI container
  const authController = container.resolve(AuthController);

  // ============================================================
  // Public Authentication Routes
  // ============================================================

  /**
   * POST /auth/signup
   * Register a new user account
   */
  router.post(
    '/signup',
    validateBody(registerUserSchema),
    authController.signup
  );

  /**
   * POST /auth/signin
   * Login with email and password
   */
  router.post(
    '/signin',
    validateBody(loginSchema),
    authController.signin
  );

  /**
   * POST /auth/google
   * Login with Google (social login)
   * Rate limited: 10 requests per minute per IP
   */
  router.post(
    '/google',
    // authRateLimiter, // COMMENTED OUT - Rate limiting disabled
    validateBody(googleSigninSchema),
    authController.googleSignin
  );

  /**
   * POST /auth/apple
   * Login with Apple (social login)
   * Rate limited: 10 requests per minute per IP
   */
  router.post(
    '/apple',
    // authRateLimiter, // COMMENTED OUT - Rate limiting disabled
    validateBody(appleSigninSchema),
    authController.appleSignin
  );

  /**
   * POST /auth/verify-email
   * Verify email address with token from email
   */
  router.post(
    '/verify-email',
    validateBody(verifyEmailTokenSchema),
    authController.verifyEmail
  );

  /**
   * POST /auth/forgot-password
   * Request password reset email
   */
  router.post(
    '/forgot-password',
    validateBody(forgotPasswordSchema),
    authController.forgotPassword
  );

  /**
   * POST /auth/reset-password
   * Reset password with token from email
   */
  router.post(
    '/reset-password',
    validateBody(resetPasswordSchema),
    authController.resetPassword
  );

  /**
   * POST /auth/resend-verification
   * Resend email verification link
   */
  router.post(
    '/resend-verification',
    validateBody(emailOnlySchema),
    authController.resendVerification
  );

  /**
   * POST /auth/logout
   * Log out user (for logging purposes, actual logout is client-side)
   */
  router.post('/logout', authController.logout);

  return router;
}

export default createAuthRoutes;

