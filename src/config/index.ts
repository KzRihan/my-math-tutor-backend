/**
 * Configuration Module
 * 
 * Provides type-safe environment configuration with Zod validation.
 * All environment variables are validated at startup - fail fast on misconfiguration.
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
// Try common locations to avoid relying on the current working directory.
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

/**
 * Environment configuration schema
 * Uses Zod for runtime validation and type inference
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_VERSION: z.string().default('v1'),

  // MongoDB
  MONGODB_URI: z.string().url().or(z.string().startsWith('mongodb')),
  MONGODB_MIN_POOL_SIZE: z.string().transform(Number).default('5'),
  MONGODB_MAX_POOL_SIZE: z.string().transform(Number).default('20'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),

  // Queue
  QUEUE_EMAIL_NAME: z.string().default('email-queue'),
  QUEUE_OCR_NAME: z.string().default('ocr-queue'),
  QUEUE_AGENT_NAME: z.string().default('agent-queue'),
  QUEUE_DEFAULT_ATTEMPTS: z.string().transform(Number).default('3'),
  QUEUE_BACKOFF_DELAY: z.string().transform(Number).default('5000'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_EMAIL: z.string().email().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_USER: z.string().optional(), // Legacy support
  SMTP_PASS: z.string().optional(), // Legacy support
  EMAIL_FROM: z.string().email().optional(),

  // JWT
  JWT_SECRET: z.string().default('your-super-secret-jwt-key-change-in-production'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('30d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // OCR Service
  OCR_API_URL: z.string().url().default('http://192.168.0.148:8501/ocr'),

  // Agent Service
  AGENT_API_URL: z.string().url().default('http://192.168.0.125:8502'),

  // AI Service (for topic and lesson generation)
  AI_SERVICE_URL: z.string().url().default('http://192.168.0.125:8503'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Feature Flags
  DISABLE_WORKERS: z.string().transform(val => val === 'true').default('false'),
});

// Parse and validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parseResult.error.format());
  process.exit(1);
}

const env = parseResult.data;

/**
 * Application configuration object
 * Provides structured, type-safe access to all configuration values
 */
export const config = {
  /** Application settings */
  app: {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    apiVersion: env.API_VERSION,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },

  /** MongoDB configuration */
  database: {
    uri: env.MONGODB_URI,
    options: {
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    },
  },

  /** Redis configuration */
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    username: env.REDIS_USERNAME,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
  },

  /** Queue configuration */
  queue: {
    emailQueueName: env.QUEUE_EMAIL_NAME,
    ocrQueueName: env.QUEUE_OCR_NAME,
    agentQueueName: env.QUEUE_AGENT_NAME,
    defaultAttempts: env.QUEUE_DEFAULT_ATTEMPTS,
    backoffDelay: env.QUEUE_BACKOFF_DELAY,
  },

  /** Logging configuration */
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },

  /** Rate limiting configuration */
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  /** Email configuration */
  email: {
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: env.SMTP_PORT || 587,
    user: env.SMTP_EMAIL || env.SMTP_USER,
    pass: env.SMTP_PASSWORD || env.SMTP_PASS,
    from: env.EMAIL_FROM || env.SMTP_EMAIL || env.SMTP_USER,
  },

  /** JWT configuration */
  jwt: {
    secret: env.JWT_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  /** OCR Service configuration */
  ocr: {
    apiUrl: env.OCR_API_URL,
  },

  /** Agent Service configuration */
  agent: {
    apiUrl: env.AGENT_API_URL,
  },

  /** AI Service configuration */
  ai: {
    apiUrl: env.AI_SERVICE_URL,
  },

  /** Google OAuth configuration */
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
  },

  /** Feature flags */
  features: {
    disableWorkers: env.DISABLE_WORKERS,
  },
} as const;

/** Type representing the config object */
export type Config = typeof config;

export default config;
