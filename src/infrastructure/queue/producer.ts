/**
 * BullMQ Queue Producer
 * 
 * Centralized queue producer for dispatching background jobs.
 * Provides type-safe job creation with retry policies.
 */

import { Queue, QueueOptions, JobsOptions } from 'bullmq';
import { config } from '@config/index';
import { getRedisClient } from '@infrastructure/redis/client';
import { createChildLogger } from '@utils/logger';

const queueLogger = createChildLogger('queue');

/** Queue instances cache */
const queues = new Map<string, Queue>();

/**
 * Default job options
 */
const defaultJobOptions: JobsOptions = {
  attempts: config.queue.defaultAttempts,
  backoff: {
    type: 'exponential',
    delay: config.queue.backoffDelay,
  },
  removeOnComplete: {
    count: 1000, // Keep last 1000 completed jobs
    age: 24 * 60 * 60, // Remove after 24 hours
  },
  removeOnFail: {
    count: 5000, // Keep last 5000 failed jobs for debugging
  },
};

/**
 * Get or create a queue instance
 */
export function getQueue(queueName: string): Queue {
  if (!queues.has(queueName)) {
    const queueOptions: QueueOptions = {
      connection: getRedisClient(),
      defaultJobOptions,
    };

    const queue = new Queue(queueName, queueOptions);

    queue.on('error', (error: Error) => {
      queueLogger.error(`Queue [${queueName}] error:`, error);
    });

    queues.set(queueName, queue);
    queueLogger.info(`Queue [${queueName}] initialized`);
  }

  return queues.get(queueName)!;
}

// ============================================================
// Email Queue Producer
// ============================================================

/**
 * Email job data structure
 */
export interface EmailJobData {
  to: string | string[];
  subject: string;
  template: string;
  templateData?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * Email job types
 */
export type EmailJobType =
  | 'welcome'
  | 'password-reset'
  | 'verification'
  | 'notification';

/**
 * Add an email job to the queue
 */
export async function addEmailJob(
  type: EmailJobType,
  data: EmailJobData,
  options?: Partial<JobsOptions>
): Promise<string> {
  const queue = getQueue(config.queue.emailQueueName);

  const job = await queue.add(type, data, {
    ...defaultJobOptions,
    ...options,
  });

  // Console log for visibility
  console.log(`📧 [EMAIL QUEUE] Job Added:`, {
    jobId: job.id,
    type,
    to: data.to,
    subject: data.subject,
    timestamp: new Date().toISOString(),
  });

  queueLogger.info(`Email job added: ${job.id}`, {
    type,
    to: data.to,
    subject: data.subject,
  });

  return job.id!;
}

/**
 * Schedule an email for later delivery
 */
export async function scheduleEmail(
  type: EmailJobType,
  data: EmailJobData,
  delay: number
): Promise<string> {
  return addEmailJob(type, data, { delay });
}

/**
 * Schedule a recurring email (cron job)
 */
export async function scheduleRecurringEmail(
  name: string,
  type: EmailJobType,
  data: EmailJobData,
  pattern: string // Cron pattern
): Promise<void> {
  const queue = getQueue(config.queue.emailQueueName);

  await queue.add(type, data, {
    ...defaultJobOptions,
    repeat: {
      pattern,
    },
    jobId: name, // Use name as job ID for deduplication
  });

  queueLogger.info(`Recurring email scheduled: ${name}`, { pattern });
}

// ============================================================
// Generic Queue Operations
// ============================================================

/**
 * Add a generic job to any queue
 */
export async function addJob<T>(
  queueName: string,
  jobName: string,
  data: T,
  options?: Partial<JobsOptions>
): Promise<string> {
  const queue = getQueue(queueName);

  const job = await queue.add(jobName, data, {
    ...defaultJobOptions,
    ...options,
  });

  // Console log for visibility
  console.log(`📋 [${queueName.toUpperCase()}] Job Added:`, {
    jobId: job.id,
    jobName,
    data,
    timestamp: new Date().toISOString(),
  });

  queueLogger.debug(`Job added to ${queueName}: ${job.id}`, { jobName });

  return job.id!;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: string): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue(queueName);

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Pause a queue
 */
export async function pauseQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueName);
  await queue.pause();
  queueLogger.warn(`Queue [${queueName}] paused`);
}

