/**
 * Admin Dashboard Service
 * 
 * Aggregates data from multiple repositories to provide comprehensive
 * dashboard statistics and information for admin users.
 */

import { injectable, inject } from 'tsyringe';
import { TopicRepository } from '@repositories/topic.repository';
import { UserRepository } from '@repositories/user.repository';
import { EnrollmentRepository } from '@repositories/enrollment.repository';
import { QuestionResponseRepository } from '@repositories/question-response.repository';
import { TopicStatus } from '@domain/interfaces/topic.interface';
import { UserRole, UserStatus } from '@domain/enums/user-status.enum';
import { TopicDocument } from '@domain/models/topic.model';

export interface DashboardStats {
  totalTopics: number;
  publishedTopics: number;
  draftTopics: number;
  totalStudents: number;
  activeStudents: number; // Active in the last 7 days
  totalLessons: number;
  totalExercises: number;
  totalQuizzes: number;
  aiGenerationsToday: number; // Topics/lessons generated today
  avgQuizScore: number;
  topicsTrend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  studentsTrend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  quizScoreTrend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
}

export interface RecentTopic {
  id: string;
  title: string;
  status: string;
  lessonsCount: number;
  exercisesCount: number;
  studentsEnrolled: number;
  completionRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLogItem {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
  user: string;
  icon: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentTopics: RecentTopic[];
  activityLog: ActivityLogItem[];
}

@injectable()
export class AdminDashboardService {
  constructor(
    @inject(TopicRepository) private topicRepository: TopicRepository,
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(EnrollmentRepository) private enrollmentRepository: EnrollmentRepository,
    @inject(QuestionResponseRepository) private questionResponseRepository: QuestionResponseRepository
  ) {}

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    try {
      // Execute all queries in parallel for better performance
      const [
        topicStats,
        userStats,
        allTopics,
        recentTopicsData,
        enrollmentsData,
        questionResponsesData,
        activeUsersData,
        quizScoresData,
      ] = await Promise.all([
        this.topicRepository.getStatistics(),
        this.userRepository.getStatistics(),
        this.topicRepository.findAll(),
        this.getRecentTopics(),
        this.enrollmentRepository.findAll(),
        this.questionResponseRepository.findAll(),
        this.getActiveUsersThisWeek(),
        this.getQuizScores(),
      ]);

      // Calculate statistics
      const stats = await this.calculateStats(
        topicStats,
        userStats,
        allTopics,
        activeUsersData,
        quizScoresData
      );

      // Get recent topics with enrollment data
      const recentTopics = await this.enrichRecentTopics(recentTopicsData, enrollmentsData);

      // Get activity log
      const activityLog = await this.getActivityLog(allTopics, enrollmentsData, questionResponsesData);

      return {
        stats,
        recentTopics,
        activityLog,
      };
    } catch (error) {
      // Log error but return safe defaults
      console.error('Error fetching dashboard data:', error);
      return this.getDefaultDashboardData();
    }
  }

