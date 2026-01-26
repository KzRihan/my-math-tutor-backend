/**
 * Achievement Service
 * 
 * Business logic layer for Achievement operations
 */

import { injectable, inject } from 'tsyringe';
import { AchievementRepository } from '@repositories/achievement.repository';
import { UserRepository } from '@repositories/user.repository';
import { IAchievementDTO, AchievementMetric, AchievementType } from '@domain/interfaces/achievement.interface';
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

    const stats = {
      problemsSolved: user.problemsSolved || 0,
      totalMinutesLearned: user.totalMinutesLearned || 0,
      totalTopicsCompleted: user.totalTopicsCompleted || 0,
      xpPoints: user.xpPoints || 0,
    };

    return this.achievementRepository.getUserAchievementsWithProgress(userId, stats);
  }

  /**
   * Initialize default achievements (seed data)
   */
  async initializeAchievements(): Promise<void> {
    const achievements = [
      {
        type: AchievementType.FIRST_STEPS,
        title: 'First Steps',
        description: 'Solve your first problem',
        icon: '*',
        metric: AchievementMetric.PROBLEMS_SOLVED,
        requiredValue: 1,
        xpReward: 50,
      },
      {
        type: AchievementType.WEEK_WARRIOR,
        title: 'Week Warrior',
        description: 'Study for 120 minutes total',
        icon: 'W',
        metric: AchievementMetric.TOTAL_MINUTES,
        requiredValue: 120,
        xpReward: 100,
      },
      {
        type: AchievementType.PROBLEM_SOLVER,
        title: 'Problem Solver',
        description: 'Solve 100 problems',
        icon: 'P',
        metric: AchievementMetric.PROBLEMS_SOLVED,
        requiredValue: 100,
        xpReward: 200,
      },
      {
        type: AchievementType.MATH_MASTER,
        title: 'Math Master',
        description: 'Complete 5 topics',
        icon: 'M',
        metric: AchievementMetric.TOPICS_COMPLETED,
        requiredValue: 5,
        xpReward: 500,
      },
    ];

    for (const achievementData of achievements) {
      const existing = await this.achievementRepository.getByType(achievementData.type);
      if (!existing) {
        await this.achievementRepository.create(achievementData);
        achievementLogger.info('Created achievement', { type: achievementData.type });
        continue;
      }

      await this.achievementRepository.updateById(existing._id.toString(), {
        $set: {
          title: achievementData.title,
          description: achievementData.description,
          icon: achievementData.icon,
          metric: achievementData.metric,
          requiredValue: achievementData.requiredValue,
          xpReward: achievementData.xpReward,
        },
      });
    }
  }
}

export default AchievementService;