/**
 * Resume a paused queue
 */
export async function resumeQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueName);
  await queue.resume();
  queueLogger.info(`Queue [${queueName}] resumed`);
}

/**
 * Close all queues gracefully
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((queue) => queue.close());
  await Promise.all(closePromises);
  queues.clear();
  queueLogger.info('All queues closed');
}

// ============================================================
// Agent Queue Producer
// ============================================================

/**
 * Agent job data structure
 */
export interface AgentJobData {
  userId?: string;
  sessionId?: string;
  studentMessage: string;
  gradeLevel: 'primary' | 'secondary' | 'college';
  currentTopic?: string;
  currentProblem: string; // LaTeX from OCR
  studentAnswer?: string;
}

/**
 * Agent job result structure
 */
export interface AgentJobResult {
  success: boolean;
  agentMessage: string;
  messageType: string;
  containsLatex: boolean;
  latexBlocks: string[];
  confidence: number;
  suggestedAction: string;
  sessionId: string;
  sessionState: Record<string, unknown>;
  error?: string;
}

/**
 * Agent job types
 */
export type AgentJobType = 'chat';

/**
 * Add an agent job to the queue
 */
export async function addAgentJob(
  data: AgentJobData,
  options?: Partial<JobsOptions>
): Promise<string> {
  const queue = getQueue(config.queue.agentQueueName);

  const job = await queue.add('chat', data, {
    ...defaultJobOptions,
    ...options,
    // Keep agent results for retrieval
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 60 * 60, // Also remove after 1 hour
    },
  });

  // Console log for visibility
  console.log(`🤖 [AGENT QUEUE] Job Added:`, {
    jobId: job.id,
    sessionId: data.sessionId,
    gradeLevel: data.gradeLevel,
    userId: data.userId,
    timestamp: new Date().toISOString(),
  });

  queueLogger.info(`Agent job added: ${job.id}`, {
    sessionId: data.sessionId,
    gradeLevel: data.gradeLevel,
  });

  return job.id!;
}

/**
 * Get agent job status and result
 */
export async function getAgentJobStatus(jobId: string): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  result?: AgentJobResult;
  error?: string;
}> {
  const queue = getQueue(config.queue.agentQueueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    console.log(`🤖 [getAgentJobStatus] Job ${jobId}: NOT FOUND`);
    return { status: 'not_found' };
  }

  const state = await job.getState();
  const progress = job.progress as number;
  const returnvalue = job.returnvalue;

  console.log(`🤖 [getAgentJobStatus] Job ${jobId}:`, {
    state,
    progress,
    hasReturnValue: !!returnvalue,
  });

  if (state === 'completed') {
    console.log(`✅ [getAgentJobStatus] Job ${jobId} COMPLETED`);
    return {
      status: 'completed',
      progress: 100,
      result: returnvalue as AgentJobResult,
    };
  }

  if (state === 'failed') {
    return {
      status: 'failed',
      error: job.failedReason || 'Unknown error',
    };
  }

  return {
    status: state as 'waiting' | 'active',
    progress: progress || 0,
  };
}

export default {
  getQueue,
  addEmailJob,
  scheduleEmail,
  scheduleRecurringEmail,
  addOcrJob,
  getOcrJobStatus,
  addAgentJob,
  getAgentJobStatus,
  addJob,
  getQueueStats,
  pauseQueue,
  resumeQueue,
  closeAllQueues,
};

// ============================================================
// OCR Queue Producer
// ============================================================

/**
 * OCR job data structure
 */
export interface OcrJobData {
  userId?: string;
  fileName: string;
  fileBuffer: string; // Base64 encoded file
  fileMimeType: string;
  strategy: 'formula_only' | 'text_only' | 'mixed' | 'pix2tex_only';
  language: string;
}

/**
 * OCR job result structure
 */
