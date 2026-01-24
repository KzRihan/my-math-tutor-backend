/**
 * Learning Session Model
 * 
 * Stores OCR capture sessions with image data, extracted content, and chat history.
 * Used to track user's learning progress and provide AI tutoring.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ILearningSession extends Document {
  userId?: mongoose.Types.ObjectId;
  // OCR Data
  jobId: string;
  imageUrl?: string;
  imageBase64?: string;
  fileName: string;
  strategy: 'formula_only' | 'text_only' | 'mixed';
  // OCR Result
  blocks: Array<{
    type: string;
    latex?: string;
    content?: string;
    confidence: number;
    bbox?: number[];
  }>;
  layoutMarkdown: string;
  qualityScore: number;
  processingTime: number;
  imageInfo: {
    width: number;
    height: number;
    format: string;
  };
  // Session Metadata
  title?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  status: 'active' | 'solved' | 'abandoned';
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  solvedAt?: Date;
}

const LearningSessionSchema = new Schema<ILearningSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    imageUrl: {
      type: String,
    },
    imageBase64: {
      type: String,
    },
    fileName: {
      type: String,
      required: true,
    },
    strategy: {
      type: String,
      enum: ['formula_only', 'text_only', 'mixed'],
      default: 'formula_only',
    },
    blocks: [
      {
        type: {
          type: String,
          required: true,
        },
        latex: String,
        content: String,
        confidence: {
          type: Number,
          default: 0,
        },
        bbox: [Number],
      },
    ],
    layoutMarkdown: {
      type: String,
      default: '',
    },
    qualityScore: {
      type: Number,
      default: 0,
    },
    processingTime: {
      type: Number,
      default: 0,
    },
    imageInfo: {
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      format: { type: String, default: '' },
    },
    title: {
      type: String,
    },
    topic: {
      type: String,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
    },
    status: {
      type: String,
      enum: ['active', 'solved', 'abandoned'],
      default: 'active',
    },
    solvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
LearningSessionSchema.index({ userId: 1, createdAt: -1 });
LearningSessionSchema.index({ status: 1 });

export const LearningSession = mongoose.model<ILearningSession>(
  'LearningSession',
  LearningSessionSchema
);

export default LearningSession;
