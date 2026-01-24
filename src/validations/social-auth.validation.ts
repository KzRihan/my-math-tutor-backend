/**
 * Social Auth Validation Schemas
 * 
 * Validation schemas for social login endpoints.
 */

import { z } from 'zod';

/**
 * Google Sign-in Schema
 * Validates the ID token from Google Sign-In SDK
 */
export const googleSigninSchema = z.object({
  /** Google ID token from Sign-In SDK */
  idToken: z.string({
    required_error: 'Google ID token is required',
  }).min(100, 'Invalid Google ID token'),
  
  /** Optional device token for push notifications */
  deviceToken: z.string().optional(),
  
  /** Optional device type */
  deviceType: z.enum(['android', 'ios', 'web']).optional(),
});

export type GoogleSigninInput = z.infer<typeof googleSigninSchema>;

/**
 * Apple Sign-in Schema (for future implementation)
 */
export const appleSigninSchema = z.object({
  /** Apple identity token */
  identityToken: z.string({
    required_error: 'Apple identity token is required',
  }),
  
  /** Authorization code from Apple */
  authorizationCode: z.string({
    required_error: 'Authorization code is required',
  }),
  
  /** User info (only provided on first login) */
  user: z.object({
    email: z.string().email().optional(),
    name: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }).optional(),
  }).optional(),
  
  /** Optional device token for push notifications */
  deviceToken: z.string().optional(),
  
  /** Optional device type */
  deviceType: z.enum(['android', 'ios', 'web']).optional(),
});

export type AppleSigninInput = z.infer<typeof appleSigninSchema>;
