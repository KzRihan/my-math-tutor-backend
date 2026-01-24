/**
 * Server Entry Point
 * 
 * Application bootstrap with:
 * - Database connection
 * - Redis connection
 * - Queue worker initialization
 * - Graceful shutdown handling
 */

// Import reflect-metadata first for dependency injection
import 'reflect-metadata';

import http from 'http';
import { config } from '@config/index';
import { createApp } from './app';
import { configureContainer } from '@container/index';
import { connectDatabase, disconnectDatabase } from '@infrastructure/database/mongoose';
import { connectRedis, disconnectRedis } from '@infrastructure/redis/client';
import { startEmailWorker, stopEmailWorker } from '@infrastructure/queue/workers/email.worker';
import { startOcrWorker, stopOcrWorker } from '@infrastructure/queue/workers/ocr.worker';
import { startAgentWorker, stopAgentWorker } from '@infrastructure/queue/workers/agent.worker';
import { closeAllQueues } from '@infrastructure/queue/producer';
import logger from '@utils/logger';
import { createAdminUser } from '@utils/create-admin';

/** Server instance */
let server: http.Server;

/**
 * Bootstrap application
 */
async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting application...');
    logger.info(`Environment: ${config.app.nodeEnv}`);

    // ============================================================
    // Configure Dependency Injection
    // ============================================================
    logger.info('Configuring dependency injection container...');
    configureContainer();

    // ============================================================
    // Connect to MongoDB
    // ============================================================
    logger.info('Connecting to MongoDB...');
    await connectDatabase();

    // Create admin user after database connects
    await createAdminUser();

    // Initialize achievements (seed data)
    const { AchievementService } = await import('@services/achievement.service');
    const { container } = await import('tsyringe');
    const achievementService = container.resolve(AchievementService);
    await achievementService.initializeAchievements();
    logger.info('✅ Achievements initialized');

    // ============================================================
    // Connect to Redis (Optional - for queue functionality)
    // ============================================================
    let redisConnected = false;

    // Skip Redis entirely if workers are disabled
    if (config.features.disableWorkers) {
      logger.info('⏸️ Redis skipped - DISABLE_WORKERS=true');
    } else {
      try {
        logger.info('Connecting to Redis...');
        await connectRedis();
        redisConnected = true;
        logger.info('✅ Redis connected successfully');
      } catch (redisError) {
        logger.warn('⚠️ Redis not available - queue features disabled');
        logger.warn('   To enable queues, start Redis: docker run -d --name redis -p 6379:6379 redis:alpine');
      }
    }

    // ============================================================
    // Start Queue Workers (only if Redis is connected)
    // ============================================================
    if (redisConnected) {
      logger.info('Starting queue workers...');
      startEmailWorker();
      startOcrWorker();
      startAgentWorker();
    }

    // ============================================================
    // Create Express App
    // ============================================================
    const app = createApp();

    // ============================================================
    // Start HTTP Server
    // ============================================================
    server = http.createServer(app);

    server.listen(config.app.port, () => {
      logger.info(`✅ Server running on http://localhost:${config.app.port}`);
      logger.info(`📚 API docs: http://localhost:${config.app.port}/api`);
      logger.info(`❤️  Health: http://localhost:${config.app.port}/health`);
      if (!redisConnected) {
        logger.warn('⚠️ Running without Redis - OCR queue and email queue disabled');
      }
    });

    // ============================================================
    // Handle Server Errors
    // ============================================================
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.app.port} is already in use`);
        process.exit(1);
      }
      throw error;
    });

  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    if (server) {
      logger.info('Closing HTTP server...');
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed');
    }

    // Stop queue workers (graceful - may not have started)
    try {
      logger.info('Stopping queue workers...');
      await stopEmailWorker();
      await stopOcrWorker();
      await stopAgentWorker();

      // Close all queues
      logger.info('Closing queues...');
      await closeAllQueues();

      // Disconnect from Redis
      logger.info('Disconnecting from Redis...');
      await disconnectRedis();
    } catch {
      // Redis/queues may not have been initialized
      logger.debug('Redis/queues were not initialized - skipping cleanup');
    }

    // Disconnect from MongoDB
    logger.info('Disconnecting from MongoDB...');
    await disconnectDatabase();

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// ============================================================
// Process Event Handlers
// ============================================================

// Graceful shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  shutdown('uncaughtException');
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});

// ============================================================
// Start Application
// ============================================================

bootstrap();