export interface OcrJobResult {
  success: boolean;
  blocks: Array<{
    type: string;
    latex?: string;
    content?: string;
    confidence: number;
    bbox: number[];
  }>;
  layoutMarkdown: string;
  qualityScore: number;
  processingTime: number;
  imageInfo: {
    width: number;
    height: number;
    format: string;
  };
  warnings: string[];
  error?: string;
}

/**
 * OCR job types
 */
export type OcrJobType = 'scan';

/**
 * Add an OCR job to the queue
 */
export async function addOcrJob(
  data: OcrJobData,
  options?: Partial<JobsOptions>
): Promise<string> {
  const queue = getQueue(config.queue.ocrQueueName);

  const job = await queue.add('scan', data, {
    ...defaultJobOptions,
    ...options,
    // Keep OCR results for retrieval - CRITICAL: must have count, not just age
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 60 * 60, // Also remove after 1 hour
    },
  });

  // Console log for visibility
  console.log(`🔍 [OCR QUEUE] Job Added:`, {
    jobId: job.id,
    fileName: data.fileName,
    strategy: data.strategy,
    userId: data.userId,
    timestamp: new Date().toISOString(),
  });

  queueLogger.info(`OCR job added: ${job.id}`, {
    fileName: data.fileName,
    strategy: data.strategy,
  });

  return job.id!;
}

/**
 * Get OCR job status and result
 */
export async function getOcrJobStatus(jobId: string): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  result?: OcrJobResult;
  error?: string;
}> {
  const queue = getQueue(config.queue.ocrQueueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    console.log(`🔍 [getOcrJobStatus] Job ${jobId}: NOT FOUND`);
    return { status: 'not_found' };
  }

  const state = await job.getState();
  const progress = job.progress as number;

  // For completed jobs, wait a bit and retry if returnvalue is null/undefined
  // This handles race conditions where job completes but result isn't persisted yet
  let returnvalue = job.returnvalue;

  // Check if returnvalue exists and is not null/undefined
  const hasValidReturnValue = returnvalue !== null && returnvalue !== undefined;

  if (state === 'completed' && !hasValidReturnValue) {
    // Wait a short time and retry up to 5 times with increasing delays
    for (let i = 0; i < 5; i++) {
      const delay = 100 * Math.pow(2, i); // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
      await new Promise(resolve => setTimeout(resolve, delay));

      // Re-fetch the job to get updated returnvalue
      const updatedJob = await queue.getJob(jobId);
      if (updatedJob) {
        returnvalue = updatedJob.returnvalue;
        // Check if we got a valid return value
        if (returnvalue !== null && returnvalue !== undefined) {
          console.log(`✅ [getOcrJobStatus] Job ${jobId} returnvalue retrieved after ${i + 1} retries`);
          break;
        }
      }
    }
  }

  console.log(`🔍 [getOcrJobStatus] Job ${jobId}:`, {
    state,
    progress,
    hasReturnValue: !!returnvalue,
    returnValueType: typeof returnvalue,
  });

  if (state === 'completed') {
    console.log(`✅ [getOcrJobStatus] Job ${jobId} COMPLETED, returnvalue:`, returnvalue ? JSON.stringify(returnvalue, null, 2) : 'null');

    // If still no returnvalue, try to get it from the job's finishedOn timestamp
    // This might indicate the job finished but result wasn't stored properly
    if (!returnvalue) {
      const finishedOn = await job.finishedOn;
      if (finishedOn) {
        console.log(`⚠️ [getOcrJobStatus] Job ${jobId} completed but returnvalue is null. Finished at: ${new Date(finishedOn).toISOString()}`);
        // Try one more time after a longer delay
        await new Promise(resolve => setTimeout(resolve, 500));
        const finalJob = await queue.getJob(jobId);
        returnvalue = finalJob?.returnvalue;
      }
    }

    return {
      status: 'completed',
      progress: 100,
      result: returnvalue as OcrJobResult | undefined,
    };
  }

  if (state === 'failed') {
    return {
      status: 'failed',
      error: job.failedReason || 'Unknown error',
    };
  }

  return {
    status: state as 'waiting' | 'active',
    progress: progress || 0,
  };
}
