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
    groupId?: string; // Tham số groupId tùy chọn
  }) {
    try {
      console.log(`Bắt đầu tạo báo cáo tiến độ cho userId: ${data.userId}, tuần: ${data.weekNumber}`);
      
      let groupId = data.groupId;
      
      // Nếu không có groupId, tìm nhóm của người dùng
      if (!groupId) {
        // Tìm student từ userId
        const student = await prisma.student.findFirst({
          where: { userId: data.userId }
        });
        
        if (!student) {
          console.log(`Không tìm thấy student với userId: ${data.userId}`);
          throw new Error(MESSAGES.STUDENT.STUDENT_NOT_FOUND);
        }
        
        console.log(`Tìm thấy student với id: ${student.id}, studentCode: ${student.studentCode}`);
        
        // Tìm thành viên nhóm dựa trên studentId
        const groupMember = await prisma.groupMember.findFirst({
          where: { 
            studentId: student.id,
            isActive: true 
          },
          include: { 
            group: true,
            role: true
          },
        });
        
        if (!groupMember) {
          console.log(`Không tìm thấy nhóm cho student: ${student.id}`);
          throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
        }
        
        groupId = groupMember.groupId;
        console.log(`Tìm thấy nhóm qua studentId: ${groupId}, vai trò: ${groupMember.role.name}`);
      }
      
      console.log(`Đã tìm thấy nhóm: ${groupId}`);

      // Lấy danh sách mentor của nhóm
      const mentors = await prisma.groupMentor.findMany({
        where: { groupId },
        include: {
          role: true
        }
      });

      if (mentors.length === 0) {
        console.log(`Không tìm thấy mentor cho nhóm: ${groupId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.MENTOR_NOT_FOUND);
      }
      
      console.log(`Tìm thấy ${mentors.length} mentor cho nhóm`);

      // Kiểm tra xem báo cáo của tuần này đã tồn tại chưa
      const existingReport = await prisma.progressReport.findFirst({
        where: {
          groupId,
          weekNumber: data.weekNumber,
        },
      });

      if (existingReport) {
        console.log(`Báo cáo tuần ${data.weekNumber} đã tồn tại cho nhóm ${groupId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.WEEK_REPORT_EXISTS);
      }

      // Tìm mentor chính của nhóm
      const mainMentor = mentors.find(mentor => 
        mentor.role.name === "mentor_main" || mentor.role.name === "lecturer"
      );

      // Nếu không tìm thấy mentor chính, sử dụng mentor đầu tiên
      const mentorId = mainMentor ? mainMentor.mentorId : mentors[0].mentorId;
      console.log(`Sử dụng mentorId: ${mentorId} cho báo cáo`);

      // Tạo báo cáo mới
      const report = await prisma.progressReport.create({
        data: {
          groupId,
          mentorId, // Lưu mentor chính vào trường mentorId
          weekNumber: data.weekNumber,
          content: data.content,
          completionPercentage: data.completionPercentage,
          status: "SUBMITTED",
          submittedAt: data.submittedAt,
        },
      });
      
      console.log(`Đã tạo báo cáo với ID: ${report.id}`);

      // Tạo liên kết với tất cả mentor trong bảng ProgressReportMentor
      for (const mentor of mentors) {
        await prisma.progressReportMentor.create({
          data: {
            reportId: report.id,
            mentorId: mentor.mentorId,
            isRead: false,
          },
        });
        console.log(`Đã tạo liên kết với mentor ${mentor.mentorId} (${mentor.role.name})`);
      }
      
      console.log(`Đã tạo liên kết với ${mentors.length} mentor`);

      return report;
    } catch (error: any) {
      console.error(`Lỗi khi tạo báo cáo tiến độ:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Thêm phản hồi của mentor
  async addMentorFeedback(reportId: string, mentorId: string, mentorFeedback: string) {
    try {
      console.log(`Thêm phản hồi cho báo cáo ${reportId} từ mentor ${mentorId}`);
      
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
        include: {
          mentors: true
        }
      });

      if (!report) {
        console.log(`Không tìm thấy báo cáo với ID: ${reportId}`);
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
        // Kiểm tra xem người dùng có phải là mentor của nhóm không
        const isGroupMentor = await prisma.groupMentor.findFirst({
          where: {
            groupId: report.groupId,
            mentorId
          },
          include: {
            role: true
          }
        });
        
        if (!isGroupMentor) {
          console.log(`Mentor ${mentorId} không có quyền thêm phản hồi cho báo cáo ${reportId}`);
          throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
        }
        
        // Tạo liên kết nếu chưa có
        await prisma.progressReportMentor.create({
          data: {
            reportId,
            mentorId,
            isRead: true,
            readAt: new Date(),
            feedback: mentorFeedback // Lưu feedback của mentor phụ
          }
        });
        
        console.log(`Đã tạo liên kết và lưu feedback cho mentor ${mentorId}`);
      } else {
        // Cập nhật trạng thái đã đọc và feedback cho mentor này
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
            feedback: mentorFeedback // Lưu feedback của mentor
          },
        });
        
        console.log(`Đã cập nhật trạng thái đã đọc và feedback cho mentor ${mentorId}`);
      }

      // Kiểm tra xem mentor hiện tại có phải là mentor chính không
      const groupMentor = await prisma.groupMentor.findFirst({
        where: {
          groupId: report.groupId,
          mentorId,
        },
        include: {
          role: true
        }
      });

      // Nếu là mentor chính hoặc là mentor được gán trong báo cáo, cập nhật feedback vào báo cáo chính
      if (groupMentor?.role.name === "mentor_main" || groupMentor?.role.name === "lecturer" || report.mentorId === mentorId) {
        // Cập nhật phản hồi vào báo cáo chính
        await prisma.progressReport.update({
          where: { id: reportId },
          data: {
            mentorFeedback,
            status: "REVIEWED",
            reviewedAt: new Date(),
          },
        });
        
        console.log(`Đã cập nhật phản hồi chính cho báo cáo ${reportId}`);
      }
      
      // Lấy báo cáo đã cập nhật với tất cả feedback
      const updatedReport = await prisma.progressReport.findUnique({
        where: { id: reportId },
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
        },
      });
      
      return updatedReport;
    } catch (error: any) {
      console.error(`Lỗi khi thêm phản hồi:`, error);
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
      console.log(`Cập nhật báo cáo ${reportId} bởi người dùng ${userId}`);
      
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
        include: { group: true },
      });

      if (!report) {
        console.log(`Không tìm thấy báo cáo với ID: ${reportId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      // Tìm student từ userId
      const student = await prisma.student.findFirst({
        where: { userId }
      });
      
      if (!student) {
        console.log(`Không tìm thấy student với userId: ${userId}`);
        throw new Error(MESSAGES.STUDENT.STUDENT_NOT_FOUND);
      }
      
      // Kiểm tra xem student có thuộc nhóm không
      const isMember = await prisma.groupMember.findFirst({
        where: {
          groupId: report.groupId,
          studentId: student.id,
          isActive: true
        },
      });

      if (!isMember) {
        console.log(`Student ${student.id} không thuộc nhóm ${report.groupId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }

      // Kiểm tra nếu báo cáo đã được đánh giá thì không cho cập nhật
      if (report.status === "REVIEWED") {
        console.log(`Báo cáo ${reportId} đã được đánh giá, không thể cập nhật`);
        throw new Error(MESSAGES.PROGRESS_REPORT.CANNOT_UPDATE_REVIEWED);
      }

      const updatedReport = await prisma.progressReport.update({
        where: { id: reportId },
        data,
      });
      
      console.log(`Đã cập nhật báo cáo ${reportId}`);
      
      return updatedReport;
    } catch (error: any) {
      console.error(`Lỗi khi cập nhật báo cáo:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Xóa báo cáo tiến độ
  async deleteProgressReport(reportId: string, userId: string) {
    try {
      console.log(`Xóa báo cáo ${reportId} bởi người dùng ${userId}`);
      
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId },
        include: { group: true },
      });

      if (!report) {
        console.log(`Không tìm thấy báo cáo với ID: ${reportId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }

      // Kiểm tra quyền xóa (chỉ trưởng nhóm hoặc mentor chính)
      let hasPermission = false;
      
      // Kiểm tra nếu là trưởng nhóm
      const student = await prisma.student.findFirst({
        where: { userId }
      });
      
      if (student) {
        const groupMember = await prisma.groupMember.findFirst({
          where: { 
            groupId: report.groupId,
            studentId: student.id,
            role: {
              name: { in: ["group_leader", "leader"] }
            },
            isActive: true 
          },
          include: { role: true }
        });
        
        if (groupMember) {
          hasPermission = true;
          console.log(`Người dùng ${userId} là trưởng nhóm của nhóm ${report.groupId}`);
        }
      }
      
      // Kiểm tra nếu là mentor chính
      if (!hasPermission) {
        const mentorRole = await prisma.groupMentor.findFirst({
          where: {
            groupId: report.groupId,
            mentorId: userId,
            role: {
              name: { in: ["mentor_main", "lecturer"] }
            }
          },
          include: { role: true }
        });
        
        if (mentorRole) {
          hasPermission = true;
          console.log(`Người dùng ${userId} là mentor chính của nhóm ${report.groupId}`);
        }
      }

      if (!hasPermission) {
        console.log(`Người dùng ${userId} không có quyền xóa báo cáo ${reportId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }

      // Xóa tất cả các liên kết với mentor
      await prisma.progressReportMentor.deleteMany({
        where: { reportId },
      });
      
      console.log(`Đã xóa liên kết mentor cho báo cáo ${reportId}`);

      // Xóa báo cáo
      const deletedReport = await prisma.progressReport.delete({
        where: { id: reportId },
      });
      
      console.log(`Đã xóa báo cáo ${reportId}`);
      
      return deletedReport;
    } catch (error: any) {
      console.error(`Lỗi khi xóa báo cáo:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy danh sách báo cáo theo nhóm
  async getProgressReportsByGroup(groupId: string) {
    try {
      console.log(`Lấy danh sách báo cáo cho nhóm ${groupId}`);
      
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        console.log(`Không tìm thấy nhóm với ID: ${groupId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
      }

      const reports = await prisma.progressReport.findMany({
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
      
      console.log(`Tìm thấy ${reports.length} báo cáo cho nhóm ${groupId}`);
      
      return reports;
    } catch (error: any) {
      console.error(`Lỗi khi lấy danh sách báo cáo theo nhóm:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy báo cáo tiến độ của mentor
  async getProgressReportsByMentor(mentorId: string) {
    try {
      console.log(`Lấy danh sách báo cáo cho mentor ${mentorId}`);
      
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
      
      console.log(`Tìm thấy ${mentorReports.length} báo cáo cho mentor ${mentorId}`);

      // Chuyển đổi kết quả để trả về danh sách báo cáo với thông tin đã đọc
      return mentorReports.map(mr => ({
        ...mr.progressReport,
        isRead: mr.isRead,
        readAt: mr.readAt,
        mentorFeedback: mr.feedback || mr.progressReport.mentorFeedback // Ưu tiên feedback của mentor hiện tại nếu có
      }));
    } catch (error: any) {
      console.error(`Lỗi khi lấy danh sách báo cáo theo mentor:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy chi tiết báo cáo tiến độ theo ID
  async getProgressReportById(reportId: string) {
    try {
      console.log(`Lấy chi tiết báo cáo ${reportId}`);
      
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
        console.log(`Không tìm thấy báo cáo với ID: ${reportId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }
      
      console.log(`Đã lấy chi tiết báo cáo ${reportId}`);

      return report;
    } catch (error: any) {
      console.error(`Lỗi khi lấy chi tiết báo cáo:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy báo cáo tiến độ theo tuần và nhóm
  async getProgressReportByWeek(groupId: string, weekNumber: number) {
    try {
      console.log(`Lấy báo cáo tuần ${weekNumber} cho nhóm ${groupId}`);
      
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
        console.log(`Không tìm thấy báo cáo tuần ${weekNumber} cho nhóm ${groupId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }
      
      console.log(`Đã lấy báo cáo tuần ${weekNumber} cho nhóm ${groupId}`);

      return report;
    } catch (error: any) {
      console.error(`Lỗi khi lấy báo cáo theo tuần:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Đánh dấu báo cáo đã đọc
  async markReportAsRead(reportId: string, mentorId: string) {
    try {
      console.log(`Đánh dấu báo cáo ${reportId} đã đọc bởi mentor ${mentorId}`);
      
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId }
      });
      
      if (!report) {
        console.log(`Không tìm thấy báo cáo với ID: ${reportId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }
      
      // Kiểm tra xem mentor có quyền đánh dấu báo cáo không
      const isGroupMentor = await prisma.groupMentor.findFirst({
        where: {
          groupId: report.groupId,
          mentorId
        }
      });
      
      if (!isGroupMentor) {
        console.log(`Mentor ${mentorId} không phải là mentor của nhóm ${report.groupId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }
      
      // Tìm hoặc tạo liên kết mentor-báo cáo
      const mentorReport = await prisma.progressReportMentor.findUnique({
        where: {
          reportId_mentorId: {
            reportId,
            mentorId,
          },
        },
      });

      if (!mentorReport) {
        // Tạo mới nếu chưa có
        return await prisma.progressReportMentor.create({
          data: {
            reportId,
            mentorId,
            isRead: true,
            readAt: new Date(),
          },
        });
      } else {
        // Cập nhật nếu đã có
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
      }
    } catch (error: any) {
      console.error(`Lỗi khi đánh dấu báo cáo đã đọc:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }
  
  // Lấy danh sách báo cáo tiến độ của sinh viên
  async getMyProgressReports(userId: string) {
    try {
      console.log(`Lấy danh sách báo cáo cho sinh viên ${userId}`);
      
      // Tìm student từ userId
      const student = await prisma.student.findFirst({
        where: { userId }
      });
      
      if (!student) {
        console.log(`Không tìm thấy student với userId: ${userId}`);
        throw new Error(MESSAGES.STUDENT.STUDENT_NOT_FOUND);
      }
      
      // Tìm nhóm của sinh viên
      const groupMember = await prisma.groupMember.findFirst({
        where: {
          studentId: student.id,
          isActive: true
        }
      });
      
      if (!groupMember) {
        console.log(`Sinh viên ${student.id} không thuộc nhóm nào`);
        throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
      }
      
      // Lấy danh sách báo cáo của nhóm
      const reports = await prisma.progressReport.findMany({
        where: { groupId: groupMember.groupId },
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
      
      console.log(`Tìm thấy ${reports.length} báo cáo cho sinh viên ${userId}`);
      
      return reports;
    } catch (error: any) {
      console.error(`Lỗi khi lấy danh sách báo cáo của sinh viên:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }
}