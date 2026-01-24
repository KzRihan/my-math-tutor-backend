/**
 * User Controller
 * 
 * HTTP request handlers for User endpoints.
 * Handles request parsing, validation, and response formatting.
 */

import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { UserService } from '@services/user.service';
import { EnrollmentService } from '@services/enrollment.service';
import { ICreateUser, IUpdateUser, IUserQuery } from '@domain/interfaces/user.interface';
import { UserStatus, UserRole } from '@domain/enums/user-status.enum';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated, calculatePagination } from '@utils/response';
import { asyncHandler } from '@utils/async-handler';
import { createChildLogger } from '@utils/logger';

const controllerLogger = createChildLogger('user-controller');

/**
 * User Controller
 * Handles HTTP requests for user operations
 */
@injectable()
export class UserController {
  constructor(
    @inject(UserService) private userService: UserService,
    @inject(EnrollmentService) private enrollmentService: EnrollmentService
  ) {}

  /**
   * Create a new user
   * POST /api/v1/users
   */
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const createData: ICreateUser = {
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      role: req.body.role,
    };

    controllerLogger.debug('Creating user', { email: createData.email });

    const user = await this.userService.createUser(createData);

    sendCreated(res, user, 'User created successfully');
  });

  /**
   * Get user by ID
   * GET /api/v1/users/:id
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      sendSuccess(res, null, 'User ID is required');
      return;
    }

    controllerLogger.debug('Getting user by ID', { id });

    const user = await this.userService.getUserById(id);

    sendSuccess(res, user);
  });

  /**
   * Get paginated list of users
   * GET /api/v1/users
   */
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Build query object, only including defined values
    const query: IUserQuery = {
      page: parseInt(req.query['page'] as string) || 1,
      limit: Math.min(parseInt(req.query['limit'] as string) || 20, 100),
      sortBy: (req.query['sortBy'] as IUserQuery['sortBy']) || 'createdAt',
      sortOrder: (req.query['sortOrder'] as IUserQuery['sortOrder']) || 'desc',
    };

    // Only add optional filters if they exist
    const search = req.query['search'] as string | undefined;
    const status = req.query['status'] as UserStatus | undefined;
    const role = req.query['role'] as UserRole | undefined;

    if (search) query.search = search;
    if (status) query.status = status;
    if (role) query.role = role;

    controllerLogger.debug('Getting users', { query });

    const result = await this.userService.getUsers(query);

    const pagination = calculatePagination(
      result.page,
      result.limit,
      result.total
    );

    sendPaginated(res, result.data, pagination);
  });

  /**
   * Get user statistics (admin)
   * GET /api/v1/users/statistics
   */
  getStatistics = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    controllerLogger.debug('Getting user statistics');

    const stats = await this.userService.getStatistics();

    sendSuccess(res, stats);
  });

  /**
   * Update user
   * PATCH /api/v1/users/:id
   */
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    
    if (!id) {
      sendSuccess(res, null, 'User ID is required');
      return;
    }

    const updateData: IUpdateUser = {};
    
    if (req.body.firstName !== undefined) updateData.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) updateData.lastName = req.body.lastName;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.role !== undefined) updateData.role = req.body.role;

    controllerLogger.debug('Updating user', { id, updateData });

    const user = await this.userService.updateUser(id, updateData);
    sendSuccess(res, user, 'User updated successfully');
  });

  /**
   * Get current user profile
   * GET /api/v1/users/me
   */
  getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      sendSuccess(res, null, 'Authentication required');
      return;
    }

    controllerLogger.debug('Getting current user profile', { userId });

    const user = await this.userService.getUserById(userId);

    sendSuccess(res, user);
  });

  /**
   * Update current user profile
   * PATCH /api/v1/users/me
   * Supports profile image upload via multipart/form-data
   */
  updateMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      sendSuccess(res, null, 'Authentication required');
      return;
    }

    const updateData: IUpdateUser = { ...req.body };

    // Handle file upload - if a file was uploaded, add the path to updateData
    if (req.file) {
      // Store the relative path for the profile image
      updateData.profileImage = `/uploads/profiles/${req.file.filename}`;
      controllerLogger.debug('Profile image uploaded', { 
        userId, 
        filename: req.file.filename,
        size: req.file.size 
      });
    }

    controllerLogger.debug('Updating current user profile', { userId, updateData });

    const user = await this.userService.updateUser(userId, updateData);

    sendSuccess(res, user, 'Profile updated successfully');
  });

  /**
   * Delete user
   * DELETE /api/v1/users/:id
   */
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      sendSuccess(res, null, 'User ID is required');
      return;
    }

    controllerLogger.debug('Deleting user', { id });

    await this.userService.deleteUser(id);

    sendNoContent(res);
  });

  /**
   * Verify email
   * GET /api/v1/users/verify-email
   */
  verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token = req.query['token'];

    if (!token || typeof token !== 'string') {
      sendSuccess(res, null, 'Invalid verification token');
      return;
    }

    // Decode token (in production, use proper JWT verification)
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');

    if (!userId) {
      sendSuccess(res, null, 'Invalid verification token');
      return;
    }

    const user = await this.userService.verifyEmail(userId);

    sendSuccess(res, user, 'Email verified successfully');
  });

  /**
   * Get current user's progress stats
   * GET /api/v1/users/me/progress
   * Returns aggregated progress data for the progress page
   */
  getMyProgress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      sendSuccess(res, null, 'Authentication required');
      return;
    }

    controllerLogger.debug('Getting user progress', { userId });

    // Update last login and get streak change info (for dashboard visit)
    const streakInfo = await this.userService.updateLastLogin(userId);

    // Get user data (after streak update)
    const user = await this.userService.getUserById(userId);

    // Get all user enrollments with topic info
    const enrollments = await this.enrollmentService.getUserEnrollments(userId);

    // Calculate topics completed (100% progress)
    const topicsCompleted = enrollments.filter(e => e.progress === 100).length;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    // Default lesson time (5 minutes) if timeSpent is 0 or not tracked
    const DEFAULT_LESSON_TIME = 5;

    // Calculate weekly study data from lesson progress
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyStudyData = weekDays.map((day, index) => {
      // Sum up time spent from all lesson progress completed on this day of the week
      let minutes = 0;
      enrollments.forEach((e) => {
        (e.lessonProgress || []).forEach((lp) => {
          if (lp.completedAt) {
            const completedDate = new Date(lp.completedAt);
            // Check if completed within current week and on this day
            if (completedDate >= startOfWeek && completedDate.getDay() === index) {
              // Use timeSpent if available, otherwise use default minimum time
              const lessonTime = lp.timeSpent && lp.timeSpent > 0 
                ? lp.timeSpent 
                : DEFAULT_LESSON_TIME;
              minutes += lessonTime;
            }
          }
        });
      });
      return { day, minutes };
    });

    // Calculate weekly progress (total minutes this week)
    const weeklyProgress = weeklyStudyData.reduce((total, day) => total + day.minutes, 0);

    // Calculate today's minutes and problems from lesson progress
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    
    let todayMinutes = 0;
    let todayProblems = 0;
    
    enrollments.forEach((e) => {
      (e.lessonProgress || []).forEach((lp) => {
        if (lp.completedAt) {
          const completedDate = new Date(lp.completedAt);
          // Check if completed today
          if (completedDate >= today && completedDate <= endOfToday) {
            // Use timeSpent if available, otherwise use default minimum time
            const lessonTime = lp.timeSpent && lp.timeSpent > 0 
              ? lp.timeSpent 
              : DEFAULT_LESSON_TIME;
            todayMinutes += lessonTime;
            // Count each completed lesson as a problem solved
            if (lp.status === 'completed') {
              todayProblems += 1;
            }
          }
        }
      });
    });

    // Calculate level progress (XP based)
    const xpPoints = user.xpPoints || 0;
    const level = user.level || Math.floor(xpPoints / 500) + 1;
    const xpForCurrentLevel = (level - 1) * 500;
    const xpForNextLevel = level * 500;
    const levelProgress = xpForNextLevel > xpForCurrentLevel 
      ? (xpPoints - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)
      : 0;

    // Build progress response
    const progressData = {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
      },
      streakPopup: {
        // Show popup only once per day, and only when streak increases
        shouldDisplay: streakInfo.streakIncreased && !streakInfo.popupDisplayedToday,
        isDisplayed: streakInfo.popupDisplayedToday,
      },
      stats: {
        totalTopicsCompleted: topicsCompleted,
        problemsSolved: user.problemsSolved || 0,
        totalMinutesLearned: user.totalMinutesLearned || 0,
        averageAccuracy: user.accuracy || 0,
        currentStreak: streakInfo.newStreak || 0,
        longestStreak: streakInfo.longestStreak || 0,
        level: level,
        xpPoints: xpPoints,
        levelProgress: levelProgress,
        nextLevelXp: xpForNextLevel,
        rankPercentile: 85, // Placeholder - would need leaderboard calculation
        weeklyGoal: user.weeklyGoal || 120,
        weeklyProgress: weeklyProgress,
        todayMinutes: todayMinutes,
        todayProblems: todayProblems,
      },
      streakInfo: {
        previousStreak: streakInfo.previousStreak,
        newStreak: streakInfo.newStreak,
        streakIncreased: streakInfo.streakIncreased,
      },
      enrollments: enrollments.map(e => ({
        id: e.id,
        topicId: e.topicId,
        topic: e.topic,
        progress: e.progress,
        lessonsCompleted: e.lessonsCompleted,
        totalLessons: e.totalLessons,
        status: e.status,
        lastAccessedAt: e.lastAccessedAt,
      })),
      weeklyStudyData,
    };

    sendSuccess(res, progressData);
  });

  /**
   * Mark streak popup as displayed
   * POST /api/v1/users/me/mark-streak-popup
   */
  markStreakPopupDisplayed = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      sendSuccess(res, null, 'Authentication required');
      return;
    }

    controllerLogger.debug('Marking streak popup as displayed', { userId });

    await this.userService.markStreakPopupDisplayed(userId);

    sendSuccess(res, { success: true }, 'Streak popup marked as displayed');
  });
}

export default UserController;
