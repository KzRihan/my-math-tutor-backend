/**
 * Achievement Service
 * 
 * Business logic layer for Achievement operations
 */

import { injectable, inject } from 'tsyringe';
import { AchievementRepository } from '@repositories/achievement.repository';
import { UserRepository } from '@repositories/user.repository';
import { IAchievementDTO, AchievementType } from '@domain/interfaces/achievement.interface';
import { createChildLogger } from '@utils/logger';

const achievementLogger = createChildLogger('achievement-service');

@injectable()
export class AchievementService {
  constructor(
    @inject(AchievementRepository) private achievementRepository: AchievementRepository,
    @inject(UserRepository) private userRepository: UserRepository
  ) {}

  /**
   * Get all achievements with user progress
   */
  async getUserAchievements(userId: string): Promise<IAchievementDTO[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentStreak = user.currentStreak || 0;
    return this.achievementRepository.getUserAchievementsWithProgress(userId, currentStreak);
  }

  /**
   * Check and unlock achievements based on current streak
   * Called when user's streak is updated
   */
  async checkAndUnlockAchievements(userId: string, currentStreak: number): Promise<IAchievementDTO[]> {
    achievementLogger.debug('Checking achievements for user', { userId, currentStreak });

    const allAchievements = await this.achievementRepository.getAllAchievements();
    const unlockedAchievements: IAchievementDTO[] = [];

    for (const achievement of allAchievements) {
      // Check if user has already unlocked this achievement
      const hasUnlocked = await this.achievementRepository.hasUnlockedAchievement(
        userId,
        achievement._id.toString()
      );

      // If not unlocked and streak requirement is met
      if (!hasUnlocked && currentStreak >= achievement.requiredStreak) {
        // Unlock the achievement
        await this.achievementRepository.unlockAchievement(
          userId,
          achievement._id.toString()
        );

        // Award XP to user
        await this.userRepository.updateById(userId, {
          $inc: { xpPoints: achievement.xpReward },
        });

        achievementLogger.info('Achievement unlocked', {
          userId,
          achievementType: achievement.type,
          xpReward: achievement.xpReward,
        });

        unlockedAchievements.push({
          id: achievement._id.toString(),
          type: achievement.type as AchievementType,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          requiredStreak: achievement.requiredStreak,
          xpReward: achievement.xpReward,
          unlocked: true,
          unlockedAt: new Date(),
          progress: 1,
        });
      }
    }

    return unlockedAchievements;
  }

  /**
   * Initialize default achievements (seed data)
   */
  async initializeAchievements(): Promise<void> {
    const achievements = [
      {
        type: AchievementType.FIRST_STEPS,
        title: 'First Steps',
        description: 'Complete a 3 day streak',
        icon: '🎯',
        requiredStreak: 3,
        xpReward: 50,
      },
      {
        type: AchievementType.WEEK_WARRIOR,
        title: 'Week Warrior',
        description: 'Complete a 7 day streak',
        icon: '🔥',
        requiredStreak: 7,
        xpReward: 100,
      },
      {
        type: AchievementType.PROBLEM_SOLVER,
        title: 'Problem Solver',
        description: 'Complete a 30 day streak',
        icon: '🧩',
        requiredStreak: 30,
        xpReward: 200,
      },
      {
        type: AchievementType.MATH_MASTER,
        title: 'Math Master',
        description: 'Complete a 90 day streak',
        icon: '🏆',
        requiredStreak: 90,
        xpReward: 500,
      },
    ];

    for (const achievementData of achievements) {
      const existing = await this.achievementRepository.getByType(achievementData.type);
      if (!existing) {
        await this.achievementRepository.create(achievementData);
        achievementLogger.info('Created achievement', { type: achievementData.type });
      }
    }
  }
}

