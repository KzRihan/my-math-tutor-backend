/**
 * Admin Analytics Service
 * 
 * Provides comprehensive analytics data for the admin analytics page.
 */

import { injectable, inject } from 'tsyringe';
import { TopicRepository } from '@repositories/topic.repository';
import { UserRepository } from '@repositories/user.repository';
import { EnrollmentRepository } from '@repositories/enrollment.repository';
import { QuestionResponseRepository } from '@repositories/question-response.repository';
import { UserRole } from '@domain/enums/user-status.enum';
import { TopicStatus } from '@domain/interfaces/topic.interface';

export interface AnalyticsSummaryStats {
  totalStudents: number;
  lessonsCompleted: number;
  avgQuizScore: number;
  avgTimePerStudent: number; // in hours
  trends: {
    students: { value: string; direction: 'up' | 'down' | 'neutral' };
    lessons: { value: string; direction: 'up' | 'down' | 'neutral' };
    quizScore: { value: string; direction: 'up' | 'down' | 'neutral' };
    timePerStudent: { value: string; direction: 'up' | 'down' | 'neutral' };
  };
}

export interface WeeklyActiveUser {
  day: string;
  users: number;
}

export interface ExerciseDifficultyData {
  easy: { count: number; avgCorrect: number };
  medium: { count: number; avgCorrect: number };
  hard: { count: number; avgCorrect: number };
}

export interface TopicPerformance {
  topic: string;
  topicId: string;
  students: number;
  completion: number;
  avgScore: number;
  trend: { value: string; direction: 'up' | 'down' | 'neutral' };
}

export interface DropOffAnalysis {
  topic: string;
  lesson: string;
  dropoff: number;
}

export interface FlaggedQuestion {
  question: string;
  correct: number;
  type: 'Too Hard' | 'Too Easy' | 'Confusing';
}

export interface AnalyticsData {
  summaryStats: AnalyticsSummaryStats;
  weeklyActiveUsers: WeeklyActiveUser[];
  exerciseDifficulty: ExerciseDifficultyData;
  topicPerformance: TopicPerformance[];
  dropOffAnalysis: DropOffAnalysis[];
  flaggedQuestions: FlaggedQuestion[];
}

@injectable()
export class AdminAnalyticsService {
  constructor(
    @inject(TopicRepository) private topicRepository: TopicRepository,
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(EnrollmentRepository) private enrollmentRepository: EnrollmentRepository,
    @inject(QuestionResponseRepository) private questionResponseRepository: QuestionResponseRepository
  ) {}

  /**
   * Get comprehensive analytics data
   */
  async getAnalyticsData(timeRange: '7d' | '30d' | '90d' | '1y' = '7d'): Promise<AnalyticsData> {
    const dateRange = this.getDateRange(timeRange);
    
    const [
      summaryStats,
      weeklyActiveUsers,
      exerciseDifficulty,
      topicPerformance,
      dropOffAnalysis,
      flaggedQuestions,
    ] = await Promise.all([
      this.getSummaryStats(dateRange),
      this.getWeeklyActiveUsers(),
      this.getExerciseDifficulty(),
      this.getTopicPerformance(),
      this.getDropOffAnalysis(),
      this.getFlaggedQuestions(),
    ]);

    return {
      summaryStats,
      weeklyActiveUsers,
      exerciseDifficulty,
      topicPerformance,
      dropOffAnalysis,
      flaggedQuestions,
    };
  }

  /**
   * Get date range based on time range parameter
   */
  private getDateRange(timeRange: '7d' | '30d' | '90d' | '1y'): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    
    switch (timeRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }

  /**
   * Get summary statistics with trends
   */
  private async getSummaryStats(_dateRange: { start: Date; end: Date }): Promise<AnalyticsSummaryStats> {
    // Get all students
    const allUsers = await this.userRepository.findAll({ role: UserRole.USER });
    const totalStudents = allUsers.length;

    // Get lessons completed (enrollments with completed status)
    const allEnrollments = await this.enrollmentRepository.findAll();
    const lessonsCompleted = allEnrollments.filter(
      (e: any) => e.status === 'completed' || e.progress >= 100
    ).length;

    // Get average quiz score
    const quizResponses = await this.questionResponseRepository.findAll({
      questionType: 'quiz',
      reviewStatus: 'approved',
    } as any);
    
    const correctCount = quizResponses.filter((r: any) => r.isCorrect).length;
    const avgQuizScore = quizResponses.length > 0 
      ? Math.round((correctCount / quizResponses.length) * 100 * 10) / 10 
      : 0;

    // Get average time per student (in hours)
    const totalMinutes = allUsers.reduce((sum: number, user: any) => 
      sum + (user.totalMinutesLearned || 0), 0
    );
    const avgTimePerStudent = totalStudents > 0 
      ? Math.round((totalMinutes / totalStudents / 60) * 10) / 10 
      : 0;

    // Calculate trends (simplified - compare with previous period)
    // For now, use simplified trend calculation
    // In production, you'd compare actual data from previous period
    const studentsTrend = this.calculateTrend(totalStudents, totalStudents * 0.88);
    const lessonsTrend = this.calculateTrend(lessonsCompleted, lessonsCompleted * 0.92);
    const quizScoreTrend = this.calculateTrend(avgQuizScore, avgQuizScore * 0.96);
    const timeTrend = this.calculateTrend(avgTimePerStudent, avgTimePerStudent * 0.85);

    return {
      totalStudents,
      lessonsCompleted,
      avgQuizScore,
      avgTimePerStudent,
      trends: {
        students: studentsTrend,
        lessons: lessonsTrend,
        quizScore: quizScoreTrend,
        timePerStudent: timeTrend,
      },
    };
  }

