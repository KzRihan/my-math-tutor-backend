/**
 * Topic Domain Interfaces
 * 
 * Defines TypeScript interfaces for Topic entities.
 */

export enum TopicStatus {
    DRAFT = 'draft',
    GENERATED = 'generated',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

export enum GradeBand {
    PRIMARY = 'primary',
    SECONDARY = 'secondary',
    COLLEGE = 'college',
}

export enum DifficultyLevel {
    EASY = 'easy',
    MEDIUM = 'medium',
    HARD = 'hard',
}

export interface ILesson {
    lesson_number: number;
    title: string;
    introduction: string;
    explanation: string;
    worked_examples: Array<{
        example: string;
        steps: string[];
    }>;
    tips: string[];
    common_mistakes: string[];
    practice_exercises: Array<{
        exercise: string;
        answer?: string;
    }>;
    quiz: Array<{
        question: string;
        answer?: string;
        correctAnswer?: string;
        solution?: string;
    }>;
}

export interface ITopicLesson {
    _id?: string;
    title: string;
    order: number;
    status: 'generated' | 'approved' | 'edited';
    type: 'lesson' | 'practice' | 'quiz';
    description?: string;
    estimatedTime?: number;
    exercisesCount?: number;
    content?: ILesson;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ITopic {
    _id?: string;
    createdBy?: string;
    title: string;
    subtitle?: string;
    gradeBand: GradeBand;
    difficulty: DifficultyLevel;
    subject: string;
    status: TopicStatus;
    objectives: string[];
    prerequisites?: string[];
    lessons: ITopicLesson[];
    lessonsCount?: number;
    exercisesCount?: number;
    studentsEnrolled?: number;
    completionRate?: number;
    quizQuestionsCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICreateTopic {
    createdBy?: string;
    title: string;
    subtitle?: string;
    gradeBand: GradeBand;
    difficulty: DifficultyLevel;
    subject?: string;
    objectives?: string[];
    prerequisites?: string[];
    status?: TopicStatus;
}

export interface IUpdateTopic {
    title?: string;
    subtitle?: string;
    gradeBand?: GradeBand;
    difficulty?: DifficultyLevel;
    subject?: string;
    objectives?: string[];
    prerequisites?: string[];
    status?: TopicStatus;
}

export interface ITopicQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: TopicStatus;
    gradeBand?: GradeBand;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    viewerUserId?: string;
}

export interface ITopicDTO {
    id: string;
    createdBy?: string;
    title: string;
    subtitle?: string;
    gradeBand: GradeBand;
    difficulty: DifficultyLevel;
    subject: string;
    status: TopicStatus;
    objectives: string[];
    prerequisites?: string[];
    lessons: ITopicLesson[];
    lessonsCount: number;
    exercisesCount: number;
    studentsEnrolled: number;
    completionRate: number;
    quizQuestionsCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IGenerateLessonsRequest {
    topic_title: string;
    grade: GradeBand;
    difficulty_level: DifficultyLevel;
    number_of_lessons: number;
}

export interface IGenerateLessonsResponse {
    topic: string;
    grade: GradeBand;
    difficulty_level: DifficultyLevel;
    lessons: string[];
}

export interface IGenerateLessonContentRequest {
    topic_title: string;
    lesson_title: string;
    grade: GradeBand;
    difficulty_level: DifficultyLevel;
    exercises_count: number;
    quiz_count: number;
    generate_images?: boolean;
}

export interface IGenerateLessonContentResponse {
    lesson: ILesson;
}

