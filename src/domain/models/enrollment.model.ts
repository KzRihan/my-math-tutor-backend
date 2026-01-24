/**
 * Enrollment Mongoose Model
 * 
 * Defines the Enrollment schema for tracking user enrollments in topics.
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import { 
    IEnrollment, 
    EnrollmentStatus,
    ILessonProgress,
    IEnrollmentDTO 
} from '@domain/interfaces/enrollment.interface';

/**
 * Enrollment document methods interface
 */
export interface IEnrollmentMethods {
    toDTO(): IEnrollmentDTO;
    updateProgress(): void;
}

/**
 * Enrollment document type with methods
 */
export type EnrollmentDocument = HydratedDocument<IEnrollment, IEnrollmentMethods>;

/**
 * Enrollment model type
 */
interface IEnrollmentModel extends Model<IEnrollment, {}, IEnrollmentMethods> {}

/**
 * Lesson Progress Schema (embedded in Enrollment)
 */
const lessonProgressSchema = new Schema<ILessonProgress>(
    {
        lessonId: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['not_started', 'in_progress', 'completed'],
            default: 'not_started',
        },
        startedAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },
        timeSpent: {
            type: Number,
            default: 0, // in minutes
            min: 0,
        },
        lastAccessedAt: {
            type: Date,
        },
    },
    {
        _id: false,
    }
);

/**
 * Enrollment Schema Definition
 */
const enrollmentSchema = new Schema<IEnrollment, IEnrollmentModel, {}, IEnrollmentMethods>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        } as any,
        topicId: {
            type: Schema.Types.ObjectId,
            ref: 'Topic',
            required: true,
            index: true,
        } as any,
        status: {
            type: String,
            enum: Object.values(EnrollmentStatus),
            default: EnrollmentStatus.ACTIVE,
            index: true,
        },
        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        lessonsCompleted: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalLessons: {
            type: Number,
            default: 0,
            min: 0,
        },
        lessonProgress: {
            type: [lessonProgressSchema],
            default: [],
        },
        enrolledAt: {
            type: Date,
            default: Date.now,
        },
        startedAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },
        lastAccessedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// ============================================================
// Indexes
// ============================================================

enrollmentSchema.index({ userId: 1, topicId: 1 }, { unique: true }); // One enrollment per user per topic
enrollmentSchema.index({ userId: 1, status: 1 });
enrollmentSchema.index({ topicId: 1 });
enrollmentSchema.index({ lastAccessedAt: -1 });

// ============================================================
// Instance Methods
// ============================================================

/**
 * Convert enrollment to DTO
 */
enrollmentSchema.methods.toDTO = function(): IEnrollmentDTO {
    return {
        id: this._id.toString(),
        userId: this.userId.toString(),
        topicId: this.topicId.toString(),
        status: this.status,
        progress: this.progress,
        lessonsCompleted: this.lessonsCompleted,
        totalLessons: this.totalLessons,
        lessonProgress: this.lessonProgress || [],
        enrolledAt: this.enrolledAt || new Date(),
        startedAt: this.startedAt,
        completedAt: this.completedAt,
        lastAccessedAt: this.lastAccessedAt || new Date(),
        createdAt: this.createdAt || new Date(),
        updatedAt: this.updatedAt || new Date(),
    };
};

/**
 * Update progress based on lesson completion
 */
enrollmentSchema.methods.updateProgress = function(): void {
    if (this.totalLessons > 0) {
        this.progress = Math.round((this.lessonsCompleted / this.totalLessons) * 100);
        
        // Update status based on progress
        if (this.progress === 100 && this.status === EnrollmentStatus.ACTIVE) {
            this.status = EnrollmentStatus.COMPLETED;
            this.completedAt = new Date();
        }
    }
};

// ============================================================
// Export Model
// ============================================================

export const Enrollment = mongoose.model<IEnrollment, IEnrollmentModel>('Enrollment', enrollmentSchema);

export default Enrollment;

