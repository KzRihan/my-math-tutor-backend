/**
 * Topic Service
 * 
 * Business logic layer for Topic operations.
 * Orchestrates between repositories and external services (AI service).
 */

import { injectable, inject } from 'tsyringe';
import axios from 'axios';
import { TopicRepository } from '@repositories/topic.repository';
import {
    ICreateTopic,
    IUpdateTopic,
    ITopicDTO,
    ITopicQuery,
    IGenerateLessonsRequest,
    IGenerateLessonsResponse,
    IGenerateLessonContentRequest,
    IGenerateLessonContentResponse,
    ITopicLesson,
    TopicStatus,
} from '@domain/interfaces/topic.interface';
import {
    NotFoundError,
    ValidationError,
    ConflictError,
} from '@utils/errors';
import { PaginatedResult } from '@repositories/base.repository';
import { createChildLogger } from '@utils/logger';
import { config } from '@config/index';

const topicLogger = createChildLogger('topic-service');

// AI Service URL from config
const AI_SERVICE_URL = config.ai.apiUrl;

/**
 * Topic Service Interface
 */
export interface ITopicService {
    createTopic(data: ICreateTopic): Promise<ITopicDTO>;
    getTopicById(id: string): Promise<ITopicDTO>;
    getTopics(query: ITopicQuery): Promise<PaginatedResult<ITopicDTO>>;
    updateTopic(id: string, data: IUpdateTopic): Promise<ITopicDTO>;
    deleteTopic(id: string): Promise<void>;
    generateLessons(data: IGenerateLessonsRequest): Promise<IGenerateLessonsResponse>;
    generateLessonContent(data: IGenerateLessonContentRequest): Promise<IGenerateLessonContentResponse>;
    saveLessonsToTopic(topicId: string, lessons: string[]): Promise<ITopicDTO>;
    saveLessonContent(topicId: string, lessonId: string, content: any): Promise<ITopicDTO>;
}

/**
 * Topic Service Implementation
 */
@injectable()
export class TopicService implements ITopicService {
    constructor(
        @inject(TopicRepository) private topicRepository: TopicRepository
    ) {}

    /**
     * Create a new topic
     */
    async createTopic(data: ICreateTopic): Promise<ITopicDTO> {
        topicLogger.info('Creating new topic', { title: data.title });

        // Check for duplicate topic (same title, gradeBand, and difficulty)
        const existingTopic = await this.topicRepository.findOne({
            title: data.title,
            gradeBand: data.gradeBand,
            difficulty: data.difficulty,
        });

        if (existingTopic) {
            throw new ConflictError(
                `A topic with title "${data.title}" for ${data.gradeBand} grade with ${data.difficulty} difficulty already exists. Please use a different title or update the existing topic.`
            );
        }

        const topic = await this.topicRepository.createTopic(data);
        return (topic as any).toDTO();
    }

