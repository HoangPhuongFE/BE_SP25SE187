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
      // Kiểm tra xem người dùng có thuộc nhóm không
      let groupId = data.groupId;
      let isLeader = false;
      
      if (!groupId) {
        // Nếu không có groupId, tìm nhóm của người dùng
        // Đầu tiên tìm student từ userId
        const student = await prisma.student.findFirst({
          where: {
            userId: data.userId,
            isDeleted: false
          }
        });

        if (!student) {
          // Nếu không tìm thấy student, kiểm tra trực tiếp trong group_members
          const userGroup = await prisma.groupMember.findFirst({
            where: {
              userId: data.userId,
              isActive: true,
              isDeleted: false,
              group: {
                isDeleted: false
              }
            },
            include: {
              role: true,
              group: true
            }
          });

          if (!userGroup) {
            throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
          }

          groupId = userGroup.groupId;
          // Kiểm tra xem người dùng có phải là leader không
          isLeader = userGroup.role.name === "group_leader" || userGroup.role.name === "leader";
        } else {
          // Nếu tìm thấy student, tìm nhóm thông qua studentId
          const studentGroup = await prisma.groupMember.findFirst({
            where: {
              studentId: student.id,
              isActive: true,
            },
            include: {
              role: true,
              group: true
            }
          });

          if (!studentGroup) {
            throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
          }

          groupId = studentGroup.groupId;
          // Kiểm tra xem người dùng có phải là leader không
          isLeader = studentGroup.role.name === "group_leader" || studentGroup.role.name === "leader";
        }
      } else {
        // Kiểm tra xem người dùng có thuộc nhóm này không và có phải là leader không
        // Đầu tiên tìm student từ userId
        const student = await prisma.student.findFirst({
          where: {
            userId: data.userId,
            isDeleted: false
          }
        });

        let isMember = false;

        if (student) {
          // Kiểm tra thông qua studentId
          const studentMember = await prisma.groupMember.findFirst({
            where: {
              groupId: groupId,
              studentId: student.id,
              isActive: true,
            },
            include: {
              role: true
            }
          });

          if (studentMember) {
            isMember = true;
            isLeader = studentMember.role.name === "group_leader" || studentMember.role.name === "leader";
          }
        }

        // Nếu không tìm thấy qua student, kiểm tra trực tiếp userId
        if (!isMember) {
          const userMember = await prisma.groupMember.findFirst({
            where: {
              groupId: groupId,
              userId: data.userId,
              isActive: true,
            },
            include: {
              role: true
            }
          });

          if (!userMember) {
            throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
          }
          
          isLeader = userMember.role.name === "group_leader" || userMember.role.name === "leader";
        }
      }

      // Kiểm tra xem người dùng có phải là leader không
      if (!isLeader) {
        throw new Error("Chỉ trưởng nhóm mới có quyền tạo báo cáo tiến độ");
      }

      // Tìm khoảng thời gian báo cáo hiện tại
      const currentDate = new Date();
      const reportPeriod = await prisma.progressReport.findFirst({
        where: {
          groupId: groupId,
          isDeleted: false,
          startDate: {
            lte: currentDate,
          },
          endDate: {
            gte: currentDate,
          },
          status: "ACTIVE",
          content: "",
        },
        include: {
          mentors: {
            where: {
              isDeleted: false
            }
          }
        }
      });

      if (!reportPeriod) {
        throw new Error(MESSAGES.PROGRESS_REPORT.NO_ACTIVE_PERIOD);
      }

      // Sử dụng weekNumber từ khoảng thời gian
      const weekNumber = reportPeriod.weekNumber;

      // Kiểm tra xem đã có báo cáo cho tuần này chưa (khác với khoảng thời gian)
      const existingReport = await prisma.progressReport.findFirst({
        where: {
          groupId: groupId,
          weekNumber: weekNumber,
          isDeleted: false,
          content: {
            not: ""
          },
        },
      });

      if (existingReport) {
        throw new Error(MESSAGES.PROGRESS_REPORT.WEEK_REPORT_EXISTS);
      }

      // Cập nhật khoảng thời gian báo cáo thay vì tạo mới
      const progressReport = await prisma.progressReport.update({
        where: { id: reportPeriod.id },
        data: {
          content: data.content,
          completionPercentage: data.completionPercentage,
          status: "SUBMITTED",
          submittedAt: data.submittedAt,
        },
        include: {
          mentors: true
        }
      });

      // Đánh dấu tất cả các mentor là chưa đọc
      if (progressReport.mentors && progressReport.mentors.length > 0) {
        await Promise.all(progressReport.mentors.map(mentor => 
          prisma.progressReportMentor.update({
            where: {
              reportId_mentorId: {
                reportId: progressReport.id,
                mentorId: mentor.mentorId
              }
            },
            data: {
              isRead: false,
              readAt: null
            }
          })
        ));
      }

      return progressReport;
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
          isDeleted: false
        },
      });

      if (!mentorReport) {
        // Kiểm tra xem người dùng có phải là mentor của nhóm không
        const isGroupMentor = await prisma.groupMentor.findFirst({
          where: {
            groupId: report.groupId,
            mentorId,
            isDeleted: false
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
        where: { 
            userId: userId,
            isDeleted: false 
        }
      });
      
      if (!student) {
        console.log(`Không tìm thấy student với userId: ${userId}`);
        throw new Error(MESSAGES.STUDENT.STUDENT_NOT_FOUND);
      }
      
      // Kiểm tra xem student có thuộc nhóm không và có phải là leader không
      const groupMember = await prisma.groupMember.findFirst({
        where: {
          groupId: report.groupId,
          studentId: student.id,
          isActive: true,
          isDeleted: false,
          group: {
            isDeleted: false
          }
        },
        include: {
          role: true
        }
      });

      if (!groupMember) {
        console.log(`Student ${student.id} không thuộc nhóm ${report.groupId}`);
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }

      // Kiểm tra xem người dùng có phải là leader không
      const isLeader = groupMember.role.name === "group_leader" || groupMember.role.name === "leader";
      if (!isLeader) {
        console.log(`Student ${student.id} không phải là leader của nhóm ${report.groupId}`);
        throw new Error("Chỉ trưởng nhóm mới có quyền cập nhật báo cáo tiến độ");
      }

      // Kiểm tra nếu báo cáo đã được đánh giá thì không cho cập nhật
      if (report.status === "REVIEWED") {
        console.log(`Báo cáo ${reportId} đã được đánh giá, không thể cập nhật`);
        throw new Error(MESSAGES.PROGRESS_REPORT.CANNOT_UPDATE_REVIEWED);
      }

      // Kiểm tra xem báo cáo có đang trong thời gian mà mentor đã tạo không
      const currentDate = new Date();
      if (currentDate < report.startDate || currentDate > report.endDate) {
        console.log(`Báo cáo ${reportId} không trong thời gian cho phép cập nhật (${report.startDate.toISOString()} - ${report.endDate.toISOString()})`);
        throw new Error("Không thể cập nhật báo cáo ngoài thời gian quy định");
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
  async deleteProgressReport(reportId: string, userId: string, ipAddress?: string): Promise<{ message: string; data: any }> {
    try {
      // Kiểm tra xem ProgressReport có tồn tại và chưa bị đánh dấu xóa
      const report = await prisma.progressReport.findUnique({
        where: { id: reportId, isDeleted: false },
        include: { group: true },
      });
      if (!report) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_PROGRESS_REPORT_ATTEMPT',
            entityType: 'ProgressReport',
            entityId: reportId,
            description: 'Thử xóa báo cáo tiến độ nhưng không tìm thấy hoặc đã bị đánh dấu xóa',
            severity: 'WARNING',
            ipAddress: ipAddress || 'unknown',
          },
        });
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }
  
      // Kiểm tra quyền của người dùng
      let hasPermission = false;
      const student = await prisma.student.findFirst({ where: { userId } });
      if (student) {
        const groupMember = await prisma.groupMember.findFirst({
          where: {
            groupId: report.groupId,
            studentId: student.id,
            role: { name: { in: ['group_leader', 'leader'] } },
            isActive: true,
            isDeleted: false,
          },
          include: { role: true },
        });
        if (groupMember) hasPermission = true;
      }
  
      if (!hasPermission) {
        const mentorRole = await prisma.groupMentor.findFirst({
          where: {
            groupId: report.groupId,
            mentorId: userId,
            role: { name: { in: ['mentor_main', 'lecturer'] } },
            isDeleted: false,
          },
          include: { role: true },
        });
        if (mentorRole) hasPermission = true;
      }
  
      if (!hasPermission) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_PROGRESS_REPORT_ATTEMPT',
            entityType: 'ProgressReport',
            entityId: reportId,
            description: 'Thử xóa báo cáo tiến độ nhưng không có quyền',
            severity: 'WARNING',
            ipAddress: ipAddress || 'unknown',
            metadata: { userId, requiredRoles: 'group_leader or mentor_main' },
          },
        });
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }
  
      // Xóa mềm trong transaction
      const updatedReport = await prisma.$transaction(async (tx) => {
        // 1. Đánh dấu xóa các ProgressReportMentor liên quan
        await tx.progressReportMentor.updateMany({
          where: { reportId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 2. Đánh dấu xóa ProgressReport
        await tx.progressReport.update({
          where: { id: reportId },
          data: { isDeleted: true },
        });
  
        // 3. Ghi log hành động thành công
        await tx.systemLog.create({
          data: {
            userId,
            action: 'DELETE_PROGRESS_REPORT',
            entityType: 'ProgressReport',
            entityId: reportId,
            description: `Báo cáo tiến độ tuần ${report.weekNumber} của nhóm ${report.groupId} đã được đánh dấu xóa`,
            severity: 'INFO',
            ipAddress: ipAddress || 'unknown',
            metadata: {
              weekNumber: report.weekNumber,
              groupId: report.groupId,
              deletedBy: hasPermission && student ? 'group_leader' : 'mentor',
            },
            oldValues: JSON.stringify(report),
          },
        });
  
        // Trả về dữ liệu ProgressReport sau khi cập nhật
        return await tx.progressReport.findUnique({
          where: { id: reportId },
          include: { group: true },
        });
      });
  
      return { message: MESSAGES.PROGRESS_REPORT.REPORT_DELETED, data: updatedReport };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_PROGRESS_REPORT_ERROR',
          entityType: 'ProgressReport',
          entityId: reportId,
          description: 'Lỗi hệ thống khi đánh dấu xóa báo cáo tiến độ',
          severity: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          stackTrace: (error as Error).stack || 'No stack trace',
          ipAddress: ipAddress || 'unknown',
        },
      });
      throw error;
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
              id: true,
              groupCode: true,
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

      // Lấy thông tin về vai trò của mentor trong nhóm
      const mentorsWithRoles = await Promise.all(
        report.mentors.map(async (mr) => {
          const groupMentor = await prisma.groupMentor.findFirst({
            where: {
              groupId: report.groupId,
              mentorId: mr.mentor.id
            },
            select: {
              roleId: true
            }
          });
          
          return {
            ...mr,
            mentor: {
              ...mr.mentor,
              roleInGroup: groupMentor?.roleId
            }
          };
        })
      );

      return {
        ...report,
        mentors: mentorsWithRoles
      };
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
        where: { 
            userId: userId,
            isDeleted: false 
        }
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
        where: { 
          groupId: groupMember.groupId,
          isDeleted: false
        },
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

  // Tạo khoảng thời gian báo cáo tiến độ cho nhóm
  async createReportPeriod(data: {
    groupId: string;
    userId: string;
    weekNumber: number;
    startDate: Date;
    endDate: Date;
  }) {
    try {
      console.log(`Tạo khoảng thời gian báo cáo cho nhóm ${data.groupId}, tuần ${data.weekNumber}`);
      
      // Lấy mentorId từ bảng groupMentor
      const mentor = await prisma.groupMentor.findFirst({
        where: {
          groupId: data.groupId,
          mentorId: data.userId,
        },
        include: {
          role: true
        }
      });

      if (!mentor) {
        // Kiểm tra xem người dùng có phải là mentor của nhóm không
        const isMentor = await prisma.groupMentor.findFirst({
          where: {
            groupId: data.groupId,
            mentorId: data.userId,
          },
        });

        if (!isMentor) {
          throw new Error(MESSAGES.PROGRESS_REPORT.NOT_MAIN_MENTOR);
        }
      }

      const mentorId = mentor?.mentorId || data.userId;

      // Kiểm tra xem khoảng thời gian có hợp lệ không
      if (data.startDate >= data.endDate) {
        throw new Error(MESSAGES.PROGRESS_REPORT.INVALID_DATE_RANGE);
      }

      // Kiểm tra xem có khoảng thời gian nào chồng chéo không
      const overlappingPeriod = await prisma.progressReport.findFirst({
        where: {
          groupId: data.groupId,
          OR: [
            {
              // Khoảng thời gian mới bắt đầu trong khoảng thời gian hiện có
              startDate: {
                lte: data.startDate,
              },
              endDate: {
                gte: data.startDate,
              },
            },
            {
              // Khoảng thời gian mới kết thúc trong khoảng thời gian hiện có
              startDate: {
                lte: data.endDate,
              },
              endDate: {
                gte: data.endDate,
              },
            },
            {
              // Khoảng thời gian mới bao trùm khoảng thời gian hiện có
              startDate: {
                gte: data.startDate,
              },
              endDate: {
                lte: data.endDate,
              },
            },
          ],
        },
      });

      if (overlappingPeriod) {
        throw new Error("Khoảng thời gian chồng chéo với khoảng thời gian báo cáo khác");
      }

      // Kiểm tra xem đã có báo cáo cho tuần này chưa
      const existingWeekReport = await prisma.progressReport.findFirst({
        where: {
          groupId: data.groupId,
          weekNumber: data.weekNumber,
        },
      });

      if (existingWeekReport) {
        throw new Error(MESSAGES.PROGRESS_REPORT.WEEK_PERIOD_EXISTS);
      }

      // Lấy danh sách mentor của nhóm
      const mentors = await prisma.groupMentor.findMany({
        where: {
          groupId: data.groupId,
          isDeleted: false
        },
        select: {
          mentorId: true,
        },
      });

      if (mentors.length === 0) {
        throw new Error(MESSAGES.PROGRESS_REPORT.MENTOR_NOT_FOUND);
      }

      console.log(`Tìm thấy ${mentors.length} mentor cho nhóm ${data.groupId}`);

      // Tạo khoảng thời gian báo cáo mới
      const reportPeriod = await prisma.progressReport.create({
        data: {
          groupId: data.groupId,
          mentorId: mentorId,
          weekNumber: data.weekNumber,
          content: "", // Để trống nội dung để đánh dấu đây là khoảng thời gian
          completionPercentage: 0,
          status: "ACTIVE",
          submittedAt: new Date(),
          startDate: data.startDate,
          endDate: data.endDate,
          mentors: {
            create: mentors.map(mentor => ({
              mentorId: mentor.mentorId,
              isRead: false,
            })),
          },
        },
        include: {
          mentors: true
        }
      });

      console.log(`Đã tạo khoảng thời gian báo cáo ID: ${reportPeriod.id} cho nhóm ${data.groupId}, tuần ${data.weekNumber}`);
      console.log(`Đã tạo ${reportPeriod.mentors.length} liên kết mentor cho khoảng thời gian báo cáo`);

      return reportPeriod;
    } catch (error: any) {
      console.error(`Lỗi khi tạo khoảng thời gian báo cáo:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy danh sách khoảng thời gian báo cáo tiến độ của nhóm
  async getReportPeriods(groupId: string) {
    try {
      console.log(`Lấy danh sách khoảng thời gian báo cáo cho nhóm ${groupId}`);
      
      // Lấy tất cả các bản ghi ProgressReport của nhóm
      const allReports = await prisma.progressReport.findMany({
        where: {
          groupId: groupId,
          isDeleted: false
        },
        orderBy: {
          weekNumber: 'asc',
        },
        include: {
          mentors: {
            include: {
              mentor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                }
              }
            }
          }
        }
      });
      
      // Phân loại thành khoảng thời gian và báo cáo thực tế
      const periods = allReports.filter(report => report.content === "");
      const reports = allReports.filter(report => report.content !== "");
      
      console.log(`Tìm thấy ${periods.length} khoảng thời gian và ${reports.length} báo cáo thực tế`);
      
      // Kết hợp thông tin từ báo cáo thực tế vào khoảng thời gian
      const result = periods.map(period => {
        // Tìm báo cáo thực tế tương ứng với khoảng thời gian này
        const matchingReport = reports.find(report => 
          report.weekNumber === period.weekNumber
        );
        
        return {
          ...period,
          hasReport: !!matchingReport,
          reportId: matchingReport?.id || null,
          reportStatus: matchingReport?.status || null,
          reportSubmittedAt: matchingReport?.submittedAt || null,
        };
      });
      
      return result;
    } catch (error: any) {
      console.error(`Lỗi khi lấy danh sách khoảng thời gian báo cáo:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Lấy khoảng thời gian báo cáo tiến độ hiện tại của nhóm
  async getCurrentReportPeriod(groupId: string) {
    try {
      const currentDate = new Date();
      const period = await prisma.progressReport.findFirst({
        where: {
          groupId: groupId,
          isDeleted: false,
          startDate: {
            lte: currentDate,
          },
          endDate: {
            gte: currentDate,
          },
          content: "",
          status: "ACTIVE",
        },
      });

      return period;
    } catch (error: any) {
      console.error(`Lỗi khi lấy khoảng thời gian báo cáo hiện tại:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }

  // Cập nhật feedback của mentor
  async updateMentorFeedback(data: {
    mentorId: string;
    groupId?: string;
    groupCode?: string;
    weekNumber: number;
    feedback: string;
  }) {
    try {
      console.log(`Cập nhật feedback của mentor ${data.mentorId} cho nhóm ${data.groupId || data.groupCode}, tuần ${data.weekNumber}`);
      
      // Tìm nhóm dựa trên groupId hoặc groupCode
      let groupId = data.groupId;
      
      if (!groupId && data.groupCode) {
        const group = await prisma.group.findFirst({
          where: {
            groupCode: data.groupCode
          }
        });
        
        if (!group) {
          throw new Error(MESSAGES.PROGRESS_REPORT.GROUP_NOT_FOUND);
        }
        
        groupId = group.id;
      }
      
      if (!groupId) {
        throw new Error("Cần cung cấp groupId hoặc groupCode");
      }
      
      // Kiểm tra xem mentor có thuộc nhóm này không
      const isMentor = await prisma.groupMentor.findFirst({
        where: {
          groupId: groupId,
          mentorId: data.mentorId
        }
      });
      
      if (!isMentor) {
        throw new Error(MESSAGES.PROGRESS_REPORT.UNAUTHORIZED);
      }
      
      // Tìm báo cáo tiến độ của tuần được chỉ định
      const report = await prisma.progressReport.findFirst({
        where: {
          groupId: groupId,
          weekNumber: data.weekNumber,
          content: {
            not: "" // Đảm bảo đây là báo cáo thực tế, không phải khoảng thời gian
          }
        },
        include: {
          mentors: true
        }
      });
      
      if (!report) {
        throw new Error(MESSAGES.PROGRESS_REPORT.REPORT_NOT_FOUND);
      }
      
      // Tìm liên kết mentor-báo cáo
      const mentorReport = await prisma.progressReportMentor.findUnique({
        where: {
          reportId_mentorId: {
            reportId: report.id,
            mentorId: data.mentorId
          }
        }
      });
      
      // Cập nhật hoặc tạo mới liên kết mentor-báo cáo
      if (mentorReport) {
        await prisma.progressReportMentor.update({
          where: {
            reportId_mentorId: {
              reportId: report.id,
              mentorId: data.mentorId
            }
          },
          data: {
            feedback: data.feedback,
            isRead: true,
            readAt: new Date()
          }
        });
      } else {
        await prisma.progressReportMentor.create({
          data: {
            reportId: report.id,
            mentorId: data.mentorId,
            feedback: data.feedback,
            isRead: true,
            readAt: new Date()
          }
        });
      }
      
      // Kiểm tra xem mentor hiện tại có phải là mentor chính không
      const groupMentor = await prisma.groupMentor.findFirst({
        where: {
          groupId: groupId,
          mentorId: data.mentorId,
        },
        include: {
          role: true
        }
      });
      
      // Nếu là mentor chính hoặc là mentor được gán trong báo cáo, cập nhật feedback vào báo cáo chính
      if (groupMentor?.role.name === "mentor_main" || groupMentor?.role.name === "lecturer" || report.mentorId === data.mentorId) {
        await prisma.progressReport.update({
          where: { id: report.id },
          data: {
            mentorFeedback: data.feedback,
            status: "REVIEWED",
            reviewedAt: new Date()
          }
        });
      }
      
      // Lấy báo cáo đã cập nhật với tất cả feedback
      const updatedReport = await prisma.progressReport.findUnique({
        where: { id: report.id },
        include: {
          mentors: {
            include: {
              mentor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true
                }
              }
            }
          },
          group: {
            select: {
              id: true,
              groupCode: true
            }
          }
        }
      });
      
      return updatedReport;
    } catch (error: any) {
      console.error(`Lỗi khi cập nhật feedback:`, error);
      throw new Error(error.message || MESSAGES.GENERAL.ACTION_FAILED);
    }
  }
}