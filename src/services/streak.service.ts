/**
 * Streak Service
 *
 * Encapsulates streak calculation logic.
 */

import { injectable, inject } from 'tsyringe';
import mongoose from 'mongoose';
import { StreakRepository } from '@repositories/streak.repository';

export interface StreakUpdateResult {
  previousStreak: number;
  newStreak: number;
  streakIncreased: boolean;
  popupDisplayedToday: boolean;
  longestStreak: number;
  lastPopupDate?: Date;
}

@injectable()
export class StreakService {
  constructor(
    @inject(StreakRepository) private streakRepository: StreakRepository
  ) {}

  async updateStreak(userId: string): Promise<StreakUpdateResult> {
    const now = new Date();
    const streak = await this.streakRepository.findByUserId(userId);

    const previousStreak = streak?.currentStreak || 0;
    let currentStreak = previousStreak;
    let longestStreak = streak?.longestStreak || 0;

    const lastStreakDate = streak?.lastStreakDate;
    const isSameDay = lastStreakDate ? this.isSameDay(lastStreakDate, now) : false;
    const isYesterday = lastStreakDate ? this.isYesterday(lastStreakDate, now) : false;

    if (!lastStreakDate) {
      currentStreak = 1;
    } else if (isSameDay) {
      currentStreak = previousStreak;
    } else if (isYesterday) {
      currentStreak = previousStreak + 1;
    } else {
      currentStreak = 1;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    const popupDisplayedToday = streak?.lastPopupDate ? this.isSameDay(streak.lastPopupDate, now) : false;

    if (!streak) {
      await this.streakRepository.create({
        userId: new mongoose.Types.ObjectId(userId),
        currentStreak,
        longestStreak,
        lastStreakDate: now,
      });
    } else {
      await this.streakRepository.updateById(streak._id.toString(), {
        $set: {
          currentStreak,
          longestStreak,
          lastStreakDate: now,
        },
      });
    }

    return {
      previousStreak,
      newStreak: currentStreak,
      streakIncreased: currentStreak > previousStreak,
      popupDisplayedToday,
      longestStreak,
      lastPopupDate: streak?.lastPopupDate,
    };
  }

  async markPopupDisplayed(userId: string): Promise<void> {
    const now = new Date();
    const streak = await this.streakRepository.findByUserId(userId);

    if (!streak) {
      await this.streakRepository.create({
        userId: new mongoose.Types.ObjectId(userId),
        currentStreak: 0,
        longestStreak: 0,
        lastPopupDate: now,
      });
      return;
    }

    await this.streakRepository.updateById(streak._id.toString(), {
      $set: {
        lastPopupDate: now,
      },
    });
  }

  async getStreakByUserId(userId: string): Promise<{ currentStreak: number; longestStreak: number; lastPopupDate?: Date }> {
    const streak = await this.streakRepository.findByUserId(userId);
    return {
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      lastPopupDate: streak?.lastPopupDate,
    };
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.toDateString() === b.toDateString();
  }

  private isYesterday(date: Date, now: Date): boolean {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  }
}
