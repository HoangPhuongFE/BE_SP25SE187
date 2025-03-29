import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from "~/constants/httpStatus";
import { SEMESTER_MESSAGE } from "~/constants/message";
import { paginate } from "~/helpers/pagination.helper";

const prisma = new PrismaClient();

export class SemesterService {
  // Lấy danh sách semester theo yearId, phân trang
  async getSemestersByYear(yearId: string, page: number, pageSize: number) {
    return paginate(prisma.semester, { page, pageSize }, { where: { yearId } });
  }

  // Tạo mới semester: tính trạng thái tự động dựa trên thời gian
  async createSemester(
    yearId: string,
    code: string,
    startDate: Date,
    endDate: Date,
    status: string
  ) {
    if (startDate >= endDate) {
      throw new Error("Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.");
    }
    const now = new Date();
    let computedStatus = status;
    if (now < startDate) {
      computedStatus = "UPCOMING";
    } else if (now >= startDate && now <= endDate) {
      computedStatus = "ACTIVE";
    } else {
      computedStatus = "COMPLETE";
    }

    return prisma.semester.create({
      data: {
        yearId,
        code,
        startDate,
        endDate,
        status: computedStatus,
      },
    });
  }

  // Cập nhật semester: Cho phép cập nhật mọi trạng thái, không ràng buộc theo thời gian hiện tại
  async updateSemester(
    id: string, code: string, startDate: Date, endDate: Date, status: any) {
    if (startDate >= endDate) {
      throw new Error("Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.");
    }

    const now = new Date();
    let computedStatus: string;
    if (now < startDate) {
      computedStatus = "UPCOMING";
    } else if (now >= startDate && now <= endDate) {
      computedStatus = "ACTIVE";
    } else {
      computedStatus = "COMPLETE";
    }

    return prisma.semester.update({
      where: { id },
      data: {
        code,
        startDate,
        endDate,
        status: computedStatus,
      },
    });
  }


  // Xóa semester: Xóa tất cả dữ liệu liên quan trước khi xóa semester


