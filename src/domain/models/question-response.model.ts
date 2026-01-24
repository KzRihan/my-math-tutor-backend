/**
 * Question Response Model
 * 
 * Tracks student responses to practice questions in lessons.
 * Used to calculate XP points and track learning progress.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestionResponse extends Document {
  userId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  lessonId: string; // Lesson ID within the topic
  questionIndex: number; // Index of question in practice_exercises or quiz array
  questionType: 'practice' | 'quiz'; // Type of question
  questionText: string; // The question text
  userAnswer: string; // Student's answer
  correctAnswer: string; // Correct answer
  isCorrect: boolean; // Whether answer is correct
  xpAwarded: number; // XP points awarded (0 if incorrect)
  reviewStatus?: 'pending' | 'approved' | 'rejected'; // For quiz questions - admin review status
  reviewedBy?: mongoose.Types.ObjectId; // Admin who reviewed (if reviewed)
  reviewedAt?: Date; // When the response was reviewed
  adminNotes?: string; // Admin notes/comments on the answer
  difficulty?: 'easy' | 'medium' | 'hard'; // Question difficulty
  topicDifficulty?: 'easy' | 'medium' | 'hard'; // Topic difficulty for XP calculation
  gradeBand?: 'primary' | 'secondary' | 'college'; // Grade band for XP calculation
  answeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionResponseSchema = new Schema<IQuestionResponse>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
    },
    lessonId: {
      type: String,
      required: true,
    },
    questionIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    questionType: {
      type: String,
      enum: ['practice', 'quiz'],
      required: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    userAnswer: {
      type: String,
      required: true,
    },
    correctAnswer: {
      type: String,
      required: false, // Optional for quiz questions (admin will set it during review)
      default: '',
    },
    isCorrect: {
      type: Boolean,
      required: true,
      default: false,
    },
    xpAwarded: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: function() {
        // Quiz questions default to pending, practice questions don't need review
        return this.questionType === 'quiz' ? 'pending' : undefined;
      },
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    adminNotes: {
      type: String,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
    },
    topicDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
    },
    gradeBand: {
      type: String,
      enum: ['primary', 'secondary', 'college'],
    },
    answeredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// Indexes
// ============================================================

// Allow multiple responses per question (removed unique constraint)
// Index for efficient querying of user's responses to a specific question
QuestionResponseSchema.index({ userId: 1, topicId: 1, lessonId: 1, questionIndex: 1, questionType: 1 });

// For querying user's question history
QuestionResponseSchema.index({ userId: 1, answeredAt: -1 });

// For querying topic/lesson statistics
QuestionResponseSchema.index({ topicId: 1, lessonId: 1 });

// For XP calculations - find questions where XP was already awarded
QuestionResponseSchema.index({ userId: 1, topicId: 1, lessonId: 1, questionIndex: 1, questionType: 1, xpAwarded: 1 });

// ============================================================
// Instance Methods
// ============================================================

/**
 * Check if user has already answered this question correctly
 */
QuestionResponseSchema.methods.hasAnsweredCorrectly = function (): boolean {
  return this.isCorrect && this.xpAwarded > 0;
};

// ============================================================
// Static Methods
// ============================================================

/**
 * Check if user has already answered a specific question correctly and earned XP
 */
QuestionResponseSchema.statics.hasUserAnsweredCorrectly = async function (
  userId: string,
  topicId: string,
  lessonId: string,
  questionIndex: number,
  questionType: 'practice' | 'quiz'
): Promise<boolean> {
  const response = await this.findOne({
    userId,
    topicId,
    lessonId,
    questionIndex,
    questionType,
    isCorrect: true,
    xpAwarded: { $gt: 0 },
  });
  return !!response;
};

/**
 * Get all responses for a specific question (for tracking attempts)
 */
QuestionResponseSchema.statics.getUserQuestionResponses = async function (
  userId: string,
  topicId: string,
  lessonId: string,
  questionIndex: number,
  questionType: 'practice' | 'quiz'
): Promise<IQuestionResponse[]> {
  return this.find({
    userId,
    topicId,
    lessonId,
    questionIndex,
    questionType,
  }).sort({ answeredAt: -1 }); // Most recent first
};

/**
 * Get user's correct answers for a lesson
 */
QuestionResponseSchema.statics.getUserCorrectAnswers = async function (
  userId: string,
  topicId: string,
  lessonId: string
): Promise<IQuestionResponse[]> {
  return this.find({
    userId,
    topicId,
    lessonId,
    isCorrect: true,
    xpAwarded: { $gt: 0 },
  });
};

/**
 * Get total XP earned by user for a specific lesson
 */
QuestionResponseSchema.statics.getLessonXP = async function (
  userId: string,
  topicId: string,
  lessonId: string
): Promise<number> {
  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        topicId: new mongoose.Types.ObjectId(topicId),
        lessonId,
        isCorrect: true,
      },
    },
    {
      $group: {
        _id: null,
        totalXP: { $sum: '$xpAwarded' },
      },
    },
  ]);

  return result.length > 0 ? result[0].totalXP : 0;
};

// ============================================================
// Export Model
// ============================================================

export interface IQuestionResponseModel extends mongoose.Model<IQuestionResponse> {
  hasUserAnsweredCorrectly(
    userId: string,
    topicId: string,
    lessonId: string,
    questionIndex: number,
    questionType: 'practice' | 'quiz'
  ): Promise<boolean>;
  getUserQuestionResponses(
    userId: string,
    topicId: string,
    lessonId: string,
    questionIndex: number,
    questionType: 'practice' | 'quiz'
  ): Promise<IQuestionResponse[]>;
  getUserCorrectAnswers(
    userId: string,
    topicId: string,
    lessonId: string
  ): Promise<IQuestionResponse[]>;
  getLessonXP(userId: string, topicId: string, lessonId: string): Promise<number>;
}

export const QuestionResponse = mongoose.model<IQuestionResponse, IQuestionResponseModel>(
  'QuestionResponse',
  QuestionResponseSchema
);

export default QuestionResponse;

