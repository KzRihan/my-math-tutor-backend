/* eslint-disable @typescript-eslint/no-unused-vars */
import { IUserDTO } from '../domain/interfaces/user.interface';

// Augment the Express module globally
declare module 'express-serve-static-core' {
  interface Request {
    /** Authenticated user information */
    user?: IUserDTO;
    
    /** Request correlation ID for distributed tracing */
    requestId?: string;
    
    /** Request start time for logging */
    startTime?: number;
  }
}

export {};
