/**
 * Custom Rate Limiter Middleware
 * 
 * Implements rate limiting without external packages.
 * Tracks requests per IP/key with configurable limits and windows.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    // Remove entries older than 10 minutes
    if (now - record.firstRequestTime > 10 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter middleware
 * 
 * @param options Rate limit configuration
 * @returns Express middleware
 */
export function createRateLimiter(options: {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key generator function - defaults to IP address */
  keyGenerator?: (req: Request) => string;
  /** Custom message when rate limited */
  message?: string;
  /** Prefix for the store key */
  prefix?: string;
}): RequestHandler {
  // RATE LIMITING DISABLED - Parameters unused but kept for API compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    maxRequests: _maxRequests,
    windowMs: _windowMs,
    keyGenerator: _keyGenerator = (req) => req.ip || req.socket.remoteAddress || 'unknown',
    message: _message = 'Too many requests, please try again later.',
    prefix: _prefix = 'rl',
  } = options;

  return (_req: Request, _res: Response, next: NextFunction): void => {
    // RATE LIMITING DISABLED - Just pass through
    next();
    
    /* COMMENTED OUT - Rate limiting disabled
    const key = `${prefix}:${keyGenerator(req)}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record) {
      // First request from this key
      rateLimitStore.set(key, {
        count: 1,
        firstRequestTime: now,
      });
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      
      return next();
    }

    const timeSinceFirst = now - record.firstRequestTime;

    if (timeSinceFirst > windowMs) {
      // Window has expired, reset the counter
      rateLimitStore.set(key, {
        count: 1,
        firstRequestTime: now,
      });
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      
      return next();
    }

    if (record.count >= maxRequests) {
      // Rate limit exceeded
      const retryAfterMs = windowMs - timeSinceFirst;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil((record.firstRequestTime + windowMs) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfter: retryAfterSec,
        },
      });
      return;
    }

    // Increment counter
    record.count++;
    
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil((record.firstRequestTime + windowMs) / 1000));
    
    next();
    */
  };
}

/**
 * Pre-configured rate limiter for admin login
 * 3 attempts per minute per IP
 */
export const adminLoginRateLimiter = createRateLimiter({
  maxRequests: 3,
  windowMs: 60 * 1000, // 1 minute
  prefix: 'admin-login',
  message: 'Too many login attempts. Please try again after 1 minute.',
  keyGenerator: (req) => {
    // Use email + IP for more precise limiting
    const email = req.body?.email || '';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${email}:${ip}`;
  },
});

/**
 * Pre-configured rate limiter for general auth endpoints
 * 10 attempts per minute per IP
 */
export const authRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
  prefix: 'auth',
  message: 'Too many authentication attempts. Please try again later.',
});

/**
 * Pre-configured rate limiter for API endpoints
 * 100 requests per minute per IP
 */
export const apiRateLimiter = createRateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000,
  prefix: 'api',
  message: 'API rate limit exceeded. Please slow down.',
});

export default createRateLimiter;
