/**
 * User Repository
 * 
 * Data access layer for User entities.
 * Extends BaseRepository with user-specific query methods.
 */

import { injectable } from 'tsyringe';
import { FilterQuery } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import User, { UserDocument } from '@domain/models/user.model';
import { 
  IUser, 
  ICreateUser, 
  IUpdateUser, 
  IUserQuery 
} from '@domain/interfaces/user.interface';
import { UserStatus, UserRole } from '@domain/enums/user-status.enum';

/**
 * User Repository
 * Handles all database operations for Users
 */
@injectable()
export class UserRepository extends BaseRepository<IUser, UserDocument> {
  constructor() {
    super(User);
  }

  /**
   * Create a new user
   */
  async createUser(data: ICreateUser): Promise<UserDocument> {
    return this.create({
      ...data,
      role: data.role || UserRole.USER,
      status: UserStatus.PENDING,
    } as Partial<UserDocument>);
  }

  /**
   * Find user by email (includes password for authentication)
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return User.findByEmail(email);
  }

  /**
   * Find user by email (without password)
   */
  async findByEmailSafe(email: string): Promise<UserDocument | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Find users with search and filters
   */
  
  async findUsers(query: IUserQuery): Promise<PaginatedResult<UserDocument>> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      role,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build filter
    const filter: FilterQuery<IUser> = {};

    if (status) {
      filter.status = status;
    }

    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const paginationOptions: PaginationOptions = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    return this.findPaginated(filter, paginationOptions);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: IUpdateUser): Promise<UserDocument | null> {
    return this.updateById(userId, { $set: data });
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<UserDocument | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    user.password = newPassword; // Will be hashed by pre-save hook
    return user.save();
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<UserDocument | null> {
    return this.updateById(userId, {
      $set: {
        emailVerifiedAt: new Date(),
        status: UserStatus.ACTIVE,
      },
    });
  }

  /**
   * Increment user statistics
   */
  async incrementUserStats(userId: string, stats: { problemsSolved?: number; totalMinutesLearned?: number; totalTopicsCompleted?: number }): Promise<void> {
    const update: any = { $inc: {} };
    if (stats.problemsSolved) update.$inc.problemsSolved = stats.problemsSolved;
    if (stats.totalMinutesLearned) update.$inc.totalMinutesLearned = stats.totalMinutesLearned;
    if (stats.totalTopicsCompleted) update.$inc.totalTopicsCompleted = stats.totalTopicsCompleted;

    if (Object.keys(update.$inc).length > 0) {
      await this.updateById(userId, update);
    }
  }

  /**
   * Update last login timestamp only
   */
  async updateLastLoginAt(userId: string, lastLoginAt: Date = new Date()): Promise<void> {
    await this.updateById(userId, {
      $set: { lastLoginAt },
    });
  }

  /**
   * Suspend user account
   */
  async suspendUser(userId: string): Promise<UserDocument | null> {
    return this.updateById(userId, {
      $set: { status: UserStatus.SUSPENDED },
    });
  }

  /**
   * Activate user account
   */
  async activateUser(userId: string): Promise<UserDocument | null> {
    return this.updateById(userId, {
      $set: { status: UserStatus.ACTIVE },
    });
  }

  /**
   * Check if email is already registered
   */
  async isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
    const filter: FilterQuery<IUser> = { email: email.toLowerCase() };
    
    if (excludeUserId) {
      filter._id = { $ne: excludeUserId };
    }

    return this.exists(filter);
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<UserStatus, number>;
    byRole: Record<UserRole, number>;
  }> {
    const [total, byStatusResult, byRoleResult] = await Promise.all([
      this.count(),
      this.aggregate<{ _id: UserStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.aggregate<{ _id: UserRole; count: number }>([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

    const byStatus = Object.values(UserStatus).reduce((acc, status) => {
      const found = byStatusResult.find((r) => r._id === status);
      acc[status] = found?.count || 0;
      return acc;
    }, {} as Record<UserStatus, number>);

    const byRole = Object.values(UserRole).reduce((acc, role) => {
      const found = byRoleResult.find((r) => r._id === role);
      acc[role] = found?.count || 0;
      return acc;
    }, {} as Record<UserRole, number>);

    return { total, byStatus, byRole };
  }

  /**
   * Find recently registered users
   */
  async findRecentlyRegistered(limit: number = 10): Promise<UserDocument[]> {
    return this.model
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Find users by IDs
   */
  async findByIds(ids: string[]): Promise<UserDocument[]> {
    return this.findAll({ _id: { $in: ids } });
  }

  /**
   * Soft delete user (change status to inactive)
   */
  async softDelete(userId: string): Promise<UserDocument | null> {
    return this.updateById(userId, {
      $set: { status: UserStatus.INACTIVE },
    });
  }
}

export default UserRepository;
