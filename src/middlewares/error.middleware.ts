/**
 * Error Middleware
 * 
 * Centralized error handling for Express.
 * Catches all errors and formats consistent error responses.
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError, ValidationError } from '@utils/errors';
import { sendError } from '@utils/response';
import logger from '@utils/logger';
import { config } from '@config/index';

/**
 * Handle Zod validation errors
 */
function handleZodError(error: ZodError): ValidationError {
  const errors: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });

  return new ValidationError('Validation failed', errors);
}

/**
 * Handle Mongoose validation errors
 */
function handleMongooseValidationError(
  error: mongoose.Error.ValidationError
): ValidationError {
  const errors: Record<string, string[]> = {};

  Object.values(error.errors).forEach((err) => {
    errors[err.path] = [err.message];
  });

  return new ValidationError('Validation failed', errors);
}

/**
 * Handle Mongoose cast errors (invalid ObjectId)
 */
function handleCastError(error: mongoose.Error.CastError): AppError {
  return new AppError(
    `Invalid ${error.path}: ${error.value}`,
    StatusCodes.BAD_REQUEST,
    'INVALID_ID'
  );
}

/**
 * Handle MongoDB duplicate key error
 */
function handleDuplicateKeyError(error: MongoError): AppError {
  const field = Object.keys(error.keyValue || {})[0] || 'field';
  return new AppError(
    `Duplicate value for ${field}`,
    StatusCodes.CONFLICT,
    'DUPLICATE_KEY'
  );
}

/**
 * MongoDB error type
 */
interface MongoError extends Error {
  code: number;
  keyValue?: Record<string, unknown>;
}

/**
 * Check if error is MongoDB error
 */
function isMongoError(error: unknown): error is MongoError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let appError: AppError;

  // Transform known error types to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = handleZodError(error);
  } else if (error instanceof mongoose.Error.ValidationError) {
    appError = handleMongooseValidationError(error);
  } else if (error instanceof mongoose.Error.CastError) {
    appError = handleCastError(error);
  } else if (isMongoError(error) && error.code === 11000) {
    appError = handleDuplicateKeyError(error);
  } else {
    // Unknown error - wrap it
    appError = new AppError(
      config.app.isProduction
        ? 'An unexpected error occurred'
        : error.message,
      StatusCodes.INTERNAL_SERVER_ERROR,
      'INTERNAL_ERROR',
      false
    );
  }

  // Log the error
  if (!appError.isOperational || appError.statusCode >= 500) {
    logger.error('Unhandled error:', {
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      code: appError.code,
    });
  } else {
    logger.warn('Handled error:', {
      message: appError.message,
      code: appError.code,
      path: req.path,
    });
  }

  // Prepare error details for response
  const details = appError instanceof ValidationError
    ? appError.errors
    : config.app.isDevelopment
      ? { stack: error.stack }
      : undefined;

  sendError(
    res,
    appError.statusCode,
    appError.code,
    appError.message,
    details
  );
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  sendError(
    res,
    StatusCodes.NOT_FOUND,
    'NOT_FOUND',
    `Route ${req.method} ${req.path} not found`
  );
};

export default errorHandler;
