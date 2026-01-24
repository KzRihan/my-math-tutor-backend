/**
 * User Mongoose Model
 * 
 * Defines the User schema with:
 * - Field validation
 * - Pre/post hooks for password hashing
 * - Instance methods for password comparison
 * - Virtual fields
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import crypto from 'crypto';
import { IUser, IUserMethods, IUserDTO } from '@domain/interfaces/user.interface';
import { UserStatus, UserRole, DeviceType, SocialLoginProvider, LearnLevel, Theme } from '@domain/enums/user-status.enum';

/**
 * User document type with methods
 */
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

/**
 * User model type with statics
 */
interface IUserModel extends Model<IUser, object, IUserMethods> {
    findByEmail(email: string): Promise<UserDocument | null>;
}

/**
 * User Schema Definition
 */
const userSchema = new Schema<IUser, IUserModel, IUserMethods>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            select: false, // Don't include in queries by default
        },

        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        profileImage: {
            type: String,
            default: null,
        },

        status: {
            type: String,
            enum: Object.values(UserStatus),
            default: UserStatus.PENDING,
            index: true,
        },

        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.USER,
            index: true,
        },

        emailVerifiedAt: {
            type: Date,
            default: null,
        },

        lastLoginAt: {
            type: Date,
            default: null,
        },

        // ============================================================
        // Device Tracking
        // ============================================================

        deviceToken: {
            type: String,
            default: null,
            trim: true,
        },

        deviceType: {
            type: String,
            enum: Object.values(DeviceType),
            default: null,
            index: true,
        },

        // ============================================================
        // Social Authentication
        // ============================================================

        socialLoginProvider: {
            type: String,
            enum: Object.values(SocialLoginProvider),
            default: SocialLoginProvider.EMAIL,
            required: true,
            index: true,
        },

        socialLoginId: {
            type: String,
            default: null,
            trim: true,
            sparse: true,
            index: true,
        },

        // ============================================================
        // Password Reset Tokens
        // ============================================================

        passwordResetToken: {
            type: String,
            default: null,
            index: true,
            sparse: true,
        },

        passwordResetExpires: {
            type: Date,
            default: null,
        },

        // ============================================================
        // Email Verification Tokens
        // ============================================================

        emailVerificationToken: {
            type: String,
            default: null,
            index: true,
            sparse: true,
        },

        emailVerificationExpires: {
            type: Date,
            default: null,
        },

        // ============================================================
        // Profile & Progress
        // ============================================================

        level: {
            type: Number
        },

        learnLevel: {
            type: String,
            enum: Object.values(LearnLevel)
        },

        xpPoints: {
            type: Number,
            default: 0,
            min: 0,
        },

        currentStreak: {
            type: Number,
            default: 0,
            min: 0,
        },

        longestStreak: {
            type: Number,
            default: 0,
            min: 0,
        },

        problemsSolved: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalMinutesLearned: {
            type: Number,
            default: 0,
            min: 0,
        },

        accuracy: {
            type: Number,
            default: 0,
            min: 0,
            max: 1,
        },

        totalTopicsCompleted: {
            type: Number,
            default: 0,
            min: 0,
        },

        weeklyGoal: {
            type: Number,
            default: 120, // Default 120 minutes per week
            min: 0,
        },

        isStreakPopupDisplayed: {
            type: Boolean,
            default: false,
        },

        streakPopupDisplayedDate: {
            type: Date,
            default: null,
        },

        // ============================================================
        // Preferences & Settings
        // ============================================================

        languagePreference: {
            type: String,
            default: 'en',
        },

        theme: {
            type: String,
            enum: Object.values(Theme),
            default: Theme.SYSTEM,
        },

        notificationSettings: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            reminders: { type: Boolean, default: true },
            marketing: { type: Boolean, default: false },
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// ============================================================
// Indexes
// ============================================================

