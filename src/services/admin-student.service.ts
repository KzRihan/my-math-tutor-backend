/**
 * Admin Student Service
 * 
 * Aggregates comprehensive student data for admin dashboard including
 * enrollments, quiz history, activity, and statistics.
 */

import { injectable, inject } from 'tsyringe';
import { UserRepository } from '@repositories/user.repository';
import { EnrollmentRepository } from '@repositories/enrollment.repository';
import { QuestionResponseRepository } from '@repositories/question-response.repository';
import { TopicRepository } from '@repositories/topic.repository';
import { EmailService } from '@services/email.service';
import { UserRole, UserStatus } from '@domain/enums/user-status.enum';

export interface StudentListStats {
  totalStudents: number;
  activeStudents: number;
  avgQuizScore: number;
  avgXPPoints: number;
}

export interface StudentListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gradeBand: string;
  status: string;
  level: number;
  xpPoints: number;
  avgQuizScore: number;
  enrolledTopicsCount: number;
  completedTopicsCount: number;
  lastActive: Date;
  totalTimeSpent: number;
}

export interface StudentDetail extends StudentListItem {
  enrolledTopics: Array<{
    id: string;
    title: string;
    gradeBand: string;
    difficulty: string;
    progress: number;
    status: string;
    lessonsCount: number;
    exercisesCount: number;
  }>;
  quizHistory: Array<{
    id: string;
    topicId: string;
    topicTitle: string;
    score: number;
    date: Date;
    passed: boolean;
  }>;
  activity: Array<{
    id: string;
    type: string;
    action: string;
    detail: string;
    timestamp: Date;
    icon: string;
  }>;
  registeredAt: Date;
}

@injectable()
export class AdminStudentService {
  constructor(
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(EnrollmentRepository) private enrollmentRepository: EnrollmentRepository,
    @inject(QuestionResponseRepository) private questionResponseRepository: QuestionResponseRepository,
    @inject(TopicRepository) private topicRepository: TopicRepository,
    @inject(EmailService) private emailService: EmailService
  ) {}

  /**
   * Get student list with statistics
   */
  async getStudentList(query: {
    page?: number;
    limit?: number;
    search?: string;
    gradeBand?: string;
    status?: string;
  }): Promise<{
    data: StudentListItem[];
    stats: StudentListStats;
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Build filter for users
      const userFilter: any = {
        role: UserRole.USER,
      };

      if (query.status && query.status !== 'all') {
        userFilter.status = query.status === 'active' ? UserStatus.ACTIVE : UserStatus.INACTIVE;
      }

      // Get all users (students)
      const allUsers = await this.userRepository.findAll(userFilter);

      // Filter by search if provided
      let filteredUsers = allUsers;
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        filteredUsers = allUsers.filter((user: any) => {
          const firstName = (user.firstName || '').toLowerCase();
          const lastName = (user.lastName || '').toLowerCase();
          const email = (user.email || '').toLowerCase();
          return firstName.includes(searchLower) || lastName.includes(searchLower) || email.includes(searchLower);
        });
      }

      // Filter by gradeBand if provided
      if (query.gradeBand && query.gradeBand !== 'all') {
        filteredUsers = filteredUsers.filter((user: any) => user.learnLevel === query.gradeBand);
      }

      // Get enrollments for all users
      const allEnrollments = await this.enrollmentRepository.findAll();
      const enrollmentsByUser = new Map<string, any[]>();
      allEnrollments.forEach((enrollment: any) => {
        const userId = enrollment.userId?.toString() || '';
        if (!enrollmentsByUser.has(userId)) {
          enrollmentsByUser.set(userId, []);
        }
        enrollmentsByUser.get(userId)!.push(enrollment);
      });

      // Get quiz responses for calculating scores
      const allQuizResponses = await this.questionResponseRepository.findAll({
        questionType: 'quiz',
        reviewStatus: 'approved',
      } as any);

      const quizScoresByUser = new Map<string, { total: number; correct: number }>();
      allQuizResponses.forEach((response: any) => {
        const userId = response.userId?.toString() || '';
        if (!quizScoresByUser.has(userId)) {
          quizScoresByUser.set(userId, { total: 0, correct: 0 });
        }
        const userScores = quizScoresByUser.get(userId)!;
        userScores.total++;
        if (response.isCorrect) {
          userScores.correct++;
        }
      });

