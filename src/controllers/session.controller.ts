/**
 * Learning Session Controller
 * 
 * Handles learning session operations:
 * - Create session from OCR result
 * - Get session by ID
 * - Get user's session history
 * - Update session status
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { LearningSession } from '@domain/models/learning-session.model';
import { createChildLogger } from '@utils/logger';

const logger = createChildLogger('session-controller');

/**
 * Create learning session from OCR result
 * POST /sessions
 */
export async function createSession(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const {
            jobId,
            fileName,
            strategy,
            blocks,
            layoutMarkdown,
            qualityScore,
            processingTime,
            imageInfo,
            imageBase64,
            title,
            topic,
        } = req.body;

        console.log('📚 [SESSION] Creating learning session:', {
            jobId,
            fileName,
            blocksCount: blocks?.length || 0,
        });

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

        // Check if session already exists for this job
        const existingSession = await LearningSession.findOne({ jobId });
        if (existingSession) {
            console.log('📚 [SESSION] Found existing session:', existingSession._id);
            res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    sessionId: existingSession._id.toString(),
                    isNew: false,
                },
            });
            return;
        }

        // Get user ID if authenticated
        const userId = (req as any).user?.id;

        // Generate title from first block if not provided
        const autoTitle = title || generateTitle(blocks);

        // Create new session
        const session = new LearningSession({
            userId,
            jobId,
            fileName,
            strategy: strategy || 'formula_only',
            blocks: blocks || [],
            layoutMarkdown: layoutMarkdown || '',
            qualityScore: qualityScore || 0,
            processingTime: processingTime || 0,
            imageInfo: imageInfo || { width: 0, height: 0, format: '' },
            imageBase64,
            title: autoTitle,
            topic,
            status: 'active',
        });

        await session.save();

        console.log('✅ [SESSION] Session created:', {
            sessionId: session._id.toString(),
            title: session.title,
        });

        logger.info('Learning session created', {
            sessionId: session._id.toString(),
            jobId,
            userId,
        });

        res.status(StatusCodes.CREATED).json({
            success: true,
            data: {
                sessionId: session._id.toString(),
                isNew: true,
            },
        });

    } catch (error) {
        console.log('🔥 [SESSION] Error creating session:', error);
        logger.error('Error creating learning session:', error);
        next(error);
    }
}

/**
 * Get learning session by ID
 * GET /sessions/:sessionId
 */
export async function getSession(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const sessionIdParam = req.params['sessionId'];
        const sessionId = Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam;

        console.log('📚 [SESSION] Fetching session:', sessionId);

        if (!sessionId) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                error: {
                    code: 'MISSING_SESSION_ID',
                    message: 'Session ID is required',
                },
            });
            return;
        }

        const session = await LearningSession.findById(sessionId);

        if (!session) {
            res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: {
                    code: 'SESSION_NOT_FOUND',
                    message: 'Learning session not found',
                },
            });
            return;
        }

        console.log('✅ [SESSION] Session found:', {
            sessionId: session._id.toString(),
            title: session.title,
            blocksCount: session.blocks.length,
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                sessionId: session._id.toString(),
                jobId: session.jobId,
                fileName: session.fileName,
                strategy: session.strategy,
                blocks: session.blocks,
                layoutMarkdown: session.layoutMarkdown,
                qualityScore: session.qualityScore,
                processingTime: session.processingTime,
                imageInfo: session.imageInfo,
                imageBase64: session.imageBase64,
                title: session.title,
                topic: session.topic,
                difficulty: session.difficulty,
                status: session.status,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                solvedAt: session.solvedAt,
            },
        });

    } catch (error) {
        console.log('🔥 [SESSION] Error fetching session:', error);
        logger.error('Error fetching learning session:', error);
        next(error);
    }
}

/**
 * Get user's session history
 * GET /sessions
 */
export async function getSessionHistory(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = (req as any).user?.id;
        const { status, limit = 20, offset = 0 } = req.query;

        console.log('📚 [SESSION] Fetching session history:', { userId, status, limit, offset });

        const query: any = {};
        if (userId) query.userId = userId;
        if (status) query.status = status;

        const sessions = await LearningSession.find(query)
            .sort({ createdAt: -1 })
            .skip(Number(offset))
            .limit(Number(limit))
            .select('-imageBase64'); // Exclude base64 for list view

        const total = await LearningSession.countDocuments(query);

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                sessions: sessions.map(s => ({
                    sessionId: s._id.toString(),
                    jobId: s.jobId,
                    title: s.title,
                    topic: s.topic,
                    difficulty: s.difficulty,
                    status: s.status,
                    blocksCount: s.blocks.length,
                    createdAt: s.createdAt,
                    solvedAt: s.solvedAt,
                })),
                pagination: {
                    total,
                    limit: Number(limit),
                    offset: Number(offset),
                    hasMore: Number(offset) + sessions.length < total,
                },
            },
        });

    } catch (error) {
        console.log('🔥 [SESSION] Error fetching history:', error);
        logger.error('Error fetching session history:', error);
        next(error);
    }
}

/**
 * Update session status
 * PATCH /sessions/:sessionId
 */
export async function updateSession(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const sessionIdParam = req.params['sessionId'];
        const sessionId = Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam;
        const { status, title, topic, difficulty } = req.body;

        console.log('📚 [SESSION] Updating session:', { sessionId, status, title });

        const session = await LearningSession.findById(sessionId);

        if (!session) {
            res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: {
                    code: 'SESSION_NOT_FOUND',
                    message: 'Learning session not found',
                },
            });
            return;
        }

        if (status) session.status = status;
        if (title) session.title = title;
        if (topic) session.topic = topic;
        if (difficulty) session.difficulty = difficulty;
        if (status === 'solved') session.solvedAt = new Date();

        await session.save();

        console.log('✅ [SESSION] Session updated:', sessionId);

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                sessionId: session._id.toString(),
                status: session.status,
            },
        });

    } catch (error) {
        console.log('🔥 [SESSION] Error updating session:', error);
        logger.error('Error updating learning session:', error);
        next(error);
    }
}

/**
 * Generate title from blocks
 */
function generateTitle(blocks: Array<{ type: string; latex?: string; content?: string }> | undefined): string {
    if (!blocks || blocks.length === 0) return 'Math Problem';

    const firstBlock = blocks[0];
    if (!firstBlock) return 'Math Problem';

    if (firstBlock.latex) {
        // Truncate long LaTeX
        const latex = firstBlock.latex.length > 50
            ? firstBlock.latex.substring(0, 50) + '...'
            : firstBlock.latex;
        return `Formula: ${latex}`;
    }
    if (firstBlock.content) {
        const content = firstBlock.content.length > 50
            ? firstBlock.content.substring(0, 50) + '...'
            : firstBlock.content;
        return content;
    }
    return 'Math Problem';
}

export default {
    createSession,
    getSession,
    getSessionHistory,
    updateSession,
};
