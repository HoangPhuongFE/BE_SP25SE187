import { PrismaClient } from '@prisma/client';
import { MESSAGES } from '../constants/message';

const prisma = new PrismaClient();

export class ProgressReportService {
  // Tạo báo cáo tiến độ mới
  async createProgressReport(data: {
    groupId: string;
    mentorId: string;
    weekNumber: number;
    content: string;
    completionPercentage: number;
    submittedAt: Date;
  }) {
    try {
      // Kiểm tra nhóm tồn tại
      const group = await prisma.group.findUnique({
        where: { id: data.groupId },
      });
      
      if (!group) {
        throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
      }

      // Kiểm tra xem báo cáo của tuần này đã tồn tại chưa
      const existingReport = await prisma.progressReport.findFirst({
        where: {
          groupId: data.groupId,
          weekNumber: data.weekNumber,
        },
      });

      if (existingReport) {
        throw new Error(MESSAGES.PROGRESS_REPORT.WEEK_REPORT_EXISTS);
      }

      // Tạo báo cáo mới
      return await prisma.progressReport.create({
        data: {
          groupId: data.groupId,
          mentorId: data.mentorId,
          weekNumber: data.weekNumber,
          content: data.content,
          completionPercentage: data.completionPercentage,
          status: "SUBMITTED", // Trạng thái ban đầu
          submittedAt: data.submittedAt,
        },
      });
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Thêm phản hồi của mentor
  async addMentorFeedback(reportId: string, mentorFeedback: string) {
    try {
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      return await prisma.progressReport.update({
        where: { id: reportId },
        data: {
          mentorFeedback,
          status: "REVIEWED",
          reviewedAt: new Date(),
        },
      });
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Cập nhật báo cáo tiến độ
  async updateProgressReport(
    reportId: string,
    data: {
      content?: string;
      completionPercentage?: number;
    }
  ) {
    try {
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      // Kiểm tra nếu báo cáo đã được đánh giá thì không cho cập nhật
      if (report.status === "REVIEWED") {
        throw new Error(MESSAGES.PROGRESS_REPORT.CANNOT_UPDATE_REVIEWED);
      }

      return await prisma.progressReport.update({
        where: { id: reportId },
        data,
      });
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Xóa báo cáo tiến độ
  async deleteProgressReport(reportId: string) {
    try {
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      return await prisma.progressReport.delete({
        where: { id: reportId },
      });
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy danh sách báo cáo theo nhóm
  async getProgressReportsByGroup(groupId: string) {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
      }

      return await prisma.progressReport.findMany({
        where: { groupId },
        orderBy: { weekNumber: 'desc' },
      });
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy báo cáo tiến độ của mentor
  async getProgressReportsByMentor(mentorId: string) {
    try {
      // Lấy tất cả các nhóm mà mentor là người hướng dẫn
      const mentorGroups = await prisma.groupMentor.findMany({
        where: { mentorId },
        select: { groupId: true },
      });

      if (mentorGroups.length === 0) {
        return [];
      }

      const groupIds = mentorGroups.map(mg => mg.groupId);

      // Lấy tất cả báo cáo từ các nhóm đó
      return await prisma.progressReport.findMany({
        where: {
          groupId: { in: groupIds },
        },
        include: {
          group: {
            select: {
              groupCode: true,
            },
          },
        },
        orderBy: [
          { groupId: 'asc' },
          { weekNumber: 'desc' },
        ],
      });
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy chi tiết báo cáo tiến độ theo ID
  async getProgressReportById(reportId: string) {
    try {
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
        include: {
          group: {
            select: {
              groupCode: true,
              members: {
                select: {
                  user: {
                    select: {
                      fullName: true,
                      email: true,
                    },
                  },
                  student: {
                    select: {
                      studentCode: true,
                    },
                  },
                  role: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      return report;
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy báo cáo tiến độ theo tuần và nhóm
  async getProgressReportByWeek(groupId: string, weekNumber: number) {
    try {
      const report = await prisma.progressReport.findFirst({
        where: {
          groupId,
          weekNumber,
        },
        include: {
          group: {
            select: {
              groupCode: true,
            },
          },
        },
      });

      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      return report;
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }
} 