/**
 * Authentication Service
 * 
 * Business logic for authentication operations.
 * Handles signup, signin, email verification, and password reset.
 */

import { injectable, inject } from 'tsyringe';
import crypto from 'crypto';
import { Request } from 'express';
import { UserRepository } from '@repositories/user.repository';
import { EmailService } from '@services/email.service';
import { LoginActivityService } from '@services/login-activity.service';
import { SettingsService } from '@services/settings.service';
import { config } from '@config/index';
import {
  IUserDTO,
} from '@domain/interfaces/user.interface';
import {
  RegisterUserInput,
  LoginInput,
  VerifyEmailTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '@validations/user.validation';
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ValidationError,
  BadRequestError,
  ForbiddenError,
} from '@utils/errors';
import { createChildLogger } from '@utils/logger';
import { UserStatus, UserRole } from '@domain/enums/user-status.enum';
import { generateTokenPair, TokenPair } from '@utils/jwt';

const authLogger = createChildLogger('auth-service');

/**
 * Auth Response with tokens
 */
export interface AuthResponse {
  user: IUserDTO;
  tokens: TokenPair;
}

/**
 * Auth Service Interface
 */
export interface IAuthService {
  signup(data: RegisterUserInput): Promise<IUserDTO>;
  signin(data: LoginInput, req?: Request): Promise<AuthResponse>;
  adminSignin(data: LoginInput, req?: Request): Promise<AuthResponse>;
  verifyEmail(data: VerifyEmailTokenInput): Promise<IUserDTO>;
  requestPasswordReset(data: ForgotPasswordInput): Promise<void>;
  resetPassword(data: ResetPasswordInput): Promise<IUserDTO>;
  resendVerificationEmail(email: string): Promise<void>;
}

/**
 * Auth Service Implementation
 */
@injectable()
export class AuthService implements IAuthService {
  constructor(
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(EmailService) private emailService: EmailService,
    @inject(LoginActivityService) private loginActivityService: LoginActivityService,
    @inject(SettingsService) private settingsService: SettingsService
  ) { }

  /**
   * User signup (registration)
   */
  async signup(data: RegisterUserInput): Promise<IUserDTO> {
    authLogger.info('User signup initiated', { email: data.email });

    // Check if email already exists
    const existingUser = await this.userRepository.findByEmailSafe(data.email);

    if (existingUser) {
      // If the existing user has verified their email, reject the registration
      if (existingUser.emailVerifiedAt) {
        throw new ConflictError('Email is already registered');
      }

      // If the email is not verified, delete the old user and allow re-registration
      authLogger.info('Deleting unverified user for re-registration', {
        email: data.email,
        userId: existingUser._id
      });
      await this.userRepository.deleteById(existingUser._id.toString());
    }

    // Validate password strength
    this.validatePassword(data.password);

    // Create user with pending status (set by repository)
    const user = await this.userRepository.createUser(data);

    // Generate email verification token
    const verificationToken = user.createEmailVerificationToken();
    await user.save();

    const hasEmailConfig = Boolean(config.email.user && config.email.pass);

    if (hasEmailConfig) {
      // Send verification email
      const verifyLink = this.generateVerificationLink(verificationToken);
      await this.emailService.sendVerification(user.email, verifyLink);

      // Send welcome email
      await this.emailService.sendWelcome(user.email, user.getFullName());
    } else if (config.app.isDevelopment) {
      authLogger.warn('SMTP is not configured in development. Auto-verifying user.', {
        userId: user._id,
        email: user.email,
      });

      user.emailVerifiedAt = new Date();
      user.status = UserStatus.ACTIVE;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
    } else {
      throw new BadRequestError(
        'Email service is not configured. Please set SMTP_EMAIL/SMTP_USER and SMTP_PASSWORD/SMTP_PASS.'
      );
    }

    authLogger.info('User signup completed', { userId: user._id });

    return user.toDTO();
  }

  /**
   * User signin (login)
   */
  async signin(data: LoginInput, req?: Request): Promise<AuthResponse> {
    authLogger.info('User signin attempt', { email: data.email });

    // Check if maintenance mode is enabled
    const settings = await this.settingsService.getSystemSettings();
    if (settings.maintenanceMode) {
      authLogger.warn('User attempted signin during maintenance mode', { email: data.email });
      throw new ForbiddenError('🚧 System is currently under maintenance. Please try again later.');
    }

    const user = await this.userRepository.findByEmail(data.email);

    if (!user) {
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: '',
          email: data.email,
          success: false,
          failureReason: 'Invalid credentials',
        });
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if password is valid
    const isPasswordValid = await user.comparePassword(data.password);

