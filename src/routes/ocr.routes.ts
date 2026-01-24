/**
 * OCR Routes
 * 
 * Routes for OCR scanning and job management:
 * POST /ocr/capture - Upload image and create OCR job
 * GET /ocr/job/:jobId - Get job status and result
 */

import { Router } from 'express';
import { scanImage, getJobStatus } from '@controllers/ocr.controller';
import { optionalAuth } from '@middlewares/auth.middleware';
import { uploadOcrImage } from '@middlewares/upload.middleware';

const router = Router();

/**
 * @route POST /ocr/capture
 * @desc Upload image and create OCR job
 * @access Public (optional auth for user tracking)
 */
router.post('/capture', optionalAuth, uploadOcrImage.single('file'), scanImage);

/**
 * @route GET /ocr/job/:jobId
 * @desc Get OCR job status and result
 * @access Public
 */
router.get('/job/:jobId', getJobStatus);

export default router;

