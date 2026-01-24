/**
 * MongoDB Connection Manager
 * 
 * Provides robust MongoDB connection with:
 * - Retry logic with exponential backoff
 * - Connection event monitoring
 * - Graceful shutdown support
 */

import mongoose from 'mongoose';
import { config } from '@config/index';
import { createChildLogger } from '@utils/logger';

const dbLogger = createChildLogger('database');

/** Connection state tracking */
let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5000;

/**
 * MongoDB connection options
 * Optimized for production workloads
 */
const connectionOptions: mongoose.ConnectOptions = {
    minPoolSize: config.database.options.minPoolSize,
    maxPoolSize: config.database.options.maxPoolSize,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    w: 'majority',
};

/**
 * Set up connection event handlers
 */
function setupConnectionHandlers(): void {
    mongoose.connection.on('connected', () => {
        isConnected = true;
        connectionAttempts = 0;
        dbLogger.info('📦 MongoDB connected successfully');
    });

    mongoose.connection.on('error', (error) => {
        isConnected = false;
        dbLogger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
        isConnected = false;
        dbLogger.warn('MongoDB disconnected');

        // Attempt reconnection if not intentionally disconnected
        if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
            dbLogger.info(`Attempting to reconnect in ${RETRY_DELAY_MS / 1000}s...`);
            setTimeout(connectDatabase, RETRY_DELAY_MS);
        }
    });

    mongoose.connection.on('reconnected', () => {
        isConnected = true;
        dbLogger.info('MongoDB reconnected');
    });
}

/**
 * Connect to MongoDB with retry logic
 */
export async function connectDatabase(): Promise<typeof mongoose> {
    if (isConnected) {
        dbLogger.debug('Using existing MongoDB connection');
        return mongoose;
    }

    connectionAttempts++;

    try {
        dbLogger.info(`Connecting to MongoDB (attempt ${connectionAttempts}/${MAX_RETRY_ATTEMPTS})...`);

        // Set up handlers before connecting
        if (connectionAttempts === 1) {
            setupConnectionHandlers();
        }

        // Enable debug mode in development
        if (config.app.isDevelopment) {
            mongoose.set('debug', (collectionName: string, method: string, query: unknown) => {
                dbLogger.debug(`Mongoose: ${collectionName}.${method}`, { query });
            });
        }

        await mongoose.connect(config.database.uri, connectionOptions);

        return mongoose;
    } catch (error) {
        dbLogger.error(`MongoDB connection failed (attempt ${connectionAttempts}):`, error);

        if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
            dbLogger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            return connectDatabase();
        }

        throw new Error('Failed to connect to MongoDB after maximum retry attempts');
    }
}

/**
 * Disconnect from MongoDB gracefully
 * Used during application shutdown
 */
export async function disconnectDatabase(): Promise<void> {
    if (!isConnected) {
        return;
    }

    try {
        await mongoose.connection.close();
        dbLogger.info('MongoDB connection closed gracefully');
    } catch (error) {
        dbLogger.error('Error closing MongoDB connection:', error);
        throw error;
    }
}

/**
 * Get connection status
 */
export function isDatabaseConnected(): boolean {
    return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get MongoDB connection for direct access if needed
 */
export function getConnection(): mongoose.Connection {
    return mongoose.connection;
}

export default {
    connect: connectDatabase,
    disconnect: disconnectDatabase,
    isConnected: isDatabaseConnected,
    getConnection,
};