  async deleteSemester(id: string, userId: string, ipAddress?: string) {
    try {
      const semester = await prisma.semester.findUnique({
        where: { id, isDeleted: false },
        include: { groups: true, topics: true, councils: true, semesterStudents: true },
      });
  
      if (!semester) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_SEMESTER_ATTEMPT',
            entityType: 'Semester',
            entityId: id,
            description: 'Thử xóa học kỳ nhưng không tìm thấy hoặc đã bị đánh dấu xóa',
            severity: 'WARNING',
            ipAddress: ipAddress || 'unknown',
          },
        });
        throw new Error('SEMESTER_NOT_FOUND');
      }
  
      const groupIds = semester.groups.map((g) => g.id);
      const topicIds = semester.topics.map((t) => t.id);
      const councilIds = semester.councils.map((c) => c.id);
      const studentIds = semester.semesterStudents.map((s) => s.studentId);
  
      const result = await prisma.$transaction(async (tx) => {
        const updatedCounts = {
          reviewSchedules: 0,
          defenseSchedules: 0,
          defenseMemberResults: 0,
          councilMembers: 0,
          topicAssignments: 0,
          groupMembers: 0,
          groupMentors: 0,
          semesterStudents: 0,
          reviewDefenseCouncils: 0,
          topics: 0,
          groups: 0,
          councils: 0,
          decisions: 0,
          submissionPeriods: 0,
          userRoles: 0,
          semesterTopicMajors: 0,
          progressReports: 0,
          groupInvitations: 0,
          documents: 0,
          meetingSchedules: 0,
        };
  
        // 1. Đánh dấu xóa các ReviewSchedule liên quan đến các Group
        updatedCounts.reviewSchedules = await tx.reviewSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 2. Đánh dấu xóa các DefenseSchedule liên quan đến các Council
        updatedCounts.defenseSchedules = await tx.defenseSchedule.updateMany({
          where: { councilId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        // 3. Đánh dấu xóa các DefenseMemberResult liên quan đến các Council
        updatedCounts.defenseMemberResults = await tx.defenseMemberResult.updateMany({
          where: { defenseScheduleId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 3. Đánh dấu xóa các CouncilMember liên quan đến các Council
        updatedCounts.councilMembers = await tx.councilMember.updateMany({
          where: { councilId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 4. Đánh dấu xóa các TopicAssignment liên quan đến các Topic
        updatedCounts.topicAssignments = await tx.topicAssignment.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 5. Đánh dấu xóa các GroupMember liên quan đến các Group
        updatedCounts.groupMembers = await tx.groupMember.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 6. Đánh dấu xóa các GroupMentor liên quan đến các Group
        updatedCounts.groupMentors = await tx.groupMentor.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 7. Đánh dấu xóa các SemesterStudent liên quan đến Semester
        updatedCounts.semesterStudents = await tx.semesterStudent.updateMany({
          where: { semesterId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        
  
        // 10. Đánh dấu xóa các Topic liên quan đến Semester
        updatedCounts.topics = await tx.topic.updateMany({
          where: { semesterId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 11. Đánh dấu xóa các Group liên quan đến Semester
        updatedCounts.groups = await tx.group.updateMany({
          where: { semesterId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 12. Đánh dấu xóa các Council liên quan đến Semester
        updatedCounts.councils = await tx.council.updateMany({
          where: { semesterId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 13. Đánh dấu xóa các Decision liên quan đến Semester
        updatedCounts.decisions = await tx.decision.updateMany({
          where: { semesterId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 14. Đánh dấu xóa các SubmissionPeriod liên quan đến Semester
        updatedCounts.submissionPeriods = await tx.submissionPeriod.updateMany({
          where: { semesterId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 15. Đánh dấu xóa các UserRole liên quan đến Semester
        updatedCounts.userRoles = await tx.userRole.updateMany({
          where: { semesterId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 16. Đánh dấu xóa các SemesterTopicMajor liên quan đến Semester
        updatedCounts.semesterTopicMajors = await tx.semesterTopicMajor.updateMany({
          where: { semesterId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 17. Đánh dấu xóa các ProgressReport liên quan đến Group
        updatedCounts.progressReports = await tx.progressReport.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 18. Đánh dấu xóa các GroupInvitation liên quan đến Group
        updatedCounts.groupInvitations = await tx.groupInvitation.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 19. Đánh dấu xóa các Document liên quan đến Group, Topic, Council
        updatedCounts.documents = await tx.document.updateMany({
          where: {
            OR: [
              { groupId: { in: groupIds } },
              { topicId: { in: topicIds } },
              { councilId: { in: councilIds } },
            ],
            isDeleted: false,
          },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 20. Đánh dấu xóa các MeetingSchedule liên quan đến Group
        updatedCounts.meetingSchedules = await tx.meetingSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
  
        // 21. Đánh dấu xóa Semester
        await tx.semester.update({
          where: { id },
          data: { isDeleted: true },
        });
  
        // 22. Ghi log hành động thành công
        await tx.systemLog.create({
          data: {
            userId,
            action: 'DELETE_SEMESTER',
            entityType: 'Semester',
            entityId: id,
            description: `Học kỳ ${semester.code} đã được đánh dấu xóa cùng các dữ liệu liên quan`,
            severity: 'INFO',
            ipAddress: ipAddress || 'unknown',
            metadata: {
              groupCount: semester.groups.length,
              topicCount: semester.topics.length,
              councilCount: semester.councils.length,
              semesterStudentCount: semester.semesterStudents.length,
              deletedUserRoleCount: updatedCounts.userRoles, // Số lượng UserRole bị xóa mềm
              deletedSemesterStudentCount: updatedCounts.semesterStudents, // Số lượng SemesterStudent bị xóa mềm
              deletedDefenseMemberResultCount: updatedCounts.defenseMemberResults, // Thêm vào metadata
              updatedCounts, // Toàn bộ số lượng bản ghi bị ảnh hưởng
            },
            oldValues: JSON.stringify(semester),
          },
        });
  
        // Trả về kết quả với thông tin chi tiết
        return {
          updatedSemester: await tx.semester.findUnique({
            where: { id },
            include: { groups: true, topics: true, councils: true, semesterStudents: true },
          }),
          updatedCounts, // Trả về số lượng bản ghi bị ảnh hưởng
        };
      });
  
      return {
        message: `Học kỳ ${semester.code} đã được xóa mềm thành công`,
        data: result.updatedSemester,
        updatedCounts: result.updatedCounts, // Số lượng bản ghi bị ảnh hưởng
      };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_SEMESTER_ERROR',
          entityType: 'Semester',
          entityId: id,
          description: 'Lỗi hệ thống khi đánh dấu xóa học kỳ',
          severity: 'ERROR',
          error: (error as Error).message || 'Unknown error',
          stackTrace: (error as Error).stack || 'No stack trace',
          ipAddress: ipAddress || 'unknown',
        },
      });
      throw error;
    }
  }
  // Lấy tất cả semester
  async getAllSemesters() {
    const semesters = await prisma.semester.findMany();
    console.log("Semesters:", semesters);
    return semesters;
  }

  // Lấy semester theo id, kèm quan hệ year
  async getSemesterById(id: string) {
    try {
      const semester = await prisma.semester.findUnique({
        where: { id },
        include: { year: true },
      });

      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          data: [],
          message: SEMESTER_MESSAGE.SEMESTER_NOT_FOUND,
        };
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        data: semester,
      };
    } catch (error) {
      console.error("Lỗi khi lấy semester theo ID:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }
}

