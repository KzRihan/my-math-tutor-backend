/**
 * Validation Middleware
 * 
 * Provides Zod-based request validation with type safety.
 * Validates body, query, and params with proper error handling.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { sendError } from '@utils/response';

/**
 * Validation targets
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation schema definition
 */
interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Create validation middleware
 * 
 * @example
 * router.post('/users', 
 *   validate({ body: createUserSchema }),
 *   userController.create
 * );
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targets: ValidationTarget[] = ['body', 'query', 'params'];

      for (const target of targets) {
        const schema = schemas[target];
        if (schema) {
          const parsed = await schema.parseAsync(req[target]);
          // Replace with parsed (and possibly transformed) data
          req[target] = parsed;
        }
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};

        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        sendError(
          res,
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          'Validation failed',
          errors
        );
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate only body
 */
export function validateBody<T extends ZodSchema>(schema: T): RequestHandler {
  return validate({ body: schema });
}

/**
 * Validate only query params
 */
export function validateQuery<T extends ZodSchema>(schema: T): RequestHandler {
  return validate({ query: schema });
}

/**
 * Validate only path params
 */
export function validateParams<T extends ZodSchema>(schema: T): RequestHandler {
  return validate({ params: schema });
}

// ============================================================
// Common Validation Schemas
// ============================================================

/**
 * MongoDB ObjectId validation
 */
export const objectIdSchema = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  'Invalid ID format'
);

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z.string().optional().transform((val) => parseInt(val || '1', 10)),
  limit: z.string().optional().transform((val) => Math.min(parseInt(val || '20', 10), 100)),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * ID params schema
 */
export const idParamsSchema = z.object({
  id: objectIdSchema,
});

// ============================================================
// User Validation Schemas
// ============================================================

// Import comprehensive user validation schemas
export {
  registerUserSchema,
  registerSocialUserSchema,
  loginSchema,
  updateUserSchema,
  updateDeviceSchema,
  changePasswordSchema,
  emailOnlySchema,
  userQuerySchema,
  verifyEmailTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@validations/user.validation';

// Legacy schemas for backward compatibility
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long'),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name too long'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name too long'),
  role: z.enum(['user', 'admin']).optional(),
});

export default validate;
