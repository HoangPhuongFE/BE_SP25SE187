import { Request, Response } from 'express';
import { ProgressReportService } from '../services/progress-report.service';
import { MESSAGES } from '../constants/message';

export class ProgressReportController {
  private progressReportService: ProgressReportService;

  constructor() {
    this.progressReportService = new ProgressReportService();
  }

  // Tạo báo cáo tiến độ mới
  async createProgressReport(req: Request, res: Response) {
    try {
      const { weekNumber, content, completionPercentage, groupId } = req.body;
      
      // Kiểm tra user từ request
      if (!req.user) {
        console.log("req.user không tồn tại:", req.user);
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      // Lấy userId từ req.user
      const userId = req.user.userId;
      
      if (!userId) {
        console.log("userId không tồn tại trong req.user:", req.user);
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      console.log(`API createProgressReport được gọi bởi userId: ${userId}`);
      console.log(`Dữ liệu: tuần ${weekNumber}, % hoàn thành: ${completionPercentage}, groupId: ${groupId || 'không có'}`);
      
      const progressReport = await this.progressReportService.createProgressReport({
        userId,
        weekNumber,
        content,
        completionPercentage,
        submittedAt: new Date(),
        groupId,
      });

      return res.status(201).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_CREATED,
        data: progressReport,
      });
    } catch (error: any) {
      console.error("Error creating progress report:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Thêm feedback của mentor vào báo cáo
  async addMentorFeedback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { mentorFeedback } = req.body;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      const mentorId = req.user.userId;

      if (!mentorId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      console.log(`API addMentorFeedback được gọi bởi mentorId: ${mentorId} cho báo cáo: ${id}`);
      
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
      console.error("Error adding mentor feedback:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Cập nhật báo cáo tiến độ
  async updateProgressReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { content, completionPercentage } = req.body;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      const userId = req.user.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      console.log(`API updateProgressReport được gọi bởi userId: ${userId} cho báo cáo: ${id}`);
      console.log(`Dữ liệu cập nhật: % hoàn thành: ${completionPercentage}`);
      
      const updatedReport = await this.progressReportService.updateProgressReport(id, userId, {
        content,
        completionPercentage,
      });

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_UPDATED,
        data: updatedReport,
      });
    } catch (error: any) {
      console.error("Error updating progress report:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Xóa báo cáo tiến độ
  async deleteProgressReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
  
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
  
      const userId = req.user.userId;
      const ipAddress = req.ip; // Lấy địa chỉ IP từ request
  
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
  
      console.log(`API deleteProgressReport được gọi bởi userId: ${userId} cho báo cáo: ${id}`);
  
      const result = await this.progressReportService.deleteProgressReport(id, userId, ipAddress);
  
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error: any) {
      console.error('Error marking progress report as deleted:', error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  // Lấy danh sách báo cáo tiến độ theo nhóm
  async getProgressReportsByGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      console.log(`API getProgressReportsByGroup được gọi cho nhóm: ${groupId}`);
      
      const reports = await this.progressReportService.getProgressReportsByGroup(groupId);

      // Định dạng lại dữ liệu để hiển thị phản hồi của tất cả mentor
      const formattedReports = reports.map(report => {
        const mentorFeedbacks = report.mentors.map(mr => ({
          mentorId: mr.mentor.id,
          mentorName: mr.mentor.fullName,
          mentorEmail: mr.mentor.email,
          feedback: mr.feedback,
          isRead: mr.isRead,
          readAt: mr.readAt
        })).filter(mf => mf.feedback); // Chỉ lấy những mentor có feedback
        
        return {
          ...report,
          mentorFeedbacks,
        };
      });

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORTS_FETCHED,
        data: formattedReports,
      });
    } catch (error: any) {
      console.error("Error fetching group progress reports:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Lấy danh sách báo cáo tiến độ của các nhóm mà mentor hướng dẫn
  async getProgressReportsByMentor(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      const mentorId = req.user.userId;

      if (!mentorId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      console.log(`API getProgressReportsByMentor được gọi bởi mentorId: ${mentorId}`);
      
      const reports = await this.progressReportService.getProgressReportsByMentor(mentorId);

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORTS_FETCHED,
        data: reports,
      });
    } catch (error: any) {
      console.error("Error fetching mentor progress reports:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Lấy chi tiết báo cáo tiến độ theo ID
  async getProgressReportById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`API getProgressReportById được gọi cho báo cáo: ${id}`);
      
      const report = await this.progressReportService.getProgressReportById(id);

      // Định dạng lại dữ liệu để hiển thị phản hồi của tất cả mentor
      const mentorFeedbacks = report.mentors.map(mr => ({
        mentorId: mr.mentor.id,
        mentorName: mr.mentor.fullName,
        mentorEmail: mr.mentor.email,
        feedback: mr.feedback,
        isRead: mr.isRead,
        readAt: mr.readAt,
        roleId: mr.mentor.roleInGroup === "mentor-main" ? "Mentor-main" : "Mentor-sub"
      })).filter(mf => mf.feedback); // Chỉ lấy những mentor có feedback
      
      // Chỉ lấy groupCode và groupId từ group
      const formattedReport = {
        ...report,
        group: report.group ? {
          id: report.groupId,
          groupCode: report.group.groupCode
        } : null,
        mentorFeedbacks,
      };

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_FETCHED,
        data: formattedReport,
      });
    } catch (error: any) {
      console.error("Error fetching progress report by ID:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Lấy báo cáo tiến độ theo tuần và nhóm
  async getProgressReportByWeek(req: Request, res: Response) {
    try {
      const { groupId, weekNumber } = req.params;
      console.log(`API getProgressReportByWeek được gọi cho nhóm: ${groupId}, tuần: ${weekNumber}`);
      
      const report = await this.progressReportService.getProgressReportByWeek(
        groupId,
        parseInt(weekNumber)
      );

      // Định dạng lại dữ liệu để hiển thị phản hồi của tất cả mentor
      const mentorFeedbacks = report.mentors.map(mr => ({
        mentorId: mr.mentor.id,
        mentorName: mr.mentor.fullName,
        mentorEmail: mr.mentor.email,
        feedback: mr.feedback,
        isRead: mr.isRead,
        readAt: mr.readAt
      })).filter(mf => mf.feedback); // Chỉ lấy những mentor có feedback
      
      const formattedReport = {
        ...report,
        mentorFeedbacks,
      };

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORT_FETCHED,
        data: formattedReport,
      });
    } catch (error: any) {
      console.error("Error fetching progress report by week:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Đánh dấu báo cáo đã đọc
  async markReportAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      const mentorId = req.user.userId;

      if (!mentorId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      console.log(`API markReportAsRead được gọi bởi mentorId: ${mentorId} cho báo cáo: ${id}`);
      
      await this.progressReportService.markReportAsRead(id, mentorId);

      return res.status(200).json({
        success: true,
        message: "Đã đánh dấu báo cáo là đã đọc",
      });
    } catch (error: any) {
      console.error("Error marking report as read:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  // Lấy danh sách báo cáo tiến độ của sinh viên hiện tại
  async getMyProgressReports(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      const userId = req.user.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      console.log(`API getMyProgressReports được gọi bởi userId: ${userId}`);
      
      const reports = await this.progressReportService.getMyProgressReports(userId);

      // Định dạng lại dữ liệu để hiển thị phản hồi của tất cả mentor
      const formattedReports = reports.map(report => {
        const mentorFeedbacks = report.mentors.map(mr => ({
          mentorId: mr.mentor.id,
          mentorName: mr.mentor.fullName,
          mentorEmail: mr.mentor.email,
          feedback: mr.feedback,
          isRead: mr.isRead,
          readAt: mr.readAt
        })).filter(mf => mf.feedback); // Chỉ lấy những mentor có feedback
        
        return {
          ...report,
          mentorFeedbacks,
        };
      });

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.REPORTS_FETCHED,
        data: formattedReports,
      });
    } catch (error: any) {
      console.error("Error fetching student progress reports:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Tạo khoảng thời gian báo cáo tiến độ cho nhóm
  async createReportPeriod(req: Request, res: Response) {
    try {
      const { groupId, weekNumber, startDate, endDate } = req.body;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      const userId = req.user.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      console.log(`API createReportPeriod được gọi bởi mentorId: ${userId} cho nhóm: ${groupId}`);
      console.log(`Dữ liệu: tuần ${weekNumber}, bắt đầu: ${startDate}, kết thúc: ${endDate}`);
      
      const reportPeriod = await this.progressReportService.createReportPeriod({
        groupId,
        userId,
        weekNumber,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      return res.status(201).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.PERIOD_CREATED,
        data: reportPeriod,
      });
    } catch (error: any) {
      console.error("Error creating report period:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Lấy danh sách khoảng thời gian báo cáo tiến độ của nhóm
  async getReportPeriods(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      console.log(`API getReportPeriods được gọi cho nhóm: ${groupId}`);
      
      const periods = await this.progressReportService.getReportPeriods(groupId);

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.PERIODS_FETCHED,
        data: periods,
      });
    } catch (error: any) {
      console.error("Error fetching report periods:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Cập nhật feedback của mentor
  async updateMentorFeedback(req: Request, res: Response) {
    try {
      const { groupId, groupCode, weekNumber, feedback } = req.body;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }
      
      const mentorId = req.user.userId;

      if (!mentorId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      console.log(`API updateMentorFeedback được gọi bởi mentorId: ${mentorId}`);
      console.log(`Dữ liệu: nhóm ${groupId || groupCode}, tuần ${weekNumber}`);
      
      const updatedReport = await this.progressReportService.updateMentorFeedback({
        mentorId,
        groupId,
        groupCode,
        weekNumber,
        feedback,
      });

      return res.status(200).json({
        success: true,
        message: MESSAGES.PROGRESS_REPORT.FEEDBACK_UPDATED,
        data: updatedReport,
      });
    } catch (error: any) {
      console.error("Error updating mentor feedback:", error);
      return res.status(400).json({
        success: false,
        message: error.message || MESSAGES.GENERAL.ACTION_FAILED,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}