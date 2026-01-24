/**
 * Login Activity Model
 * 
 * Tracks user login attempts for security and auditing
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

/**
 * Login Activity Interface
 */
export interface ILoginActivity {
  userId: mongoose.Types.ObjectId;
  email: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  success: boolean;
  failureReason?: string;
  timestamp: Date;
}

/**
 * Login Activity Document (with Mongoose methods)
 */
export type LoginActivityDocument = HydratedDocument<ILoginActivity>;

/**
 * Login Activity Schema
 */
const LoginActivitySchema = new Schema<LoginActivityDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    device: {
      type: String,
      default: 'Unknown',
    },
    browser: {
      type: String,
      default: 'Unknown',
    },
    os: {
      type: String,
      default: 'Unknown',
    },
    success: {
      type: Boolean,
      required: true,
      index: true,
    },
    failureReason: {
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
    collection: 'login_activities',
  }
);

// Compound index for efficient queries
LoginActivitySchema.index({ userId: 1, timestamp: -1 });
LoginActivitySchema.index({ email: 1, timestamp: -1 });

/**
 * Login Activity Model
 */
export const LoginActivity: Model<LoginActivityDocument> = mongoose.model<LoginActivityDocument>(
  'LoginActivity',
  LoginActivitySchema
);

export default LoginActivity;
