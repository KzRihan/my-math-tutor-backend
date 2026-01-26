/**
 * User Interface Definitions
 * 
 * Provides TypeScript interfaces for User domain objects
 * Separates database documents from DTOs
 */

import { Types } from 'mongoose';
import { UserStatus, UserRole, DeviceType, SocialLoginProvider, LearnLevel, Theme } from '@domain/enums/user-status.enum';

/**
 * Base user attributes (shared between entity and DTOs)
 */
export interface IUserBase {
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  role: UserRole;

  // Profile information
  profileImage?: string;
  level?: number;
  learnLevel?: LearnLevel;
  xpPoints: number;
  problemsSolved: number;
  totalMinutesLearned: number;
  accuracy: number;
  totalTopicsCompleted: number;
  weeklyGoal: number;

  // Preferences
  languagePreference: string;
  theme: Theme;
  notificationSettings: INotificationSettings;
}

/**
 * Notification Settings Interface
 */
export interface INotificationSettings {
  email: boolean;
  push: boolean;
  reminders: boolean;
  marketing: boolean;
}

/**
 * User document interface (for Mongoose)
 */
export interface IUser extends IUserBase {
  _id: Types.ObjectId;
  password: string;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;

  // Device tracking
  deviceToken?: string;
  deviceType?: DeviceType;

  // Social authentication
  socialLoginProvider: SocialLoginProvider;
  socialLoginId?: string; // Provider-specific user ID (e.g., Google ID, Apple ID)

  // Password reset tokens
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // Email verification tokens
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation input
 */
export interface ICreateUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;

  // Device information (optional)
  deviceToken?: string;
  deviceType?: DeviceType;

  profileImage?: string;

  // Social login information
  socialLoginProvider?: SocialLoginProvider;
  socialLoginId?: string;

  // Profile initial data
  learnLevel?: LearnLevel;
}

/**
 * User update input
 */
export interface IUpdateUser {
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  status?: UserStatus;
  role?: UserRole;

  // Device information updates
  deviceToken?: string;
  deviceType?: DeviceType;

  // Social login updates (for linking accounts)
  socialLoginProvider?: SocialLoginProvider;
  socialLoginId?: string;
  emailVerifiedAt?: Date;
  
  // Profile updates
  level?: number;
  learnLevel?: LearnLevel;
  weeklyGoal?: number;

  // Preferences
  languagePreference?: string;
  theme?: Theme;
  notificationSettings?: INotificationSettings;
}

/**
 * User response DTO (excludes sensitive fields)
 */
export interface IUserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: UserStatus;
  role: UserRole;
  emailVerified: boolean;
  lastLoginAt?: Date;
  profileImage?: string;

  // Device information
  deviceType?: DeviceType;

  // Social login information
  socialLoginProvider: SocialLoginProvider;

  // Profile information
  level?: number;
  learnLevel?: LearnLevel;
  xpPoints: number;
  problemsSolved: number;
  totalMinutesLearned: number;
  accuracy: number;
  totalTopicsCompleted: number;
  weeklyGoal: number;

  // Preferences
  languagePreference: string;
  theme: Theme;
  notificationSettings: INotificationSettings;

  createdAt: Date;
}

/**
 * User list query parameters
 */
export interface IUserQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  role?: UserRole;
  sortBy?: 'createdAt' | 'email' | 'firstName';
  sortOrder?: 'asc' | 'desc';
}

/**
 * User instance methods interface
 */
export interface IUserMethods {
  /** Compare password for authentication */
  comparePassword(candidatePassword: string): Promise<boolean>;

  /** Convert to DTO (excludes sensitive data) */
  toDTO(): IUserDTO;

  /** Get user's full name */
  getFullName(): string;

  /** Create password reset token (returns unhashed token) */
  createPasswordResetToken(): string;

  /** Create email verification token (returns unhashed token) */
  createEmailVerificationToken(): string;
}
