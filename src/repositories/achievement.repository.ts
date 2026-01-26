/**
 * Achievement Repository
 * 
 * Data access layer for Achievement operations
 */

import { injectable } from 'tsyringe';
import { BaseRepository } from './base.repository';
import { Achievement, AchievementDocument } from '@domain/models/achievement.model';
import { UserAchievement, UserAchievementDocument } from '@domain/models/user-achievement.model';
import { IAchievement, IAchievementDTO, AchievementMetric, AchievementType } from '@domain/interfaces/achievement.interface';

@injectable()
export class AchievementRepository extends BaseRepository<IAchievement, AchievementDocument> {
  constructor() {
    super(Achievement);
  }

  /**
   * Get all achievements
   */
  async getAllAchievements(): Promise<AchievementDocument[]> {
    return this.model.find().sort({ requiredValue: 1 }).exec();
  }

  /**
   * Get achievement by type
   */
  async getByType(type: AchievementType): Promise<AchievementDocument | null> {
    return this.model.findOne({ type }).exec();
  }

  /**
   * Get user's unlocked achievements
   */
  async getUserAchievements(userId: string): Promise<UserAchievementDocument[]> {
    return UserAchievement.find({ userId })
      .populate('achievementId')
      .sort({ unlockedAt: -1 })
      .exec();
  }

  /**
   * Check if user has unlocked an achievement
   */
  async hasUnlockedAchievement(userId: string, achievementId: string): Promise<boolean> {
    const userAchievement = await UserAchievement.findOne({
      userId,
      achievementId,
    }).exec();
    return !!userAchievement;
  }

  /**
   * Unlock achievement for user
   */
  async unlockAchievement(userId: string, achievementId: string): Promise<UserAchievementDocument> {
    // Check if already unlocked
    const existing = await UserAchievement.findOne({
      userId,
      achievementId,
    }).exec();

    if (existing) {
      return existing;
    }

    // Create new user achievement
    const userAchievement = new UserAchievement({
      userId,
      achievementId,
      unlockedAt: new Date(),
    });

    return userAchievement.save();
  }

  /**
   * Get user achievements with progress
   */
  async getUserAchievementsWithProgress(
    userId: string,
    stats: { problemsSolved: number; totalMinutesLearned: number; totalTopicsCompleted: number; xpPoints: number }
  ): Promise<IAchievementDTO[]> {
    const allAchievements = await this.getAllAchievements();
    const userAchievements = await this.getUserAchievements(userId);

    const unlockedAchievementIds = new Set(
      userAchievements.map(ua => ua.achievementId.toString())
    );

    return allAchievements.map(achievement => {
      const value = this.getMetricValue(achievement.metric as AchievementMetric, stats);
      const requiredValue = achievement.requiredValue || 1;
      const progress = Math.min(value / requiredValue, 1);
      const isUnlocked = progress >= 1 || unlockedAchievementIds.has(achievement._id.toString());

      const userAchievement = userAchievements.find(
        ua => ua.achievementId.toString() === achievement._id.toString()
      );

      return {
        id: achievement._id.toString(),
        type: achievement.type as AchievementType,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        metric: achievement.metric as AchievementMetric,
        requiredValue: achievement.requiredValue,
        xpReward: achievement.xpReward,
        unlocked: isUnlocked,
        unlockedAt: userAchievement?.unlockedAt,
        progress: isUnlocked ? 1 : progress,
      };
    });
  }

  private getMetricValue(
    metric: AchievementMetric,
    stats: { problemsSolved: number; totalMinutesLearned: number; totalTopicsCompleted: number; xpPoints: number }
  ): number {
    switch (metric) {
      case AchievementMetric.PROBLEMS_SOLVED:
        return stats.problemsSolved;
      case AchievementMetric.TOTAL_MINUTES:
        return stats.totalMinutesLearned;
      case AchievementMetric.TOPICS_COMPLETED:
        return stats.totalTopicsCompleted;
      case AchievementMetric.XP_POINTS:
        return stats.xpPoints;
      default:
        return 0;
    }
  }

  /**
   * Create achievement (for seeding)
   */
  override async create(data: Partial<IAchievement>): Promise<AchievementDocument> {
    const achievement = new this.model(data);
    return achievement.save();
  }
}

