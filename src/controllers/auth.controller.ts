/**
 * Authentication Controller
 * 
 * HTTP request handlers for authentication endpoints.
 * Handles signup, signin, email verification, and password reset.
 */

import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { AuthService } from '@services/auth.service';
import { SocialAuthService } from '@services/social-auth.service';
import { sendSuccess, sendCreated } from '@utils/response';
import { asyncHandler } from '@utils/async-handler';
import { createChildLogger } from '@utils/logger';
import { SocialLoginProvider } from '@domain/enums/user-status.enum';

const controllerLogger = createChildLogger('auth-controller');

/**
 * Auth Controller
 * Handles HTTP requests for authentication operations
 */
@injectable()
export class AuthController {
  constructor(
    @inject(AuthService) private authService: AuthService,
    @inject(SocialAuthService) private socialAuthService: SocialAuthService
  ) {}

  /**
   * User signup (registration)
   * POST /api/v1/auth/signup
   */
  signup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signupData = {
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      role: req.body.role,
      socialLoginProvider: SocialLoginProvider.EMAIL as const,
      deviceToken: req.body.deviceToken,
      deviceType: req.body.deviceType,
    };

    controllerLogger.debug('User signup request', { email: signupData.email });

    const user = await this.authService.signup(signupData);

    sendCreated(
      res,
      user,
      'Signup successful! Please check your email to verify your account.'
    );
  });

  /**
   * User signin (login)
   * POST /api/v1/auth/signin
   */
  signin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signinData = {
      email: req.body.email,
      password: req.body.password,
      deviceToken: req.body.deviceToken,
      deviceType: req.body.deviceType,
    };

    controllerLogger.debug('User signin request', { email: signinData.email });

    const user = await this.authService.signin(signinData, req);

    sendSuccess(res, user, 'Signin successful');
  });

  /**
   * Google Sign-in (social login)
   * POST /api/v1/auth/google
   */
  googleSignin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const googleData = {
      idToken: req.body.idToken,
      deviceToken: req.body.deviceToken,
      deviceType: req.body.deviceType as 'android' | 'ios' | 'web' | undefined,
    };

    controllerLogger.debug('Google signin request');

    const result = await this.socialAuthService.googleSignin(googleData);

    sendSuccess(res, result, result.isNewUser ? 'Welcome! Account created successfully.' : 'Signin successful');
  });

  /**
   * Apple Sign-in (social login)
   * POST /api/v1/auth/apple
   */
  appleSignin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const appleData = {
      identityToken: req.body.identityToken,
      authorizationCode: req.body.authorizationCode,
      user: req.body.user,
      deviceToken: req.body.deviceToken,
      deviceType: req.body.deviceType as 'android' | 'ios' | 'web' | undefined,
    };

    controllerLogger.debug('Apple signin request');

    const result = await this.socialAuthService.appleSignin(appleData);

    sendSuccess(res, result, result.isNewUser ? 'Welcome! Account created successfully.' : 'Signin successful');
  });

  /**
   * Admin signin (login)
   * POST /api/v1/admin/auth/signin
   * Only allows users with ADMIN or SUPER_ADMIN role
   */
  adminSignin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signinData = {
      email: req.body.email,
      password: req.body.password,
      deviceToken: req.body.deviceToken,
      deviceType: req.body.deviceType,
    };

    controllerLogger.debug('Admin signin request', { email: signinData.email });

    const result = await this.authService.adminSignin(signinData, req);

    sendSuccess(res, result, 'Admin signin successful');
  });

  /**
   * Verify email with token
   * POST /api/v1/auth/verify-email
   */
  verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;

    controllerLogger.debug('Email verification request');

    const user = await this.authService.verifyEmail({ token });

    sendSuccess(res, user, 'Email verified successfully! You can now sign in.');
  });

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    controllerLogger.debug('Password reset request', { email });

    await this.authService.requestPasswordReset({ email });

    sendSuccess(
      res,
      null,
      'If an account exists with this email, a password reset link has been sent.'
    );
  });

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const resetData = {
      token: req.body.token,
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword,
    };

    controllerLogger.debug('Password reset attempt');

    const user = await this.authService.resetPassword(resetData);

    sendSuccess(res, user, 'Password reset successful! You can now sign in with your new password.');
  });

  /**
   * Resend verification email
   * POST /api/v1/auth/resend-verification
   */
  resendVerification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    controllerLogger.debug('Resend verification request', { email });

    await this.authService.resendVerificationEmail(email);

    sendSuccess(res, null, 'Verification email has been resent. Please check your inbox.');
  });

  /**
   * User logout
   * POST /api/v1/auth/logout
   * Clears device token and logs out user
   */
  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    controllerLogger.info('User logout request');

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        // Verify and decode the token to get userId
        const { verifyAccessToken } = await import('@utils/jwt');
        const decoded = verifyAccessToken(token);
        
        if (decoded && decoded.userId) {
          // Clear device token and type for this user
          await this.authService.clearDeviceToken(decoded.userId);
          controllerLogger.info('Device token cleared for user', { userId: decoded.userId });
        }
      } catch (error) {
        // Token might be expired, but still process logout
        controllerLogger.warn('Could not verify token during logout', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    sendSuccess(res, null, 'Logged out successfully');
  });
}

export default AuthController;

