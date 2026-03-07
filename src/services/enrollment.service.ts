/**
 * Enrollment Service
 * 
 * Business logic layer for Enrollment operations.
 * Orchestrates between repositories and handles enrollment logic.
 */

import { injectable, inject } from 'tsyringe';
import { EnrollmentRepository } from '@repositories/enrollment.repository';
import { TopicRepository } from '@repositories/topic.repository';
import { UserRepository } from '@repositories/user.repository';
import {
    ICreateEnrollment,
    IUpdateEnrollment,
    IUpdateLessonProgress,
    IEnrollmentDTO,
    IEnrollmentWithTopic,
    EnrollmentStatus,
} from '@domain/interfaces/enrollment.interface';
import {
    NotFoundError,
    ConflictError,
    ForbiddenError,
} from '@utils/errors';
import { createChildLogger } from '@utils/logger';

const enrollmentLogger = createChildLogger('enrollment-service');

/**
 * Enrollment Service Interface
 */
export interface IEnrollmentService {
    enrollUser(data: ICreateEnrollment): Promise<IEnrollmentDTO>;
    getUserEnrollment(userId: string, topicId: string): Promise<IEnrollmentDTO | null>;
    getUserEnrollments(userId: string, status?: string): Promise<IEnrollmentWithTopic[]>;
    updateEnrollment(enrollmentId: string, userId: string, data: IUpdateEnrollment): Promise<IEnrollmentDTO>;
    updateLessonProgress(enrollmentId: string, userId: string, data: IUpdateLessonProgress): Promise<IEnrollmentDTO>;
    unenrollUser(userId: string, topicId: string): Promise<void>;
}

/**
 * Enrollment Service Implementation
 */
@injectable()
export class EnrollmentService implements IEnrollmentService {
    constructor(
        @inject(EnrollmentRepository) private enrollmentRepository: EnrollmentRepository,
        @inject(TopicRepository) private topicRepository: TopicRepository,
        @inject(UserRepository) private userRepository: UserRepository,
    ) {}

