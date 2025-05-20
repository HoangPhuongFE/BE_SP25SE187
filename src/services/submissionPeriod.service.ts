import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from "../constants/httpStatus";
import { TOPIC_SUBMISSION_PERIOD_MESSAGE } from "../constants/message";

const prisma = new PrismaClient();

export class SubmissionPeriodService {
  
  // Tạo một đợt đề xuất mới
  async createSubmissionPeriod(data: {
    semesterId: string;
    roundNumber: number;
    startDate: Date | string;
    endDate: Date | string;
    type: "TOPIC" | "CHECK-TOPIC" | "REVIEW" | "DEFENSE";
    description?: string;
    createdBy: string;
  }) {
    try {
      // Ép kiểu lại ngày nếu từ client truyền lên là string
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
  
      // Kiểm tra người tạo
      const creator = await prisma.user.findUnique({
        where: { id: data.createdBy },
        include: { roles: { include: { role: true } } },
      });
  
      if (!creator) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Người tạo không tồn tại!",
        };
      }
  
      const creatorRoles = creator.roles.map((r) => r.role.name.toLowerCase());
      if (creatorRoles.includes("academic_officer") || creatorRoles.includes("admin")) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Academic officer không được phép tạo đợt đề xuất.",
        };
      }
  
      // Kiểm tra học kỳ
      const semester = await prisma.semester.findUnique({
        where: { id: data.semesterId, isDeleted: false },
      });
  
      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Học kỳ không tồn tại hoặc đã bị xóa!",
        };
      }
  
      // Kiểm tra thời gian bắt đầu < kết thúc
      if (startDate >= endDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.",
        };
      }
  
      // Lấy trạng thái học kỳ
      const semesterStatus = this.determineStatus(semester.startDate, semester.endDate);
  
      // Logic kiểm tra theo loại đợt
      if (data.type === "TOPIC" || data.type === "CHECK-TOPIC") {
        if (semesterStatus === "COMPLETE") {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: "Không thể tạo TOPIC hoặc CHECK-TOPIC khi học kỳ đã hoàn thành!",
          };
        }
  
        const daysFromSemesterStart = Math.floor(
          (startDate.getTime() - semester.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
  
        if (daysFromSemesterStart > 14) {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: "Thời gian bắt đầu đợt TOPIC hoặc CHECK-TOPIC phải nằm trong 2 tuần đầu của học kỳ!",
          };
        }
      } else if (data.type === "REVIEW") {
        if (semesterStatus !== "ACTIVE" && semesterStatus !== "UPCOMING") {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: "Chỉ có thể tạo REVIEW khi học kỳ đang diễn ra (ACTIVE)!",
          };
        }
      } else if (data.type === "DEFENSE") {
        if (semesterStatus === "UPCOMING") {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: "Không thể tạo DEFENSE khi học kỳ chưa bắt đầu!",
          };
        }
      }
  
      // Tính trạng thái của đợt đề xuất
      const status = this.determineStatus(startDate, endDate);
  
      // Tạo submission period
      const newPeriod = await prisma.submissionPeriod.create({
        data: {
          semesterId: data.semesterId,
          roundNumber: data.roundNumber,
          startDate,
          endDate,
          type: data.type,
          description: data.description || "",
          createdBy: data.createdBy,
          status,
        },
      });
  
      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: TOPIC_SUBMISSION_PERIOD_MESSAGE.CREATED,
        data: newPeriod,
      };
    } catch (error) {
      console.error("Lỗi khi tạo đợt đề xuất:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }
  
  
  

  // Cập nhật đợt đề xuất
  async updateSubmissionPeriod(
    periodId: string,
    data: Partial<{
      startDate: Date;
      endDate: Date;
      type: "TOPIC" | "CHECK-TOPIC" | "REVIEW" | "DEFENSE";
      description?: string;
    }>
  ) {
    try {
      const existingPeriod = await prisma.submissionPeriod.findFirst({
        where: {
          id: periodId,
          semester: { isDeleted: false },
        },
        include: { semester: true },
      });
      if (!existingPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND,
        };
      }

      // Kiểm tra thời gian nếu cập nhật
      if (data.startDate && data.endDate && data.endDate < data.startDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Ngày kết thúc không thể trước ngày bắt đầu.",
        };
      }

      // Giữ giá trị cũ nếu không cung cấp giá trị mới
      const newStartDate = data.startDate ?? existingPeriod.startDate;
      const newEndDate = data.endDate ?? existingPeriod.endDate;
      const newType = data.type ?? existingPeriod.type;

      // Tính trạng thái mới
      const updatedStatus = this.determineStatus(new Date(newStartDate), new Date(newEndDate));

      // Cập nhật với dữ liệu mới
      const updatedPeriod = await prisma.submissionPeriod.update({
        where: { id: periodId },
        data: {
          startDate: newStartDate,
          endDate: newEndDate,
          type: newType,
          description: data.description,
          status: updatedStatus,
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: TOPIC_SUBMISSION_PERIOD_MESSAGE.UPDATED,
        data: updatedPeriod,
      };
    } catch (error) {
      console.error("Lỗi khi cập nhật đợt đề xuất:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }

  // Lấy danh sách đợt đề xuất theo học kỳ, có thể lọc theo type
  async getSubmissionPeriods(semesterId: string, type?: "TOPIC" | "CHECK-TOPIC" | "REVIEW" |"DEFENSE") {
    try {
      const periods = await prisma.submissionPeriod.findMany({
        where: {
          semesterId,
          ...(type && { type }), // Lọc theo type nếu được cung cấp
          semester: { isDeleted: false },
        },
        orderBy: { roundNumber: "asc" },
      });

      // Cập nhật trạng thái và trả về danh sách
      const updatedPeriods = periods.map((period) => {
        const newStatus = this.determineStatus(new Date(period.startDate), new Date(period.endDate));
        if (newStatus !== period.status) {
          prisma.submissionPeriod.update({
            where: { id: period.id },
            data: { status: newStatus },
          }).catch((err) => console.error(`Lỗi cập nhật trạng thái: ${err}`));
        }
        return { ...period, status: newStatus };
      });

      return { success: true, status: HTTP_STATUS.OK, data: updatedPeriods };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đợt đề xuất:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  // Lấy thông tin một đợt đề xuất theo ID, có thể kiểm tra type
  async getSubmissionPeriodById(periodId: string, expectedType?: "TOPIC" | "CHECK-TOPIC" | "REVIEW" | "DEFENSE") {
    try {
      const period = await prisma.submissionPeriod.findFirst({
        where: {
          id: periodId,
          semester: { isDeleted: false },
        },
      });
      if (!period) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          data: [],
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND,
        };
      }

      // Kiểm tra type nếu expectedType được cung cấp
      if (expectedType && period.type !== expectedType) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `Đợt xét duyệt này có type ${period.type}, không phải ${expectedType} như yêu cầu!`,
        };
      }

      // Tính trạng thái mới
      const newStatus = this.determineStatus(new Date(period.startDate), new Date(period.endDate));
      if (newStatus !== period.status) {
        await prisma.submissionPeriod.update({
          where: { id: period.id },
          data: { status: newStatus },
        });
      }

      return { success: true, status: HTTP_STATUS.OK, data: { ...period, status: newStatus } };
    } catch (error) {
      console.error("Lỗi khi lấy đợt đề xuất theo ID:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }
  
  // Xóa đợt đề xuất
  async deleteSubmissionPeriod(periodId: string, userId: string, ipAddress?: string) {
    try {
      const period = await prisma.submissionPeriod.findFirst({
        where: {
          id: periodId,
          isDeleted: false,
          semester: { isDeleted: false },
        },
        include: { topics: true, councils: true },
      });
      if (!period) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: "DELETE_SUBMISSION_PERIOD_ATTEMPT",
            entityType: "SubmissionPeriod",
            entityId: periodId,
            description: "Thử xóa đợt đề xuất nhưng không tìm thấy hoặc đã bị đánh dấu xóa",
            severity: "WARNING",
            ipAddress: ipAddress || "unknown",
          },
        });
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND };
      }

      const topicIds = period.topics.map((t) => t.id);
      const councilIds = period.councils.map((c) => c.id);

      const updatedPeriod = await prisma.$transaction(async (tx) => {
        const updatedCounts = {
          reviewSchedules: 0,
          reviewAssignments: 0,
          defenseSchedules: 0,
          defenseMemberResults: 0,
          councilMembers: 0,
          documents: 0,
          semesterTopicMajors: 0,
          detailMajorTopics: 0,
          topicAssignments: 0,
          topics: 0,
          councils: 0,
          topicRegistrations: 0,
          notifications: 0,
        };

        updatedCounts.reviewSchedules = await tx.reviewSchedule
          .updateMany({ where: { topicId: { in: topicIds }, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        updatedCounts.reviewAssignments = await tx.reviewAssignment
          .updateMany({ where: { topicId: { in: topicIds }, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        const defenseScheduleIds = await tx.defenseSchedule
          .findMany({ where: { councilId: { in: councilIds }, isDeleted: false }, select: { id: true } })
          .then((schedules) => schedules.map((s) => s.id));

        updatedCounts.defenseSchedules = await tx.defenseSchedule
          .updateMany({ where: { councilId: { in: councilIds }, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        updatedCounts.defenseMemberResults = await tx.defenseMemberResult
          .updateMany({ where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        updatedCounts.councilMembers = await tx.councilMember
          .updateMany({ where: { councilId: { in: councilIds }, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        updatedCounts.documents = await tx.document
          .updateMany({
            where: { OR: [{ topicId: { in: topicIds } }, { councilId: { in: councilIds } }], isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

   
        updatedCounts.topicAssignments = await tx.topicAssignment
          .updateMany({ where: { topicId: { in: topicIds }, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        updatedCounts.topics = await tx.topic
          .updateMany({ where: { submissionPeriodId: periodId, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        updatedCounts.councils = await tx.council
          .updateMany({ where: { submissionPeriodId: periodId, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        updatedCounts.topicRegistrations = await tx.topicRegistration
          .updateMany({ where: { submissionPeriodId: periodId, isDeleted: false }, data: { isDeleted: true } })
          .then((res) => res.count);

        await tx.submissionPeriod.update({
          where: { id: periodId },
          data: { isDeleted: true },
        });

        await tx.systemLog.create({
          data: {
            userId,
            action: "DELETE_SUBMISSION_PERIOD",
            entityType: "SubmissionPeriod",
            entityId: periodId,
            description: `Đợt đề xuất "${period.description || periodId}" đã được đánh dấu xóa cùng các dữ liệu liên quan`,
            severity: "INFO",
            ipAddress: ipAddress || "unknown",
            metadata: {
              topicCount: period.topics.length,
              councilCount: period.councils.length,
              deletedDefenseMemberResultCount: updatedCounts.defenseMemberResults,
              updatedCounts,
            },
            oldValues: JSON.stringify(period),
          },
        });

        return await tx.submissionPeriod.findUnique({
          where: { id: periodId },
          include: { topics: true, councils: true },
        });
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: TOPIC_SUBMISSION_PERIOD_MESSAGE.DELETED,
        data: updatedPeriod,
      };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: "DELETE_SUBMISSION_PERIOD_ERROR",
          entityType: "SubmissionPeriod",
          entityId: periodId,
          description: "Lỗi hệ thống khi đánh dấu xóa đợt đề xuất",
          severity: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          stackTrace: (error as Error).stack || "No stack trace",
          ipAddress: ipAddress || "unknown",
        },
      });
      console.error("Lỗi khi đánh dấu xóa đợt đề xuất:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi đánh dấu xóa đợt đề xuất!",
      };
    }
  }

  private determineStatus(startDate: Date, endDate: Date): string {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return "UPCOMING";
    if (now >= start && now <= end) return "ACTIVE";
    return "COMPLETE";
  }
}