/**
 * Enrollment Repository
 * 
 * Data access layer for Enrollment entities.
 * Handles database operations for user enrollments in topics.
 */

import { injectable } from 'tsyringe';
import { BaseRepository } from './base.repository';
import { Enrollment, EnrollmentDocument } from '@domain/models/enrollment.model';
import { IEnrollment, ICreateEnrollment, EnrollmentStatus } from '@domain/interfaces/enrollment.interface';
import { FilterQuery } from 'mongoose';

@injectable()
export class EnrollmentRepository extends BaseRepository<IEnrollment, EnrollmentDocument> {
    constructor() {
        super(Enrollment);
    }

    /**
     * Create a new enrollment
     */
    async createEnrollment(data: ICreateEnrollment): Promise<EnrollmentDocument> {
        return this.create(data as Partial<EnrollmentDocument>);
    }

    /**
     * Find enrollment by user and topic
     */
    async findByUserAndTopic(userId: string, topicId: string): Promise<EnrollmentDocument | null> {
        return this.model.findOne({
            userId,
            topicId,
        }).exec();
    }

    /**
     * Find enrollment by ID scoped to a user
     */
    async findByIdAndUser(enrollmentId: string, userId: string): Promise<EnrollmentDocument | null> {
        return this.model.findOne({
            _id: enrollmentId,
            userId,
        }).exec();
    }

    /**
     * Find all enrollments for a user
     */
    async findByUser(userId: string, status?: string): Promise<EnrollmentDocument[]> {
        const filter: FilterQuery<IEnrollment> = { userId };
        if (status) {
            filter.status = status;
        }
        return this.model.find(filter).sort({ lastAccessedAt: -1 }).exec();
    }

    /**
     * Find all enrollments for a topic
     */
    async findByTopic(topicId: string): Promise<EnrollmentDocument[]> {
        return this.model.find({ topicId }).exec();
    }

    /**
     * Update lesson progress in enrollment
     */
    async updateLessonProgress(
        enrollmentId: string,
        lessonId: string,
        progressData: { status: string; timeSpent?: number }
    ): Promise<EnrollmentDocument | null> {
        const enrollment = await this.findById(enrollmentId);
        if (!enrollment) {
            return null;
        }

        const lessonProgress = enrollment.lessonProgress || [];
        const existingIndex = lessonProgress.findIndex((lp: any) => lp.lessonId === lessonId);

        const now = new Date();
        const existingItem = existingIndex >= 0 ? lessonProgress[existingIndex] : null;
        const progressUpdate: any = {
            lessonId,
            status: progressData.status,
            lastAccessedAt: now,
        };

        // Set startedAt if lesson is being marked as in_progress and hasn't been started yet
        if (progressData.status === 'in_progress') {
            if (!existingItem?.startedAt) {
                progressUpdate.startedAt = now;
            }
        }

        if (progressData.status === 'completed') {
            progressUpdate.completedAt = now;
            
            // Set startedAt if it doesn't exist (lesson completed without being marked in_progress)
            if (!existingItem?.startedAt && !progressUpdate.startedAt) {
                // Set startedAt to 5 minutes before completedAt as a reasonable default
                const defaultStartTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
                progressUpdate.startedAt = defaultStartTime;
            }
            
            // Auto-calculate timeSpent if not provided
            if (progressData.timeSpent === undefined) {
                const existingTime = existingItem ? (existingItem.timeSpent || 0) : 0;
                
                // If timeSpent already exists, keep it; otherwise calculate from startedAt
                if (existingTime > 0) {
                    progressUpdate.timeSpent = existingTime;
                } else {
                    // Calculate time from startedAt to completedAt
                    const startedAt = existingItem?.startedAt 
                        ? new Date(existingItem.startedAt) 
                        : (progressUpdate.startedAt ? new Date(progressUpdate.startedAt) : now);
                    
                    const timeDiffMs = now.getTime() - startedAt.getTime();
                    const timeDiffMinutes = Math.max(5, Math.round(timeDiffMs / (1000 * 60))); // Minimum 5 minutes
                    
                    progressUpdate.timeSpent = timeDiffMinutes;
                }
            } else {
                // timeSpent was provided, add to existing
                const existingTime = existingItem ? (existingItem.timeSpent || 0) : 0;
                progressUpdate.timeSpent = existingTime + progressData.timeSpent;
            }
        } else if (progressData.timeSpent !== undefined) {
            // For non-completed status, just add to existing timeSpent
            const existingItem = existingIndex >= 0 ? lessonProgress[existingIndex] : null;
            const existingTime = existingItem ? (existingItem.timeSpent || 0) : 0;
            progressUpdate.timeSpent = existingTime + progressData.timeSpent;
        }

        if (existingIndex >= 0) {
            lessonProgress[existingIndex] = { ...lessonProgress[existingIndex], ...progressUpdate };
        } else {
            lessonProgress.push(progressUpdate);
        }

        // Assign updated lessonProgress back to enrollment
        enrollment.lessonProgress = lessonProgress;

        // Update lessons completed count
        const completedCount = lessonProgress.filter((lp: any) => lp.status === 'completed').length;
        enrollment.lessonsCompleted = completedCount;

        // Update progress percentage
        if (enrollment.totalLessons > 0) {
            enrollment.progress = Math.round((completedCount / enrollment.totalLessons) * 100);
        }

        // Update status if completed
        if (enrollment.progress === 100 && enrollment.status === EnrollmentStatus.ACTIVE) {
            enrollment.status = EnrollmentStatus.COMPLETED;
            enrollment.completedAt = now;
        }

        enrollment.lastAccessedAt = now;
        return enrollment.save();
    }
}

