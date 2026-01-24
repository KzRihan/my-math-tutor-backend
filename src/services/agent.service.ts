/**
 * Agent Service
 * 
 * Service for interacting with the AI Math Tutor Agent via job queue.
 * Provides async processing of agent chat requests.
 */

import { addAgentJob, getAgentJobStatus, AgentJobData, AgentJobResult } from '@infrastructure/queue/producer';
import { createChildLogger } from '@utils/logger';

const logger = createChildLogger('agent-service');

/**
 * Request interface for agent chat
 */
export interface AgentChatRequest {
  userId?: string;
  sessionId?: string;
  studentMessage: string;
  gradeLevel: 'primary' | 'secondary' | 'college';
  currentTopic?: string;
  currentProblem: string; // LaTeX from OCR
  studentAnswer?: string;
}

/**
 * Response interface for agent chat
 */
export interface AgentChatResponse {
  jobId: string;
  status: 'queued';
  message: string;
}

/**
 * Send a chat message to the agent via queue
 * 
 * @param request - Chat request data
 * @returns Job ID and status
 */
export async function sendAgentChat(request: AgentChatRequest): Promise<AgentChatResponse> {
  try {
    logger.info('Adding agent chat job to queue', {
      sessionId: request.sessionId,
      gradeLevel: request.gradeLevel,
    });

    const jobData: AgentJobData = {
      userId: request.userId,
      sessionId: request.sessionId,
      studentMessage: request.studentMessage,
      gradeLevel: request.gradeLevel,
      currentTopic: request.currentTopic,
      currentProblem: request.currentProblem,
      studentAnswer: request.studentAnswer,
    };

    const jobId = await addAgentJob(jobData);

    return {
      jobId,
      status: 'queued',
      message: 'Agent chat job queued successfully',
    };
  } catch (error) {
    logger.error('Failed to queue agent chat job', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: request.sessionId,
    });
    throw error;
  }
}

/**
 * Get agent job status and result
 * 
 * @param jobId - Job ID from sendAgentChat
 * @returns Job status and result if completed
 */
export async function getAgentChatStatus(jobId: string): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  result?: AgentJobResult;
  error?: string;
}> {
  try {
    return await getAgentJobStatus(jobId);
  } catch (error) {
    logger.error('Failed to get agent job status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      jobId,
    });
    throw error;
  }
}

/**
 * Wait for agent job to complete (with timeout)
 * 
 * @param jobId - Job ID from sendAgentChat
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 60000)
 * @param pollIntervalMs - Polling interval in milliseconds (default: 500)
 * @returns Job result when completed
 */
export async function waitForAgentChat(
  jobId: string,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 500
): Promise<AgentJobResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await getAgentJobStatus(jobId);

    if (status.status === 'completed' && status.result) {
      return status.result;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Agent job failed');
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Agent job timeout after ${timeoutMs}ms`);
}

export default {
  sendAgentChat,
  getAgentChatStatus,
  waitForAgentChat,
};