// Note: email index is automatically created by unique: true in schema definition
userSchema.index({ status: 1, role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

// Compound index for social login lookups
// Only enforce uniqueness when socialLoginId is not null (for actual social login users)
userSchema.index(
    { socialLoginProvider: 1, socialLoginId: 1 },
    {
        unique: true,
        partialFilterExpression: { socialLoginId: { $type: 'string' } }
    }
);

// Device-specific indexes for analytics and targeting
userSchema.index({ deviceType: 1, status: 1 });
userSchema.index({ deviceToken: 1 }, { sparse: true });

// ============================================================
// Virtual Fields
// ============================================================

userSchema.virtual('fullName').get(function (this: UserDocument) {
    return `${this.firstName} ${this.lastName}`;
});

// ============================================================
// Pre-save Hooks
// ============================================================

/**
 * Hash password before saving
 * Only applies to email/password authentication
 */
userSchema.pre('save', async function (next) {
    // Skip password hashing for social login users
    if (this.socialLoginProvider !== SocialLoginProvider.EMAIL) {
        return next();
    }

    // Only hash if password is modified
    if (!this.isModified('password')) {
        return next();
    }

    try {
        // Use crypto for password hashing (in production, use bcrypt or argon2)
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto
            .pbkdf2Sync(this.password, salt, 100000, 64, 'sha512')
            .toString('hex');

        this.password = `${salt}:${hash}`;
        next();
    } catch (error) {
        next(error as Error);
    }
});

// ============================================================
// Instance Methods
// ============================================================

/**
 * Compare password for authentication
 */
userSchema.methods.comparePassword = async function (
    this: UserDocument,
    candidatePassword: string
): Promise<boolean> {
    const [salt, storedHash] = this.password.split(':');

    if (!salt || !storedHash) {
        return false;
    }

    const hash = crypto
        .pbkdf2Sync(candidatePassword, salt, 100000, 64, 'sha512')
        .toString('hex');

    return storedHash === hash;
};

/**
 * Convert to DTO (safe for API responses)
 */
userSchema.methods.toDTO = function (this: UserDocument): IUserDTO {
    return {
        id: this._id.toString(),
        email: this.email,
        firstName: this.firstName,
        lastName: this.lastName,
        fullName: this.getFullName(),
        status: this.status,
        role: this.role,
        emailVerified: this.emailVerifiedAt !== null && this.emailVerifiedAt !== undefined,
        lastLoginAt: this.lastLoginAt,
        profileImage: this.profileImage,
        deviceType: this.deviceType,
        socialLoginProvider: this.socialLoginProvider,
        level: this.level,
        learnLevel: this.learnLevel,
        xpPoints: this.xpPoints,
        currentStreak: this.currentStreak,
        longestStreak: this.longestStreak,
        problemsSolved: this.problemsSolved,
        totalMinutesLearned: this.totalMinutesLearned,
        accuracy: this.accuracy,
        totalTopicsCompleted: this.totalTopicsCompleted,
        weeklyGoal: this.weeklyGoal,
        isStreakPopupDisplayed: this.isStreakPopupDisplayed,
        streakPopupDisplayedDate: this.streakPopupDisplayedDate,
        languagePreference: this.languagePreference,
        theme: this.theme,
        notificationSettings: this.notificationSettings,
        createdAt: this.createdAt,
    };
}

/**
 * Get user's full name
 */
userSchema.methods.getFullName = function (this: UserDocument): string {
    return `${this.firstName} ${this.lastName}`;
};

/**
 * Create password reset token
 * Generates a secure token and sets expiration (1 hour)
 */
userSchema.methods.createPasswordResetToken = function (this: UserDocument): string {
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token before storing in database
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expiration to 1 hour from now
    this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);

    // Return unhashed token to send via email
    return resetToken;
};

/**
 * Create email verification token
 * Generates a secure token and sets expiration (24 hours)
 */
userSchema.methods.createEmailVerificationToken = function (this: UserDocument): string {
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Hash token before storing in database
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    // Set expiration to 24 hours from now
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Return unhashed token to send via email
    return verificationToken;
};

// ============================================================
// Static Methods
// ============================================================

/**
 * Find user by email
 */
userSchema.statics.findByEmail = async function (
    email: string
): Promise<UserDocument | null> {
    const result = await this.findOne({ email: email.toLowerCase() }).select('+password');
    return result as unknown as UserDocument | null;
};

// ============================================================
// Export Model
// ============================================================

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;
