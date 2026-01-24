/**
 * User Validation Schemas
 * 
 * Zod validation schemas for user-related operations
 * Provides comprehensive validation for registration, login, updates, and social auth
 */

import { z } from 'zod';
import { UserStatus, UserRole, DeviceType, SocialLoginProvider, LearnLevel, Theme } from '@domain/enums/user-status.enum';

// ============================================================
// Reusable Field Validators
// ============================================================

const emailValidator = z
    .string({ required_error: 'Email is required' })
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim();

const passwordValidator = z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters');

const firstNameValidator = z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters');

const lastNameValidator = z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters');

const deviceTokenValidator = z
    .string()
    .trim()
    .max(500, 'Device token is too long')
    .optional();

const deviceTypeValidator = z
    .enum([DeviceType.ANDROID, DeviceType.IOS, DeviceType.WEB], {
        errorMap: () => ({ message: 'Device type must be one of: android, ios, web' }),
    })
    .optional();

// ============================================================
// User Registration Validation (Email/Password)
// ============================================================

export const registerUserSchema = z.object({
    email: emailValidator,
    password: passwordValidator,
    firstName: firstNameValidator,
    lastName: lastNameValidator,
    role: z
        .enum([UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN], {
            errorMap: () => ({ message: 'Role must be one of: user, admin, super_admin' }),
        })
        .optional()
        .default(UserRole.USER),
    deviceToken: deviceTokenValidator,
    deviceType: deviceTypeValidator,
    profileImage: z.string().url('Invalid profile image URL').optional(),
    socialLoginProvider: z
        .literal(SocialLoginProvider.EMAIL)
        .optional()
        .default(SocialLoginProvider.EMAIL),
    learnLevel: z.enum([LearnLevel.PRIMARY, LearnLevel.SECONDARY, LearnLevel.COLLEGE]).optional(),
});

// ============================================================
// Social Login Registration Validation
// ============================================================

export const registerSocialUserSchema = z.object({
    email: emailValidator,
    firstName: firstNameValidator,
    lastName: lastNameValidator,
    socialLoginProvider: z.enum(
        [SocialLoginProvider.GOOGLE, SocialLoginProvider.APPLE, SocialLoginProvider.FACEBOOK],
        {
            errorMap: (issue, ctx) => {
                if (issue.code === 'invalid_type' && ctx.data === undefined) {
                    return { message: 'Social login provider is required' };
                }
                return { message: 'Social login provider must be one of: google, apple, facebook' };
            },
        }
    ),
    socialLoginId: z
        .string({ required_error: 'Social login ID is required' })
        .trim()
        .min(1, 'Social login ID is required'),
    role: z
        .enum([UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN])
        .optional()
        .default(UserRole.USER),
    deviceToken: deviceTokenValidator,
    deviceType: deviceTypeValidator,
    profileImage: z.string().url('Invalid profile image URL').optional(),
    // Password is optional for social login (will be auto-generated)
    password: z.string().optional(),
    learnLevel: z.enum([LearnLevel.PRIMARY, LearnLevel.SECONDARY, LearnLevel.COLLEGE]).optional(),
});

// ============================================================
// User Login Validation
// ============================================================

export const loginSchema = z.object({
    email: emailValidator,
    password: passwordValidator,
    deviceToken: deviceTokenValidator,
    deviceType: deviceTypeValidator,
});

// ============================================================
// User Update Validation
// ============================================================

