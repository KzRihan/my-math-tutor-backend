/**
 * Streak Interface Definitions
 *
 * Tracks user streaks separately from user profile data.
 */

import { Types } from 'mongoose';

/**
 * Streak document interface
 */
export interface IStreak {
  userId: Types.ObjectId;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate?: Date;
  lastPopupDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
