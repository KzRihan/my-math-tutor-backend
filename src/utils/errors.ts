/**
 * Custom Error Classes
 * 
 * Provides a hierarchy of typed errors for consistent error handling.
 * All custom errors extend AppError which includes HTTP status codes.
 */

import { StatusCodes, ReasonPhrases } from 'http-status-codes';

/**
 * Base application error
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Resource not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(
      `${resource} not found`,
      StatusCodes.NOT_FOUND,
      'NOT_FOUND'
    );
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string = 'Validation failed', errors: Record<string, string[]> = {}) {
    super(
      message,
      StatusCodes.BAD_REQUEST,
      'VALIDATION_ERROR'
    );
    this.errors = errors;
  }
}

/**
 * Authentication error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = ReasonPhrases.UNAUTHORIZED) {
    super(
      message,
      StatusCodes.UNAUTHORIZED,
      'UNAUTHORIZED'
    );
  }
}

/**
 * Authorization error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = ReasonPhrases.FORBIDDEN) {
    super(
      message,
      StatusCodes.FORBIDDEN,
      'FORBIDDEN'
    );
  }
}

/**
 * Conflict error (409) - for duplicate resources
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(
      message,
      StatusCodes.CONFLICT,
      'CONFLICT'
    );
  }
}

/**
 * Bad request error (400) - for invalid requests
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(
      message,
      StatusCodes.BAD_REQUEST,
      'BAD_REQUEST'
    );
  }
}

/**
 * Rate limit exceeded error (429)
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(
      message,
      StatusCodes.TOO_MANY_REQUESTS,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}

/**
 * Database operation error (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(
      message,
      StatusCodes.INTERNAL_SERVER_ERROR,
      'DATABASE_ERROR',
      false // Not operational - indicates a programming or infrastructure error
    );
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service unavailable') {
    super(
      `${service}: ${message}`,
      StatusCodes.BAD_GATEWAY,
      'EXTERNAL_SERVICE_ERROR'
    );
  }
}
