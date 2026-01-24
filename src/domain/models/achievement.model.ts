/**
 * Achievement Mongoose Model
 * 
 * Defines the Achievement schema for streak-based achievements
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import { IAchievement, AchievementType } from '@domain/interfaces/achievement.interface';

/**
 * Achievement document type
 */
export type AchievementDocument = HydratedDocument<IAchievement>;

/**
 * Achievement model type
 */
interface IAchievementModel extends Model<IAchievement> {}

/**
 * Achievement Schema Definition
 */
const achievementSchema = new Schema<IAchievement, IAchievementModel>(
  {
    type: {
      type: String,
      enum: Object.values(AchievementType),
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    requiredStreak: {
      type: Number,
      required: true,
      min: 1,
    },
    xpReward: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Export Model
 */
export const Achievement = mongoose.model<IAchievement, IAchievementModel>('Achievement', achievementSchema);

export default Achievement;

