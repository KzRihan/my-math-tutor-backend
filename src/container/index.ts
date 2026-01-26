/**
 * Dependency Injection Container
 * 
 * Configures TSyringe container with all dependencies.
 * Provides centralized registration of services and repositories.
 */

import 'reflect-metadata';
import { container, Lifecycle, InjectionToken } from 'tsyringe';

// Repositories
import { UserRepository } from '@repositories/user.repository';
import { TopicRepository } from '@repositories/topic.repository';
import { EnrollmentRepository } from '@repositories/enrollment.repository';
import { AchievementRepository } from '@repositories/achievement.repository';
import { QuestionResponseRepository } from '@repositories/question-response.repository';
import { LoginActivityRepository } from '@repositories/login-activity.repository';
import { ActivityLogRepository } from '@repositories/activity-log.repository';

// Services
import { UserService } from '@services/user.service';
import { EmailService } from '@services/email.service';
import { AuthService } from '@services/auth.service';
import { SocialAuthService } from '@services/social-auth.service';
import { TopicService } from '@services/topic.service';
import { EnrollmentService } from '@services/enrollment.service';
import { AchievementService } from '@services/achievement.service';
import { XPCalculationService } from '@services/xp-calculation.service';
import { QuizReviewService } from '@services/quiz-review.service';
import { AdminDashboardService } from '@services/admin-dashboard.service';
import { AdminStudentService } from '@services/admin-student.service';
import { AdminAnalyticsService } from '@services/admin-analytics.service';
import { SettingsService } from '@services/settings.service';
import { LoginActivityService } from '@services/login-activity.service';
import { ActivityLoggerService } from '@services/activity-logger.service';

// Controllers
import { UserController } from '@controllers/user.controller';
import { AuthController } from '@controllers/auth.controller';
import { TopicController } from '@controllers/topic.controller';
import { EnrollmentController } from '@controllers/enrollment.controller';
import { AchievementController } from '@controllers/achievement.controller';
import { QuestionResponseController } from '@controllers/question-response.controller';
import { QuizReviewController } from '@controllers/quiz-review.controller';
import { AdminDashboardController } from '@controllers/admin-dashboard.controller';
import { AdminStudentController } from '@controllers/admin-student.controller';
import { SettingsController } from '@controllers/settings.controller';

/**
 * Configure dependency injection container
 */
export function configureContainer(): void {
  // ============================================================
  // Repositories (Singleton - one instance per app lifecycle)
  // ============================================================
  
  container.register(UserRepository, {
    useClass: UserRepository,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(TopicRepository, {
    useClass: TopicRepository,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(EnrollmentRepository, {
    useClass: EnrollmentRepository,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(AchievementRepository, {
    useClass: AchievementRepository,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(QuestionResponseRepository, {
    useClass: QuestionResponseRepository,
  }, {
    lifecycle: Lifecycle.Singleton,
  });


  container.register(LoginActivityRepository, {
    useClass: LoginActivityRepository,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(ActivityLogRepository, {
    useClass: ActivityLogRepository,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  // ============================================================
  // Services (Singleton)
  // ============================================================
  
  container.register(EmailService, {
    useClass: EmailService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(UserService, {
    useClass: UserService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(AuthService, {
    useClass: AuthService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(SocialAuthService, {
    useClass: SocialAuthService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(TopicService, {
    useClass: TopicService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(EnrollmentService, {
    useClass: EnrollmentService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(AchievementService, {
    useClass: AchievementService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(XPCalculationService, {
    useClass: XPCalculationService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(QuizReviewService, {
    useClass: QuizReviewService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });


  container.register(AdminDashboardService, {
    useClass: AdminDashboardService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(AdminStudentService, {
    useClass: AdminStudentService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(AdminAnalyticsService, {
    useClass: AdminAnalyticsService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(SettingsService, {
    useClass: SettingsService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(LoginActivityService, {
    useClass: LoginActivityService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(ActivityLoggerService, {
    useClass: ActivityLoggerService,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  // ============================================================
  // Controllers (Transient - new instance per request)
  // ============================================================
  
  container.register(UserController, {
    useClass: UserController,
  }, {
    lifecycle: Lifecycle.Singleton, // Can be Transient for request-scoped
  });

  container.register(AuthController, {
    useClass: AuthController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(TopicController, {
    useClass: TopicController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(EnrollmentController, {
    useClass: EnrollmentController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(AchievementController, {
    useClass: AchievementController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(QuestionResponseController, {
    useClass: QuestionResponseController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(QuizReviewController, {
    useClass: QuizReviewController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(AdminDashboardController, {
    useClass: AdminDashboardController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  container.register(AdminStudentController, {
    useClass: AdminStudentController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  // Settings Controller
  container.register(SettingsController, {
    useClass: SettingsController,
  }, {
    lifecycle: Lifecycle.Singleton,
  });

  // ============================================================
  // Custom factories (example for complex dependencies)
  // ============================================================
  
  // container.register('DatabaseConnection', {
  //   useFactory: (c) => {
  //     return mongoose.connection;
  //   },
  // });

  // container.register('RedisClient', {
  //   useFactory: (c) => {
  //     return getRedisClient();
  //   },
  // });
}

/**
 * Get container instance
 */
export function getContainer(): typeof container {
  return container;
}

/**
 * Resolve a dependency from container
 */
export function resolve<T>(token: InjectionToken<T>): T {
  return container.resolve(token);
}

export default configureContainer;