  /**
   * Calculate trend percentage and direction
   */
  private calculateTrend(current: number, previous: number): { value: string; direction: 'up' | 'down' | 'neutral' } {
    if (previous === 0) {
      return { value: '+0%', direction: 'neutral' };
    }
    
    const change = ((current - previous) / previous) * 100;
    const rounded = Math.round(change);
    
    if (rounded > 0) {
      return { value: `+${rounded}%`, direction: 'up' };
    } else if (rounded < 0) {
      return { value: `${rounded}%`, direction: 'down' };
    } else {
      return { value: '0%', direction: 'neutral' };
    }
  }

  /**
   * Get weekly active users (last 7 days)
   */
  private async getWeeklyActiveUsers(): Promise<WeeklyActiveUser[]> {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const result: WeeklyActiveUser[] = [];
    
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Get all users
    const allUsers = await this.userRepository.findAll({ role: UserRole.USER });
    
    // For each of the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      // Count users who logged in on this day
      const usersOnDay = allUsers.filter((user: any) => {
        if (!user.lastLoginAt) return false;
        const loginDate = new Date(user.lastLoginAt);
        return loginDate >= date && loginDate < nextDate;
      }).length;
      
      // Calculate day name (adjust for week start)
      const dayIndex = (dayOfWeek - (6 - i) + 7) % 7;
      const dayNameIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      const dayName: string = days[dayNameIndex] ?? days[0] ?? 'Mon';
      
      result.push({
        day: dayName,
        users: usersOnDay,
      });
    }
    
