/**
 * Agent Routes
 * 
 * Express router for AI Math Tutor Agent endpoints.
 * Handles chat interactions with the agent via job queue.
 */

import { Router } from 'express';
import { 
    chatWithAgent, 
    getAgentChatStatus, 
    waitForAgentResponse 
} from '@controllers/agent.controller';

const router = Router();

/**
 * POST /agent/chat
 * Send a chat message to the agent (queued)
 * Optional authentication - allows anonymous sessions
 */
router.post('/chat', chatWithAgent);

/**
 * GET /agent/chat/:jobId
 * Get the status of an agent job
 */
router.get('/chat/:jobId', getAgentChatStatus);

/**
 * POST /agent/chat/:jobId/wait
 * Wait for agent response (with timeout)
 */
router.post('/chat/:jobId/wait', waitForAgentResponse);

export default router;

