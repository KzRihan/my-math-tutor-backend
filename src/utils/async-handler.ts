/**
 * Async Handler Utility
 * 
 * Wraps async route handlers to automatically catch and forward errors
 * to the Express error handling middleware.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Async handler type definition
 */
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async function to catch errors and pass them to next()
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.findAll();
 *   res.json(users);
 * }));
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Alternative: Higher-order function for class method binding
 * Useful when using controllers as classes
 * 
 * @example
 * @catchAsync
 * async getUser(req: Request, res: Response) {
 *   // ...
 * }
 */
export function catchAsync(
  _target: unknown,
  _propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value as AsyncRequestHandler;

  descriptor.value = function (
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    Promise.resolve(originalMethod.call(this, req, res, next)).catch(next);
  };

  return descriptor;
}

export default asyncHandler;
