/**
 * Quiz Review Service
 * 
 * Handles admin review and approval of quiz question responses.
 * Allows admins to manually verify answers and award XP points.
 */

import { injectable, inject } from 'tsyringe';
import mongoose from 'mongoose';
import { QuestionResponseRepository } from '@repositories/question-response.repository';
import { UserRepository } from '@repositories/user.repository';
import { TopicRepository } from '@repositories/topic.repository';
import { XPCalculationService } from './xp-calculation.service';
import { createChildLogger } from '@utils/logger';
import { NotFoundError, BadRequestError } from '@utils/errors';

const logger = createChildLogger('quiz-review-service');

export interface IReviewQuizAnswer {
  responseId: string;
  isCorrect: boolean;
  correctAnswer?: string; // Admin can set the correct answer
  xpAwarded?: number; // Optional: if not provided, will calculate based on topic
  adminNotes?: string;
}

@injectable()
export class QuizReviewService {
  constructor(
    @inject(QuestionResponseRepository) private questionResponseRepository: QuestionResponseRepository,
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(TopicRepository) private topicRepository: TopicRepository,
    @inject(XPCalculationService) private xpCalculationService: XPCalculationService
  ) {}

  /**
   * Get all pending quiz responses for admin review
   */
  async getPendingQuizResponses(limit: number = 50, skip: number = 0) {
    const QuestionResponse = (this.questionResponseRepository as any).model;
    
    const [responses, total] = await Promise.all([
      QuestionResponse.find({
        questionType: 'quiz',
        reviewStatus: 'pending',
      })
        .populate('userId', 'firstName lastName email')
        .populate('topicId', 'title gradeBand difficulty')
        .sort({ answeredAt: 1 }) // Oldest first
        .limit(limit)
        .skip(skip)
        .lean()
        .exec(),
      QuestionResponse.countDocuments({
        questionType: 'quiz',
        reviewStatus: 'pending',
      }).exec(),
    ]);

    return {
      responses,
      total,
      limit,
      skip,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Get quiz responses by status (pending, approved, rejected)
   */
  async getQuizResponsesByStatus(
    status: 'pending' | 'approved' | 'rejected',
    limit: number = 50,
    skip: number = 0
  ) {
    const QuestionResponse = (this.questionResponseRepository as any).model;
    
    const [responses, total] = await Promise.all([
      QuestionResponse.find({
        questionType: 'quiz',
        reviewStatus: status,
      })
        .populate('userId', 'firstName lastName email')
        .populate('topicId', 'title gradeBand difficulty')
        .sort({ answeredAt: -1 }) // Newest first
        .limit(limit)
        .skip(skip)
        .lean()
        .exec(),
      QuestionResponse.countDocuments({
        questionType: 'quiz',
        reviewStatus: status,
      }).exec(),
    ]);

    return {
      responses,
      total,
      limit,
      skip,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Review and approve/reject a quiz answer
   */
  async reviewQuizAnswer(
    adminId: string,
    data: IReviewQuizAnswer
  ): Promise<{
    success: boolean;
    message: string;
    xpAwarded: number;
    userXP: number;
    userLevel: number;
  }> {
    // Get the response
    const response = await this.questionResponseRepository.findById(data.responseId);
    if (!response) {
      throw new NotFoundError(`Question response with ID ${data.responseId} not found`);
    }

    // Verify it's a quiz question
    if (response.questionType !== 'quiz') {
      throw new BadRequestError('This endpoint is only for reviewing quiz questions');
    }

    // Verify it's pending review
    if (response.reviewStatus !== 'pending') {
      throw new BadRequestError(`This response has already been reviewed. Status: ${response.reviewStatus}`);
    }

    // Get topic for XP calculation
    const topic = await this.topicRepository.findById(response.topicId.toString());
    if (!topic) {
      throw new NotFoundError(`Topic not found`);
    }

    // Calculate XP if not provided
    let xpAwarded = data.xpAwarded;
    if (xpAwarded === undefined && data.isCorrect) {
      xpAwarded = this.xpCalculationService.calculateXP(
        'quiz',
        topic.difficulty as 'easy' | 'medium' | 'hard',
        topic.gradeBand as 'primary' | 'secondary' | 'college'
      );
    } else if (!data.isCorrect) {
      xpAwarded = 0;
    }

    // Check if user already earned XP for this question
    const hasEarnedXP = await this.questionResponseRepository.hasUserAnsweredCorrectly(
      response.userId.toString(),
      response.topicId.toString(),
      response.lessonId,
      response.questionIndex,
      'quiz'
    );

    if (hasEarnedXP && data.isCorrect) {
      // User already earned XP for this question - don't award again
      xpAwarded = 0;
      logger.warn('User already earned XP for this quiz question', {
        userId: response.userId,
        topicId: response.topicId,
        lessonId: response.lessonId,
        questionIndex: response.questionIndex,
      });
    }

    // Update the response
    await this.questionResponseRepository.update(data.responseId, {
      isCorrect: data.isCorrect,
      xpAwarded: xpAwarded || 0,
      reviewStatus: data.isCorrect ? 'approved' : 'rejected',
      reviewedBy: new mongoose.Types.ObjectId(adminId),
      reviewedAt: new Date(),
      adminNotes: data.adminNotes,
      correctAnswer: data.correctAnswer || response.correctAnswer || '',
    });

    // Award XP to user if approved and XP > 0
    if (data.isCorrect && xpAwarded && xpAwarded > 0 && !hasEarnedXP) {
      await this.xpCalculationService.awardXP(response.userId.toString(), xpAwarded);
    }

    // Get updated user stats
    const user = await this.userRepository.findById(response.userId.toString());
    if (!user) {
      throw new NotFoundError(`User not found`);
    }

    logger.info('Quiz answer reviewed', {
      responseId: data.responseId,
      adminId,
      userId: response.userId,
      isCorrect: data.isCorrect,
      xpAwarded: xpAwarded || 0,
      reviewStatus: data.isCorrect ? 'approved' : 'rejected',
    });

    return {
      success: true,
      message: data.isCorrect
        ? `Answer approved! User earned ${xpAwarded || 0} XP.`
        : 'Answer rejected.',
      xpAwarded: xpAwarded || 0,
      userXP: user.xpPoints || 0,
      userLevel: user.level || 1,
    };
  }

  /**
   * Get quiz response statistics
   */
  async getQuizReviewStats() {
    const QuestionResponse = (this.questionResponseRepository as any).model;
    
    const stats = await QuestionResponse.aggregate([
      {
        $match: {
          questionType: 'quiz',
        },
      },
      {
        $group: {
          _id: '$reviewStatus',
          count: { $sum: 1 },
          totalXP: { $sum: '$xpAwarded' },
        },
      },
    ]);

    const result: {
      pending: number;
      approved: number;
      rejected: number;
      totalXP: number;
    } = {
      pending: 0,
      approved: 0,
      rejected: 0,
      totalXP: 0,
    };

    stats.forEach((stat: { _id: string | null; count: number; totalXP: number }) => {
      const status = stat._id || 'pending';
      result[status as keyof typeof result] = stat.count;
      if (status === 'approved') {
        result.totalXP = stat.totalXP || 0;
      }
    });

    return result;
  }
}

