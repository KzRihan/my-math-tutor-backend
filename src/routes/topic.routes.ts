/**
 * Topic Routes (Public)
 * 
 * Express router for public topic endpoints.
 * These routes are accessible without authentication and only return published topics.
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import { sendSuccess, sendPaginated, calculatePagination } from '@utils/response';
import { asyncHandler } from '@utils/async-handler';
import { Request, Response } from 'express';
import { TopicService } from '@services/topic.service';
import { ITopicQuery } from '@domain/interfaces/topic.interface';

/**
 * Create public topic routes
 * Factory function for dependency injection
 */
export function createTopicRoutes(): Router {
    const router = Router();
    const topicService = container.resolve(TopicService);

    /**
     * GET /topics
     * Get all published topics (public endpoint)
     * Query params: page, limit, gradeBand, search, sortBy, sortOrder
     */
    router.get(
        '/topics',
        asyncHandler(async (req: Request, res: Response): Promise<void> => {
            const query: ITopicQuery = {
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20,
                search: req.query.search as string,
                gradeBand: req.query.gradeBand as any,
                sortBy: req.query.sortBy as string || 'createdAt',
                sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
            };

            const result = await topicService.getPublishedTopics(query);

            sendPaginated(
                res,
                result.data,
                calculatePagination(result.page, result.limit, result.total),
                'Published topics retrieved successfully'
            );
        })
    );

    /**
     * GET /topics/:id
     * Get a published topic by ID (public endpoint)
     */
    router.get(
        '/topics/:id',
        asyncHandler(async (req: Request, res: Response): Promise<void> => {
            const idParam = req.params['id'];
            const id = Array.isArray(idParam) ? idParam[0] : idParam;

            if (!id) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_ID',
                        message: 'Topic ID is required',
                    },
                });
                return;
            }

            const topic = await topicService.getPublishedTopicById(id);

            sendSuccess(res, topic, 'Topic retrieved successfully');
        })
    );

    return router;
}

export default createTopicRoutes;

