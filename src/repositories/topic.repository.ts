/**
 * Topic Repository
 * 
 * Data access layer for Topic entities.
 * Extends BaseRepository with topic-specific query methods.
 */

import { injectable } from 'tsyringe';
import { FilterQuery } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import Topic, { TopicDocument } from '@domain/models/topic.model';
import { 
    ITopic, 
    ICreateTopic, 
    ITopicQuery,
    ITopicLesson,
} from '@domain/interfaces/topic.interface';
import { TopicStatus, GradeBand } from '@domain/interfaces/topic.interface';

/**
 * Topic Repository
 * Handles all database operations for Topics
 */
@injectable()
export class TopicRepository extends BaseRepository<ITopic, TopicDocument> {
    constructor() {
        super(Topic);
    }

    /**
     * Create a new topic
     */
    async createTopic(data: ICreateTopic): Promise<TopicDocument> {
        return this.create({
            ...data,
            status: data.status || TopicStatus.DRAFT,
            lessons: [],
            lessonsCount: 0,
            exercisesCount: 0,
            studentsEnrolled: 0,
            completionRate: 0,
        } as Partial<TopicDocument>);
    }

    /**
     * Find topics with search and filters
     */
    async findTopics(query: ITopicQuery): Promise<PaginatedResult<TopicDocument>> {
        const {
            page = 1,
            limit = 20,
            search,
            status,
            gradeBand,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = query;

        // Build filter
        const filter: FilterQuery<ITopic> = {};

        if (status) {
            filter.status = status;
        }

        if (gradeBand) {
            filter.gradeBand = gradeBand;
        }

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { subtitle: { $regex: search, $options: 'i' } },
            ];
        }

        const paginationOptions: PaginationOptions = {
            page,
            limit,
            sortBy,
            sortOrder,
        };

        return this.findPaginated(filter, paginationOptions);
    }

    /**
     * Add lessons to a topic
     */
    async addLessons(topicId: string, lessons: Array<Omit<ITopicLesson, '_id'>>): Promise<TopicDocument | null> {
        const topic = await this.findById(topicId);
        if (!topic) return null;

        // Add lessons with proper order
        const newLessons = lessons.map((lesson, index) => ({
            ...lesson,
            order: lesson.order || topic.lessons.length + index + 1,
        }));

        topic.lessons.push(...newLessons);
        topic.lessonsCount = topic.lessons.length;
        
        return topic.save();
    }

    /**
     * Update lesson content
     */
    async updateLessonContent(
        topicId: string,
        lessonId: string,
        content: any
    ): Promise<TopicDocument | null> {
        const topic = await this.findById(topicId);
        if (!topic) return null;

        // Find lesson by ID - lessons is an array, so we need to find by _id
        const lesson = (topic.lessons as any[]).find((l: any) => l._id?.toString() === lessonId);
        if (!lesson) return null;

        lesson.content = content;
        lesson.status = 'approved';
        
        return topic.save();
    }

    /**
     * Update a lesson
     */
    async updateLesson(
        topicId: string,
        lessonId: string,
        data: Partial<ITopicLesson>
    ): Promise<TopicDocument | null> {
        const topic = await this.findById(topicId);
        if (!topic) return null;

        // Find lesson by ID - lessons is an array, so we need to find by _id
        const lesson = (topic.lessons as any[]).find((l: any) => l._id?.toString() === lessonId);
        if (!lesson) return null;

        Object.assign(lesson, data);
        
        return topic.save();
    }

    /**
     * Delete a lesson
     */
    async deleteLesson(topicId: string, lessonId: string): Promise<TopicDocument | null> {
        const topic = await this.findById(topicId);
        if (!topic) return null;

        // Find and remove lesson by ID
        const lessonIndex = (topic.lessons as any[]).findIndex((l: any) => l._id?.toString() === lessonId);
        if (lessonIndex === -1) return null;

        topic.lessons.splice(lessonIndex, 1);
        topic.lessonsCount = topic.lessons.length;
        
        return topic.save();
    }

    /**
     * Get topic statistics
     */
    async getStatistics(): Promise<{
        total: number;
        byStatus: Record<TopicStatus, number>;
        byGradeBand: Record<GradeBand, number>;
    }> {
        const [total, byStatusResult, byGradeBandResult] = await Promise.all([
            this.count(),
            this.aggregate<{ _id: TopicStatus; count: number }>([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            this.aggregate<{ _id: GradeBand; count: number }>([
                { $group: { _id: '$gradeBand', count: { $sum: 1 } } },
            ]),
        ]);

        const byStatus = Object.values(TopicStatus).reduce((acc, status) => {
            const found = byStatusResult.find((r) => r._id === status);
            acc[status] = found?.count || 0;
            return acc;
        }, {} as Record<TopicStatus, number>);

        const byGradeBand = Object.values(GradeBand).reduce((acc, grade) => {
            const found = byGradeBandResult.find((r) => r._id === grade);
            acc[grade] = found?.count || 0;
            return acc;
        }, {} as Record<GradeBand, number>);

        return { total, byStatus, byGradeBand };
    }
}

export default TopicRepository;

