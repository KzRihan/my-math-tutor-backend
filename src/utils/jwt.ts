/**
 * JWT Utility
 * 
 * Handles JWT token generation and verification.
 * Provides access and refresh token functionality.
 */

import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { config } from '@config/index';
import { createChildLogger } from '@utils/logger';

const jwtLogger = createChildLogger('jwt');

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Token pair structure
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

/**
 * Decoded token structure
 */
export interface DecodedToken extends JWTPayload, JwtPayload {}

/**
 * Generate access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
    issuer: 'my-math-tutor',
    audience: 'my-math-tutor-api',
  };

  return jwt.sign(payload, config.jwt.secret, options);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    issuer: 'my-math-tutor',
    audience: 'my-math-tutor-api',
  };

  return jwt.sign({ ...payload, type: 'refresh' }, config.jwt.secret, options);
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: JWTPayload): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Parse expiration time to seconds
  const expiresIn = parseExpiresIn(config.jwt.accessExpiresIn);

  jwtLogger.debug('Token pair generated', { userId: payload.userId });

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): DecodedToken {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'my-math-tutor',
      audience: 'my-math-tutor-api',
    }) as DecodedToken;

    return decoded;
  } catch (error) {
    jwtLogger.warn('Access token verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): DecodedToken {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'my-math-tutor',
      audience: 'my-math-tutor-api',
    }) as DecodedToken & { type?: string };

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    jwtLogger.warn('Refresh token verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwt.decode(token) as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Parse expires in string to seconds
 */
function parseExpiresIn(expiresIn: string | undefined): number {
  if (!expiresIn) {
    return 900; // Default 15 minutes
  }

  const match = expiresIn.match(/^(\d+)([smhd])$/);
  
  if (!match) {
    return 900; // Default 15 minutes
  }

  const valueStr = match[1];
  const unit = match[2];
  
  if (!valueStr || !unit) {
    return 900; // Default 15 minutes
  }

  const value = parseInt(valueStr, 10);

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return 900;
  }
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