export const updateUserSchema = z
    .object({
        firstName: z
            .string()
            .trim()
            .min(1, 'First name cannot be empty')
            .max(50, 'First name cannot exceed 50 characters')
            .optional(),
        lastName: z
            .string()
            .trim()
            .min(1, 'Last name cannot be empty')
            .max(50, 'Last name cannot exceed 50 characters')
            .optional(),
        profileImage: z.string().url('Invalid profile image URL').optional(),
        status: z
            .enum([UserStatus.PENDING, UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.INACTIVE], {
                errorMap: () => ({
                    message: 'Status must be one of: pending, active, suspended, inactive',
                }),
            })
            .optional(),
        role: z
            .enum([UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN], {
                errorMap: () => ({ message: 'Role must be one of: user, admin, super_admin' }),
            })
            .optional(),
        deviceToken: deviceTokenValidator,
        deviceType: deviceTypeValidator,
        
        // Profile updates
        level: z.number().min(1).optional(),
        learnLevel: z.enum([LearnLevel.PRIMARY, LearnLevel.SECONDARY, LearnLevel.COLLEGE]).optional(),
        xpPoints: z.number().min(0).optional(),
        currentStreak: z.number().min(0).optional(),
        longestStreak: z.number().min(0).optional(),
        problemsSolved: z.number().min(0).optional(),
        totalMinutesLearned: z.number().min(0).optional(),
        accuracy: z.number().min(0).max(1).optional(),
        totalTopicsCompleted: z.number().min(0).optional(),
        
        // Settings updates
        languagePreference: z.string().optional(),
        theme: z.enum([Theme.LIGHT, Theme.DARK, Theme.SYSTEM]).optional(),
        notificationSettings: z.object({
            email: z.boolean().optional(),
            push: z.boolean().optional(),
            reminders: z.boolean().optional(),
            marketing: z.boolean().optional(),
        }).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field must be provided for update',
    });

// ============================================================
// Device Update Validation
// ============================================================

export const updateDeviceSchema = z.object({
    deviceToken: z
        .string({ required_error: 'Device token is required' })
        .trim()
        .min(1, 'Device token is required'),
    deviceType: z.enum([DeviceType.ANDROID, DeviceType.IOS, DeviceType.WEB], {
        errorMap: (issue, ctx) => {
            if (issue.code === 'invalid_type' && ctx.data === undefined) {
                return { message: 'Device type is required' };
            }
            return { message: 'Device type must be one of: android, ios, web' };
        },
    }),
});

// ============================================================
// Password Change Validation
// ============================================================

export const changePasswordSchema = z
    .object({
        currentPassword: z
            .string({ required_error: 'Current password is required' })
            .min(8, 'Password must be at least 8 characters'),
        newPassword: z
            .string({ required_error: 'New password is required' })
            .min(8, 'Password must be at least 8 characters')
            .max(128, 'Password cannot exceed 128 characters'),
        confirmPassword: z.string({ required_error: 'Password confirmation is required' }),
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
        message: 'New password must be different from current password',
        path: ['newPassword'],
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

// ============================================================
// Email Validation (for email verification, password reset)
// ============================================================

export const emailOnlySchema = z.object({
    email: emailValidator,
});

// ============================================================
// User Query Validation (for GET /users)
// ============================================================

export const userQuerySchema = z.object({
    page: z.string().optional().transform((val) => parseInt(val || '1', 10)),
    limit: z.string().optional().transform((val) => Math.min(parseInt(val || '20', 10), 100)),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    role: z.enum([UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN]).optional(),
    status: z.enum([UserStatus.PENDING, UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.INACTIVE]).optional(),
    search: z.string().optional(), // Search by name or email
});

// ============================================================
// Email Verification Validation
// ============================================================

export const verifyEmailTokenSchema = z.object({
    token: z
        .string({ required_error: 'Verification token is required' })
        .trim()
        .min(1, 'Verification token is required'),
});

// ============================================================
// Password Reset Validation
// ============================================================

export const forgotPasswordSchema = z.object({
    email: emailValidator,
});

export const resetPasswordSchema = z
    .object({
        token: z
            .string({ required_error: 'Reset token is required' })
            .trim()
            .min(1, 'Reset token is required'),
        newPassword: z
            .string({ required_error: 'New password is required' })
            .min(8, 'Password must be at least 8 characters')
            .max(128, 'Password cannot exceed 128 characters'),
        confirmPassword: z.string({ required_error: 'Password confirmation is required' }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

// ============================================================
// Type Exports
// ============================================================

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type RegisterSocialUserInput = z.infer<typeof registerSocialUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type VerifyEmailTokenInput = z.infer<typeof verifyEmailTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
