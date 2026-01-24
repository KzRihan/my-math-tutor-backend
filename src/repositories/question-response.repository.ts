/**
 * Question Response Repository
 * 
 * Data access layer for QuestionResponse operations.
 */

import { injectable } from 'tsyringe';
import { BaseRepository } from './base.repository';
import {
  QuestionResponse,
  IQuestionResponse,
  IQuestionResponseModel,
} from '@domain/models/question-response.model';
import type { HydratedDocument } from 'mongoose';

export type QuestionResponseDocument = HydratedDocument<IQuestionResponse>;

@injectable()
export class QuestionResponseRepository extends BaseRepository<
  IQuestionResponse,
  QuestionResponseDocument
> {
  constructor() {
    super(QuestionResponse as any);
  }

  /**
   * Check if user has already answered a specific question correctly and earned XP
   */
  async hasUserAnsweredCorrectly(
    userId: string,
    topicId: string,
    lessonId: string,
    questionIndex: number,
    questionType: 'practice' | 'quiz'
  ): Promise<boolean> {
    const response = await (this.model as IQuestionResponseModel).hasUserAnsweredCorrectly(
      userId,
      topicId,
      lessonId,
      questionIndex,
      questionType
    );
    return response;
  }

  /**
   * Get all responses for a specific question (for tracking attempts)
   */
  async getUserQuestionResponses(
    userId: string,
    topicId: string,
    lessonId: string,
    questionIndex: number,
    questionType: 'practice' | 'quiz'
  ): Promise<QuestionResponseDocument[]> {
    return (this.model as IQuestionResponseModel).getUserQuestionResponses(
      userId,
      topicId,
      lessonId,
      questionIndex,
      questionType
    ) as Promise<QuestionResponseDocument[]>;
  }

  /**
   * Find user's most recent answer for a specific question
   */
  async findLatestUserAnswer(
    userId: string,
    topicId: string,
    lessonId: string,
    questionIndex: number,
    questionType: 'practice' | 'quiz'
  ): Promise<QuestionResponseDocument | null> {
    return (this.model as any)
      .findOne({
        userId,
        topicId,
        lessonId,
        questionIndex,
        questionType,
      })
      .sort({ answeredAt: -1 }); // Get most recent
  }

  /**
   * Get user's correct answers for a lesson
   */
  async getUserCorrectAnswers(
    userId: string,
    topicId: string,
    lessonId: string
  ): Promise<QuestionResponseDocument[]> {
    return (this.model as IQuestionResponseModel).getUserCorrectAnswers(
      userId,
      topicId,
      lessonId
    ) as Promise<QuestionResponseDocument[]>;
  }

  /**
   * Get total XP earned by user for a specific lesson
   */
  async getLessonXP(userId: string, topicId: string, lessonId: string): Promise<number> {
    return (this.model as IQuestionResponseModel).getLessonXP(
      userId,
      topicId,
      lessonId
    );
  }

  /**
   * Get all responses for a lesson
   */
  async findByLesson(
    userId: string,
    topicId: string,
    lessonId: string
  ): Promise<QuestionResponseDocument[]> {
    return (this.model as any).find({
      userId,
      topicId,
      lessonId,
    }).sort({ answeredAt: 1 });
  }

  /**
   * Get user's question history
   */
  async getUserHistory(
    userId: string,
    limit: number = 50
  ): Promise<QuestionResponseDocument[]> {
    return (this.model as any)
      .find({ userId })
      .sort({ answeredAt: -1 })
      .limit(limit)
      .populate('topicId', 'title gradeBand difficulty');
  }

  /**
   * Get statistics for a topic
   */
  async getTopicStats(
    userId: string,
    topicId: string
  ): Promise<{
    totalQuestions: number;
    correctAnswers: number;
    totalXP: number;
    accuracy: number;
  }> {
    const responses = await (this.model as any).find({
      userId,
      topicId,
    });

    const totalQuestions = responses.length;
    const correctAnswers = responses.filter((r: any) => r.isCorrect).length;
    const totalXP = responses.reduce((sum: number, r: any) => sum + (r.xpAwarded || 0), 0);
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    return {
      totalQuestions,
      correctAnswers,
      totalXP,
      accuracy: Math.round(accuracy * 100) / 100,
    };
  }

  /**
   * Find responses with filter (for admin queries)
   */
  async find(filter: any): Promise<QuestionResponseDocument[]> {
    return (this.model as any).find(filter).exec();
  }

  /**
   * Count responses with filter
   */
  override async count(filter: any): Promise<number> {
    return (this.model as any).countDocuments(filter).exec();
  }

  /**
   * Update a response by ID
   */
  async update(id: string, data: Partial<IQuestionResponse>): Promise<QuestionResponseDocument | null> {
    return (this.model as any).findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }
}

