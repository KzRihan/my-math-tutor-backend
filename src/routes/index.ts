import { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createUserRoutes } from './user.routes';
import { createAuthRoutes } from './auth.routes';
import { createAdminRoutes } from './admin.routes';
import { createTopicRoutes } from './topic.routes';
import { createEnrollmentRoutes } from './enrollment.routes';
import { createAchievementRoutes } from './achievement.routes';
import ocrRoutes from './ocr.routes';
import sessionRoutes from './session.routes';
import agentRoutes from './agent.routes';
import questionResponseRoutes from './question-response.routes';
import { config } from '@config/index';
import { isDatabaseConnected } from '@infrastructure/database/mongoose';
import { isRedisHealthy } from '@infrastructure/redis/client';
import { getQueueStats } from '@infrastructure/queue/producer';

/**
 * Create main router
 */
export function createRouter(): Router {
  const router = Router();
  const apiVersion = config.app.apiVersion;

  // ============================================================
  // Health Check Endpoints
  // ============================================================

  /**
   * Basic health check
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Detailed health check (readiness probe)
   */
  router.get('/health/ready', async (_req: Request, res: Response) => {
    try {
      const [mongoHealthy, redisHealthy] = await Promise.all([
        Promise.resolve(isDatabaseConnected()),
        isRedisHealthy(),
      ]);

      const status = mongoHealthy && redisHealthy
        ? StatusCodes.OK
        : StatusCodes.SERVICE_UNAVAILABLE;

      res.status(status).json({
        success: status === StatusCodes.OK,
        timestamp: new Date().toISOString(),
        services: {
          mongodb: mongoHealthy ? 'healthy' : 'unhealthy',
          redis: redisHealthy ? 'healthy' : 'unhealthy',
        },
      });
    } catch (error) {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Queue statistics
   */
  router.get('/health/queues', async (_req: Request, res: Response) => {
    try {
      const emailQueueStats = await getQueueStats(config.queue.emailQueueName);

      res.status(StatusCodes.OK).json({
        success: true,
        timestamp: new Date().toISOString(),
        queues: {
          email: emailQueueStats,
          ocr: await getQueueStats(config.queue.ocrQueueName),
          agent: await getQueueStats(config.queue.agentQueueName),
        },
      });
    } catch (error) {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'Failed to get queue stats',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ============================================================
  // API Routes
  // ============================================================

  /**
   * Mount auth routes
   * /api/v1/auth
   */
  router.use(`/api/${apiVersion}/auth`, createAuthRoutes());

  /**
   * Mount user routes
   * /api/v1/users
   */
  router.use(`/api/${apiVersion}/users`, createUserRoutes());

  /**
   * Mount OCR routes
   * /api/v1/ocr
   */
  router.use(`/api/${apiVersion}/ocr`, ocrRoutes);

  /**
   * Mount session routes
   * /api/v1/sessions
   */
  router.use(`/api/${apiVersion}/sessions`, sessionRoutes);

  /**
   * Mount agent routes
   * /api/v1/agent
   */
  router.use(`/api/${apiVersion}/agent`, agentRoutes);

  /**
   * Mount admin routes
   * /api/v1/admin
   */
  router.use(`/api/${apiVersion}/admin`, createAdminRoutes());

  /**
   * Mount public topic routes
   * /api/v1/topics
   */
  router.use(`/api/${apiVersion}`, createTopicRoutes());

  /**
   * Mount enrollment routes
   * /api/v1/enrollments
   */
  router.use(`/api/${apiVersion}`, createEnrollmentRoutes());

  /**
   * Mount achievement routes
   * /api/v1/achievements
   */
  router.use(`/api/${apiVersion}/achievements`, createAchievementRoutes());

  /**
   * Mount question response routes
   * /api/v1/questions
   */
  router.use(`/api/${apiVersion}/questions`, questionResponseRoutes);

  // Add more route modules here:
  // router.use(`/api/${apiVersion}/courses`, createCourseRoutes());
  // router.use(`/api/${apiVersion}/lessons`, createLessonRoutes());

  // ============================================================
  // API Info
  // ============================================================

  /**
   * API root endpoint - shows available routes
   */
  router.get('/api', (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'My Math Tutor API',
      version: apiVersion,
      endpoints: {
        health: '/health',
        healthReady: '/health/ready',
        healthQueues: '/health/queues',
        auth: `/api/${apiVersion}/auth`,
        users: `/api/${apiVersion}/users`,
        ocr: `/api/${apiVersion}/ocr`,
        sessions: `/api/${apiVersion}/sessions`,
        agent: `/api/${apiVersion}/agent`,
        admin: `/api/${apiVersion}/admin`,
        topics: `/api/${apiVersion}/topics`,
        enrollments: `/api/${apiVersion}/enrollments`,
        achievements: `/api/${apiVersion}/achievements`,
        questions: `/api/${apiVersion}/questions`,
      },
    });
  });

  return router;
}

export default createRouter;

