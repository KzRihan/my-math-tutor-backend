/**
 * XP Calculation Service
 * 
 * Handles XP point calculations and awards for practice questions.
 * Implements business logic for XP calculation based on difficulty, grade level, etc.
 */

import { injectable, inject } from 'tsyringe';
import mongoose from 'mongoose';
import { UserRepository } from '@repositories/user.repository';
import { TopicRepository } from '@repositories/topic.repository';
import { QuestionResponseRepository } from '@repositories/question-response.repository';
import { createChildLogger } from '@utils/logger';
import { NotFoundError } from '@utils/errors';

const xpLogger = createChildLogger('xp-calculation-service');

/**
 * XP Calculation Configuration
 */
const XP_CONFIG = {
  // Base XP per correct answer
  BASE_XP: {
    practice: 10,
    quiz: 15,
  },
  // Difficulty multipliers
  DIFFICULTY_MULTIPLIER: {
    easy: 1.0,
    medium: 1.5,
    hard: 2.0,
  },
  // Grade band multipliers (higher grades = more XP)
  GRADE_BAND_MULTIPLIER: {
    primary: 1.0,
    secondary: 1.2,
    college: 1.5,
  },
  // Starting XP for new users
  STARTING_XP: 0,
  // XP per level (level = floor(xpPoints / XP_PER_LEVEL) + 1)
  XP_PER_LEVEL: 500,
};

@injectable()
export class XPCalculationService {
  constructor(
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(TopicRepository) private topicRepository: TopicRepository,
    @inject(QuestionResponseRepository) private questionResponseRepository: QuestionResponseRepository
  ) {}

  /**
   * Calculate XP for a correct answer
   */
  calculateXP(
    questionType: 'practice' | 'quiz',
    topicDifficulty: 'easy' | 'medium' | 'hard' = 'medium',
    gradeBand: 'primary' | 'secondary' | 'college' = 'primary'
  ): number {
    const baseXP = XP_CONFIG.BASE_XP[questionType];
    const difficultyMultiplier = XP_CONFIG.DIFFICULTY_MULTIPLIER[topicDifficulty];
    const gradeMultiplier = XP_CONFIG.GRADE_BAND_MULTIPLIER[gradeBand];

    const calculatedXP = Math.round(baseXP * difficultyMultiplier * gradeMultiplier);

    xpLogger.debug('XP calculated', {
      questionType,
      topicDifficulty,
      gradeBand,
      baseXP,
      difficultyMultiplier,
      gradeMultiplier,
      calculatedXP,
    });

    return calculatedXP;
  }

