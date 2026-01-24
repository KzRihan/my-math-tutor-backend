/**
 * Agent Worker
 * 
 * BullMQ worker that processes agent jobs from the queue.
 * Calls external agent microservice API (http://192.168.0.148:8502/chat) and returns results.
 */

import { Worker, Job, Processor } from 'bullmq';
import axios from 'axios';
import { config } from '@config/index';
import { createBullMQConnection } from '@infrastructure/redis/client';
import { AgentJobData, AgentJobResult, AgentJobType } from '@infrastructure/queue/producer';
import { createChildLogger } from '@utils/logger';

const workerLogger = createChildLogger('agent-worker');

/** Worker instance */
let agentWorker: Worker<AgentJobData, AgentJobResult, AgentJobType> | null = null;

/**
 * Agent processor function
 * Handles agent jobs by calling external agent microservice API via axios
 */
const processAgent: Processor<AgentJobData, AgentJobResult, AgentJobType> = async (
  job: Job<AgentJobData, AgentJobResult, AgentJobType>
) => {
  const { data } = job;

  workerLogger.info(`Processing agent job: ${job.id}`, {
    sessionId: data.sessionId,
    gradeLevel: data.gradeLevel,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Stage 1: Job started - 10%
    await job.updateProgress(10);
    console.log(`📊 [AGENT PROGRESS] Job ${job.id}: 10% - Starting job processing`);

    // Stage 2: Preparing request - 30%
    await job.updateProgress(30);
    console.log(`📊 [AGENT PROGRESS] Job ${job.id}: 30% - Preparing request to agent service`);

    const url = `${config.agent.apiUrl}/chat`;

    // Build the message: combine problem and student message
    const fullMessage = data.currentProblem
      ? `# Problem\n${data.currentProblem}${data.studentMessage ? '\n\n# Student Message\n' + data.studentMessage : ''}`
      : data.studentMessage || '';

    // Request payload - API expects student_message and stream fields
    const requestPayload = {
      session_id: data.sessionId || '',
      student_message: fullMessage,
      stream: true,
    };

    console.log('\n' + '='.repeat(60));
    console.log(`🚀 [AGENT REQUEST START] Job ${job.id}`);
    console.log(`📍 URL: ${url}`);
    console.log(`📝 Session ID: ${requestPayload.session_id}`);
    console.log(`� FULL REQUEST PAYLOAD:`);
    console.log(JSON.stringify(requestPayload, null, 2));
    console.log('='.repeat(60) + '\n');

    workerLogger.debug(`Calling Agent API: ${url}`, {
      sessionId: requestPayload.session_id,
    });

    // Stage 3: Calling agent API - 50%
    await job.updateProgress(50);
    console.log(`📊 [AGENT PROGRESS] Job ${job.id}: 50% - Sending request to agent service`);

    // Handle streaming response
    let apiResult: { reply?: string; message?: string; data?: string } = {};
    let accumulatedReply = '';

    try {
      const response = await axios.post(url, requestPayload, {
        headers: {
          'accept': 'text/event-stream, application/json',
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 120 seconds timeout for slow AI responses
        responseType: 'stream', // Handle streaming response
      });

      // Stage 4: Processing stream - 60%
      await job.updateProgress(60);
      console.log(`📊 [AGENT PROGRESS] Job ${job.id}: 60% - Processing streaming response`);

      // Process the stream
      await new Promise<void>((resolve, reject) => {
        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          
          // Process complete lines (SSE format: data: {...}\n\n)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6); // Remove 'data: ' prefix
                if (jsonStr.trim()) {
                  const chunkData = JSON.parse(jsonStr);
                  // Accumulate the reply from stream chunks
                  if (chunkData.reply) {
                    accumulatedReply += chunkData.reply;
                  } else if (chunkData.message) {
                    accumulatedReply += chunkData.message;
                  } else if (chunkData.data) {
                    accumulatedReply += chunkData.data;
                  } else if (typeof chunkData === 'string') {
                    accumulatedReply += chunkData;
                  }
                }
              } catch (parseError) {
                // If it's not JSON, treat as plain text
                const text = line.substring(6);
                if (text.trim()) {
                  accumulatedReply += text;
                }
              }
            } else if (line.trim() && !line.startsWith(':')) {
              // Handle non-SSE format (plain text chunks)
              accumulatedReply += line;
            }
          }
        });

        response.data.on('end', () => {
          // Process any remaining buffer
          if (buffer.trim()) {
            if (buffer.startsWith('data: ')) {
              try {
                const jsonStr = buffer.substring(6);
                if (jsonStr.trim()) {
                  const chunkData = JSON.parse(jsonStr);
                  if (chunkData.reply) accumulatedReply += chunkData.reply;
                  else if (chunkData.message) accumulatedReply += chunkData.message;
                  else if (chunkData.data) accumulatedReply += chunkData.data;
                }
              } catch {
                accumulatedReply += buffer.substring(6);
              }
            } else {
              accumulatedReply += buffer;
            }
          }

          // If we got accumulated data, use it; otherwise try to parse as JSON
          if (accumulatedReply) {
            apiResult = { reply: accumulatedReply };
          } else {
            // Try to parse buffer as JSON (non-streaming response)
            try {
              apiResult = JSON.parse(buffer);
            } catch {
              apiResult = { reply: buffer };
            }
          }
          resolve();
        });

        response.data.on('error', (error: Error) => {
          reject(error);
        });
      });

      // Stage 5: Response received - 70%
      await job.updateProgress(70);

      console.log('\n' + '='.repeat(60));
      console.log(`📥 [AGENT RESPONSE RECEIVED] Job ${job.id}`);
      console.log(`📍 API URL: ${url}`);
      console.log(`✅ Status: ${response.status}`);
      console.log(`📨 ACCUMULATED REPLY LENGTH: ${accumulatedReply.length} characters`);
      console.log(`📨 REPLY PREVIEW: ${accumulatedReply.substring(0, 200)}...`);
      console.log('='.repeat(60) + '\n');

    } catch (streamError) {
      // Fallback: try non-streaming request if streaming fails
      console.log(`⚠️ [AGENT] Streaming failed, trying non-streaming request:`, streamError);
      
      const response = await axios.post<{
        reply: string;
      }>(url, { ...requestPayload, stream: false }, {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      });

      apiResult = response.data;
      console.log(`📥 [AGENT] Non-streaming response received`);
    }

    // Stage 6: Validating response - 80%
    await job.updateProgress(80);
    console.log(`📊 [AGENT PROGRESS] Job ${job.id}: 80% - Validating agent response`);

    // Extract reply from various possible response formats
    const reply = apiResult.reply || apiResult.message || apiResult.data || accumulatedReply;
    
    if (!reply || reply.trim().length === 0) {
      throw new Error('Agent API returned invalid response: missing or empty reply');
    }

    // Stage 7: Transforming result - 90%
    await job.updateProgress(90);
    console.log(`📊 [AGENT PROGRESS] Job ${job.id}: 90% - Transforming results`);

    // Transform API response to our format
    // Check for LaTeX: $...$ (inline), $$...$$ (display), or \(...\)
    const hasLatex = /\$[^$]+\$|\\\(|\\\[/.test(reply);

    const result: AgentJobResult = {
      success: true,
      agentMessage: reply,
      messageType: 'hint',
      containsLatex: hasLatex,
      latexBlocks: [],
      confidence: 0.8,
      suggestedAction: 'wait_for_student',
      sessionId: requestPayload.session_id,
      sessionState: {},
    };

    // Stage 8: Complete - 100%
    await job.updateProgress(100);
    console.log(`📊 [AGENT PROGRESS] Job ${job.id}: 100% - Job completed successfully!`);

    workerLogger.info(`Agent job completed: ${job.id}`, {
      sessionId: data.sessionId,
      messageType: result.messageType,
      confidence: result.confidence,
    });

    // Log the result before returning for debugging
    console.log(`🎯 [AGENT WORKER] Returning result for Job ${job.id}:`, JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    // Handle axios errors specifically
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorData = error.response?.data;
      
      // Extract error message from various possible formats
      let errorMessage: string;
      if (Array.isArray(errorData?.error)) {
        // Pydantic validation errors
        errorMessage = errorData.error.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join('; ');
      } else if (errorData?.error) {
        errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : JSON.stringify(errorData.error);
      } else if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail);
      } else {
        errorMessage = error.message;
      }

      workerLogger.error(`Agent API request failed: ${job.id}`, {
        sessionId: data.sessionId,
        statusCode,
        error: errorData || errorMessage,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts,
      });

      throw new Error(`Agent API error (${statusCode}): ${errorMessage}`);
    }

    workerLogger.error(`Agent job failed: ${job.id}`, {
      sessionId: data.sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });

    throw error; // Rethrow to trigger retry
  }
};