      // Calculate statistics
      const activeUsers = filteredUsers.filter((u: any) => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return u.lastLoginAt && new Date(u.lastLoginAt) >= sevenDaysAgo;
      });

      const totalStudents = filteredUsers.length;
      const activeStudents = activeUsers.length;

      // Calculate average quiz score
      let totalQuizScore = 0;
      let quizScoreCount = 0;
      quizScoresByUser.forEach((scores) => {
        if (scores.total > 0) {
          const avg = (scores.correct / scores.total) * 100;
          totalQuizScore += avg;
          quizScoreCount++;
        }
      });
      const avgQuizScore = quizScoreCount > 0 ? totalQuizScore / quizScoreCount : 0;

      // Calculate average XP
      const totalXP = filteredUsers.reduce((sum: number, user: any) => sum + (user.xpPoints || 0), 0);
      const avgXPPoints = totalStudents > 0 ? totalXP / totalStudents : 0;

      // Build student list items
      const page = query.page || 1;
      const limit = query.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      const studentList: StudentListItem[] = await Promise.all(
        paginatedUsers.map(async (user: any) => {
          const userId = user._id?.toString() || user.id;
          const userEnrollments = enrollmentsByUser.get(userId) || [];
          const completedEnrollments = userEnrollments.filter((e: any) => e.progress === 100);
          const userQuizScores = quizScoresByUser.get(userId) || { total: 0, correct: 0 };
          const avgScore = userQuizScores.total > 0 
            ? Math.round((userQuizScores.correct / userQuizScores.total) * 100) 
            : 0;

          // Calculate total time spent from enrollments
          const totalTimeSpent = userEnrollments.reduce((sum: number, e: any) => {
            if (e.lessonProgress && Array.isArray(e.lessonProgress)) {
              return sum + e.lessonProgress.reduce((lessonSum: number, lp: any) => lessonSum + (lp.timeSpent || 0), 0);
            }
            return sum;
          }, 0);

          return {
            id: userId,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            gradeBand: user.learnLevel || 'primary',
            status: user.status === UserStatus.ACTIVE ? 'active' : 'inactive',
            level: user.level || 1,
            xpPoints: user.xpPoints || 0,
            avgQuizScore: avgScore,
            enrolledTopicsCount: userEnrollments.length,
            completedTopicsCount: completedEnrollments.length,
            lastActive: user.lastLoginAt || user.createdAt || new Date(),
            totalTimeSpent,
          };
        })
      );

      return {
        data: studentList,
        stats: {
          totalStudents,
          activeStudents,
          avgQuizScore: Math.round(avgQuizScore * 10) / 10,
          avgXPPoints: Math.round(avgXPPoints),
        },
        total: filteredUsers.length,
        page,
        limit,
      };
    } catch (error) {
      console.error('Error fetching student list:', error);
      return {
        data: [],
        stats: {
          totalStudents: 0,
          activeStudents: 0,
          avgQuizScore: 0,
          avgXPPoints: 0,
        },
        total: 0,
        page: query.page || 1,
        limit: query.limit || 20,
      };
    }
  }

  /**
   * Get detailed student information
   */
  async getStudentDetail(userId: string): Promise<StudentDetail | null> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user || (user as any).role !== UserRole.USER) {
        return null;
      }

      // Get enrollments
      const enrollments = await this.enrollmentRepository.findByUser(userId);
      
      // Get topics for enrollments
      const topicIds = enrollments.map((e: any) => e.topicId?.toString()).filter(Boolean);
      const topics = await Promise.all(
        topicIds.map(async (topicId: string) => {
          return await this.topicRepository.findById(topicId);
        })
      );

      // Build enrolled topics with progress
      const enrolledTopics = enrollments.map((enrollment: any) => {
        const topicId = enrollment.topicId?.toString();
        const topic = topics.find((t: any) => (t?._id?.toString() || t?.id) === topicId);
        
        if (!topic) return null;

        const lessonsCount = (topic.lessons && Array.isArray(topic.lessons)) ? topic.lessons.length : 0;
        let exercisesCount = 0;
        if (topic.lessons && Array.isArray(topic.lessons)) {
          topic.lessons.forEach((lesson: any) => {
            if (lesson.content?.practice_exercises && Array.isArray(lesson.content.practice_exercises)) {
              exercisesCount += lesson.content.practice_exercises.length;
            }
          });
        }

        return {
          id: topicId,
          title: topic.title || 'Untitled Topic',
          gradeBand: topic.gradeBand || 'primary',
          difficulty: topic.difficulty || 'medium',
          progress: enrollment.progress || 0,
          status: enrollment.progress === 100 ? 'completed' : 'in_progress',
          lessonsCount,
          exercisesCount,
        };
      }).filter(Boolean) as any[];

      // Get quiz history
      const quizResponses = await this.questionResponseRepository.findAll({
        userId,
        questionType: 'quiz',
        reviewStatus: 'approved',
      } as any);

      // Group quiz responses by topic
      const quizByTopic = new Map<string, any[]>();
      quizResponses.forEach((response: any) => {
        const topicId = response.topicId?.toString();
        if (!quizByTopic.has(topicId)) {
          quizByTopic.set(topicId, []);
        }
        quizByTopic.get(topicId)!.push(response);
      });

      const quizHistory = Array.from(quizByTopic.entries()).map(([topicId, responses]) => {
        const topic = topics.find((t: any) => (t?._id?.toString() || t?.id) === topicId);
        const correctCount = responses.filter((r: any) => r.isCorrect).length;
        const totalCount = responses.length;
        const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        const latestResponse = responses.sort((a: any, b: any) => 
          new Date(b.answeredAt || b.createdAt).getTime() - new Date(a.answeredAt || a.createdAt).getTime()
        )[0];

        return {
          id: `${topicId}-${latestResponse._id}`,
          topicId,
          topicTitle: topic?.title || 'Unknown Topic',
          score,
          date: latestResponse.answeredAt || latestResponse.createdAt || new Date(),
          passed: score >= 70, // Assuming 70% is passing
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Get activity log
      const activity = await this.getStudentActivity(userId, enrollments, quizResponses);

      // Calculate stats
      const userEnrollments = enrollments;
      const completedEnrollments = userEnrollments.filter((e: any) => e.progress === 100);
      const userQuizScores = quizResponses.filter((r: any) => r.isCorrect).length;
      const totalQuizResponses = quizResponses.length;
      const avgQuizScore = totalQuizResponses > 0 
        ? Math.round((userQuizScores / totalQuizResponses) * 100) 
        : 0;

      const totalTimeSpent = userEnrollments.reduce((sum: number, e: any) => {
        if (e.lessonProgress && Array.isArray(e.lessonProgress)) {
          return sum + e.lessonProgress.reduce((lessonSum: number, lp: any) => lessonSum + (lp.timeSpent || 0), 0);
        }
        return sum;
      }, 0);

      return {
        id: user._id?.toString() || userId,
        firstName: (user as any).firstName || '',
        lastName: (user as any).lastName || '',
        email: (user as any).email || '',
        gradeBand: (user as any).learnLevel || 'primary',
        status: (user as any).status === UserStatus.ACTIVE ? 'active' : 'inactive',
        level: (user as any).level || 1,
        xpPoints: (user as any).xpPoints || 0,
        avgQuizScore,
        enrolledTopicsCount: userEnrollments.length,
        completedTopicsCount: completedEnrollments.length,
        lastActive: (user as any).lastLoginAt || (user as any).createdAt || new Date(),
        totalTimeSpent,
        enrolledTopics,
        quizHistory: quizHistory.slice(0, 20), // Limit to 20 most recent
        activity: activity.slice(0, 20), // Limit to 20 most recent
        registeredAt: (user as any).createdAt || new Date(),
      };
    } catch (error) {
      console.error('Error fetching student detail:', error);
      return null;
    }
  }

  /**
   * Get student activity log
   */
  private async getStudentActivity(
    _userId: string,
    enrollments: any[],
    quizResponses: any[]
  ): Promise<Array<{ id: string; type: string; action: string; detail: string; timestamp: Date; icon: string }>> {
    const activities: Array<{ id: string; type: string; action: string; detail: string; timestamp: Date; icon: string }> = [];

    try {
      // Add enrollment activities
      enrollments.forEach((enrollment: any) => {
        activities.push({
          id: `enrollment-${enrollment._id}`,
          type: 'enrollment',
          action: 'Enrolled in topic',
          detail: `Topic ID: ${enrollment.topicId}`,
          timestamp: enrollment.enrolledAt || enrollment.createdAt || new Date(),
          icon: '📚',
        });
      });

      // Add quiz completion activities
      const quizByTopic = new Map<string, any[]>();
      quizResponses.forEach((response: any) => {
        const topicId = response.topicId?.toString();
        if (!quizByTopic.has(topicId)) {
          quizByTopic.set(topicId, []);
        }
        quizByTopic.get(topicId)!.push(response);
      });

      quizByTopic.forEach((responses, topicId) => {
        const latestResponse = responses.sort((a: any, b: any) => 
          new Date(b.answeredAt || b.createdAt).getTime() - new Date(a.answeredAt || a.createdAt).getTime()
        )[0];
        const correctCount = responses.filter((r: any) => r.isCorrect).length;
        const score = responses.length > 0 ? Math.round((correctCount / responses.length) * 100) : 0;

        activities.push({
          id: `quiz-${topicId}-${latestResponse._id}`,
          type: 'quiz',
          action: score >= 70 ? 'Completed quiz' : 'Failed quiz',
          detail: `Score: ${score}%`,
          timestamp: latestResponse.answeredAt || latestResponse.createdAt || new Date(),
          icon: score >= 70 ? '✅' : '❌',
        });
      });

      // Add lesson completion activities from enrollments
      enrollments.forEach((enrollment: any) => {
        if (enrollment.lessonProgress && Array.isArray(enrollment.lessonProgress)) {
          enrollment.lessonProgress
            .filter((lp: any) => lp.status === 'completed')
            .forEach((lp: any) => {
              activities.push({
                id: `lesson-${enrollment._id}-${lp.lessonId}`,
                type: 'lesson',
                action: 'Completed lesson',
                detail: `Lesson ID: ${lp.lessonId}`,
                timestamp: lp.completedAt || lp.lastAccessedAt || new Date(),
                icon: '✅',
              });
            });
        }
      });

      // Sort by timestamp descending
      return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Error generating activity log:', error);
      return [];
    }
  }

  /**
   * Send email to student
   */
  async sendEmailToStudent(userId: string, subject: string, message: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Student not found');
    }

    // Send email using email service
    await this.emailService.sendNotification(
      (user as any).email,
      subject,
      message
    );
  }

  /**
   * Unlock topic for student (create enrollment if doesn't exist)
   */
  async unlockTopicForStudent(userId: string, topicId: string): Promise<void> {
    // Check if enrollment already exists
    const existingEnrollment = await this.enrollmentRepository.findByUserAndTopic(userId, topicId);
    if (existingEnrollment) {
      // Enrollment already exists, nothing to do
      return;
    }

    // Get topic to verify it exists
    const topic = await this.topicRepository.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    // Create enrollment
    const totalLessons = (topic.lessons && Array.isArray(topic.lessons)) ? topic.lessons.length : 0;
    await this.enrollmentRepository.createEnrollment({
      userId: userId as any,
      topicId: topicId as any,
      enrolledAt: new Date(),
      lastAccessedAt: new Date(),
      progress: 0,
      lessonsCompleted: 0,
      totalLessons,
      lessonProgress: [],
    } as any);

    // Update topic's studentsEnrolled count
    await this.topicRepository.updateById(topicId, {
      $inc: { studentsEnrolled: 1 },
    });
  }

  /**
   * Reset all quiz responses for a student
   */
  async resetAllQuizzesForStudent(userId: string): Promise<number> {
    // Delete all quiz responses for this user
    const deletedCount = await this.questionResponseRepository.deleteMany({
      userId,
      questionType: 'quiz',
    } as any);

    return deletedCount || 0;
  }

  /**
   * Suspend student account
   */
  async suspendStudent(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Student not found');
    }

    await this.userRepository.suspendUser(userId);
  }

  /**
   * Activate student account
   */
  async activateStudent(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Student not found');
    }

    await this.userRepository.activateUser(userId);
  }
}