    /**
     * Enroll user in a topic
     */
    async enrollUser(data: ICreateEnrollment): Promise<IEnrollmentDTO> {
        // Ensure user exists
        const user = await this.userRepository.findById(data.userId);
        if (!user) {
            throw new NotFoundError(`User with ID ${data.userId} not found`);
        }

        // Check if topic exists
        const topic = await this.topicRepository.findById(data.topicId);
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${data.topicId} not found`);
        }

        const topicOwnerId = (topic as any).createdBy?.toString?.() || (topic as any).createdBy;
        if (topicOwnerId && topicOwnerId !== data.userId) {
            throw new ForbiddenError('You do not have access to enroll in this topic');
        }

        // Check if already enrolled
        const existingEnrollment = await this.enrollmentRepository.findByUserAndTopic(
            data.userId,
            data.topicId
        );

        if (existingEnrollment) {
            throw new ConflictError('User is already enrolled in this topic');
        }

        // Create enrollment
        const enrollment = await this.enrollmentRepository.createEnrollment({
            userId: data.userId,
            topicId: data.topicId,
        });

        // Set total lessons count
        enrollment.totalLessons = topic.lessonsCount || topic.lessons?.length || 0;
        enrollment.startedAt = new Date();
        await enrollment.save();

        // Update topic's studentsEnrolled count
        await this.topicRepository.updateById(data.topicId, {
            $inc: { studentsEnrolled: 1 },
        });

        enrollmentLogger.info('User enrolled in topic', {
            userId: data.userId,
            topicId: data.topicId,
            enrollmentId: enrollment._id,
        });

        return (enrollment as any).toDTO();
    }

    /**
     * Get user enrollment for a specific topic
     */
    async getUserEnrollment(userId: string, topicId: string): Promise<IEnrollmentDTO | null> {
        const enrollment = await this.enrollmentRepository.findByUserAndTopic(userId, topicId);
        
        if (!enrollment) {
            return null;
        }

        return (enrollment as any).toDTO();
    }

    /**
     * Get all enrollments for a user
     */
    async getUserEnrollments(userId: string, status?: string): Promise<IEnrollmentWithTopic[]> {
        const enrollments = await this.enrollmentRepository.findByUser(userId, status);
        
        const enrollmentsWithTopics: IEnrollmentWithTopic[] = [];

        for (const enrollment of enrollments) {
            const topic = await this.topicRepository.findById(enrollment.topicId.toString());
            if (topic) {
                const enrollmentDTO = (enrollment as any).toDTO();
                enrollmentsWithTopics.push({
                    ...enrollmentDTO,
                    topic: {
                        id: topic._id.toString(),
                        title: topic.title,
                        subtitle: topic.subtitle,
                        gradeBand: topic.gradeBand,
                        difficulty: topic.difficulty,
                        lessonsCount: topic.lessonsCount || topic.lessons?.length || 0,
                    },
                });
            }
        }

        return enrollmentsWithTopics;
    }

    /**
     * Update enrollment
     */
    async updateEnrollment(enrollmentId: string, userId: string, data: IUpdateEnrollment): Promise<IEnrollmentDTO> {
        const ownedEnrollment = await this.enrollmentRepository.findByIdAndUser(enrollmentId, userId);
        if (!ownedEnrollment) {
            throw new NotFoundError(`Enrollment with ID ${enrollmentId} not found`);
        }

        const enrollment = await this.enrollmentRepository.updateById(enrollmentId, { $set: data });
        
        if (!enrollment) {
            throw new NotFoundError(`Enrollment with ID ${enrollmentId} not found`);
        }

        // Update progress if lessons completed changed
        if (data.lessonsCompleted !== undefined && enrollment.totalLessons > 0) {
            enrollment.progress = Math.round((data.lessonsCompleted / enrollment.totalLessons) * 100);
            
            if (enrollment.progress === 100 && enrollment.status === EnrollmentStatus.ACTIVE) {
                enrollment.status = EnrollmentStatus.COMPLETED;
                enrollment.completedAt = new Date();
            }
            
            await enrollment.save();
        }

        return (enrollment as any).toDTO();
    }

    /**
     * Update lesson progress
     */
    async updateLessonProgress(enrollmentId: string, userId: string, data: IUpdateLessonProgress): Promise<IEnrollmentDTO> {
        const ownedEnrollment = await this.enrollmentRepository.findByIdAndUser(enrollmentId, userId);
        if (!ownedEnrollment) {
            throw new NotFoundError(`Enrollment with ID ${enrollmentId} not found`);
        }

        const enrollment = await this.enrollmentRepository.updateLessonProgress(
            enrollmentId,
            data.lessonId,
            {
                status: data.status,
                timeSpent: data.timeSpent,
            }
        );

        if (!enrollment) {
            throw new NotFoundError(`Enrollment with ID ${enrollmentId} not found`);
        }

        // Update user statistics
        const enrollmentUserId = enrollment.userId.toString();
        const statsToUpdate: any = {};
        
        if (data.timeSpent) {
            statsToUpdate.totalMinutesLearned = data.timeSpent;
        }

        // If newly completed
        if (data.status === 'completed' && enrollment.progress === 100) {
            // Note: In a real system, we'd check if this lesson was already completed
            // For now, let's say marking as completed adds 1 to problemsSolved
            statsToUpdate.problemsSolved = 1;

            // Check if topic is now 100% complete
            if (enrollment.lessonsCompleted === enrollment.totalLessons) {
                statsToUpdate.totalTopicsCompleted = 1;
            }
        }

        if (Object.keys(statsToUpdate).length > 0) {
            await this.userRepository.incrementUserStats(enrollmentUserId, statsToUpdate);
        }

        enrollmentLogger.info('Lesson progress updated', {
            enrollmentId,
            lessonId: data.lessonId,
            status: data.status,
        });

        return (enrollment as any).toDTO();
    }

    /**
     * Unenroll user from a topic
     */
    async unenrollUser(userId: string, topicId: string): Promise<void> {
        const enrollment = await this.enrollmentRepository.findByUserAndTopic(userId, topicId);
        
        if (!enrollment) {
            throw new NotFoundError('Enrollment not found');
        }

        await this.enrollmentRepository.deleteById(enrollment._id.toString());

        // Update topic's studentsEnrolled count
        await this.topicRepository.updateById(topicId, {
            $inc: { studentsEnrolled: -1 },
        });

        enrollmentLogger.info('User unenrolled from topic', {
            userId,
            topicId,
        });
    }
}

