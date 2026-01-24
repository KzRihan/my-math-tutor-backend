/**
 * Enrollment Routes
 * 
 * Express router for enrollment endpoints.
 * All routes require user authentication.
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import { EnrollmentController } from '@controllers/enrollment.controller';
import { authenticate } from '@middlewares/auth.middleware';

/**
 * Create enrollment routes
 * Factory function for dependency injection
 */
export function createEnrollmentRoutes(): Router {
    const router = Router();
    const enrollmentController = container.resolve(EnrollmentController);

    // All routes require authentication
    router.use(authenticate);

    /**
     * POST /enrollments
     * Enroll user in a topic
     */
    router.post(
        '/enrollments',
        enrollmentController.enroll
    );

    /**
     * GET /enrollments
     * Get all user enrollments
     */
    router.get(
        '/enrollments',
        enrollmentController.getUserEnrollments
    );

    /**
     * GET /enrollments/topic/:topicId
     * Get user enrollment for a specific topic
     */
    router.get(
        '/enrollments/topic/:topicId',
        enrollmentController.getEnrollment
    );

    /**
     * PUT /enrollments/:id
     * Update enrollment
     */
    router.put(
        '/enrollments/:id',
        enrollmentController.update
    );

    /**
     * PUT /enrollments/:id/lesson-progress
     * Update lesson progress
     */
    router.put(
        '/enrollments/:id/lesson-progress',
        enrollmentController.updateLessonProgress
    );

    /**
     * DELETE /enrollments/topic/:topicId
     * Unenroll user from a topic
     */
    router.delete(
        '/enrollments/topic/:topicId',
        enrollmentController.unenroll
    );

    return router;
}

export default createEnrollmentRoutes;

