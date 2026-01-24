/**
 * User Service
 * 
 * Business logic layer for User operations.
 * Orchestrates between repositories and external services.
 */

import { injectable, inject } from 'tsyringe';
import { UserRepository } from '@repositories/user.repository';
import { EmailService } from '@services/email.service';
import { AchievementService } from '@services/achievement.service';
import { StreakService } from '@services/streak.service';
import {
  ICreateUser,
  IUpdateUser,
  IUserDTO,
  IUserQuery,
} from '@domain/interfaces/user.interface';
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from '@utils/errors';
import { PaginatedResult } from '@repositories/base.repository';
import { createChildLogger } from '@utils/logger';

const userLogger = createChildLogger('user-service');

/**
 * User Service Interface
 */
export interface IUserService {
  createUser(data: ICreateUser): Promise<IUserDTO>;
  getUserById(id: string): Promise<IUserDTO>;
  getUsers(query: IUserQuery): Promise<PaginatedResult<IUserDTO>>;
  updateUser(id: string, data: IUpdateUser): Promise<IUserDTO>;
  deleteUser(id: string): Promise<void>;
  verifyEmail(userId: string): Promise<IUserDTO>;
}

/**
 * User Service Implementation
 */
@injectable()
export class UserService implements IUserService {
  constructor(
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(EmailService) private emailService: EmailService,
    @inject(AchievementService) private achievementService: AchievementService,
    @inject(StreakService) private streakService: StreakService
  ) { }

  /**
   * Create a new user
   */
  async createUser(data: ICreateUser): Promise<IUserDTO> {
    userLogger.info('Creating new user', { email: data.email });

    // Check if email already exists
    const emailTaken = await this.userRepository.isEmailTaken(data.email);
    if (emailTaken) {
      throw new ConflictError('Email is already registered');
    }

    // Validate password strength
    this.validatePassword(data.password);

    // Create user
    const user = await this.userRepository.createUser(data);

    // Queue welcome email
    await this.emailService.sendWelcome(
      user.email,
      user.getFullName()
    );

    // Queue verification email
    const verifyLink = this.generateVerificationLink(user._id.toString());
    await this.emailService.sendVerification(user.email, verifyLink);

    userLogger.info('User created successfully', { userId: user._id });

    return user.toDTO();
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<IUserDTO> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundError('User');
    }

    return user.toDTO();
  }

  /**
   * Get paginated list of users
   */
  async getUsers(query: IUserQuery): Promise<PaginatedResult<IUserDTO>> {
    const result = await this.userRepository.findUsers(query);

    return {
      ...result,
      data: result.data.map((user) => user.toDTO()),
    };
  }

  /**
   * Update user profile
   */
  async updateUser(id: string, data: IUpdateUser): Promise<IUserDTO> {
    userLogger.info('Updating user', { userId: id });

    const user = await this.userRepository.updateProfile(id, data);

    if (!user) {
      throw new NotFoundError('User');
    }

    userLogger.info('User updated successfully', { userId: id });

    return user.toDTO();
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: string): Promise<void> {
    userLogger.info('Deleting user', { userId: id });

    const user = await this.userRepository.softDelete(id);

    if (!user) {
      throw new NotFoundError('User');
    }

    userLogger.info('User deleted successfully', { userId: id });
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<IUserDTO> {
    userLogger.info('Verifying user email', { userId });

    const user = await this.userRepository.verifyEmail(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    userLogger.info('Email verified successfully', { userId });

    return user.toDTO();
  }

  /**
   * Authenticate user (login)
   */
  async authenticate(email: string, password: string): Promise<IUserDTO> {
    userLogger.info('Authenticating user', { email });

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login timestamp
    await this.userRepository.updateLastLoginAt(user._id.toString());

    userLogger.info('User authenticated successfully', { userId: user._id });

    return user.toDTO();
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    userLogger.info('Password reset requested', { email });

    const user = await this.userRepository.findByEmailSafe(email);

    // Don't reveal if user exists
    if (!user) {
      userLogger.warn('Password reset for non-existent email', { email });
      return;
    }

    const resetLink = this.generatePasswordResetLink(user._id.toString());
    await this.emailService.sendPasswordReset(user.email, resetLink);

    userLogger.info('Password reset email sent', { userId: user._id });
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byRole: Record<string, number>;
  }> {
    return this.userRepository.getStatistics();
  }

  /**
   * Update last login and streak
   * Returns streak change information
   * Also checks and unlocks achievements based on new streak
   */
  async updateLastLogin(userId: string): Promise<{ previousStreak: number; newStreak: number; streakIncreased: boolean; popupDisplayedToday: boolean; longestStreak: number }> {
    const streakInfo = await this.streakService.updateStreak(userId);

    await this.userRepository.updateLastLoginAt(userId);
    await this.userRepository.updateStreakFields(userId, {
      currentStreak: streakInfo.newStreak,
      longestStreak: streakInfo.longestStreak,
      isStreakPopupDisplayed: streakInfo.popupDisplayedToday,
      streakPopupDisplayedDate: streakInfo.lastPopupDate || null,
    });
    
    // Check and unlock achievements if streak increased
    if (streakInfo.streakIncreased && streakInfo.newStreak > 0 && this.achievementService) {
      try {
        await this.achievementService.checkAndUnlockAchievements(userId, streakInfo.newStreak);
      } catch (error) {
        userLogger.warn('Failed to check achievements', { userId, error });
        // Don't throw - achievement checking is not critical
      }
    }
    
    return streakInfo;
  }

  /**
   * Mark streak popup as displayed
   */
  async markStreakPopupDisplayed(userId: string): Promise<void> {
    await this.streakService.markPopupDisplayed(userId);
    const streak = await this.streakService.getStreakByUserId(userId);
    await this.userRepository.updateStreakFields(userId, {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      isStreakPopupDisplayed: true,
      streakPopupDisplayedDate: new Date(),
    });
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
   * In production, use JWT or secure token
   */
  private generateVerificationLink(userId: string): string {
    // In production, generate a secure token
    const token = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    return `http://localhost:3000/api/v1/users/verify-email?token=${token}`;
  }

  /**
   * Generate password reset link
   * In production, use JWT or secure token with expiry
   */
  private generatePasswordResetLink(userId: string): string {
    // In production, generate a secure token with expiry
    const token = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    return `http://localhost:3000/api/v1/auth/reset-password?token=${token}`;
  }
}

export default UserService;
