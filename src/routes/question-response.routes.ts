/**
 * Question Response Routes
 * 
 * Defines API routes for question response operations.
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import { QuestionResponseController } from '@controllers/question-response.controller';
import { authenticate } from '@middlewares/auth.middleware';

const router = Router();
const questionResponseController = container.resolve(QuestionResponseController);

/**
 * @route   POST /api/v1/questions/submit
 * @desc    Submit answer to a practice question
 * @access  Private
 */
router.post('/submit', authenticate, questionResponseController.submitAnswer);

/**
 * @route   GET /api/v1/questions/lesson/:topicId/:lessonId/summary
 * @desc    Get lesson XP summary
 * @access  Private
 */
router.get('/lesson/:topicId/:lessonId/summary', authenticate, questionResponseController.getLessonXPSummary);

/**
 * @route   GET /api/v1/questions/xp-config
 * @desc    Get XP configuration
 * @access  Public (for frontend to display XP info)
 */
router.get('/xp-config', questionResponseController.getXPConfig);

/**
 * @route   GET /api/v1/questions/history
 * @desc    Get user's question history
 * @access  Private
 */
router.get('/history', authenticate, questionResponseController.getUserHistory);

/**
 * @route   GET /api/v1/questions/topic/:topicId/stats
 * @desc    Get topic statistics
 * @access  Private
 */
router.get('/topic/:topicId/stats', authenticate, questionResponseController.getTopicStats);

export default router;

