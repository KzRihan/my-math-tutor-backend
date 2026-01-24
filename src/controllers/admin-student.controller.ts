/**
 * Admin Student Controller
 * 
 * Handles HTTP requests for admin student operations.
 */

import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { AdminStudentService } from '@services/admin-student.service';
import { sendSuccess } from '@utils/response';
import { asyncHandler } from '@utils/async-handler';
import { createChildLogger } from '@utils/logger';

const controllerLogger = createChildLogger('admin-student-controller');

export class AdminStudentController {
  /**
   * Get student list with filters
   * GET /admin/students
   */
  getStudentList = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const studentService = container.resolve(AdminStudentService);
    
    const query = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      search: req.query.search as string | undefined,
      gradeBand: req.query.gradeBand as string | undefined,
      status: req.query.status as string | undefined,
    };

    controllerLogger.debug('Getting student list', { query });
    
    const result = await studentService.getStudentList(query);

    sendSuccess(res, result, 'Students retrieved successfully');
  });

  /**
   * Get student detail
   * GET /admin/students/:id
   */
  getStudentDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const studentService = container.resolve(AdminStudentService);
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Student ID is required',
        },
      });
      return;
    }

    controllerLogger.debug('Getting student detail', { userId: id });

    const student = await studentService.getStudentDetail(id);

    if (!student) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Student not found',
        },
      });
      return;
    }

    sendSuccess(res, student, 'Student detail retrieved successfully');
  });

  /**
   * Send email to student
   * POST /admin/students/:id/send-email
   */
  sendEmailToStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const studentService = container.resolve(AdminStudentService);
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const { subject, message } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Student ID is required',
        },
      });
      return;
    }

    if (!subject || !message) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Subject and message are required',
        },
      });
      return;
    }

    controllerLogger.debug('Sending email to student', { userId: id });

    await studentService.sendEmailToStudent(id, subject, message);

    sendSuccess(res, { sent: true }, 'Email sent successfully');
  });

  /**
   * Unlock topic for student
   * POST /admin/students/:id/unlock-topic
   */
  unlockTopicForStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const studentService = container.resolve(AdminStudentService);
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const { topicId } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Student ID is required',
        },
      });
      return;
    }

    if (!topicId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Topic ID is required',
        },
      });
      return;
    }

    controllerLogger.debug('Unlocking topic for student', { userId: id, topicId });

    await studentService.unlockTopicForStudent(id, topicId);

    sendSuccess(res, { unlocked: true }, 'Topic unlocked successfully');
  });

  /**
   * Reset all quizzes for student
   * POST /admin/students/:id/reset-quizzes
   */
  resetAllQuizzesForStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const studentService = container.resolve(AdminStudentService);
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Student ID is required',
        },
      });
      return;
    }

    controllerLogger.debug('Resetting quizzes for student', { userId: id });

    const deletedCount = await studentService.resetAllQuizzesForStudent(id);

    sendSuccess(res, { deletedCount }, `Successfully reset ${deletedCount} quiz responses`);
  });

  /**
   * Suspend student account
   * POST /admin/students/:id/suspend
   */
  suspendStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const studentService = container.resolve(AdminStudentService);
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Student ID is required',
        },
      });
      return;
    }

    controllerLogger.debug('Suspending student', { userId: id });

    await studentService.suspendStudent(id);

    sendSuccess(res, { suspended: true }, 'Student account suspended successfully');
  });

  /**
   * Activate student account
   * POST /admin/students/:id/activate
   */
  activateStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const studentService = container.resolve(AdminStudentService);
    const idParam = req.params['id'];
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Student ID is required',
        },
      });
      return;
    }

    controllerLogger.debug('Activating student', { userId: id });

    await studentService.activateStudent(id);

    sendSuccess(res, { activated: true }, 'Student account activated successfully');
  });
}