  /**
   * Calculate dashboard statistics
   */
  private async calculateStats(
    topicStats: { total: number; byStatus: Record<TopicStatus, number>; byGradeBand: Record<string, number> },
    userStats: { total: number; byStatus: Record<UserStatus, number>; byRole: Record<UserRole, number> },
    allTopics: any[],
    activeUsers: number,
    quizScores: { avg: number; count: number }
  ): Promise<DashboardStats> {
    // Topic statistics
    const totalTopics = topicStats.total || 0;
    const publishedTopics = topicStats.byStatus[TopicStatus.PUBLISHED] || 0;
    const draftTopics = topicStats.byStatus[TopicStatus.DRAFT] || 0;

    // User statistics
    const totalStudents = userStats.byRole[UserRole.USER] || 0;
    const activeStudents = activeUsers || 0;

    // Content statistics
    let totalLessons = 0;
    let totalExercises = 0;
    let totalQuizzes = 0;

    allTopics.forEach((topic) => {
      if (topic.lessons && Array.isArray(topic.lessons)) {
        totalLessons += topic.lessons.length;
        topic.lessons.forEach((lesson: any) => {
          if (lesson.content) {
            // Count practice exercises
            if (lesson.content.practice_exercises && Array.isArray(lesson.content.practice_exercises)) {
              totalExercises += lesson.content.practice_exercises.length;
            }
            // Count quiz questions
            if (lesson.content.quiz && Array.isArray(lesson.content.quiz)) {
              totalQuizzes += lesson.content.quiz.length;
            }
          }
        });
      }
    });

    // AI generations today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const aiGenerationsToday = allTopics.filter((topic) => {
      const createdAt = new Date(topic.createdAt);
      return createdAt >= today && topic.creationMethod === 'ai';
    }).length;

    // Average quiz score
    const avgQuizScore = quizScores.avg || 0;

    // Calculate trends (simplified - compare with previous period)
    // In a real scenario, you'd compare with data from 7 days ago
    const topicsTrend = this.calculateTopicTrend(allTopics);
    const studentsTrend = this.calculateStudentTrend(activeUsers, totalStudents);
    const quizScoreTrend = this.calculateQuizScoreTrend(avgQuizScore);

    return {
      totalTopics,
      publishedTopics,
      draftTopics,
      totalStudents,
      activeStudents,
      totalLessons,
      totalExercises,
      totalQuizzes,
      aiGenerationsToday,
      avgQuizScore: Math.round(avgQuizScore * 10) / 10, // Round to 1 decimal
      topicsTrend,
      studentsTrend,
      quizScoreTrend,
    };
  }

  /**
   * Get recent topics (last 4)
   */
  private async getRecentTopics(): Promise<TopicDocument[]> {
    try {
      const topics = await this.topicRepository.findAll();
      // Sort by updatedAt descending and take first 4
      return topics
        .sort((a: any, b: any) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 4);
    } catch (error) {
      console.error('Error fetching recent topics:', error);
      return [];
    }
  }

  /**
   * Enrich recent topics with enrollment and completion data
   */
  private async enrichRecentTopics(
    topics: TopicDocument[],
    enrollments: any[]
  ): Promise<RecentTopic[]> {
    return topics.map((topic: any) => {
      const topicId = topic._id?.toString() || topic.id;
      
      // Count enrollments for this topic
      const topicEnrollments = enrollments.filter(
        (enrollment: any) => enrollment.topicId?.toString() === topicId
      );
      const studentsEnrolled = topicEnrollments.length;

      // Calculate completion rate
      let completedCount = 0;
      topicEnrollments.forEach((enrollment: any) => {
        if (enrollment.lessonsCompleted && enrollment.lessonsCompleted.length > 0) {
          const totalLessons = topic.lessons?.length || 0;
          if (totalLessons > 0) {
            const completionPercentage = (enrollment.lessonsCompleted.length / totalLessons) * 100;
            if (completionPercentage >= 100) {
              completedCount++;
            }
          }
        }
      });
      const completionRate = studentsEnrolled > 0 
        ? Math.round((completedCount / studentsEnrolled) * 100) 
        : 0;

      // Count lessons and exercises
      let lessonsCount = 0;
      let exercisesCount = 0;
      if (topic.lessons && Array.isArray(topic.lessons)) {
        lessonsCount = topic.lessons.length;
        topic.lessons.forEach((lesson: any) => {
          if (lesson.content?.practice_exercises && Array.isArray(lesson.content.practice_exercises)) {
            exercisesCount += lesson.content.practice_exercises.length;
          }
        });
      }

      return {
        id: topicId,
        title: topic.title || 'Untitled Topic',
        status: topic.status || TopicStatus.DRAFT,
        lessonsCount,
        exercisesCount,
        studentsEnrolled,
        completionRate,
        createdAt: topic.createdAt || new Date(),
        updatedAt: topic.updatedAt || topic.createdAt || new Date(),
      };
    });
  }

  /**
   * Get active users in the last 7 days
   */
  private async getActiveUsersThisWeek(): Promise<number> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const activeUsers = await this.userRepository.findAll({
        lastLoginAt: { $gte: sevenDaysAgo },
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      } as any);

      return activeUsers.length || 0;
    } catch (error) {
      console.error('Error fetching active users:', error);
      return 0;
    }
  }

  /**
   * Get average quiz score
   */
  private async getQuizScores(): Promise<{ avg: number; count: number }> {
    try {
      const quizResponses = await this.questionResponseRepository.findAll({
        questionType: 'quiz',
        isCorrect: true,
        reviewStatus: 'approved',
      } as any);

      if (quizResponses.length === 0) {
        return { avg: 0, count: 0 };
      }

      // For now, we'll use a simple calculation
      // In a real scenario, you'd calculate based on actual quiz scores
      // This is a placeholder - you may need to adjust based on your data model
      const totalResponses = quizResponses.length;
      const correctResponses = quizResponses.filter((r: any) => r.isCorrect).length;
      const avgScore = totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0;

      return { avg: avgScore, count: totalResponses };
    } catch (error) {
      console.error('Error fetching quiz scores:', error);
      return { avg: 0, count: 0 };
    }
  }

  /**
   * Get activity log
   */
  private async getActivityLog(
    topics: any[],
    enrollments: any[],
    questionResponses: any[]
  ): Promise<ActivityLogItem[]> {
    const activities: ActivityLogItem[] = [];
    const now = new Date();

    try {
      // Recent topic publications
      const recentPublishedTopics = topics
        .filter((topic: any) => {
          if (!topic.publishedAt) return false;
          const publishedDate = new Date(topic.publishedAt);
          const daysDiff = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        })
        .slice(0, 3);

      recentPublishedTopics.forEach((topic: any) => {
        const topicId = topic._id?.toString() || topic.id || 'unknown';
        activities.push({
          id: `topic-published-${topicId}`,
          type: 'topic_published',
          message: `Topic "${topic.title || 'Untitled'}" was published`,
          timestamp: topic.publishedAt || topic.updatedAt || topic.createdAt || new Date(),
          user: 'System Admin',
          icon: '✅',
        });
      });

      // Recent enrollments (grouped by topic)
      const recentEnrollments = enrollments
        .filter((enrollment: any) => {
          const enrolledDate = new Date(enrollment.enrolledAt || enrollment.createdAt);
          const daysDiff = (now.getTime() - enrolledDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        })
        .slice(0, 10);

      // Group enrollments by topic
      const enrollmentsByTopic = new Map<string, number>();
      recentEnrollments.forEach((enrollment: any) => {
        const topicId = enrollment.topicId?.toString() || 'unknown';
        enrollmentsByTopic.set(topicId, (enrollmentsByTopic.get(topicId) || 0) + 1);
      });

      enrollmentsByTopic.forEach((count, topicId) => {
        const topic = topics.find((t: any) => (t._id?.toString() || t.id) === topicId);
        if (topic && count >= 5) {
          activities.push({
            id: `enrollment-${topicId}-${Date.now()}`,
            type: 'student_enrolled',
            message: `${count} new students enrolled in "${topic.title || 'Untitled Topic'}"`,
            timestamp: new Date(),
            user: 'System',
            icon: '👥',
          });
        }
      });

      // Recent quiz completions
      const recentQuizResponses = questionResponses
        .filter((response: any) => {
          if (response.questionType !== 'quiz') return false;
          const responseDate = new Date(response.answeredAt || response.createdAt);
          const daysDiff = (now.getTime() - responseDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        })
        .slice(0, 5);

      if (recentQuizResponses.length > 0) {
        // Group by topic
        const quizByTopic = new Map<string, number>();
        recentQuizResponses.forEach((response: any) => {
          const topicId = response.topicId?.toString() || 'unknown';
          quizByTopic.set(topicId, (quizByTopic.get(topicId) || 0) + 1);
        });

        quizByTopic.forEach((count, topicId) => {
          const topic = topics.find((t: any) => (t._id?.toString() || t.id) === topicId);
          if (topic && count >= 10) {
            activities.push({
              id: `quiz-completed-${topicId}-${Date.now()}`,
              type: 'quiz_completed',
              message: `${count} students completed quiz for "${topic.title || 'Untitled Topic'}"`,
              timestamp: new Date(),
              user: 'System',
              icon: '📊',
            });
          }
        });
      }

      // Sort by timestamp descending and limit to 6
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6);
    } catch (error) {
      console.error('Error generating activity log:', error);
      return [];
    }
  }

  /**
   * Calculate topic trend
   */
  private calculateTopicTrend(topics: any[]): { value: number; direction: 'up' | 'down' | 'neutral' } {
    // Simplified trend calculation
    // In production, compare with data from previous period
    const recentTopics = topics.filter((topic: any) => {
      const createdAt = new Date(topic.createdAt);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return createdAt >= sevenDaysAgo;
    }).length;

    return {
      value: recentTopics,
      direction: recentTopics > 0 ? 'up' : 'neutral',
    };
  }

  /**
   * Calculate student trend
   */
  private calculateStudentTrend(activeStudents: number, _totalStudents: number): { value: string; direction: 'up' | 'down' | 'neutral' } {
    // Simplified trend calculation
    // In production, compare with data from previous period
    // _totalStudents is kept for future use in more accurate trend calculations
    const previousWeekEstimate = activeStudents * 0.9; // Simplified estimate
    const change = activeStudents - previousWeekEstimate;
    const changePercentage = previousWeekEstimate > 0 ? (change / previousWeekEstimate) * 100 : 0;

    return {
      value: changePercentage > 0 ? `+${Math.round(changePercentage)}%` : `${Math.round(changePercentage)}%`,
      direction: changePercentage > 0 ? 'up' : changePercentage < 0 ? 'down' : 'neutral',
    };
  }

  /**
   * Calculate quiz score trend
   */
  private calculateQuizScoreTrend(avgScore: number): { value: string; direction: 'up' | 'down' | 'neutral' } {
    // Simplified trend - in production, compare with previous period
    const estimatedPrevious = avgScore * 0.97; // Simplified estimate
    const change = avgScore - estimatedPrevious;
    const changePercentage = estimatedPrevious > 0 ? (change / estimatedPrevious) * 100 : 0;

    return {
      value: changePercentage > 0 ? `+${Math.round(changePercentage * 10) / 10}%` : `${Math.round(changePercentage * 10) / 10}%`,
      direction: changePercentage > 0 ? 'up' : changePercentage < 0 ? 'down' : 'neutral',
    };
  }

  /**
   * Get default dashboard data (fallback)
   */
  private getDefaultDashboardData(): DashboardData {
    return {
      stats: {
        totalTopics: 0,
        publishedTopics: 0,
        draftTopics: 0,
        totalStudents: 0,
        activeStudents: 0,
        totalLessons: 0,
        totalExercises: 0,
        totalQuizzes: 0,
        aiGenerationsToday: 0,
        avgQuizScore: 0,
      },
      recentTopics: [],
      activityLog: [],
    };
  }
}
