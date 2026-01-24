/**
 * Agent Controller
 * 
 * Handles AI Math Tutor Agent operations:
 * - Send chat message to agent (via queue)
 * - Get agent job status
 * - Wait for agent response
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendAgentChat, getAgentChatStatus as getAgentChatStatusService, waitForAgentChat, AgentChatRequest } from '@services/agent.service';
import { createChildLogger } from '@utils/logger';

const logger = createChildLogger('agent-controller');

/**
 * Send chat message to agent
 * POST /agent/chat
 */
export async function chatWithAgent(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const {
            sessionId,
            studentMessage,
            gradeLevel,
            currentTopic,
            currentProblem,
            studentAnswer,
        } = req.body;

        // Get user ID if authenticated
        const userId = (req as any).user?.id;

        console.log('🤖 [AGENT] Chat request:', {
            sessionId,
            gradeLevel,
            userId,
            messageLength: studentMessage?.length || 0,
        });

        // Validate required fields
        if (!studentMessage || !currentProblem) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: {
                    code: 'MISSING_REQUIRED_FIELDS',
                    message: 'studentMessage and currentProblem are required',
                },
            });
            return;
        }

        // Validate grade level
        const validGradeLevels = ['primary', 'secondary', 'college'];
        const grade = gradeLevel || 'primary';
        if (!validGradeLevels.includes(grade)) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: {
                    code: 'INVALID_GRADE_LEVEL',
                    message: `gradeLevel must be one of: ${validGradeLevels.join(', ')}`,
                },
            });
            return;
        }

        const request: AgentChatRequest = {
            userId,
            sessionId,
            studentMessage,
            gradeLevel: grade as 'primary' | 'secondary' | 'college',
            currentTopic: currentTopic || 'algebra',
            currentProblem,
            studentAnswer,
        };

        const result = await sendAgentChat(request);

        console.log('✅ [AGENT] Chat job queued:', {
            jobId: result.jobId,
            sessionId,
        });

        res.status(StatusCodes.ACCEPTED).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.log('🔥 [AGENT] Error sending chat:', error);
        logger.error('Error sending agent chat:', error);
        next(error);
    }
}

/**
 * Get agent job status
 * GET /agent/chat/:jobId
 */
export async function getAgentChatStatus(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const jobIdParam = req.params['jobId'];
        const jobId = Array.isArray(jobIdParam) ? jobIdParam[0] : jobIdParam;

        console.log('🤖 [AGENT] Getting job status:', jobId);

        if (!jobId) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: {
                    code: 'MISSING_JOB_ID',
                    message: 'Job ID is required',
                },
            });
            return;
        }

        const status = await getAgentChatStatusService(jobId);

        res.status(StatusCodes.OK).json({
            success: true,
            data: status,
        });

    } catch (error) {
        console.log('🔥 [AGENT] Error getting job status:', error);
        logger.error('Error getting agent job status:', error);
        next(error);
    }
}

/**
 * Wait for agent response (with timeout)
 * POST /agent/chat/:jobId/wait
 */
export async function waitForAgentResponse(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const jobIdParam = req.params['jobId'];
        const jobId = Array.isArray(jobIdParam) ? jobIdParam[0] : jobIdParam;
        const { timeout = 60000 } = req.body; // Default 60 seconds

        console.log('🤖 [AGENT] Waiting for response:', { jobId, timeout });

        if (!jobId) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: {
                    code: 'MISSING_JOB_ID',
                    message: 'Job ID is required',
                },
            });
            return;
        }

        const result = await waitForAgentChat(jobId, timeout);

        console.log('✅ [AGENT] Response received:', {
            jobId,
            messageType: result.messageType,
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.log('🔥 [AGENT] Error waiting for response:', error);
        logger.error('Error waiting for agent response:', error);
        
        // Handle timeout specifically
        if (error instanceof Error && error.message.includes('timeout')) {
            res.status(StatusCodes.REQUEST_TIMEOUT).json({
                success: false,
                error: {
                    code: 'TIMEOUT',
                    message: error.message,
                },
            });
            return;
        }

        next(error);
    }
}

export default {
    chatWithAgent,
    getAgentChatStatus,
    waitForAgentResponse,
};

