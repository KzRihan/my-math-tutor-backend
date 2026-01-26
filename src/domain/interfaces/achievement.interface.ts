/**
 * Achievement Interface Definitions
 * 
 * Provides TypeScript interfaces for Achievement domain objects
 */

import { Types } from 'mongoose';

/**
 * Achievement types
 */
export enum AchievementType {
  FIRST_STEPS = 'first_steps',
  WEEK_WARRIOR = 'week_warrior',
  PROBLEM_SOLVER = 'problem_solver',
  MATH_MASTER = 'math_master',
}

/**
 * Achievement metrics
 */
export enum AchievementMetric {
  PROBLEMS_SOLVED = 'problems_solved',
  TOTAL_MINUTES = 'total_minutes',
  TOPICS_COMPLETED = 'topics_completed',
  XP_POINTS = 'xp_points',
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
  metric: AchievementMetric;
  requiredValue: number;
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
  metric: AchievementMetric;
  requiredValue: number;
  xpReward: number;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number; // Progress percentage (0-1)
}