    /**
     * Get topic by ID
     */
    async getTopicById(id: string): Promise<ITopicDTO> {
        const topic = await this.topicRepository.findById(id);
        
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${id} not found`);
        }

        return (topic as any).toDTO();
    }

    /**
     * Get paginated list of topics
     */
    async getTopics(query: ITopicQuery): Promise<PaginatedResult<ITopicDTO>> {
        const result = await this.topicRepository.findTopics(query);
        
        return {
            ...result,
            data: result.data.map(topic => (topic as any).toDTO()),
        };
    }

    /**
     * Update topic
     */
    async updateTopic(id: string, data: IUpdateTopic): Promise<ITopicDTO> {
        const topic = await this.topicRepository.updateById(id, { $set: data });
        
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${id} not found`);
        }

        return (topic as any).toDTO();
    }

    /**
     * Delete topic
     */
    async deleteTopic(id: string): Promise<void> {
        const topic = await this.topicRepository.findById(id);
        
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${id} not found`);
        }

        await this.topicRepository.deleteById(id);
    }

    /**
     * Publish topic (set status to published)
     */
    async publishTopic(id: string): Promise<ITopicDTO> {
        const topic = await this.topicRepository.updateById(id, { 
            $set: { status: TopicStatus.PUBLISHED } 
        });
        
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${id} not found`);
        }

        return (topic as any).toDTO();
    }

    /**
     * Unpublish topic (set status to draft)
     */
    async unpublishTopic(id: string): Promise<ITopicDTO> {
        const topic = await this.topicRepository.updateById(id, { 
            $set: { status: TopicStatus.DRAFT } 
        });
        
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${id} not found`);
        }

        return (topic as any).toDTO();
    }

    /**
     * Get published topics for users (public endpoint)
     */
    async getPublishedTopics(query: ITopicQuery): Promise<PaginatedResult<ITopicDTO>> {
        const userQuery: ITopicQuery = {
            ...query,
            status: TopicStatus.PUBLISHED, // Only published topics
        };
        
        const result = await this.topicRepository.findTopics(userQuery);
        
        return {
            ...result,
            data: result.data.map(topic => (topic as any).toDTO()),
        };
    }

    /**
     * Get published topic by ID (public endpoint)
     */
    async getPublishedTopicById(id: string): Promise<ITopicDTO> {
        const topic = await this.topicRepository.findById(id);
        
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${id} not found`);
        }

        // Only return if published
        if (topic.status !== TopicStatus.PUBLISHED) {
            throw new NotFoundError(`Topic with ID ${id} not found`);
        }

        return (topic as any).toDTO();
    }

    /**
     * Generate lessons using AI service
     */
    async generateLessons(data: IGenerateLessonsRequest): Promise<IGenerateLessonsResponse> {
        // Validate input
        if (!data.topic_title || !data.grade || !data.difficulty_level || !data.number_of_lessons) {
            throw new ValidationError('Missing required fields: topic_title, grade, difficulty_level, number_of_lessons');
        }

        if (data.number_of_lessons < 1 || data.number_of_lessons > 5) {
            throw new ValidationError('number_of_lessons must be between 1 and 5 (AI service limit)');
        }

        const requestPayload = {
            topic_title: data.topic_title,
            grade: data.grade,
            difficulty_level: data.difficulty_level,
            number_of_lessons: data.number_of_lessons,
        };

        topicLogger.info('Generating lessons via AI service', { 
            topicTitle: data.topic_title,
            payload: requestPayload
        });

        try {
            const response = await axios.post<IGenerateLessonsResponse>(
                `${AI_SERVICE_URL}/generate-lessons`,
                requestPayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'accept': 'application/json',
                    },
                    timeout: 180000, // 180 second timeout
                }
            );

            topicLogger.info('Lessons generated successfully', { count: response.data.lessons.length });
            
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data;
                
                // Extract detailed error message from FastAPI validation errors
                let errorMessage = error.message;
                if (errorData) {
                    if (typeof errorData === 'string') {
                        errorMessage = errorData;
                    } else if (errorData.detail) {
                        // FastAPI validation errors format
                        if (Array.isArray(errorData.detail)) {
                            const validationErrors = errorData.detail.map((err: any) => 
                                `${err.loc?.join('.')}: ${err.msg}`
                            ).join('; ');
                            errorMessage = validationErrors;
                        } else if (typeof errorData.detail === 'string') {
                            errorMessage = errorData.detail;
                        } else {
                            errorMessage = JSON.stringify(errorData.detail);
                        }
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                }
                
                topicLogger.error('AI service error', { 
                    status: error.response?.status, 
                    statusText: error.response?.statusText,
                    error: errorData,
                    requestData: {
                        topic_title: data.topic_title,
                        grade: data.grade,
                        difficulty_level: data.difficulty_level,
                        number_of_lessons: data.number_of_lessons,
                    }
                });
                
                // Throw ValidationError for 422 status codes
                if (error.response?.status === 422) {
                    throw new ValidationError(`AI service validation error: ${errorMessage}`);
                }
                
                throw new Error(`AI service error: ${error.response?.status || 'Unknown'} - ${errorMessage}`);
            }
            topicLogger.error('Failed to generate lessons', { error });
            throw new Error(`Failed to generate lessons: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate lesson content using AI service
     */
    async generateLessonContent(data: IGenerateLessonContentRequest): Promise<IGenerateLessonContentResponse> {
        // Validate input
        if (!data.topic_title || !data.lesson_title || !data.grade || !data.difficulty_level) {
            throw new ValidationError('Missing required fields: topic_title, lesson_title, grade, difficulty_level');
        }
        if (data.exercises_count !== undefined && (data.exercises_count < 1 || data.exercises_count > 10)) {
            throw new ValidationError('exercises_count must be between 1 and 10');
        }
        if (data.quiz_count !== undefined && (data.quiz_count < 1 || data.quiz_count > 5)) {
            throw new ValidationError('quiz_count must be between 1 and 5 (AI service limit)');
        }

        topicLogger.info('Generating lesson content via AI service', { 
            topicTitle: data.topic_title,
            lessonTitle: data.lesson_title,
            exercisesCount: data.exercises_count,
            quizCount: data.quiz_count
        });

        try {
            // Use responseType: 'text' to get raw response and handle JSON parsing manually
            // This allows us to catch and handle malformed JSON from the AI service
            const response = await axios.post(
                `${AI_SERVICE_URL}/generate-lesson-content`,
                {
                    topic_title: data.topic_title,
                    lesson_title: data.lesson_title,
                    grade: data.grade,
                    difficulty_level: data.difficulty_level,
                    exercises_count: data.exercises_count,
                    quiz_count: data.quiz_count,
                    generate_images: data.generate_images,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'accept': 'application/json',
                    },
                    timeout: 240000, // 240 second timeout for content generation
                    responseType: 'text', // Get raw response to handle malformed JSON
                }
            );

            // Parse JSON manually with error handling
            let responseData: IGenerateLessonContentResponse;
            
            try {
                // Try to parse the response as JSON
                responseData = JSON.parse(response.data);
            } catch (parseError) {
                // If JSON parsing fails, log the raw response and try to fix common issues
                topicLogger.error('Failed to parse AI service response as JSON', {
                    rawResponse: response.data?.substring(0, 1000), // Log first 1000 chars
                    error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
                    errorPosition: parseError instanceof Error && parseError.message.includes('char') 
                        ? parseError.message.match(/char (\d+)/)?.[1] 
                        : null
                });

                // Try multiple cleaning strategies
                let cleanedJson = response.data;
                let parsedData: IGenerateLessonContentResponse | null = null;
                const originalError = parseError;

                // Strategy 1: Remove all control characters except valid JSON ones
                try {
                    cleanedJson = response.data
                        // Remove control characters (0x00-0x1F except \n, \r, \t which are valid in JSON strings)
                        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                        // Fix invalid escape sequences (but preserve valid ones)
                        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
                        // Normalize multiple backslashes
                        .replace(/\\\\+/g, '\\\\');
                    
                    parsedData = JSON.parse(cleanedJson);
                    topicLogger.warn('Successfully parsed JSON after Strategy 1 (control character removal)');
                } catch (strategy1Error) {
                    // Strategy 2: More aggressive cleaning - remove all non-printable characters
                    try {
                        cleanedJson = response.data
                            // Remove all control characters including newlines/tabs in JSON structure (but keep in string values)
                            .replace(/[\x00-\x1F\x7F]/g, '')
                            // Fix broken escape sequences
                            .replace(/\\(?!["\\/bfnrtu0-9x])/g, '\\\\')
                            // Remove trailing commas before closing braces/brackets
                            .replace(/,(\s*[}\]])/g, '$1');
                        
                        parsedData = JSON.parse(cleanedJson);
                        topicLogger.warn('Successfully parsed JSON after Strategy 2 (aggressive cleaning)');
                    } catch (strategy2Error) {
                        // Strategy 3: Try to extract JSON object from potentially malformed response
                        try {
                            // Try to find JSON object boundaries
                            const firstBrace = cleanedJson.indexOf('{');
                            const lastBrace = cleanedJson.lastIndexOf('}');
                            
                            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                                const jsonSubstring = cleanedJson.substring(firstBrace, lastBrace + 1);
                                // Clean the substring
                                const cleanedSubstring = jsonSubstring
                                    .replace(/[\x00-\x1F\x7F]/g, '')
                                    .replace(/\\(?!["\\/bfnrtu0-9x])/g, '\\\\')
                                    .replace(/,(\s*[}\]])/g, '$1');
                                
                                parsedData = JSON.parse(cleanedSubstring);
                                topicLogger.warn('Successfully parsed JSON after Strategy 3 (extract JSON object)');
                            }
                        } catch (strategy3Error) {
                            // All strategies failed
                            topicLogger.error('All JSON parsing strategies failed', {
                                originalError: originalError instanceof Error ? originalError.message : 'Unknown',
                                strategy1Error: strategy1Error instanceof Error ? strategy1Error.message : 'Unknown',
                                strategy2Error: strategy2Error instanceof Error ? strategy2Error.message : 'Unknown',
                                strategy3Error: strategy3Error instanceof Error ? strategy3Error.message : 'Unknown',
                                responseLength: response.data?.length,
                                responsePreview: response.data?.substring(0, 1000),
                                errorChar: originalError instanceof Error && originalError.message.includes('char') 
                                    ? originalError.message.match(/char (\d+)/)?.[1] 
                                    : null
                            });
                        }
                    }
                }

                // If parsing succeeded, assign the parsed data
                if (parsedData) {
                    responseData = parsedData;
                } else {
                    // If all cleaning strategies failed, throw a descriptive error
                    const errorChar = originalError instanceof Error && originalError.message.includes('char') 
                        ? originalError.message.match(/char (\d+)/)?.[1] 
                        : null;
                    
                    throw new Error(
                        `AI service returned invalid JSON that could not be parsed. ` +
                        `Error at character position: ${errorChar || 'unknown'}. ` +
                        `Original error: ${originalError instanceof Error ? originalError.message : 'Unknown'}. ` +
                        `This may be due to special characters or formatting issues in the generated content. ` +
                        `Please try regenerating the lesson content.`
                    );
                }
            }

            topicLogger.info('Lesson content generated successfully');
            
            return responseData;
        } catch (error) {
            // Handle JSON parsing errors separately
            if (error instanceof Error && (error.message.includes('invalid JSON') || error.message.includes('Invalid'))) {
                topicLogger.error('JSON parsing error from AI service', {
                    error: error.message,
                    requestData: {
                        topic_title: data.topic_title,
                        lesson_title: data.lesson_title,
                    }
                });
                throw new Error(
                    `AI service returned malformed JSON response. ` +
                    `This may be due to special characters in the generated content. ` +
                    `Please try again or contact support. Error: ${error.message}`
                );
            }

            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data;
                const status = error.response?.status;
                
                // Extract detailed error message from FastAPI validation errors
                let errorMessage = error.message;
                
                // Handle text response (when responseType is 'text')
                if (typeof errorData === 'string') {
                    // Try to clean and parse malformed JSON error response
                    try {
                        // Clean the error response JSON
                        let cleanedErrorJson = errorData
                            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                            .replace(/\\(?!["\\/bfnrtu0-9x])/g, '\\\\')
                            .replace(/,(\s*[}\]])/g, '$1');
                        
                        const parsed = JSON.parse(cleanedErrorJson);
                        if (parsed.detail) {
                            errorMessage = typeof parsed.detail === 'string' 
                                ? parsed.detail 
                                : JSON.stringify(parsed.detail);
                        } else if (parsed.message) {
                            errorMessage = parsed.message;
                        } else {
                            errorMessage = errorData.substring(0, 500); // Use first 500 chars if can't parse
                        }
                    } catch {
                        // If parsing fails, extract error message from the string
                        // Look for common error patterns
                        const errorMatch = errorData.match(/(?:error|detail|message)[":\s]+([^"}\n]+)/i);
                        if (errorMatch && errorMatch[1]) {
                            errorMessage = errorMatch[1].trim();
                        } else {
                            errorMessage = errorData.substring(0, 500); // Use first 500 chars
                        }
                    }
                } else if (errorData && typeof errorData === 'object') {
                    if (errorData.detail) {
                        // FastAPI validation errors format
                        if (Array.isArray(errorData.detail)) {
                            const validationErrors = errorData.detail.map((err: any) => 
                                `${err.loc?.join('.')}: ${err.msg}`
                            ).join('; ');
                            errorMessage = validationErrors;
                        } else if (typeof errorData.detail === 'string') {
                            errorMessage = errorData.detail;
                        } else {
                            errorMessage = JSON.stringify(errorData.detail);
                        }
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                }
                
                // For 500 errors, provide more helpful message
                if (status === 500) {
                    // Check if error message indicates JSON parsing issue
                    if (errorMessage.includes('Invalid control character') || errorMessage.includes('Invalid \\escape')) {
                        errorMessage = `AI service encountered an error generating content. The response contains invalid characters that cannot be parsed. This may be due to special characters in the generated content. Please try regenerating the lesson content. Original error: ${errorMessage}`;
                    }
                }
                
                topicLogger.error('AI service error', { 
                    status: status, 
                    statusText: error.response?.statusText,
                    error: typeof errorData === 'string' ? errorData.substring(0, 1000) : errorData,
                    errorMessage: errorMessage,
                    requestData: {
                        topic_title: data.topic_title,
                        lesson_title: data.lesson_title,
                        grade: data.grade,
                        difficulty_level: data.difficulty_level,
                        exercises_count: data.exercises_count,
                        quiz_count: data.quiz_count,
                    }
                });
                
                // Throw ValidationError for 422 status codes
                if (status === 422) {
                    throw new ValidationError(`AI service validation error: ${errorMessage}`);
                }
                
                throw new Error(`AI service error: ${status || 'Unknown'} - ${errorMessage}`);
            }
            topicLogger.error('Failed to generate lesson content', { error });
            throw new Error(`Failed to generate lesson content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Save generated lessons to topic
     */
    async saveLessonsToTopic(topicId: string, lessons: string[]): Promise<ITopicDTO> {
        const topic = await this.topicRepository.findById(topicId);
        
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${topicId} not found`);
        }

        // Check for duplicate lesson titles within the topic
        const existingLessonTitles = new Set(
            topic.lessons.map(lesson => lesson.title.toLowerCase().trim())
        );
        
        const duplicateLessons: string[] = [];
        const newLessons: string[] = [];

        lessons.forEach((title) => {
            const normalizedTitle = title.toLowerCase().trim();
            if (existingLessonTitles.has(normalizedTitle)) {
                duplicateLessons.push(title);
            } else {
                newLessons.push(title);
                existingLessonTitles.add(normalizedTitle);
            }
        });

        if (duplicateLessons.length > 0) {
            topicLogger.warn('Duplicate lessons detected', {
                topicId,
                duplicates: duplicateLessons,
            });
            throw new ConflictError(
                `The following lesson(s) already exist in this topic: ${duplicateLessons.join(', ')}. Please remove duplicates or use different titles.`
            );
        }

        if (newLessons.length === 0) {
            throw new ValidationError('All provided lessons already exist in this topic. No new lessons to add.');
        }

        // Only add new, non-duplicate lessons
        const lessonDocuments: Array<Omit<ITopicLesson, '_id'>> = newLessons.map((title, index) => ({
            title,
            order: topic.lessons.length + index + 1,
            status: 'generated',
            type: 'lesson',
            exercisesCount: 0,
        }));

        await this.topicRepository.addLessons(topicId, lessonDocuments);
        
        const updatedTopic = await this.topicRepository.findById(topicId);
        if (!updatedTopic) {
            throw new NotFoundError(`Topic with ID ${topicId} not found after update`);
        }

        topicLogger.info('Lessons added to topic', {
            topicId,
            addedCount: newLessons.length,
        });

        return (updatedTopic as any).toDTO();
    }

    /**
     * Save generated lesson content
     */
    async saveLessonContent(topicId: string, lessonId: string, content: any): Promise<ITopicDTO> {
        const topic = await this.topicRepository.findById(topicId);
        
        if (!topic) {
            throw new NotFoundError(`Topic with ID ${topicId} not found`);
        }

        // Find lesson by ID - lessons is an array, so we need to find by _id
        const lesson = (topic.lessons as any[]).find((l: any) => l._id?.toString() === lessonId);
        if (!lesson) {
            throw new NotFoundError(`Lesson with ID ${lessonId} not found in topic ${topicId}`);
        }

        // Update lesson content
        await this.topicRepository.updateLessonContent(topicId, lessonId, content);
        
        // Update exercises count from content
        if (content.practice_exercises) {
            await this.topicRepository.updateLesson(topicId, lessonId, {
                exercisesCount: content.practice_exercises.length,
            });
        }

        const updatedTopic = await this.topicRepository.findById(topicId);
        if (!updatedTopic) {
            throw new NotFoundError(`Topic with ID ${topicId} not found after update`);
        }

        return (updatedTopic as any).toDTO();
    }
}

export default TopicService;

