/**
 * Topic Controller
 * 
 * Handles HTTP requests for Topic operations.
 * Validates input and delegates to TopicService.
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { TopicService } from '@services/topic.service';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess, sendCreated, sendError, sendPaginated, calculatePagination } from '@utils/response';
import { UserRole } from '@domain/enums/user-status.enum';
import {
    ICreateTopic,
    IUpdateTopic,
    ITopicQuery,
    IGenerateLessonsRequest,
    IGenerateLessonContentRequest,
} from '@domain/interfaces/topic.interface';

/**
 * Topic Controller
 */
export class TopicController {
    /**
     * Create a new topic
     * POST /admin/topics
     */
    create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const topicData: ICreateTopic = req.body;
        const authUser = req.user;

        // User-created topics are scoped to their owner.
        if (authUser?.role === UserRole.USER) {
            topicData.createdBy = authUser.id;
        }

        const topic = await topicService.createTopic(topicData);

        sendCreated(res, topic, 'Topic created successfully');
    });

    /**
     * Get all topics
     * GET /admin/topics
     */
    getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const query: ITopicQuery = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 20,
            search: req.query.search as string,
            status: req.query.status as any,
            gradeBand: req.query.gradeBand as any,
            sortBy: req.query.sortBy as string || 'createdAt',
            sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
        };

        const result = await topicService.getTopics(query);

        sendPaginated(
            res,
            result.data,
            calculatePagination(result.page, result.limit, result.total),
            'Topics retrieved successfully'
        );
    });

    /**
     * Get topic by ID
     * GET /admin/topics/:id
     */
    getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const idParam = req.params['id'];
        const id = Array.isArray(idParam) ? idParam[0] : idParam;

        if (!id) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID is required');
            return;
        }

        const topic = await topicService.getTopicById(id);

        sendSuccess(res, topic, 'Topic retrieved successfully');
    });

    /**
     * Update topic
     * PUT /admin/topics/:id
     */
    update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const idParam = req.params['id'];
        const id = Array.isArray(idParam) ? idParam[0] : idParam;
        const updateData: IUpdateTopic = req.body;

        if (!id) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID is required');
            return;
        }

        const topic = await topicService.updateTopic(id, updateData);

        sendSuccess(res, topic, 'Topic updated successfully');
    });

    /**
     * Delete topic
     * DELETE /admin/topics/:id
     */
    delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const authUser = req.user;
        const idParam = req.params['id'];
        const id = Array.isArray(idParam) ? idParam[0] : idParam;

        if (!id) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID is required');
            return;
        }

        if (authUser?.role === UserRole.USER) {
            const canManage = await topicService.canUserManageTopic(id, authUser.id);
            if (!canManage) {
                sendError(res, StatusCodes.FORBIDDEN, 'FORBIDDEN', 'You can only delete topics you created');
                return;
            }
        }

        await topicService.deleteTopic(id);

        sendSuccess(res, null, 'Topic deleted successfully');
    });

    /**
     * Delete lesson from topic
     * DELETE /admin/topics/:topicId/lessons/:lessonId
     */
    deleteLesson = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const authUser = req.user;
        const topicIdParam = req.params['topicId'];
        const lessonIdParam = req.params['lessonId'];
        const topicId = Array.isArray(topicIdParam) ? topicIdParam[0] : topicIdParam;
        const lessonId = Array.isArray(lessonIdParam) ? lessonIdParam[0] : lessonIdParam;

        if (!topicId || !lessonId) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID and Lesson ID are required');
            return;
        }

        if (authUser?.role === UserRole.USER) {
            const canManage = await topicService.canUserManageTopic(topicId, authUser.id);
            if (!canManage) {
                sendError(res, StatusCodes.FORBIDDEN, 'FORBIDDEN', 'You can only delete lessons from topics you created');
                return;
            }
        }

        const topic = await topicService.deleteLessonFromTopic(topicId, lessonId);
        sendSuccess(res, topic, 'Lesson deleted successfully');
    });

    /**
     * Generate lessons for a topic
     * POST /admin/topics/generate-lessons
     */
    generateLessons = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const data: IGenerateLessonsRequest = req.body;

        // Validate required fields
        if (!data.topic_title || !data.grade || !data.difficulty_level || !data.number_of_lessons) {
            sendError(res, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'Missing required fields: topic_title, grade, difficulty_level, number_of_lessons');
            return;
        }

        try {
            const result = await topicService.generateLessons(data);
            sendSuccess(res, result, 'Lessons generated successfully');
        } catch (error) {
            // Re-throw to let error middleware handle it
            throw error;
        }
    });

    /**
     * Generate lesson content
     * POST /admin/topics/generate-lesson-content
     */
    generateLessonContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const data: IGenerateLessonContentRequest = req.body;

        // Validate required fields
        if (!data.topic_title || !data.lesson_title || !data.grade || !data.difficulty_level) {
            sendError(res, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'Missing required fields: topic_title, lesson_title, grade, difficulty_level');
            return;
        }

        try {
            const result = await topicService.generateLessonContent(data);
            sendSuccess(res, result, 'Lesson content generated successfully');
        } catch (error) {
            // Re-throw to let error middleware handle it
            throw error;
        }
    });

    /**
     * Save lessons to topic
     * POST /admin/topics/:topicId/lessons
     */
    saveLessons = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const authUser = req.user;
        const topicIdParam = req.params['topicId'];
        const topicId = Array.isArray(topicIdParam) ? topicIdParam[0] : topicIdParam;
        const { lessons } = req.body;

        if (!topicId) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID is required');
            return;
        }

        if (!Array.isArray(lessons)) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_INPUT', 'Lessons must be an array');
            return;
        }

        if (authUser?.role === UserRole.USER) {
            const canManage = await topicService.canUserManageTopic(topicId, authUser.id);
            if (!canManage) {
                sendError(res, StatusCodes.FORBIDDEN, 'FORBIDDEN', 'You can only edit topics you created');
                return;
            }
        }

        const topic = await topicService.saveLessonsToTopic(topicId, lessons);

        sendSuccess(res, topic, 'Lessons saved successfully');
    });

    /**
     * Save lesson content
     * POST /admin/topics/:topicId/lessons/:lessonId/content
     */
    saveLessonContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const authUser = req.user;
        const topicIdParam = req.params['topicId'];
        const lessonIdParam = req.params['lessonId'];
        const topicId = Array.isArray(topicIdParam) ? topicIdParam[0] : topicIdParam;
        const lessonId = Array.isArray(lessonIdParam) ? lessonIdParam[0] : lessonIdParam;
        const content = req.body;

        if (!topicId || !lessonId) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID and Lesson ID are required');
            return;
        }

        if (authUser?.role === UserRole.USER) {
            const canManage = await topicService.canUserManageTopic(topicId, authUser.id);
            if (!canManage) {
                sendError(res, StatusCodes.FORBIDDEN, 'FORBIDDEN', 'You can only edit topics you created');
                return;
            }
        }

        const topic = await topicService.saveLessonContent(topicId, lessonId, content);

        sendSuccess(res, topic, 'Lesson content saved successfully');
    });

    /**
     * Publish topic
     * POST /admin/topics/:id/publish
     */
    publish = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const idParam = req.params['id'];
        const id = Array.isArray(idParam) ? idParam[0] : idParam;

        if (!id) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID is required');
            return;
        }

        const topic = await topicService.publishTopic(id);

        sendSuccess(res, topic, 'Topic published successfully');
    });

    /**
     * Unpublish topic
     * POST /admin/topics/:id/unpublish
     */
    unpublish = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const topicService = container.resolve(TopicService);
        const idParam = req.params['id'];
        const id = Array.isArray(idParam) ? idParam[0] : idParam;

        if (!id) {
            sendError(res, StatusCodes.BAD_REQUEST, 'INVALID_ID', 'Topic ID is required');
            return;
        }

        const topic = await topicService.unpublishTopic(id);

        sendSuccess(res, topic, 'Topic unpublished successfully');
    });
}

export default TopicController;

