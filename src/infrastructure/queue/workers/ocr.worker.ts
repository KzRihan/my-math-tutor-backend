/**
 * OCR Worker
 * 
 * BullMQ worker that processes OCR jobs from the queue.
 * Calls external OCR microservice API and returns results.
 */

import { Worker, Job, Processor } from 'bullmq';
import axios from 'axios';
import FormData from 'form-data';
import { config } from '@config/index';
import { createBullMQConnection } from '@infrastructure/redis/client';
import { OcrJobData, OcrJobResult, OcrJobType } from '@infrastructure/queue/producer';
import { createChildLogger } from '@utils/logger';

const workerLogger = createChildLogger('ocr-worker');


/** Worker instance */
let ocrWorker: Worker<OcrJobData, OcrJobResult, OcrJobType> | null = null;

/**
 * OCR processor function
 * Handles OCR jobs by calling external OCR microservice API via axios
 */
const processOcr: Processor<OcrJobData, OcrJobResult, OcrJobType> = async (
  job: Job<OcrJobData, OcrJobResult, OcrJobType>
) => {
  const { data } = job;

  workerLogger.info(`Processing OCR job: ${job.id}`, {
    fileName: data.fileName,
    strategy: data.strategy,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Stage 1: Job started - 10%
    await job.updateProgress(10);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 10% - Starting job processing`);

    // Stage 2: Decoding image - 20%
    await job.updateProgress(20);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 20% - Decoding base64 image`);
    const fileBuffer = Buffer.from(data.fileBuffer, 'base64');

    // Stage 3: Preparing FormData - 30%
    await job.updateProgress(30);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 30% - Preparing form data`);
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: data.fileName,
      contentType: data.fileMimeType,
    });

    // Stage 4: Ready to call API - 40%
    await job.updateProgress(40);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 40% - Connecting to OCR service`);
    const url = `${config.ocr.apiUrl}?strategy=${encodeURIComponent(data.strategy)}&language=${encodeURIComponent(data.language)}`;

    console.log('\n' + '='.repeat(60));
    console.log(`🚀 [OCR REQUEST START] Job ${job.id}`);
    console.log(`📍 URL: ${url}`);
    console.log(`📁 File: ${data.fileName} (${data.fileMimeType})`);
    console.log(`⚙️  Strategy: ${data.strategy}, Language: ${data.language}`);
    console.log('='.repeat(60) + '\n');

    workerLogger.debug(`Calling OCR API: ${url}`);

    // Stage 5: Calling OCR API - 50%
    await job.updateProgress(50);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 50% - Sending image to OCR service`);

    const response = await axios.post<any>(url, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Stage 6: Response received - 60%
    await job.updateProgress(60);

    console.log('\n' + '='.repeat(60));
    console.log(`📥 [OCR RESPONSE RECEIVED] Job ${job.id}`);
    console.log(`✅ Status: ${response.status}`);
    console.log('='.repeat(60) + '\n');

    const rawData = response.data;
    console.log(`🔍 [OCR API RAW RESPONSE] Job ${job.id}:`, JSON.stringify(rawData, null, 2));


    // Robust extraction: Check if the response is nested or at top level
    const apiResult = rawData.data || rawData.result || rawData.res || rawData;

    // Stage 7: Validating response - 70%
    await job.updateProgress(70);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 70% - Validating OCR response`);

    // lenient success check: true if success property is true in either wrapper or nested object,
    // or if we have results even without a success flag
    const isSuccess = rawData.success === true ||
      apiResult.success === true ||
      (apiResult.blocks || apiResult.content_blocks || apiResult.layout_markdown || apiResult.latex);

    if (!isSuccess && (rawData.error || apiResult.error)) {
      throw new Error(apiResult.error || rawData.error || 'OCR processing failed');
    }

    // Stage 8: Transforming result - 80%
    await job.updateProgress(80);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 80% - Transforming results`);

    // Extract blocks with multi-naming support
    const blocks = apiResult.blocks || apiResult.content_blocks || apiResult.contentBlocks || apiResult.res || [];

    // Extract markdown with multi-naming support
    let layoutMarkdown = apiResult.layout_markdown ||
      apiResult.layoutMarkdown ||
      apiResult.markdown ||
      apiResult.latex ||
      apiResult.content ||
      apiResult.text || '';

    // If no markdown but we have blocks, try to combine them as a fallback
    if (!layoutMarkdown && Array.isArray(blocks) && blocks.length > 0) {
      layoutMarkdown = blocks
        .map((b: any) => b.latex || b.content || '')
        .filter(Boolean)
        .join('\n\n');
    }

    // Transform API response to our format with fallbacks for different naming conventions
    const result: OcrJobResult = {
      success: true,
      blocks: Array.isArray(blocks) ? blocks : [],
      layoutMarkdown,
      qualityScore: apiResult.quality_score || apiResult.qualityScore || apiResult.score || 0,
      processingTime: apiResult.processing_time_ms || apiResult.processingTime || apiResult.time || 0,
      imageInfo: apiResult.image_info || apiResult.imageInfo || { width: 0, height: 0, format: '' },
      warnings: apiResult.warnings || [],
    };

    // Stage 9: Finalizing - 90%
    await job.updateProgress(90);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 90% - Finalizing results`);

    // Stage 10: Complete - 100%
    await job.updateProgress(100);
    console.log(`📊 [OCR PROGRESS] Job ${job.id}: 100% - Job completed successfully!`);

    workerLogger.info(`OCR job completed: ${job.id}`, {
      fileName: data.fileName,
      blocksCount: result.blocks.length,
      processingTime: result.processingTime,
    });

    // Log the result before returning for debugging
    console.log(`🎯 [OCR WORKER] Returning result for Job ${job.id}:`, JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    // Handle axios errors specifically
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error || error.message;

      workerLogger.error(`OCR API request failed: ${job.id}`, {
        fileName: data.fileName,
        statusCode,
        error: errorMessage,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts,
      });

      throw new Error(`OCR API error (${statusCode}): ${errorMessage}`);
    }

    workerLogger.error(`OCR job failed: ${job.id}`, {
      fileName: data.fileName,
      error: error instanceof Error ? error.message : 'Unknown error',
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });

    throw error; // Rethrow to trigger retry
  }
};

