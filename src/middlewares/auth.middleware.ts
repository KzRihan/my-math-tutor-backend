/**
 * Authentication Middleware
 * 
 * Placeholder for authentication logic.
 * In production, implement JWT or session-based authentication.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@utils/errors';
import { UserRole } from '@domain/enums/user-status.enum';
import { IUserDTO } from '@domain/interfaces/user.interface';
import { verifyAccessToken } from '@utils/jwt';
import { container } from 'tsyringe';
import { UserService } from '@services/user.service';

/**
 * Extend Express Request to include user
 */
declare global {
  namespace Express {
    interface Request {
      user?: IUserDTO;
    }
  }
}

/**
 * Authenticate request
 * In production, verify JWT token and attach user to request
 */
export const authenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    console.log("authHeader+++++++++++++++++++++++++++", authHeader);


    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Invalid authentication token');
    }

    try {
      // 1. Verify access token
      const decoded = verifyAccessToken(token);
      console.log("decoded++++++++++++++++++++++++++", decoded);

      // 2. Get user from database
      const userService = container.resolve(UserService);
      let user: IUserDTO;
      
      try {
        user = await userService.getUserById(decoded.userId);
        console.log("user++++++++++++++++++++++++++", user);
      } catch (error) {
        // If user not found, treat as invalid token (401 Unauthorized)
        if (error instanceof NotFoundError) {
          throw new UnauthorizedError('User not found - invalid token');
        }
        // Re-throw other errors
        throw error;
      }

      // 3. Check if user exists (additional safety check)
      if (!user) {
        throw new UnauthorizedError('User not found - invalid token');
      }

      // 4. Attach user to request
      req.user = user;
      next();
    } catch (error) {
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize by roles
 * 
 * @example
 * router.delete('/users/:id', 
 *   authenticate, 
 *   authorize(UserRole.ADMIN), 
 *   userController.delete
 * );
 */
export function authorize(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    console.log('🔐 Authorization Check:', {
      userRole: req.user.role,
      allowedRoles,
      userId: req.user.id,
      email: req.user.email,
      isAuthorized: allowedRoles.includes(req.user.role as UserRole)
    });

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Optional authentication
 * Attaches user if token present, but doesn't require it
*/
export const optionalAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (token) {
      // TODO: Verify token and attach user
      // try {
      //   const decoded = jwt.verify(token, config.jwt.secret);
      //   req.user = await userService.getUserById(decoded.userId);
      // } catch {
      //   // Token invalid, but that's OK for optional auth
      // }
    }
  }

  next();
};

/**
 * Rate limiting by user
 * Can be used for user-specific rate limits
 */
export function userRateLimit(
  _limit: number,
  _windowMs: number = 60000
): RequestHandler {
  // RATE LIMITING DISABLED - Just pass through
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
  
  /* COMMENTED OUT - Rate limiting disabled
  const requests = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const record = requests.get(key);

    if (!record || now > record.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= limit) {
      return next(new ForbiddenError('Rate limit exceeded'));
    }

    record.count++;
    next();
  };
  */
}

export default authenticate;
