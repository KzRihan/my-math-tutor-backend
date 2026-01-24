/**
 * Redis Client Manager
 * 
 * Provides a singleton Redis client using ioredis with:
 * - Automatic reconnection
 * - Error handling
 * - Health check support
 * - Lazy initialization
 * - Separate BullMQ-optimized connections for workers
 */

import Redis, { RedisOptions } from 'ioredis';
import { config } from '@config/index';
import { createChildLogger } from '@utils/logger';

const redisLogger = createChildLogger('redis');

/** Singleton Redis client instance */
let redisClient: Redis | null = null;

/**
 * Base Redis connection options (shared settings)
 */
const baseRedisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  username: config.redis.username || undefined,
  password: config.redis.password || undefined,
  db: config.redis.db,

  // Retry strategy with exponential backoff
  retryStrategy: (times: number): number | null => {
    if (times > 10) {
      redisLogger.error('Redis max retries reached, giving up');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 200, 5000);
    redisLogger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },

  // Connection options
  enableReadyCheck: true,
  connectTimeout: 10000,
};

/**
 * Standard Redis client options (for general use)
 */
const redisOptions: RedisOptions = {
  ...baseRedisOptions,
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
  lazyConnect: true,
  commandTimeout: 30000, // 30 second timeout for commands (increased for job status checks with retries)
};

/**
 * BullMQ-specific Redis options
 * - No commandTimeout (blocking commands need to wait indefinitely)
 * - maxRetriesPerRequest: null (required by BullMQ)
 * - No lazyConnect (connect immediately)
 */
const bullMQRedisOptions: RedisOptions = {
  ...baseRedisOptions,
  maxRetriesPerRequest: null, // Required for BullMQ workers
  enableOfflineQueue: true, // Queue commands when disconnected
  lazyConnect: false, // Connect immediately
  // No commandTimeout - BullMQ uses blocking commands that need to wait
};

/**
 * Create and configure Redis client
 */
function createClient(): Redis {
  const client = new Redis(redisOptions);

  // Event handlers
  client.on('connect', () => {
    redisLogger.info('🔴 Redis connected');
  });

  client.on('ready', () => {
    redisLogger.info('Redis client ready');
  });

  client.on('error', (error: Error) => {
    redisLogger.error('Redis client error:', error);
  });

  client.on('close', () => {
    redisLogger.warn('Redis connection closed');
  });

  client.on('reconnecting', () => {
    redisLogger.info('Redis reconnecting...');
  });

  client.on('end', () => {
    redisLogger.info('Redis connection ended');
  });

  return client;
}

/**
 * Get or create Redis client (singleton pattern)
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createClient();
  }
  return redisClient;
}

/**
 * Connect to Redis
 * Should be called during application startup
 */
export async function connectRedis(): Promise<Redis> {
  const client = getRedisClient();

  try {
    await client.connect();
    return client;
  } catch (error) {
    redisLogger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

/**
 * Disconnect Redis client gracefully
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      redisLogger.info('Redis disconnected gracefully');
    } catch (error) {
      redisLogger.error('Error disconnecting Redis:', error);
      // Force disconnect if client still exists
      if (redisClient) {
        redisClient.disconnect();
      }
      redisClient = null;
    }
  }
}

/**
 * Check if Redis is connected and responsive
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Create a new Redis connection for specific use cases
 * (e.g., pub/sub, blocking operations)
 */
export function createDedicatedConnection(name: string): Redis {
  const options = { ...redisOptions, connectionName: name };
  const client = new Redis(options);

  client.on('error', (error: Error) => {
    redisLogger.error(`Redis [${name}] error:`, error);
  });

  return client;
}

/**
 * Create a new Redis connection optimized for BullMQ workers
 * Each BullMQ worker should have its own connection instance
 * @param name - Connection name for identification
 */
export function createBullMQConnection(name: string): Redis {
  const options: RedisOptions = {
    ...bullMQRedisOptions,
    connectionName: `bullmq-${name}`
  };
  const client = new Redis(options);

  client.on('connect', () => {
    redisLogger.debug(`BullMQ [${name}] connected`);
  });

  client.on('ready', () => {
    redisLogger.debug(`BullMQ [${name}] ready`);
  });

  client.on('error', (error: Error) => {
    redisLogger.error(`BullMQ [${name}] error:`, error);
  });

  client.on('close', () => {
    redisLogger.warn(`BullMQ [${name}] connection closed`);
  });

  return client;
}

/**
 * Get BullMQ-compatible connection options object
 * This returns raw options that BullMQ can use to create its own connections
 */
export function getBullMQConnectionOptions(): RedisOptions {
  return { ...bullMQRedisOptions };
}

export default {
  getClient: getRedisClient,
  connect: connectRedis,
  disconnect: disconnectRedis,
  isHealthy: isRedisHealthy,
  createDedicatedConnection,
  createBullMQConnection,
  getBullMQConnectionOptions,
};