  /**
   * Submit answer and award XP if correct
   */
  async submitAnswer(
    userId: string,
    data: {
      topicId: string;
      lessonId: string;
      questionIndex: number;
      questionType: 'practice' | 'quiz';
      userAnswer: string;
      questionText: string;
      correctAnswer: string;
    }
  ): Promise<{
    isCorrect: boolean;
    xpAwarded: number;
    totalXPEarned: number;
    userLevel: number;
    userXP: number;
    message: string;
  }> {
    // Check if user has already answered this question correctly and earned XP
    // Allow multiple attempts, but only award XP once for the first correct answer
    const hasEarnedXP = await this.questionResponseRepository.hasUserAnsweredCorrectly(
      userId,
      data.topicId,
      data.lessonId,
      data.questionIndex,
      data.questionType
    );

    // If user already earned XP for this question, they can still submit but won't get XP again
    const alreadyEarnedXP = hasEarnedXP;
    
    xpLogger.info('Checking previous responses', {
      userId,
      topicId: data.topicId,
      lessonId: data.lessonId,
      questionIndex: data.questionIndex,
      questionType: data.questionType,
      hasEarnedXP,
    });

    // Get topic to determine difficulty and grade band
    const topic = await this.topicRepository.findById(data.topicId);
    if (!topic) {
      throw new NotFoundError(`Topic with ID ${data.topicId} not found`);
    }

    // Normalize answers for comparison (trim, lowercase, remove extra spaces)
    const normalizeAnswer = (answer: string): string => {
      return answer
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\-\+\.]/g, ''); // Remove special chars except basic math symbols
    };

    // For quiz questions, don't auto-validate - admin will review
    // For practice questions, validate answer
    let isCorrect = false;
    let xpAwarded = 0;
    let reviewStatus: 'pending' | 'approved' | 'rejected' | undefined = undefined;

    if (data.questionType === 'quiz') {
      // Quiz questions: Save for admin review, don't auto-validate
      isCorrect = false; // Will be set by admin
      xpAwarded = 0; // Will be awarded by admin
      reviewStatus = 'pending';
      xpLogger.info('Quiz answer saved for admin review', {
        userId,
        topicId: data.topicId,
        lessonId: data.lessonId,
        questionIndex: data.questionIndex,
      });
    } else {
      // Practice questions: Auto-validate
      const normalizedUserAnswer = normalizeAnswer(data.userAnswer);
      const normalizedCorrectAnswer = normalizeAnswer(data.correctAnswer);

      // Check if answer is correct
      isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

      // Calculate XP (only if correct AND user hasn't earned XP for this question before)
      if (isCorrect && !alreadyEarnedXP) {
        // Only award XP if this is the first correct answer
        xpAwarded = this.calculateXP(
          data.questionType,
          topic.difficulty as 'easy' | 'medium' | 'hard',
          topic.gradeBand as 'primary' | 'secondary' | 'college'
        );
      } else if (isCorrect && alreadyEarnedXP) {
        // User answered correctly but already earned XP - no additional XP
        xpAwarded = 0;
      }
    }

    // Save question response (allow multiple responses per question)
    // EVERY response is saved to the database, whether correct or incorrect
    // Quiz questions are saved with reviewStatus: 'pending' for admin review
    const savedResponse = await this.questionResponseRepository.create({
      userId: new mongoose.Types.ObjectId(userId),
      topicId: new mongoose.Types.ObjectId(data.topicId),
      lessonId: data.lessonId,
      questionIndex: data.questionIndex,
      questionType: data.questionType,
      questionText: data.questionText,
      userAnswer: data.userAnswer,
      correctAnswer: data.correctAnswer || '', // Empty for quiz questions
      isCorrect,
      xpAwarded, // Will be 0 for quiz (pending review) or if already earned XP or if incorrect
      reviewStatus, // 'pending' for quiz, undefined for practice
      topicDifficulty: topic.difficulty as 'easy' | 'medium' | 'hard',
      gradeBand: topic.gradeBand as 'primary' | 'secondary' | 'college',
    });
    
    xpLogger.info('Question response saved', {
      responseId: savedResponse._id,
      userId,
      isCorrect,
      xpAwarded,
      userAnswer: data.userAnswer,
    });

    // Award XP to user if correct and not already awarded
    if (isCorrect && xpAwarded > 0) {
      await this.awardXP(userId, xpAwarded);
    }

    // Get updated user stats
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    // Get total XP earned for this lesson
    const totalXPEarned = await this.questionResponseRepository.getLessonXP(
      userId,
      data.topicId,
      data.lessonId
    );

    // Calculate user level
    const userXP = user.xpPoints || 0;
    const userLevel = this.calculateLevel(userXP);

    let message = '';
    if (data.questionType === 'quiz') {
      message = 'Your answer has been submitted for review. You will receive XP points once an admin reviews your answer.';
    } else if (isCorrect && xpAwarded > 0) {
      message = `Correct! You earned ${xpAwarded} XP! 🎉`;
    } else if (isCorrect && alreadyEarnedXP) {
      message = `Correct! (You already earned XP for this question)`;
    } else {
      message = `Incorrect. The correct answer is: ${data.correctAnswer}`;
    }

    xpLogger.info('Answer submitted', {
      userId,
      topicId: data.topicId,
      lessonId: data.lessonId,
      questionIndex: data.questionIndex,
      isCorrect,
      xpAwarded,
      userLevel,
      userXP,
    });

    return {
      isCorrect,
      xpAwarded,
      totalXPEarned,
      userLevel,
      userXP,
      message,
    };
  }

  /**
   * Award XP to user and update level
   */
  async awardXP(userId: string, xpAmount: number): Promise<void> {
    if (xpAmount <= 0) {
      return; // Don't award zero or negative XP
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    const currentXP = user.xpPoints || 0;
    const currentLevel = this.calculateLevel(currentXP);

    // Increment XP
    const newXP = currentXP + xpAmount;
    const newLevel = this.calculateLevel(newXP);

    // Update user - increment XP, update level, and increment problems solved
    await this.userRepository.updateById(userId, {
      $inc: { 
        xpPoints: xpAmount,
        problemsSolved: 1, // Increment problems solved when XP is awarded
      },
      $set: {
        level: newLevel,
      },
    });

    xpLogger.info('XP awarded', {
      userId,
      xpAmount,
      previousXP: currentXP,
      newXP,
      previousLevel: currentLevel,
      newLevel,
    });

    // If level increased, log it
    if (newLevel > currentLevel) {
      xpLogger.info('User leveled up!', {
        userId,
        previousLevel: currentLevel,
        newLevel,
      });
    }
  }

  /**
   * Calculate user level from XP
   */
  calculateLevel(xpPoints: number): number {
    return Math.floor(xpPoints / XP_CONFIG.XP_PER_LEVEL) + 1;
  }

  /**
   * Get XP configuration (for frontend display)
   */
  getXPConfig() {
    return {
      baseXP: XP_CONFIG.BASE_XP,
      difficultyMultiplier: XP_CONFIG.DIFFICULTY_MULTIPLIER,
      gradeBandMultiplier: XP_CONFIG.GRADE_BAND_MULTIPLIER,
      xpPerLevel: XP_CONFIG.XP_PER_LEVEL,
      startingXP: XP_CONFIG.STARTING_XP,
    };
  }

  /**
   * Get user's XP summary for a lesson
   */
  async getLessonXPSummary(
    userId: string,
    topicId: string,
    lessonId: string
  ): Promise<{
    totalXP: number;
    questionsAnswered: number;
    correctAnswers: number;
    accuracy: number;
  }> {
    const responses = await this.questionResponseRepository.findByLesson(
      userId,
      topicId,
      lessonId
    );

    const totalXP = responses.reduce((sum, r) => sum + (r.xpAwarded || 0), 0);
    const questionsAnswered = responses.length;
    const correctAnswers = responses.filter((r) => r.isCorrect).length;
    const accuracy = questionsAnswered > 0 ? (correctAnswers / questionsAnswered) * 100 : 0;

    return {
      totalXP,
      questionsAnswered,
      correctAnswers,
      accuracy: Math.round(accuracy * 100) / 100, // Round to 2 decimal places
    };
  }
}

