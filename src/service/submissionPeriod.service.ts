import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from "../constants/httpStatus";
import { TOPIC_SUBMISSION_PERIOD_MESSAGE } from "../constants/message";

const prisma = new PrismaClient();

export class SubmissionPeriodService {
  // Tạo một đợt đề xuất mới, thêm kiểm tra quyền ở đây
  async createSubmissionPeriod(data: {
    semesterId: string;
    roundNumber: number;
    startDate: Date;
    endDate: Date;
    description?: string;
    createdBy: string;
  }) {
    try {
      // Kiểm tra quyền của người tạo (createdBy) - không cho phép academic_officer tạo đợt đề xuất
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
      // Nếu người tạo có vai trò academic_officer, từ chối thao tác tạo đợt đề xuất
      if (creatorRoles.includes("academic_officer")|| creatorRoles.includes("admin")) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Academic officer không được phép tạo đợt đề xuất.",
        };
      }

      // Kiểm tra học kỳ tồn tại và chưa bị xóa
      const semester = await prisma.semester.findUnique({
        where: { 
          id: data.semesterId,
          isDeleted: false 
        }
      });

      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Học kỳ không tồn tại hoặc đã bị xóa!",
        };
      }

      // Kiểm tra xem đợt này đã tồn tại chưa
      const existingPeriod = await prisma.submissionPeriod.findFirst({
        where: { 
          semesterId: data.semesterId, 
          roundNumber: data.roundNumber,
          semester: {
            isDeleted: false
          }
        },
      });

      if (existingPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.OVERLAPPED_PERIOD,
        };
      }

      // Kiểm tra rằng startDate < endDate
      if (data.startDate >= data.endDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.",
        };
      }

      // Tính toán trạng thái tự động dựa trên thời gian
      const status = this.determineStatus(data.startDate, data.endDate);

      // Tạo đợt đề xuất mới
      const newPeriod = await prisma.submissionPeriod.create({
        data: {
          semesterId: data.semesterId,
          roundNumber: data.roundNumber,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description || "",
          createdBy: data.createdBy,
          status, // Lưu trạng thái đã tính toán
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


  //  Cập nhật đợt đề xuất
  async updateSubmissionPeriod(
    periodId: string,
    data: Partial<{ startDate: Date; endDate: Date; description?: string }>
  ) {
    try {
      const existingPeriod = await prisma.submissionPeriod.findFirst({ 
        where: { 
          id: periodId,
          semester: {
            isDeleted: false
          }
        },
        include: {
          semester: true
        }
      });
      
      if (!existingPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND,
        };
      }
  
      // Nếu có cung cấp cả startDate và endDate mới, kiểm tra hợp lệ
      if (data.startDate && data.endDate && data.endDate < data.startDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Ngày kết thúc không thể trước ngày bắt đầu.",
        };
      }
  
      // Sử dụng giá trị mới nếu có, ngược lại giữ nguyên giá trị cũ
      const newStartDate = data.startDate ?? existingPeriod.startDate;
      const newEndDate = data.endDate ?? existingPeriod.endDate;
  
      // Tính trạng thái mới dựa trên newStartDate và newEndDate
      const updatedStatus = this.determineStatus(new Date(newStartDate), new Date(newEndDate));
  
      // Cập nhật đợt đề xuất với dữ liệu mới và trạng thái tính toán lại
      const updatedPeriod = await prisma.submissionPeriod.update({
        where: { id: periodId },
        data: { ...data, status: updatedStatus },
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
  

  //  Lấy danh sách đợt đề xuất theo học kỳ
  async getSubmissionPeriods(semesterId: string) {
    try {
      const periods = await prisma.submissionPeriod.findMany({
        where: { 
          semesterId,
          semester: {
            isDeleted: false
          }
        },
        orderBy: { roundNumber: "asc" },
      });

      // Tính toán trạng thái mới
      const updatedPeriods = periods.map((period) => {
        const newStatus = this.determineStatus(new Date(period.startDate), new Date(period.endDate));

        // Cập nhật trạng thái trong DB nếu khác với hiện tại
        if (newStatus !== period.status) {
          prisma.submissionPeriod.update({
            where: { id: period.id },
            data: { status: newStatus }
          }).catch(err => console.error(`Lỗi cập nhật trạng thái: ${err}`));
        }

        return { ...period, status: newStatus };
      });

      return { success: true, status: HTTP_STATUS.OK, data: updatedPeriods };
    } catch (error) {
      console.error(" Lỗi khi lấy danh sách đợt đề xuất:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  //  Lấy thông tin một đợt đề xuất theo ID
  async getSubmissionPeriodById(periodId: string) {
    try {
      const period = await prisma.submissionPeriod.findFirst({ 
        where: { 
          id: periodId,
          semester: {
            isDeleted: false
          }
        } 
      });
      
      if (!period) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          data: [],
          message : TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND
        };
      } 

      // Tính toán trạng thái mới
      const newStatus = this.determineStatus(new Date(period.startDate), new Date(period.endDate));

      // Nếu trạng thái khác DB, cập nhật lại
      if (newStatus !== period.status) {
        await prisma.submissionPeriod.update({
          where: { id: period.id },
          data: { status: newStatus }
        });
      }

      return { success: true, status: HTTP_STATUS.OK, data: { ...period, status: newStatus } };
    } catch (error) {
      console.error(" Lỗi khi lấy đợt đề xuất theo ID:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }


  //  Xóa đợt đề xuất
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
          defenseMemberResults: 0, // Thêm để đếm số bản ghi DefenseMemberResult bị xóa
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
  
        // 1. Đánh dấu xóa các ReviewSchedule liên quan đến các Topic
        updatedCounts.reviewSchedules = await tx.reviewSchedule
          .updateMany({
            where: { topicId: { in: topicIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 2. Đánh dấu xóa các ReviewAssignment liên quan đến các Topic
        updatedCounts.reviewAssignments = await tx.reviewAssignment
          .updateMany({
            where: { topicId: { in: topicIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 3. Đánh dấu xóa các DefenseSchedule liên quan đến các Council
        const defenseScheduleIds = await tx.defenseSchedule
          .findMany({
            where: { councilId: { in: councilIds }, isDeleted: false },
            select: { id: true },
          })
          .then((schedules) => schedules.map((s) => s.id));
  
        updatedCounts.defenseSchedules = await tx.defenseSchedule
          .updateMany({
            where: { councilId: { in: councilIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // Bổ sung xóa mềm DefenseMemberResult
        updatedCounts.defenseMemberResults = await tx.defenseMemberResult
          .updateMany({
            where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 4. Đánh dấu xóa các CouncilMember liên quan đến các Council
        updatedCounts.councilMembers = await tx.councilMember
          .updateMany({
            where: { councilId: { in: councilIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 5. Đánh dấu xóa các Document liên quan đến Topic hoặc Council
        updatedCounts.documents = await tx.document
          .updateMany({
            where: {
              OR: [{ topicId: { in: topicIds } }, { councilId: { in: councilIds } }],
              isDeleted: false,
            },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 6. Đánh dấu xóa các SemesterTopicMajor liên quan đến Topic
        updatedCounts.semesterTopicMajors = await tx.semesterTopicMajor
          .updateMany({
            where: { topicId: { in: topicIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 7. Đánh dấu xóa các DetailMajorTopic liên quan đến Topic
        updatedCounts.detailMajorTopics = await tx.detailMajorTopic
          .updateMany({
            where: { topicId: { in: topicIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 8. Đánh dấu xóa các TopicAssignment liên quan đến Topic
        updatedCounts.topicAssignments = await tx.topicAssignment
          .updateMany({
            where: { topicId: { in: topicIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 9. Đánh dấu xóa các Topic liên quan đến SubmissionPeriod
        updatedCounts.topics = await tx.topic
          .updateMany({
            where: { submissionPeriodId: periodId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 10. Đánh dấu xóa các Council liên quan đến SubmissionPeriod
        updatedCounts.councils = await tx.council
          .updateMany({
            where: { submissionPeriodId: periodId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 11. Đánh dấu xóa các TopicRegistration liên quan đến SubmissionPeriod
        updatedCounts.topicRegistrations = await tx.topicRegistration
          .updateMany({
            where: { submissionPeriodId: periodId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 12. Đánh dấu xóa SubmissionPeriod
        await tx.submissionPeriod.update({
          where: { id: periodId },
          data: { isDeleted: true },
        });
  
        // 13. Ghi log hành động thành công
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
              deletedDefenseMemberResultCount: updatedCounts.defenseMemberResults, // Thêm vào metadata
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
  
  

  //  Hàm xác định trạng thái SubmissionPeriod
  private determineStatus(startDate: Date, endDate: Date): string {
    const now = new Date(); // Lấy thời gian hiện tại của server
    const start = new Date(startDate); // Chuyển đổi startDate về cùng kiểu Date
    const end = new Date(endDate); // Chuyển đổi endDate về cùng kiểu Date

    if (now < start) return "UPCOMING"; // Chưa bắt đầu
    if (now >= start && now <= end) return "ACTIVE"; // Đang mở
    return "COMPLETE"; // Đã kết thúc
}

}