/**
 * Start the agent worker
 */
export function startAgentWorker(): Worker<AgentJobData, AgentJobResult, AgentJobType> {
  if (agentWorker) {
    workerLogger.warn('Agent worker already running');
    return agentWorker;
  }

  agentWorker = new Worker<AgentJobData, AgentJobResult, AgentJobType>(
    config.queue.agentQueueName,
    processAgent,
    {
      connection: createBullMQConnection('agent-worker'),
      concurrency: 1, // Process 1 agent job at a time to prevent overloading the agent service
      // Rate limiting commented out for now
      // limiter: {
      //   max: 50,        // Max 50 jobs
      //   duration: 60000, // Per minute (rate limiting)
      // },
    }
  );

  // Worker event handlers
  agentWorker.on('active', (job: Job<AgentJobData, AgentJobResult, AgentJobType>) => {
    console.log(`🤖 [AGENT WORKER] Job Started:`, {
      jobId: job.id,
      sessionId: job.data.sessionId,
      gradeLevel: job.data.gradeLevel,
      timestamp: new Date().toISOString(),
    });
  });

  agentWorker.on('completed', (job: Job<AgentJobData, AgentJobResult, AgentJobType>) => {
    console.log(`✅ [AGENT WORKER] Job Completed:`, {
      jobId: job.id,
      sessionId: job.data.sessionId,
      messageType: job.returnvalue?.messageType,
      timestamp: new Date().toISOString(),
    });
    workerLogger.debug(`Agent job completed: ${job.id}`);
  });

  agentWorker.on('failed', (job: Job<AgentJobData, AgentJobResult, AgentJobType> | undefined, error: Error) => {
    console.log(`❌ [AGENT WORKER] Job Failed:`, {
      jobId: job?.id,
      sessionId: job?.data.sessionId,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    workerLogger.error(`Agent job failed: ${job?.id}`, { error: error.message });
  });

  agentWorker.on('error', (error: Error) => {
    console.log(`🔥 [AGENT WORKER] Error:`, error.message);
    workerLogger.error('Agent worker error:', error);
  });

  agentWorker.on('stalled', (jobId: string) => {
    console.log(`⚠️ [AGENT WORKER] Job Stalled:`, { jobId });
    workerLogger.warn(`Agent job stalled: ${jobId}`);
  });

  workerLogger.info('🤖 Agent worker started');

  return agentWorker;
}

/**
 * Stop the agent worker gracefully
 */
export async function stopAgentWorker(): Promise<void> {
  if (agentWorker) {
    await agentWorker.close();
    agentWorker = null;
    workerLogger.info('Agent worker stopped');
  }
}

/**
 * Check if agent worker is running
 */
export function isAgentWorkerRunning(): boolean {
  return agentWorker !== null && !agentWorker.closing;
}

export default {
  start: startAgentWorker,
  stop: stopAgentWorker,
  isRunning: isAgentWorkerRunning,
};