    if (!isPasswordValid) {
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: user._id.toString(),
          email: data.email,
          success: false,
          failureReason: 'Invalid password',
        });
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: user._id.toString(),
          email: data.email,
          success: false,
          failureReason: 'Email not verified',
        });
      }
      throw new UnauthorizedError('Please verify your email before signing in');
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: user._id.toString(),
          email: data.email,
          success: false,
          failureReason: 'Account not active',
        });
      }
      throw new UnauthorizedError('Your account is not active. Please contact support.');
    }

    // Log successful login
    if (req) {
      await this.loginActivityService.logLoginAttempt(req, {
        userId: user._id.toString(),
        email: data.email,
        success: true,
      });
    }

    // Update last login timestamp and device info
    await this.userRepository.updateLastLoginAt(user._id.toString());

    if (data.deviceToken && data.deviceType) {
      await this.userRepository.updateProfile(user._id.toString(), {
        deviceToken: data.deviceToken,
        deviceType: data.deviceType,
      });
    }

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    authLogger.info('User signin successful', { userId: user._id });

    return {
      user: user.toDTO(),
      tokens,
    };
  }

  /**
   * Admin signin (login) - Only allows admin users
   */
  async adminSignin(data: LoginInput, req?: Request): Promise<AuthResponse> {
    authLogger.info('Admin signin attempt', { email: data.email });

    const user = await this.userRepository.findByEmail(data.email);

    if (!user) {
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: '',
          email: data.email,
          success: false,
          failureReason: 'Invalid credentials',
        });
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if password is valid
    const isPasswordValid = await user.comparePassword(data.password);

    if (!isPasswordValid) {
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: user._id.toString(),
          email: data.email,
          success: false,
          failureReason: 'Invalid password',
        });
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is an admin
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      authLogger.warn('Non-admin user attempted admin signin', { 
        userId: user._id, 
        role: user.role 
      });
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: user._id.toString(),
          email: data.email,
          success: false,
          failureReason: 'Not an admin',
        });
      }
      throw new ForbiddenError('Access denied. Admin privileges required.');
    }

    // Check if email is verified (optional for admins, but recommended)
    if (!user.emailVerifiedAt) {
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: user._id.toString(),
          email: data.email,
          success: false,
          failureReason: 'Email not verified',
        });
      }
      throw new UnauthorizedError('Please verify your email before signing in');
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      // Log failed attempt
      if (req) {
        await this.loginActivityService.logLoginAttempt(req, {
          userId: user._id.toString(),
          email: data.email,
          success: false,
          failureReason: 'Account not active',
        });
      }
      throw new UnauthorizedError('Your account is not active. Please contact support.');
    }

    // Log successful admin login
    if (req) {
      await this.loginActivityService.logLoginAttempt(req, {
        userId: user._id.toString(),
        email: data.email,
        success: true,
      });
    }

    // Update last login timestamp
    await this.userRepository.updateLastLoginAt(user._id.toString());

    if (data.deviceToken && data.deviceType) {
      await this.userRepository.updateProfile(user._id.toString(), {
        deviceToken: data.deviceToken,
        deviceType: data.deviceType,
      });
    }

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    authLogger.info('Admin signin successful', { userId: user._id, role: user.role });

    return {
      user: user.toDTO(),
      tokens,
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(data: VerifyEmailTokenInput): Promise<IUserDTO> {
    authLogger.info('Email verification attempt');

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(data.token)
      .digest('hex');

    // Find user by verification token
    const user = await this.userRepository.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    // Mark email as verified and activate user
    user.emailVerifiedAt = new Date();
    user.status = UserStatus.ACTIVE;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    authLogger.info('Email verified successfully', { userId: user._id });

    return user.toDTO();
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: ForgotPasswordInput): Promise<void> {
    authLogger.info('Password reset requested', { email: data.email });

    const user = await this.userRepository.findByEmailSafe(data.email);

    // Don't reveal if user exists (security best practice)
    if (!user) {
      authLogger.warn('Password reset for non-existent email', { email: data.email });
      return;
    }

    // Generate password reset token
    const resetToken = user.createPasswordResetToken();
    await user.save();

    // Send password reset email
    const resetLink = this.generatePasswordResetLink(resetToken);
    await this.emailService.sendPasswordReset(user.email, resetLink);

    authLogger.info('Password reset email sent', { userId: user._id });
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordInput): Promise<IUserDTO> {
    authLogger.info('Password reset attempt');

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(data.token)
      .digest('hex');

    // Find user by reset token
    const user = await this.userRepository.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Validate new password strength
    this.validatePassword(data.newPassword);

    // Update password
    user.password = data.newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    authLogger.info('Password reset successful', { userId: user._id });

    return user.toDTO();
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    authLogger.info('Resend verification email requested', { email });

    const user = await this.userRepository.findByEmailSafe(email);

    if (!user) {
      throw new NotFoundError('User');
    }

    // Check if already verified
    if (user.emailVerifiedAt) {
      throw new BadRequestError('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = user.createEmailVerificationToken();
    await user.save();

    // Send verification email
    const verifyLink = this.generateVerificationLink(verificationToken);
    await this.emailService.sendVerification(user.email, verifyLink);

    authLogger.info('Verification email resent', { userId: user._id });
  }

  /**
   * Clear device token on logout
   */
  async clearDeviceToken(userId: string): Promise<void> {
    authLogger.info('Clearing device token', { userId });

    await this.userRepository.updateProfile(userId, {
      deviceToken: undefined,
      deviceType: undefined,
    });

    authLogger.info('Device token cleared', { userId });
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================


  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (errors.length > 0) {
      throw new ValidationError('Password validation failed', {
        password: errors,
      });
    }
  }

  /**
   * Generate verification link
   */
  private generateVerificationLink(token: string): string {
    // In production, use frontend URL from config
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}/verify-email?token=${token}`;
  }

  /**
   * Generate password reset link
   */
  private generatePasswordResetLink(token: string): string {
    // In production, use frontend URL from config
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}/reset-password?token=${token}`;
  }
}

export default AuthService;
