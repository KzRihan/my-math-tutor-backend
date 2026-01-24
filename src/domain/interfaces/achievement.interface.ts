/**
 * Achievement Interface Definitions
 * 
 * Provides TypeScript interfaces for Achievement domain objects
 */

import { Types } from 'mongoose';

/**
 * Achievement types based on streak milestones
 */
export enum AchievementType {
  FIRST_STEPS = 'first_steps',        // 3 days streak
  WEEK_WARRIOR = 'week_warrior',      // 7 days streak
  PROBLEM_SOLVER = 'problem_solver',  // 30 days streak
  MATH_MASTER = 'math_master',        // 90 days streak
}

/**
 * Achievement document interface
 */
export interface IAchievement {
  _id: Types.ObjectId;
  type: AchievementType;
  title: string;
  description: string;
  icon: string;
  requiredStreak: number; // Days required
  xpReward: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Achievement (junction table)
 */
export interface IUserAchievement {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  unlockedAt: Date;
  createdAt: Date;
}

/**
 * Achievement DTO
 */
export interface IAchievementDTO {
  id: string;
  type: AchievementType;
  title: string;
  description: string;
  icon: string;
  requiredStreak: number;
  xpReward: number;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number; // Progress percentage (0-1)
}

