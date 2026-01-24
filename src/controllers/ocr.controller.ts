/**
 * OCR Controller
 * 
 * Handles OCR-related HTTP requests:
 * - Image upload and job creation (POST /ocr/capture)
 * - Job status retrieval (GET /ocr/job/:jobId)
 * 
 * Flow:
 * 1. Frontend calls /ocr/capture with image
 * 2. Controller creates a job in Redis queue, returns jobId immediately
 * 3. OCR Worker picks up job, calls external OCR API (http://192.168.0.148:8501/ocr)
 * 4. Frontend polls /ocr/job/:jobId for status and results
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { addOcrJob, getOcrJobStatus } from '@infrastructure/queue/producer';
import { createChildLogger } from '@utils/logger';

const logger = createChildLogger('ocr-controller');

/**
 * Capture image - Upload image and create OCR job
 * POST /ocr/capture
 */
export async function scanImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;

    console.log('📸 [OCR CAPTURE] Request received:', {
      hasFile: !!file,
      fileName: file?.originalname,
      fileSize: file?.size,
      mimeType: file?.mimetype,
      timestamp: new Date().toISOString(),
    });

    if (!file) {
      console.log('❌ [OCR CAPTURE] No file provided');
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No image file provided',
        },
      });
      return;
    }

    // Validate file type (middleware already validates, but double check)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('❌ [OCR CAPTURE] Invalid file type:', file.mimetype);
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC',
        },
      });
      return;
    }

    // Get parameters from request
    const strategy = (req.body.strategy as 'formula_only' | 'text_only' | 'mixed' | 'pix2tex_only') || 'pix2tex_only';
    const language = (req.body.language as string) || 'en';

    // Get user ID if authenticated
    const userId = (req as any).user?.id;

    // Convert file buffer to base64 for queue storage
    const fileBuffer = file.buffer.toString('base64');

    console.log('📋 [OCR CAPTURE] Creating job:', {
      fileName: file.originalname,
      strategy,
      language,
      userId: userId || 'anonymous',
      fileSizeKB: Math.round(file.size / 1024),
    });

    // Create OCR job
    const jobId = await addOcrJob({
      userId,
      fileName: file.originalname,
      fileBuffer,
      fileMimeType: file.mimetype,
      strategy,
      language,
    });

    logger.info('OCR job created', {
      jobId,
      fileName: file.originalname,
      strategy,
      userId,
    });

    console.log('✅ [OCR CAPTURE] Job created successfully:', {
      jobId,
      status: 'waiting',
    });

    res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        jobId,
        status: 'waiting',
        message: 'OCR job created. Poll /ocr/job/:jobId for status.',
      },
    });

  } catch (error) {
    console.log('🔥 [OCR CAPTURE] Error:', error);
    logger.error('Error creating OCR job:', error);
    next(error);
  }
}

/**
 * Get job status - Retrieve OCR job status and result
 * GET /ocr/job/:jobId
 */
export async function getJobStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const jobIdParam = req.params['jobId'];
    const jobId = Array.isArray(jobIdParam) ? jobIdParam[0] : jobIdParam;

    if (!jobId) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'NO_JOB_ID',
          message: 'Job ID is required',
        },
      });
      return;
    }

    const jobStatus = await getOcrJobStatus(jobId);

    console.log(`📊 [OCR STATUS] Job ${jobId}:`, {
      status: jobStatus.status,
      progress: jobStatus.progress,
      hasResult: !!jobStatus.result,
      error: jobStatus.error,
    });

    if (jobStatus.status === 'not_found') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'OCR job not found',
        },
      });
      return;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        jobId,
        ...jobStatus,
      },
    });

  } catch (error: any) {
    console.log('🔥 [OCR STATUS] Error:', error);
    logger.error('Error getting OCR job status:', error);
    
    // Handle Redis timeout gracefully
    if (error.message?.includes('timeout') || error.message?.includes('Command timed out')) {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        success: false,
        error: {
          code: 'SERVICE_BUSY',
          message: 'Job status check is taking longer than expected. Please try again in a moment.',
        },
      });
      return;
    }
    
    next(error);
  }
}

export default {
  scanImage,
  getJobStatus,
};
