/**
 * User Achievement Mongoose Model
 * 
 * Junction table for user achievements (many-to-many relationship)
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import { IUserAchievement } from '@domain/interfaces/achievement.interface';

/**
 * User Achievement document type
 */
export type UserAchievementDocument = HydratedDocument<IUserAchievement>;

/**
 * User Achievement model type
 */
interface IUserAchievementModel extends Model<IUserAchievement> {}

/**
 * User Achievement Schema Definition
 */
const userAchievementSchema = new Schema<IUserAchievement, IUserAchievementModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    achievementId: {
      type: Schema.Types.ObjectId,
      ref: 'Achievement',
      required: true,
      index: true,
    },
    unlockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Create indexes
 */
userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
userAchievementSchema.index({ userId: 1 });

/**
 * Export Model
 */
export const UserAchievement = mongoose.model<IUserAchievement, IUserAchievementModel>('UserAchievement', userAchievementSchema);

export default UserAchievement;