/**
 * Start the OCR worker
 */
export function startOcrWorker(): Worker<OcrJobData, OcrJobResult, OcrJobType> {
  if (ocrWorker) {
    workerLogger.warn('OCR worker already running');
    return ocrWorker;
  }

  ocrWorker = new Worker<OcrJobData, OcrJobResult, OcrJobType>(
    config.queue.ocrQueueName,
    processOcr,
    {
      connection: createBullMQConnection('ocr-worker'),
      concurrency: 3, // Process 3 OCR jobs concurrently
      limiter: {
        max: 30,        // Max 30 jobs
        duration: 60000, // Per minute (rate limiting)
      },
    }
  );

  // Worker event handlers
  ocrWorker.on('active', (job: Job<OcrJobData, OcrJobResult, OcrJobType>) => {
    console.log(`🔍 [OCR WORKER] Job Started:`, {
      jobId: job.id,
      fileName: job.data.fileName,
      strategy: job.data.strategy,
      timestamp: new Date().toISOString(),
    });
  });

  ocrWorker.on('completed', (job: Job<OcrJobData, OcrJobResult, OcrJobType>) => {
    console.log(`✅ [OCR WORKER] Job Completed:`, {
      jobId: job.id,
      fileName: job.data.fileName,
      timestamp: new Date().toISOString(),
    });
    workerLogger.debug(`OCR job completed: ${job.id}`);
  });

  ocrWorker.on('failed', (job: Job<OcrJobData, OcrJobResult, OcrJobType> | undefined, error: Error) => {
    console.log(`❌ [OCR WORKER] Job Failed:`, {
      jobId: job?.id,
      fileName: job?.data.fileName,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    workerLogger.error(`OCR job failed: ${job?.id}`, { error: error.message });
  });

  ocrWorker.on('error', (error: Error) => {
    console.log(`🔥 [OCR WORKER] Error:`, error.message);
    workerLogger.error('OCR worker error:', error);
  });

  ocrWorker.on('stalled', (jobId: string) => {
    console.log(`⚠️ [OCR WORKER] Job Stalled:`, { jobId });
    workerLogger.warn(`OCR job stalled: ${jobId}`);
  });

  workerLogger.info('🔍 OCR worker started');

  return ocrWorker;
}

/**
 * Stop the OCR worker gracefully
 */
export async function stopOcrWorker(): Promise<void> {
  if (ocrWorker) {
    await ocrWorker.close();
    ocrWorker = null;
    workerLogger.info('OCR worker stopped');
  }
}

/**
 * Check if OCR worker is running
 */
export function isOcrWorkerRunning(): boolean {
  return ocrWorker !== null && !ocrWorker.closing;
}

export default {
  start: startOcrWorker,
  stop: stopOcrWorker,
  isRunning: isOcrWorkerRunning,
};
