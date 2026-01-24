/**
 * Streak Model
 *
 * Stores daily streak information per user.
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import { IStreak } from '@domain/interfaces/streak.interface';

export type StreakDocument = HydratedDocument<IStreak>;

interface IStreakModel extends Model<IStreak> { }

const StreakSchema = new Schema<IStreak, IStreakModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    currentStreak: { type: Number, required: true, default: 0, min: 0 },
    longestStreak: { type: Number, required: true, default: 0, min: 0 },
    lastStreakDate: { type: Date },
    lastPopupDate: { type: Date },
  },
  { timestamps: true }
);

export const Streak = mongoose.model<IStreak, IStreakModel>('Streak', StreakSchema);
