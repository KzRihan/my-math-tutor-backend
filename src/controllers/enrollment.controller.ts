/**
 * Enrollment Controller
 * 
 * Handles HTTP requests for Enrollment operations.
 * Validates input and delegates to EnrollmentService.
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { EnrollmentService } from '@services/enrollment.service';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess, sendCreated, sendError } from '@utils/response';
import {
    IUpdateEnrollment,
    IUpdateLessonProgress,
} from '@domain/interfaces/enrollment.interface';

/**
 * Enrollment Controller
 */
export class EnrollmentController {
    /**
     * Enroll user in a topic
     * POST /enrollments
     */
    enroll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const enrollmentService = container.resolve(EnrollmentService);
        const userId = (req as any).user?.id || (req as any).user?._id;
        
        if (!userId) {
            sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
            return;
        }

        const { topicId } = req.body;

        if (!topicId) {
            sendError(res, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'Topic ID is required');
            return;
        }

        const enrollment = await enrollmentService.enrollUser({
            userId: userId.toString(),
            topicId,
        });

        sendCreated(res, enrollment, 'Successfully enrolled in topic');
    });

    /**
     * Get user enrollment for a topic
     * GET /enrollments/topic/:topicId
     */
    getEnrollment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const enrollmentService = container.resolve(EnrollmentService);
        const userId = (req as any).user?.id || (req as any).user?._id;
        const topicIdParam = req.params['topicId'];
        const topicId = Array.isArray(topicIdParam) ? topicIdParam[0] : topicIdParam;

        if (!userId) {
            sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
            return;
        }

        if (!topicId) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID is required');
            return;
        }

        const enrollment = await enrollmentService.getUserEnrollment(userId.toString(), topicId);

        if (!enrollment) {
            sendError(res, StatusCodes.NOT_FOUND, 'NOT_FOUND', 'Enrollment not found');
            return;
        }

        sendSuccess(res, enrollment, 'Enrollment retrieved successfully');
    });

    /**
     * Get all user enrollments
     * GET /enrollments
     */
    getUserEnrollments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const enrollmentService = container.resolve(EnrollmentService);
        const userId = (req as any).user?.id || (req as any).user?._id;
        const status = req.query.status as string | undefined;

        if (!userId) {
            sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
            return;
        }

        const enrollments = await enrollmentService.getUserEnrollments(userId.toString(), status);

        sendSuccess(res, enrollments, 'Enrollments retrieved successfully');
    });

    /**
     * Update enrollment
     * PUT /enrollments/:id
     */
    update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const enrollmentService = container.resolve(EnrollmentService);
        const userId = (req as any).user?.id || (req as any).user?._id;
        const idParam = req.params['id'];
        const id = Array.isArray(idParam) ? idParam[0] : idParam;
        const updateData: IUpdateEnrollment = req.body;

        if (!userId) {
            sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
            return;
        }

        if (!id) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Enrollment ID is required');
            return;
        }

        const enrollment = await enrollmentService.updateEnrollment(id, userId.toString(), updateData);

        sendSuccess(res, enrollment, 'Enrollment updated successfully');
    });

    /**
     * Update lesson progress
     * PUT /enrollments/:id/lesson-progress
     */
    updateLessonProgress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const enrollmentService = container.resolve(EnrollmentService);
        const userId = (req as any).user?.id || (req as any).user?._id;
        const idParam = req.params['id'];
        const id = Array.isArray(idParam) ? idParam[0] : idParam;
        const progressData: IUpdateLessonProgress = req.body;

        if (!userId) {
            sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
            return;
        }

        if (!id) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Enrollment ID is required');
            return;
        }

        if (!progressData.lessonId || !progressData.status) {
            sendError(res, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'Lesson ID and status are required');
            return;
        }

        const enrollment = await enrollmentService.updateLessonProgress(id, userId.toString(), progressData);

        sendSuccess(res, enrollment, 'Lesson progress updated successfully');
    });

    /**
     * Unenroll user from a topic
     * DELETE /enrollments/topic/:topicId
     */
    unenroll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const enrollmentService = container.resolve(EnrollmentService);
        const userId = (req as any).user?.id || (req as any).user?._id;
        const topicIdParam = req.params['topicId'];
        const topicId = Array.isArray(topicIdParam) ? topicIdParam[0] : topicIdParam;

        if (!userId) {
            sendError(res, StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'User not authenticated');
            return;
        }

        if (!topicId) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID is required');
            return;
        }

        await enrollmentService.unenrollUser(userId.toString(), topicId);

        sendSuccess(res, null, 'Successfully unenrolled from topic');
    });
}

export default EnrollmentController;

