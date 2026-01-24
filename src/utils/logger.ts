/**
 * Winston Logger Configuration
 * 
 * Provides structured logging with different formats for development and production.
 * Supports log levels, timestamps, and colored output in development.
 */

import winston from 'winston';
import { config } from '@config/index';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/**
 * Custom log format for development - human readable
 */
const devFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  return msg;
});

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'my-math-tutor' },
  
  // Use different formats based on environment
  format: combine(
    errors({ stack: true }), // Capture stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.logging.format === 'json' && config.app.isProduction
      ? json()
      : combine(colorize(), devFormat)
  ),
  
  transports: [
    // Console transport - always enabled
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    
    // File transport for errors - production only
    ...(config.app.isProduction
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
  
  // Don't exit on handled exceptions
  exitOnError: false,
});

/**
 * Stream for Morgan HTTP logging integration
 */
export const morganStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

/**
 * Child logger factory - creates namespaced loggers
 * 
 * @example
 * const dbLogger = createChildLogger('database');
 * dbLogger.info('Connected to MongoDB');
 */
export function createChildLogger(namespace: string): winston.Logger {
  return logger.child({ namespace });
}

export default logger;
