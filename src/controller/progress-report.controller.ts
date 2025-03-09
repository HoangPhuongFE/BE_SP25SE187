import { Request, Response } from 'express';
import { ProgressReportService } from '../service/progress-report.service';
import { MESSAGES } from '../constants/message';

export class ProgressReportController {
  private progressReportService: ProgressReportService;

  constructor() {
    this.progressReportService = new ProgressReportService();
  }

  // Tạo báo cáo tiến độ mới
  async createProgressReport(req: Request, res: Response) {
    try {
      const { weekNumber, content, completionPercentage } = req.body;
      const studentId = req.user?.id; // Lấy studentId từ token hoặc session
      
      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      const progressReport = await this.progressReportService.createProgressReport({
        studentId,
        weekNumber,
        content,
        completionPercentage,
        submittedAt: new Date(),
      });

      return res.status(201).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_CREATED,
        data: progressReport,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
      });
    }
  }

  // Thêm feedback của mentor vào báo cáo
  async addMentorFeedback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { mentorFeedback } = req.body;
      const mentorId = req.user?.id;

      if (!mentorId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      if (!mentorFeedback) {
        return res.status(400).json({
          success: false,
          message: MESSAGES.PROGRESS_REPORT.INVALID_REQUEST,
        });
      }

      const updatedReport = await this.progressReportService.addMentorFeedback(id, mentorId, mentorFeedback);

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.FEEDBACK_ADDED,
        data: updatedReport,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
      });
    }
  }

  // Cập nhật báo cáo tiến độ
  async updateProgressReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { content, completionPercentage } = req.body;
      const studentId = req.user?.id;

      if (!studentId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      const updatedReport = await this.progressReportService.updateProgressReport(id, studentId, {
        content,
        completionPercentage,
      });

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_UPDATED,
        data: updatedReport,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
      });
    }
  }

  // Xóa báo cáo tiến độ
  async deleteProgressReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      await this.progressReportService.deleteProgressReport(id, userId);

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_DELETED,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
      });
    }
  }

  // Lấy danh sách báo cáo tiến độ theo nhóm
  async getProgressReportsByGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;

      const reports = await this.progressReportService.getProgressReportsByGroup(groupId);

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORTS_FETCHED,
        data: reports,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
      });
    }
  }

  // Lấy danh sách báo cáo tiến độ của các nhóm mà mentor hướng dẫn
  async getProgressReportsByMentor(req: Request, res: Response) {
    try {
      const mentorId = req.user?.id;

      if (!mentorId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      const reports = await this.progressReportService.getProgressReportsByMentor(mentorId);

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORTS_FETCHED,
        data: reports,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
      });
    }
  }

  // Lấy chi tiết báo cáo tiến độ theo ID
  async getProgressReportById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const report = await this.progressReportService.getProgressReportById(id);

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_FETCHED,
        data: report,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
      });
    }
  }

  // Lấy báo cáo tiến độ theo tuần và nhóm
  async getProgressReportByWeek(req: Request, res: Response) {
    try {
      const { groupId, weekNumber } = req.params;

      const report = await this.progressReportService.getProgressReportByWeek(
        groupId,
        parseInt(weekNumber)
      );

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_FETCHED,
        data: report,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
      });
    }
  }
}