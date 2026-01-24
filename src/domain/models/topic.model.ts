/**
 * Topic Mongoose Model
 * 
 * Defines the Topic schema with lessons and content.
 */

import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';
import { 
    ITopic, 
    ITopicLesson, 
    TopicStatus, 
    GradeBand, 
    DifficultyLevel,
    ITopicDTO 
} from '@domain/interfaces/topic.interface';

/**
 * Topic document methods interface
 */
export interface ITopicMethods {
    toDTO(): ITopicDTO;
}

/**
 * Topic document type with methods
 */
export type TopicDocument = HydratedDocument<ITopic, {}, ITopicMethods>;

/**
 * Topic model type
 */
interface ITopicModel extends Model<ITopic, {}, ITopicMethods> {}

/**
 * Lesson Schema (embedded in Topic)
 */
const lessonSchema = new Schema<ITopicLesson>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        order: {
            type: Number,
            required: true,
            min: 1,
        },
        status: {
            type: String,
            enum: ['generated', 'approved', 'edited'],
            default: 'generated',
        },
        type: {
            type: String,
            enum: ['lesson', 'practice', 'quiz'],
            default: 'lesson',
        },
        description: {
            type: String,
            default: '',
        },
        estimatedTime: {
            type: Number,
            default: 15, // minutes
        },
        exercisesCount: {
            type: Number,
            default: 0,
        },
        content: {
            type: Schema.Types.Mixed,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

/**
 * Topic Schema Definition
 */
const topicSchema = new Schema<ITopic, ITopicModel, {}, ITopicMethods>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        subtitle: {
            type: String,
            default: '',
            trim: true,
        },
        gradeBand: {
            type: String,
            enum: Object.values(GradeBand),
            required: true,
            index: true,
        },
        difficulty: {
            type: String,
            enum: Object.values(DifficultyLevel),
            required: true,
            index: true,
        },
        subject: {
            type: String,
            default: 'Mathematics',
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(TopicStatus),
            default: TopicStatus.DRAFT,
            index: true,
        },
        objectives: {
            type: [String],
            default: [],
        },
        prerequisites: {
            type: [String],
            default: [],
        },
        lessons: {
            type: [lessonSchema],
            default: [],
        },
        lessonsCount: {
            type: Number,
            default: 0,
        },
        exercisesCount: {
            type: Number,
            default: 0,
        },
        studentsEnrolled: {
            type: Number,
            default: 0,
        },
        completionRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        quizQuestionsCount: {
            type: Number,
            default: 0,
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

topicSchema.index({ title: 'text', subtitle: 'text' });
topicSchema.index({ status: 1, gradeBand: 1 });
topicSchema.index({ createdAt: -1 });
topicSchema.index({ gradeBand: 1, difficulty: 1 });

// ============================================================
// Virtual Fields
// ============================================================

topicSchema.virtual('id').get(function (this: TopicDocument) {
    return this._id.toString();
});

// ============================================================
// Instance Methods
// ============================================================

/**
 * Convert to DTO (safe for API responses)
 */
topicSchema.methods.toDTO = function (this: TopicDocument): ITopicDTO {
    return {
        id: this._id.toString(),
        title: this.title,
        subtitle: this.subtitle,
        gradeBand: this.gradeBand,
        difficulty: this.difficulty,
        subject: this.subject,
        status: this.status,
        objectives: this.objectives,
        prerequisites: this.prerequisites,
        lessons: this.lessons.map(lesson => ({
            _id: lesson._id?.toString(),
            title: lesson.title,
            order: lesson.order,
            status: lesson.status,
            type: lesson.type,
            description: lesson.description,
            estimatedTime: lesson.estimatedTime,
            exercisesCount: lesson.exercisesCount,
            content: lesson.content,
            createdAt: lesson.createdAt,
            updatedAt: lesson.updatedAt,
        })),
        lessonsCount: this.lessonsCount || this.lessons.length,
        exercisesCount: this.exercisesCount || 0,
        studentsEnrolled: this.studentsEnrolled || 0,
        completionRate: this.completionRate || 0,
        quizQuestionsCount: this.quizQuestionsCount || 0,
        createdAt: this.createdAt || new Date(),
        updatedAt: this.updatedAt || new Date(),
    };
};

// ============================================================
// Pre-save Hooks
// ============================================================

/**
 * Update lessonsCount before saving
 */
topicSchema.pre('save', function (next) {
    if (this.isModified('lessons')) {
        this.lessonsCount = this.lessons.length;
        // Calculate total exercises count
        this.exercisesCount = this.lessons.reduce(
            (total, lesson) => total + (lesson.exercisesCount || 0),
            0
        );
    }
    next();
});

// ============================================================
// Export Model
// ============================================================

export const Topic = mongoose.model<ITopic, ITopicModel>('Topic', topicSchema);

export default Topic;

