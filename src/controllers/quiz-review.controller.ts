/**
 * Quiz Review Controller
 * 
 * Handles HTTP requests for admin quiz review operations.
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { QuizReviewService } from '@services/quiz-review.service';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess, sendError } from '@utils/response';
import { createChildLogger } from '@utils/logger';

const logger = createChildLogger('quiz-review-controller');

@injectable()
export class QuizReviewController {
  constructor(
    @inject(QuizReviewService) private quizReviewService: QuizReviewService
  ) {}

  /**
   * Get pending quiz responses for review
   * GET /api/v1/admin/quiz/pending
   */
  getPendingQuizResponses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;

    const result = await this.quizReviewService.getPendingQuizResponses(limit, skip);

    sendSuccess(res, result, 'Pending quiz responses retrieved successfully', StatusCodes.OK);
  });

  /**
   * Get quiz responses by status
   * GET /api/v1/admin/quiz/status/:status
   */
  getQuizResponsesByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const statusParam = req.params['status'];
    const status = Array.isArray(statusParam) ? statusParam[0] : statusParam;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;

    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_STATUS', 'Status must be pending, approved, or rejected');
      return;
    }

    const result = await this.quizReviewService.getQuizResponsesByStatus(
      status as 'pending' | 'approved' | 'rejected',
      limit,
      skip
    );

    sendSuccess(res, result, `Quiz responses with status ${status} retrieved successfully`, StatusCodes.OK);
  });

  /**
   * Review and approve/reject a quiz answer
   * POST /api/v1/admin/quiz/review
   */
  reviewQuizAnswer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'Admin not authenticated');
      return;
    }

    const { responseId, isCorrect, correctAnswer, xpAwarded, adminNotes } = req.body;

    if (!responseId) {
      sendError(res, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'responseId is required');
      return;
    }

    if (typeof isCorrect !== 'boolean') {
      sendError(res, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'isCorrect must be a boolean');
      return;
    }

    const result = await this.quizReviewService.reviewQuizAnswer(adminId, {
      responseId,
      isCorrect,
      correctAnswer,
      xpAwarded,
      adminNotes,
    });

    logger.info('Quiz answer reviewed by admin', {
      adminId,
      responseId,
      isCorrect,
      xpAwarded: result.xpAwarded,
    });

    sendSuccess(res, result, result.message, StatusCodes.OK);
  });

  /**
   * Get quiz review statistics
   * GET /api/v1/admin/quiz/stats
   */
  getQuizReviewStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = await this.quizReviewService.getQuizReviewStats();

    sendSuccess(res, stats, 'Quiz review statistics retrieved successfully', StatusCodes.OK);
  });
}

