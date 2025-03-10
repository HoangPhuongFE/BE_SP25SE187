import { PrismaClient } from '@prisma/client';
import { MESSAGES } from '../constants/message';

const prisma = new PrismaClient();

export class ProgressReportService {
  // Tạo báo cáo tiến độ mới
  async createProgressReport(data: {
    userId: string;
    weekNumber: number;
    content: string;
    completionPercentage: number;
    submittedAt: Date;
  }) {
    try {
      // Lấy thông tin nhóm của người dùng
      const groupMember = await prisma.groupMember.findFirst({
        where: { 
          userId: data.userId,
          isActive: true 
        },
        include: { group: true },
      });

      if (!groupMember) {
        throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
      }

      const groupId = groupMember.groupId;

      // Lấy danh sách mentor của nhóm
      const mentors = await prisma.groupMentor.findMany({
        where: { groupId },
        select: { mentorId: true },
      });

      if (mentors.length === 0) {
        throw new Error(MESSAGES.PROGRESS_REPORT.MENTOR_NOT_FOUND);
      }

      // Kiểm tra xem báo cáo của tuần này đã tồn tại chưa
      const existingReport = await prisma.progressReport.findFirst({
        where: {
          groupId,
          weekNumber: data.weekNumber,
        },
      });

      if (existingReport) {
        throw new Error(MESSAGES.PROGRESS_REPORT.WEEK_REPORT_EXISTS);
      }

      // Tìm mentor chính của nhóm
      const mainMentor = await prisma.groupMentor.findFirst({
        where: { 
          groupId,
          role: {
            name: "mentor_main"
          }
        },
        select: { mentorId: true },
      });

      const mentorId = mainMentor ? mainMentor.mentorId : mentors[0].mentorId;

      // Tạo báo cáo mới
      const report = await prisma.progressReport.create({
        data: {
          groupId,
          mentorId, // Lưu mentor chính hoặc mentor đầu tiên vào trường mentorId
          weekNumber: data.weekNumber,
          content: data.content,
          completionPercentage: data.completionPercentage,
          status: "SUBMITTED",
          submittedAt: data.submittedAt,
        },
      });

      // Tạo liên kết với tất cả mentor trong bảng ProgressReportMentor
      for (const mentor of mentors) {
        await prisma.progressReportMentor.create({
          data: {
            reportId: report.id,
            mentorId: mentor.mentorId,
            isRead: false,
          },
        });
      }

      return report;
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Thêm phản hồi của mentor
  async addMentorFeedback(reportId: string, mentorId: string, mentorFeedback: string) {
    try {
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      // Kiểm tra xem mentor có quyền thêm phản hồi không
      const mentorReport = await prisma.progressReportMentor.findUnique({
        where: {
          reportId_mentorId: {
            reportId,
            mentorId,
          },
        },
      });

      if (!mentorReport) {
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }

      // Cập nhật trạng thái đã đọc cho mentor này
      await prisma.progressReportMentor.update({
        where: {
          reportId_mentorId: {
            reportId,
            mentorId,
          },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      // Cập nhật phản hồi vào báo cáo
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
    userId: string,
    data: {
      content?: string;
      completionPercentage?: number;
    }
  ) {
    try {
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
        include: { group: true },
      });

      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      // Kiểm tra xem người dùng có thuộc nhóm không
      const isMember = await prisma.groupMember.findFirst({
        where: {
          groupId: report.groupId,
          userId,
          isActive: true
        },
      });

      if (!isMember) {
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
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
  async deleteProgressReport(reportId: string, userId: string) {
    try {
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
        include: { group: true },
      });

      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      // Kiểm tra quyền xóa (chỉ trưởng nhóm hoặc mentor chính)
      const isGroupLeader = await prisma.groupMember.findFirst({
        where: {
          groupId: report.groupId,
          userId,
          role: {
            name: "group_leader",
          },
          isActive: true
        },
      });

      const isMentorMain = await prisma.groupMentor.findFirst({
        where: {
          groupId: report.groupId,
          mentorId: userId,
          role: {
            name: "mentor_main",
          },
        },
      });

      if (!isGroupLeader && !isMentorMain) {
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }

      // Xóa tất cả các liên kết với mentor
      await prisma.progressReportMentor.deleteMany({
        where: { reportId },
      });

      // Xóa báo cáo
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
        include: {
          mentors: {
            include: {
              mentor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          group: {
            select: {
              groupCode: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy báo cáo tiến độ của mentor
  async getProgressReportsByMentor(mentorId: string) {
    try {
      // Lấy tất cả báo cáo mà mentor được gán
      const mentorReports = await prisma.progressReportMentor.findMany({
        where: { mentorId },
        include: {
          progressReport: {
            include: {
              group: {
                select: {
                  id: true,
                  groupCode: true,
                  members: {
                    where: {
                      isActive: true,
                    },
                    select: {
                      user: {
                        select: {
                          fullName: true,
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
          },
        },
        orderBy: [
          { progressReport: { groupId: 'asc' } },
          { progressReport: { weekNumber: 'desc' } },
        ],
      });

      // Chuyển đổi kết quả để trả về danh sách báo cáo với thông tin đã đọc
      return mentorReports.map(mr => ({
        ...mr.progressReport,
        isRead: mr.isRead,
        readAt: mr.readAt,
      }));
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
                where: {
                  isActive: true,
                },
                select: {
                  user: {
                    select: {
                      id: true,
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
          mentors: {
            include: {
              mentor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
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
              members: {
                where: {
                  isActive: true,
                },
                select: {
                  user: {
                    select: {
                      fullName: true,
                    },
                  },
                  student: {
                    select: {
                      studentCode: true,
                    },
                  },
                },
              },
            },
          },
          mentors: {
            include: {
              mentor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
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

  // Đánh dấu báo cáo đã đọc
  async markReportAsRead(reportId: string, mentorId: string) {
    try {
      const mentorReport = await prisma.progressReportMentor.findUnique({
        where: {
          reportId_mentorId: {
            reportId,
            mentorId,
          },
        },
      });

      if (!mentorReport) {
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }

      return await prisma.progressReportMentor.update({
        where: {
          reportId_mentorId: {
            reportId,
            mentorId,
          },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } catch (error: any) {
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }
}