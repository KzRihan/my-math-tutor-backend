/**
 * Enrollment Domain Interfaces
 * 
 * Defines TypeScript interfaces for Topic Enrollment entities.
 */

export enum EnrollmentStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    PAUSED = 'paused',
    DROPPED = 'dropped',
}

export interface ILessonProgress {
    lessonId: string;
    status: 'not_started' | 'in_progress' | 'completed';
    startedAt?: Date;
    completedAt?: Date;
    timeSpent?: number; // in minutes
    lastAccessedAt?: Date;
}

export interface IEnrollment {
    _id?: string;
    userId: string;
    topicId: string;
    status: EnrollmentStatus;
    progress: number; // 0-100 percentage
    lessonsCompleted: number;
    totalLessons: number;
    lessonProgress: ILessonProgress[];
    enrolledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    lastAccessedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICreateEnrollment {
    userId: string;
    topicId: string;
}

export interface IUpdateEnrollment {
    status?: EnrollmentStatus;
    progress?: number;
    lessonsCompleted?: number;
    lessonProgress?: ILessonProgress[];
    lastAccessedAt?: Date;
    completedAt?: Date;
}

export interface IUpdateLessonProgress {
    lessonId: string;
    status: 'not_started' | 'in_progress' | 'completed';
    timeSpent?: number;
}

export interface IEnrollmentDTO {
    id: string;
    userId: string;
    topicId: string;
    status: EnrollmentStatus;
    progress: number;
    lessonsCompleted: number;
    totalLessons: number;
    lessonProgress?: ILessonProgress[];
    enrolledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    lastAccessedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IEnrollmentWithTopic extends IEnrollmentDTO {
    topic: {
        id: string;
        title: string;
        subtitle?: string;
        gradeBand: string;
        difficulty: string;
        lessonsCount: number;
    };
}

