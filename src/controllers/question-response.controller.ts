/**
 * Question Response Controller
 * 
 * Handles HTTP requests for question response operations.
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { XPCalculationService } from '@services/xp-calculation.service';
import { QuestionResponseRepository } from '@repositories/question-response.repository';
import { TopicRepository } from '@repositories/topic.repository';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess, sendError } from '@utils/response';
import { ISubmitQuestionAnswer, ISubmitAnswerResponse } from '@domain/interfaces/question-response.interface';
import { createChildLogger } from '@utils/logger';
import { NotFoundError, BadRequestError } from '@utils/errors';

const logger = createChildLogger('question-response-controller');

@injectable()
export class QuestionResponseController {
  constructor(
    @inject(XPCalculationService) private xpCalculationService: XPCalculationService,
    @inject(QuestionResponseRepository) private questionResponseRepository: QuestionResponseRepository,
    @inject(TopicRepository) private topicRepository: TopicRepository
  ) {}

  /**
   * Submit answer to a practice question
   * POST /api/v1/questions/submit
   */
  submitAnswer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
      return;
    }

    const data: ISubmitQuestionAnswer = req.body;

    // Validate required fields
    if (!data.topicId || !data.lessonId || data.questionIndex === undefined || !data.questionType || !data.userAnswer) {
      sendError(
        res,
        StatusCodes.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Missing required fields: topicId, lessonId, questionIndex, questionType, userAnswer'
      );
      return;
    }

    // Get topic and lesson to validate and get question details
    const topic = await this.topicRepository.findById(data.topicId);
    if (!topic) {
      throw new NotFoundError(`Topic with ID ${data.topicId} not found`);
    }

    // Find the lesson
    const lesson = topic.lessons?.find((l) => l._id?.toString() === data.lessonId);
    if (!lesson) {
      throw new NotFoundError(`Lesson with ID ${data.lessonId} not found in topic`);
    }

    // Get question text and correct answer from lesson content
    let questionText = '';
    let correctAnswer = '';

    if (data.questionType === 'practice' && lesson.content?.practice_exercises) {
      const exercise = lesson.content.practice_exercises[data.questionIndex];
      if (!exercise) {
        throw new NotFoundError(`Practice exercise at index ${data.questionIndex} not found`);
      }
      // Extract question text from exercise field
      questionText = exercise.exercise || '';
      
      // If still empty, try to get from request body as fallback
      if (!questionText || questionText.trim() === '') {
        questionText = (req.body.questionText as string)?.trim() || '';
      }
      
      // Validate questionText is not empty
      if (!questionText || questionText.trim() === '') {
        throw new BadRequestError(
          `Question text is required. Practice exercise at index ${data.questionIndex} is missing the exercise field. ` +
          `Available fields: ${JSON.stringify(Object.keys(exercise || {}))}. ` +
          `Exercise object: ${JSON.stringify(exercise)}.`
        );
      }
      
      // For practice exercises, prioritize answer from exercise object, then from request body
      // Only use request body if it's not empty (to avoid empty strings)
      const requestAnswer = (req.body.correctAnswer as string)?.trim();
      correctAnswer = exercise.answer?.trim() || (requestAnswer && requestAnswer !== '' ? requestAnswer : '');
    } else if (data.questionType === 'quiz' && lesson.content?.quiz) {
      const quizQuestion = lesson.content.quiz[data.questionIndex];
      if (!quizQuestion) {
        throw new NotFoundError(`Quiz question at index ${data.questionIndex} not found`);
      }
      // Extract question text from question field
      questionText = quizQuestion.question || '';
      
      // If still empty, try to get from request body as fallback
      if (!questionText || questionText.trim() === '') {
        questionText = (req.body.questionText as string)?.trim() || '';
      }
      
      // Validate questionText is not empty
      if (!questionText || questionText.trim() === '') {
        throw new BadRequestError(
          `Question text is required. Quiz question at index ${data.questionIndex} is missing the question field. ` +
          `Available fields: ${JSON.stringify(Object.keys(quizQuestion || {}))}. ` +
          `Quiz question object: ${JSON.stringify(quizQuestion)}.`
        );
      }
      
      // For quiz questions, answers are not stored in lesson content
      // They will be reviewed by admin later
      // Allow submission without correct answer - admin will verify
      correctAnswer = ''; // Quiz answers are not auto-validated
      
      logger.info('Quiz question submitted for admin review', {
        questionIndex: data.questionIndex,
        lessonId: data.lessonId,
        topicId: data.topicId,
        userId,
      });
    } else {
      throw new NotFoundError(`Question type ${data.questionType} not found in lesson`);
    }

    // For practice questions, validate that we have a correct answer
    // For quiz questions, allow submission without answer (admin will review)
    if (data.questionType === 'practice' && (!correctAnswer || correctAnswer.trim() === '')) {
      throw new BadRequestError(
        `Correct answer is required for validation. Question type: ${data.questionType}, Index: ${data.questionIndex}. ` +
        `The lesson content for this question is missing the answer field. ` +
        `Available fields: ${JSON.stringify(Object.keys(lesson.content?.practice_exercises?.[data.questionIndex] || {}))}. ` +
        `Please ensure the lesson content includes the answer for this question.`
      );
    }

    // Submit answer and calculate XP
    const result = await this.xpCalculationService.submitAnswer(userId, {
      topicId: data.topicId,
      lessonId: data.lessonId,
      questionIndex: data.questionIndex,
      questionType: data.questionType,
      userAnswer: data.userAnswer,
      questionText,
      correctAnswer,
    });

    const response: ISubmitAnswerResponse = {
      success: true,
      isCorrect: result.isCorrect,
      xpAwarded: result.xpAwarded,
      totalXPEarned: result.totalXPEarned,
      userLevel: result.userLevel,
      userXP: result.userXP,
      message: result.message,
      correctAnswer: result.isCorrect ? undefined : correctAnswer, // Only show if wrong
    };

    logger.info('Answer submitted', {
      userId,
      topicId: data.topicId,
      lessonId: data.lessonId,
      questionIndex: data.questionIndex,
      isCorrect: result.isCorrect,
      xpAwarded: result.xpAwarded,
    });

    sendSuccess(res, response, 'Answer submitted successfully', StatusCodes.OK);
  });

  /**
   * Get lesson XP summary
   * GET /api/v1/questions/lesson/:topicId/:lessonId/summary
   */
  getLessonXPSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
      return;
    }

    const topicIdParam = req.params['topicId'];
    const lessonIdParam = req.params['lessonId'];
    const topicId = Array.isArray(topicIdParam) ? topicIdParam[0] : topicIdParam;
    const lessonId = Array.isArray(lessonIdParam) ? lessonIdParam[0] : lessonIdParam;

    if (!topicId || !lessonId) {
      sendError(res, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'Missing topicId or lessonId');
      return;
    }

    const summary = await this.xpCalculationService.getLessonXPSummary(userId, topicId, lessonId);

    sendSuccess(res, summary, 'Lesson XP summary retrieved successfully', StatusCodes.OK);
  });

  /**
   * Get XP configuration
   * GET /api/v1/questions/xp-config
   */
  getXPConfig = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const config = this.xpCalculationService.getXPConfig();
    sendSuccess(res, config, 'XP configuration retrieved successfully', StatusCodes.OK);
  });

  /**
   * Get user's question history
   * GET /api/v1/questions/history
   */
  getUserHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;

    const history = await this.questionResponseRepository.getUserHistory(userId, limit);

    sendSuccess(res, history, 'Question history retrieved successfully', StatusCodes.OK);
  });

  /**
   * Get topic statistics
   * GET /api/v1/questions/topic/:topicId/stats
   */
  getTopicStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id;
    if (!userId) {
      sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
      return;
    }

    const topicIdParam = req.params['topicId'];
    const topicId = Array.isArray(topicIdParam) ? topicIdParam[0] : topicIdParam;

    if (!topicId) {
      sendError(res, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'Missing topicId');
      return;
    }

    const stats = await this.questionResponseRepository.getTopicStats(userId, topicId);

    sendSuccess(res, stats, 'Topic statistics retrieved successfully', StatusCodes.OK);
  });
}

