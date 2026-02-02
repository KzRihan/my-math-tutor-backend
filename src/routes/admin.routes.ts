/**
 * Admin Routes
 * 
 * Express router for admin-specific endpoints.
 * All routes require admin authentication.
 */

import { Router } from 'express';
import { container } from 'tsyringe';
import { AuthController } from '@controllers/auth.controller';
import { TopicController } from '@controllers/topic.controller';
import { QuizReviewController } from '@controllers/quiz-review.controller';
import { AdminDashboardController } from '@controllers/admin-dashboard.controller';
import { AdminStudentController } from '@controllers/admin-student.controller';
import { getAnalyticsData } from '@controllers/admin-analytics.controller';
import { SettingsController } from '@controllers/settings.controller';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { UserRole, UserStatus } from '@domain/enums/user-status.enum';
import {
    validateBody,
    loginSchema,
} from '@middlewares/validate.middleware';
// import { adminLoginRateLimiter } from '@middlewares/rate-limiter.middleware'; // COMMENTED OUT - Rate limiting disabled

/**
 * Create admin routes
 * Factory function for dependency injection
 */
export function createAdminRoutes(): Router {
    const router = Router();

    // Get controller instance from DI container
    const authController = container.resolve(AuthController);

    // ============================================================
    // Public Admin Routes (Login)
    // ============================================================

    /**
     * POST /admin/auth/signin
     * Admin login - only users with ADMIN or SUPER_ADMIN role
     * Rate limited: 3 attempts per minute per email+IP
     */
    router.post(
        '/auth/signin',
        // adminLoginRateLimiter, // COMMENTED OUT - Rate limiting disabled
        validateBody(loginSchema),
        authController.adminSignin
    );

    // ============================================================
    // Protected Admin Routes (require authentication + admin role)
    // ============================================================

    /**
     * GET /admin/dashboard
     * Admin dashboard stats (protected)
     */
    const dashboardController = container.resolve(AdminDashboardController);
    router.get(
        '/dashboard',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        dashboardController.getDashboardData.bind(dashboardController)
    );

    /**
     * GET /admin/analytics
     * Admin analytics data (protected)
     */
    router.get(
        '/analytics',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        getAnalyticsData
    );

    /**
     * GET /admin/users
     * Get all users (protected - admin only)
     */
    router.get(
        '/users',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        async (req, res, next) => {
            try {
                const { UserService } = await import('@services/user.service');
                const userService = container.resolve(UserService);

                // Parse pagination from query params
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 20;
                const status = req.query.status as UserStatus | undefined;
                const role = req.query.role as UserRole | undefined;

                const users = await userService.getUsers({
                    page,
                    limit,
                    status,
                    role,
                });

                res.json({
                    success: true,
                    message: 'Users retrieved successfully',
                    data: users,
                });
            } catch (error) {
                next(error);
            }
        }
    );

    // ============================================================
    // Student Routes (protected - admin only)
    // ============================================================

    const studentController = container.resolve(AdminStudentController);

    /**
     * GET /admin/students
     * Get student list with filters
     */
    router.get(
        '/students',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        studentController.getStudentList.bind(studentController)
    );

    /**
     * GET /admin/students/:id
     * Get student detail
     */
    router.get(
        '/students/:id',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        studentController.getStudentDetail.bind(studentController)
    );

    /**
     * POST /admin/students/:id/send-email
     * Send email to student
     */
    router.post(
        '/students/:id/send-email',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        studentController.sendEmailToStudent.bind(studentController)
    );

    /**
     * POST /admin/students/:id/unlock-topic
     * Unlock topic for student
     */
    router.post(
        '/students/:id/unlock-topic',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        studentController.unlockTopicForStudent.bind(studentController)
    );

    /**
     * POST /admin/students/:id/reset-quizzes
     * Reset all quizzes for student
     */
    router.post(
        '/students/:id/reset-quizzes',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        studentController.resetAllQuizzesForStudent.bind(studentController)
    );

    /**
     * POST /admin/students/:id/suspend
     * Suspend student account
     */
    router.post(
        '/students/:id/suspend',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        studentController.suspendStudent.bind(studentController)
    );

    /**
     * POST /admin/students/:id/activate
     * Activate student account
     */
    router.post(
        '/students/:id/activate',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        studentController.activateStudent.bind(studentController)
    );

    // ============================================================
    // Topic Routes (protected - admin only)
    // ============================================================

    const topicController = container.resolve(TopicController);

    /**
     * POST /admin/topics
     * Create a new topic
     */
    router.post(
        '/topics',
        authenticate,
        authorize(UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.create
    );

    /**
     * GET /admin/topics
     * Get all topics
     */
    router.get(
        '/topics',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.getAll
    );

    /**
     * GET /admin/topics/:id
     * Get topic by ID
     */
    router.get(
        '/topics/:id',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.getById
    );

    /**
     * PUT /admin/topics/:id
     * Update topic
     */
    router.put(
        '/topics/:id',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.update
    );

    /**
     * DELETE /admin/topics/:id
     * Delete topic
     */
    router.delete(
        '/topics/:id',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.delete
    );

    /**
     * POST /admin/topics/generate-lessons
     * Generate lessons for a topic using AI
     */
    router.post(
        '/topics/generate-lessons',
        authenticate,
        authorize(UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.generateLessons
    );

    /**
     * POST /admin/topics/generate-lesson-content
     * Generate lesson content using AI
     */
    router.post(
        '/topics/generate-lesson-content',
        authenticate,
        authorize(UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.generateLessonContent
    );

    /**
     * POST /admin/topics/:topicId/lessons
     * Save lessons to a topic
     */
    router.post(
        '/topics/:topicId/lessons',
        authenticate,
        authorize(UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.saveLessons
    );

    /**
     * POST /admin/topics/:topicId/lessons/:lessonId/content
     * Save lesson content
     */
    router.post(
        '/topics/:topicId/lessons/:lessonId/content',
        authenticate,
        authorize(UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.saveLessonContent
    );

    /**
     * POST /admin/topics/:id/publish
     * Publish a topic
     */
    router.post(
        '/topics/:id/publish',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.publish
    );

    /**
     * POST /admin/topics/:id/unpublish
     * Unpublish a topic
     */
    router.post(
        '/topics/:id/unpublish',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        topicController.unpublish
    );

    // ============================================================
    // Quiz Review Routes (protected - admin only)
    // ============================================================

    const quizReviewController = container.resolve(QuizReviewController);

    /**
     * GET /admin/quiz/pending
     * Get pending quiz responses for review
     */
    router.get(
        '/quiz/pending',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        quizReviewController.getPendingQuizResponses
    );

    /**
     * GET /admin/quiz/status/:status
     * Get quiz responses by status (pending, approved, rejected)
     */
    router.get(
        '/quiz/status/:status',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        quizReviewController.getQuizResponsesByStatus
    );

    /**
     * POST /admin/quiz/review
     * Review and approve/reject a quiz answer
     */
    router.post(
        '/quiz/review',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        quizReviewController.reviewQuizAnswer
    );

    /**
     * GET /admin/quiz/stats
     * Get quiz review statistics
     */
    router.get(
        '/quiz/stats',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        quizReviewController.getQuizReviewStats
    );

    // ============================================================
    // Settings Routes
    // ============================================================
    const settingsController = container.resolve(SettingsController);

    // System settings - admin only
    router.get(
        '/settings/system',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        settingsController.getSystemSettings
    );

    router.put(
        '/settings/system',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN), // Admin and Super Admin can update
        settingsController.updateSystemSettings
    );

    // Storage stats - admin only
    router.get(
        '/settings/storage',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        settingsController.getStorageStats
    );

    // Backup
    router.post(
        '/settings/backup',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        settingsController.createBackup
    );

    // Activity logs - requires admin access
    router.get(
        '/settings/logs',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        settingsController.getActivityLogs
    );

    router.get(
        '/settings/logs/export',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        settingsController.exportActivityLogs
    );

    // Danger zone
    router.delete(
        '/settings/content/generated',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        settingsController.deleteGeneratedContent
    );

    router.delete(
        '/settings/progress/reset',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        settingsController.resetAllProgress
    );

    // Security - all authenticated users can change their own password
    router.put(
        '/settings/password',
        authenticate,
        settingsController.updatePassword
    );

    // Login activity - admin only (shows current admin's login activity)
    router.get(
        '/settings/security/login-activity',
        authenticate,
        authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
        settingsController.getLoginActivity
    );

    return router;
}

export default createAdminRoutes;