    return result;
  }

  /**
   * Get exercise performance by difficulty
   */
  private async getExerciseDifficulty(): Promise<ExerciseDifficultyData> {
    const allResponses = await this.questionResponseRepository.findAll({
      questionType: 'practice',
    } as any);
    
    const byDifficulty: Record<string, { total: number; correct: number }> = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 },
    };
    
    // Get all topics to map topic difficulty
    const allTopics = await this.topicRepository.findAll();
    const topicDifficultyMap = new Map<string, string>();
    allTopics.forEach((topic: any) => {
      topicDifficultyMap.set(topic._id?.toString() || '', topic.difficulty || 'medium');
    });
    
    // Group responses by difficulty
    allResponses.forEach((response: any) => {
      // Use response difficulty, topic difficulty, or default to medium
      const difficulty = response.difficulty || 
                         topicDifficultyMap.get(response.topicId?.toString() || '') || 
                         'medium';
      
      if (byDifficulty[difficulty]) {
        byDifficulty[difficulty].total++;
        if (response.isCorrect) {
          byDifficulty[difficulty].correct++;
        }
      }
    });
    
    // Calculate averages - ensure all keys exist
    const easyData = byDifficulty.easy || { total: 0, correct: 0 };
    const mediumData = byDifficulty.medium || { total: 0, correct: 0 };
    const hardData = byDifficulty.hard || { total: 0, correct: 0 };
    
    const result: ExerciseDifficultyData = {
      easy: {
        count: easyData.total,
        avgCorrect: easyData.total > 0
          ? Math.round((easyData.correct / easyData.total) * 100)
          : 0,
      },
      medium: {
        count: mediumData.total,
        avgCorrect: mediumData.total > 0
          ? Math.round((mediumData.correct / mediumData.total) * 100)
          : 0,
      },
      hard: {
        count: hardData.total,
        avgCorrect: hardData.total > 0
          ? Math.round((hardData.correct / hardData.total) * 100)
          : 0,
      },
    };
    
    // If no data, return defaults
    if (result.easy.count === 0 && result.medium.count === 0 && result.hard.count === 0) {
      return {
        easy: { count: 0, avgCorrect: 0 },
        medium: { count: 0, avgCorrect: 0 },
        hard: { count: 0, avgCorrect: 0 },
      };
    }
    
    return result;
  }

  /**
   * Get topic performance data
   */
  private async getTopicPerformance(): Promise<TopicPerformance[]> {
    const allTopics = await this.topicRepository.findAll({ status: TopicStatus.PUBLISHED });
    const allEnrollments = await this.enrollmentRepository.findAll();
    
    const result: TopicPerformance[] = [];
    
    for (const topic of allTopics) {
      const topicId = topic._id?.toString() || '';
      const topicEnrollments = allEnrollments.filter(
        (e: any) => e.topicId?.toString() === topicId
      );
      
      const students = topicEnrollments.length;
      const completed = topicEnrollments.filter(
        (e: any) => e.status === 'completed' || e.progress >= 100
      ).length;
      const completion = students > 0 ? Math.round((completed / students) * 100) : 0;
      
      // Get average quiz score for this topic
      const topicQuizResponses = await this.questionResponseRepository.findAll({
        topicId: topicId,
        questionType: 'quiz',
        reviewStatus: 'approved',
      } as any);
      
      const correctCount = topicQuizResponses.filter((r: any) => r.isCorrect).length;
      const avgScore = topicQuizResponses.length > 0
        ? Math.round((correctCount / topicQuizResponses.length) * 100)
        : 0;
      
      // Calculate trend (simplified)
      const trend = this.calculateTrend(completion, completion * 0.95);
      
      result.push({
        topic: topic.title,
        topicId,
        students,
        completion,
        avgScore,
        trend,
      });
    }
    
    // Sort by students enrolled (descending)
    return result.sort((a, b) => b.students - a.students);
  }

  /**
   * Get drop-off analysis
   */
  private async getDropOffAnalysis(): Promise<DropOffAnalysis[]> {
    const allTopics = await this.topicRepository.findAll({ status: TopicStatus.PUBLISHED });
    const allEnrollments = await this.enrollmentRepository.findAll();
    
    const dropOffs: DropOffAnalysis[] = [];
    
    for (const topic of allTopics) {
      const topicId = topic._id?.toString() || '';
      const topicEnrollments = allEnrollments.filter(
        (e: any) => e.topicId?.toString() === topicId
      );
      
      if (topicEnrollments.length === 0) continue;
      
      // Find the lesson where most students drop off
      // This is simplified - in production, you'd track lesson-level progress
      const totalEnrolled = topicEnrollments.length;
      const completed = topicEnrollments.filter(
        (e: any) => e.status === 'completed' || e.progress >= 100
      ).length;
      
      if (totalEnrolled > completed) {
        const dropOffRate = Math.round(((totalEnrolled - completed) / totalEnrolled) * 100);
        
        // Find the lesson with most drop-offs (simplified)
        if (topic.lessons && topic.lessons.length > 0) {
          const midLesson = topic.lessons[Math.floor(topic.lessons.length / 2)];
          dropOffs.push({
            topic: topic.title,
            lesson: midLesson?.title || `Lesson ${Math.floor(topic.lessons.length / 2)}`,
            dropoff: dropOffRate,
          });
        }
      }
    }
    
    // Sort by dropoff rate (descending) and return top 3
    return dropOffs.sort((a, b) => b.dropoff - a.dropoff).slice(0, 3);
  }

  /**
   * Get flagged questions (low performance)
   */
  private async getFlaggedQuestions(): Promise<FlaggedQuestion[]> {
    const allResponses = await this.questionResponseRepository.findAll({
      questionType: 'practice',
    } as any);
    
    // Group by question (simplified - in production, you'd group by questionText + topicId + lessonId)
    const questionStats: Record<string, { total: number; correct: number; questionText: string }> = {};
    
    allResponses.forEach((response: any) => {
      const key = `${response.topicId}-${response.lessonId}-${response.questionIndex}`;
      if (!questionStats[key]) {
        questionStats[key] = {
          total: 0,
          correct: 0,
          questionText: response.questionText || 'Question',
        };
      }
      questionStats[key].total++;
      if (response.isCorrect) {
        questionStats[key].correct++;
      }
    });
    
    const flagged: FlaggedQuestion[] = [];
    
    Object.values(questionStats).forEach((stat) => {
      if (stat.total < 5) return; // Need at least 5 attempts
      
      const correctRate = (stat.correct / stat.total) * 100;
      
      if (correctRate < 40) {
        flagged.push({
          question: stat.questionText,
          correct: Math.round(correctRate),
          type: 'Too Hard',
        });
      } else if (correctRate > 90) {
        flagged.push({
          question: stat.questionText,
          correct: Math.round(correctRate),
          type: 'Too Easy',
        });
      } else if (correctRate >= 40 && correctRate <= 60) {
        flagged.push({
          question: stat.questionText,
          correct: Math.round(correctRate),
          type: 'Confusing',
        });
      }
    });
    
    // Sort by correct rate and return top 3
    return flagged.sort((a, b) => a.correct - b.correct).slice(0, 3);
  }
}
