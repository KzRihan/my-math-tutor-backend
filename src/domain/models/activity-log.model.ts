/**
 * Activity Log Model
 * 
 * Tracks system-wide activities for auditing and monitoring
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * Activity Type Enum
 */


export enum ActivityType {
  CONTENT = 'content',
  AI = 'ai',
  USER = 'user',
  SYSTEM = 'system',
  SECURITY = 'security',
}

/**
 * Activity Log Interface
 */
export interface IActivityLog {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  type: ActivityType;
  action: string;
  message: string;
  icon: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * Activity Log Document
 */
export interface ActivityLogDocument extends IActivityLog, Document {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Activity Log Schema
 */
const ActivityLogSchema = new Schema<ActivityLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: '📝',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'activity_logs',
  }
);

// Compound indexes for efficient queries
ActivityLogSchema.index({ type: 1, timestamp: -1 });
ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ timestamp: -1 }); // For recent activities

/**
 * Activity Log Model
 */
export const ActivityLog = mongoose.model<ActivityLogDocument>(
  'ActivityLog',
  ActivityLogSchema
);

export default ActivityLog;
