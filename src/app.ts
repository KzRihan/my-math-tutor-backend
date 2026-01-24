/**
 * Express Application Setup
 * 
 * Creates and configures Express application with:
 * - Security middleware (helmet, cors)
 * - Request parsing (json, urlencoded)
 * - Compression
 * - Rate limiting
 * - Logging
 * - Error handling
 */

// Module augmentation for Express Request
declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    startTime?: number;
  }
}

import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
// import rateLimit from 'express-rate-limit'; // COMMENTED OUT - Rate limiting disabled
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

import { config } from '@config/index';
import { createRouter } from '@routes/index';
import { errorHandler, notFoundHandler } from '@middlewares/error.middleware';
import logger from '@utils/logger';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // ============================================================
  // Trust Proxy (for reverse proxy setups like nginx)
  // ============================================================
  app.set('trust proxy', 1);

  // ============================================================
  // Security Middleware
  // ============================================================
  
  // Helmet - sets various HTTP headers for security
  app.use(helmet({
    contentSecurityPolicy: config.app.isProduction,
  }));

  // CORS - configure allowed origins
  app.use(cors({
    origin: config.app.isDevelopment 
      ? '*' 
      : ['http://localhost:3000'], // Add your frontend URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // ============================================================
  // Rate Limiting (excluding agent/chat routes)
  // ============================================================
  // RATE LIMITING COMMENTED OUT FOR NOW
  /*
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for agent/chat endpoints
    skip: (req: Request): boolean => {
      // Check all possible path properties
      const checkPath = (path: string): boolean => {
        if (!path) return false;
        const lowerPath = path.toLowerCase();
        return lowerPath.includes('/agent') || lowerPath.includes('/api/v1/agent');
      };
      
      return checkPath(req.originalUrl || '') || 
             checkPath(req.url || '') || 
             checkPath(req.path || '');
    },
  });

  app.use(limiter);
  */

  // ============================================================
  // Request Parsing
  // ============================================================
  
  // Parse JSON bodies
  app.use(express.json({ limit: '10mb' }));
  
  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ============================================================
  // Compression
  // ============================================================
  
  app.use(compression());

  // ============================================================
  // Static Files - Serve uploaded files
  // ============================================================
  
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // ============================================================
  // Request ID & Logging
  // ============================================================
  
  // Add request ID and timing
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
    req.startTime = Date.now();
    
    res.setHeader('X-Request-ID', req.requestId);
    
    next();
  });

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      const duration = Date.now() - (req.startTime || Date.now());
      
      logger.http(`${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });
    
    next();
  });

  // ============================================================
  // Routes
  // ============================================================
  
  app.use(createRouter());

  // ============================================================
  // Error Handling
  // ============================================================
  
  // 404 handler
  app.use(notFoundHandler);
  
  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;
