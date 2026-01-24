/**
 * Session Routes
 * 
 * Routes for learning session management:
 * POST /sessions - Create new session from OCR result
 * GET /sessions - Get user's session history
 * GET /sessions/:sessionId - Get session by ID
 * PATCH /sessions/:sessionId - Update session
 */

import { Router } from 'express';
import {
  createSession,
  getSession,
  getSessionHistory,
  updateSession,
} from '@controllers/session.controller';
import { optionalAuth } from '@middlewares/auth.middleware';

const router = Router();

/**
 * @route POST /sessions
 * @desc Create new learning session from OCR result
 * @access Public (optional auth for user tracking)
 */
router.post('/', optionalAuth, createSession);

/**
 * @route GET /sessions
 * @desc Get user's session history
 * @access Public (optional auth for filtering by user)
 */
router.get('/', optionalAuth, getSessionHistory);

/**
 * @route GET /sessions/:sessionId
 * @desc Get learning session by ID
 * @access Public
 */
router.get('/:sessionId', getSession);

/**
 * @route PATCH /sessions/:sessionId
 * @desc Update learning session
 * @access Public (optional auth for ownership check)
 */
router.patch('/:sessionId', optionalAuth, updateSession);

export default router;
