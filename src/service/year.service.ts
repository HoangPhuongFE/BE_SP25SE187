import { PrismaClient } from "@prisma/client";
import { paginate } from "~/helpers/pagination.helper";

const prisma = new PrismaClient();

export class YearService {
  // Lấy danh sách Year (phân trang)
  async getAllYears(page: number, pageSize: number) {
    return paginate(prisma.year, { page, pageSize }, { orderBy: { year: "asc" } });
  }

  // Tạo mới Year
  async createYear(year: number) {
    return prisma.year.create({
      data: { year },
    });
  }

  // Cập nhật Year
  async updateYear(id: string, year: number) {
    return prisma.year.update({
      where: { id },
      data: { year },
    });
  }

  // Xóa (soft delete) Year
  async deleteYear(id: string, userId: string, ipAddress?: string) {
    try {
      // Kiểm tra Year tồn tại
      const year = await prisma.year.findUnique({
        where: { id, isDeleted: false },
        include: { semesters: true },
      });
  
      if (!year) {
        // Ghi log cảnh báo
        await prisma.systemLog.create({
          data: {
            userId,
            action: "DELETE_YEAR_ATTEMPT",
            entityType: "Year",
            entityId: id,
            description: "Thử xóa nhưng Year không tồn tại hoặc đã bị xóa",
            severity: "WARNING",
            ipAddress: ipAddress || "unknown",
          },
        });
        throw new Error("YEAR_NOT_FOUND");
      }
  
      const semesterIds = year.semesters.map((s) => s.id);
      console.log(`Processing Year ${id} with Semesters:`, semesterIds);
  
      // Transaction xóa mềm
      const result = await prisma.$transaction(async (tx) => {
        const updatedCounts = {
          semesters: 0,
          semesterStudents: 0,
          topics: 0,
          groups: 0,
          councils: 0,
          submissionPeriods: 0,
          userRoles: 0,
          decisions: 0,
          semesterTopicMajors: 0,
          groupMembers: 0,
          groupMentors: 0,
          reviewSchedules: 0,
          progressReports: 0,
          groupInvitations: 0,
          meetingSchedules: 0,
          topicAssignments: 0,
          topicRegistrations: 0,
          reviewAssignments: 0,
          councilMembers: 0,
          defenseSchedules: 0,
          defenseMemberResults: 0, 
          documents: 0,
        };
  
        // 1. Xóa mềm Year
        console.log(`Marking Year ${id} as deleted`);
        await tx.year.update({
          where: { id },
          data: { isDeleted: true },
        });
  
        // 2. Xóa mềm Semester
        console.log(`Marking ${semesterIds.length} Semesters as deleted`);
        updatedCounts.semesters = await tx.semester
          .updateMany({
            where: { yearId: id, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 3. Xóa mềm SemesterStudent
        updatedCounts.semesterStudents = await tx.semesterStudent
          .updateMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 4. Xóa mềm Topic
        updatedCounts.topics = await tx.topic
          .updateMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 5. Xóa mềm Group
        const groupIds = await tx.group
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((groups) => groups.map((g) => g.id));
        updatedCounts.groups = await tx.group
          .updateMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 6. Xóa mềm Council
        const councilIds = await tx.council
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((councils) => councils.map((c) => c.id));
        updatedCounts.councils = await tx.council
          .updateMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 7. Xóa mềm các bảng phụ thuộc Semesters
        updatedCounts.submissionPeriods = await tx.submissionPeriod
          .updateMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.userRoles = await tx.userRole
          .updateMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.decisions = await tx.decision
          .updateMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.semesterTopicMajors = await tx.semesterTopicMajor
          .updateMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 8. Xóa mềm các bảng phụ thuộc Groups
        updatedCounts.groupMembers = await tx.groupMember
          .updateMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.groupMentors = await tx.groupMentor
          .updateMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.reviewSchedules = await tx.reviewSchedule
          .updateMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.progressReports = await tx.progressReport
          .updateMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.groupInvitations = await tx.groupInvitation
          .updateMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.meetingSchedules = await tx.meetingSchedule
          .updateMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 9. Xóa mềm các bảng phụ thuộc Topic
        const topicIds = await tx.topic
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((topics) => topics.map((t) => t.id));
        updatedCounts.topicAssignments = await tx.topicAssignment
          .updateMany({
            where: { topicId: { in: topicIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.topicRegistrations = await tx.topicRegistration
          .updateMany({
            where: { topicId: { in: topicIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        updatedCounts.reviewAssignments = await tx.reviewAssignment
          .updateMany({
            where: { topicId: { in: topicIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 10. Xóa mềm các bảng phụ thuộc Council
        updatedCounts.councilMembers = await tx.councilMember
          .updateMany({
            where: { councilId: { in: councilIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // Bổ sung xóa mềm DefenseSchedule và DefenseMemberResult
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
  
        updatedCounts.defenseMemberResults = await tx.defenseMemberResult
          .updateMany({
            where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // Gom thêm số record reviewAssignments ở Council
        updatedCounts.reviewAssignments += await tx.reviewAssignment
          .updateMany({
            where: { councilId: { in: councilIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 11. Xóa mềm Document
        updatedCounts.documents = await tx.document
          .updateMany({
            where: {
              OR: [
                { groupId: { in: groupIds } },
                { topicId: { in: topicIds } },
                { councilId: { in: councilIds } },
              ],
              isDeleted: false,
            },
            data: { isDeleted: true },
          })
          .then((res) => res.count);
  
        // 12. Ghi log
        await tx.systemLog.create({
          data: {
            userId,
            action: "DELETE_YEAR",
            entityType: "Year",
            entityId: id,
            description: `Năm học ${year.year} đã được đánh dấu xóa cùng các dữ liệu liên quan`,
            severity: "INFO",
            ipAddress: ipAddress || "unknown",
            metadata: {
              semesterCount: year.semesters.length,
              deletedSemesters: year.semesters.map((s) => s.code),
              deletedGroupCount: groupIds.length,
              deletedCouncilCount: councilIds.length,
              deletedTopicCount: topicIds.length,
              deletedUserRoleCount: updatedCounts.userRoles,
              deletedSemesterStudentCount: updatedCounts.semesterStudents,
              deletedDefenseMemberResultCount: updatedCounts.defenseMemberResults, // Thêm vào metadata
              updatedCounts,
            },
            oldValues: JSON.stringify(year),
          },
        });
  
        return {
          updatedYear: await tx.year.findUnique({
            where: { id },
            include: { semesters: true },
          }),
          updatedCounts,
        };
      });
  
      return {
        message: `Năm học ${year.year} đã được xóa mềm thành công.`,
        data: result.updatedYear,
        updatedCounts: result.updatedCounts,
      };
    } catch (error) {
      // Log lỗi
      await prisma.systemLog.create({
        data: {
          userId,
          action: "DELETE_YEAR_ERROR",
          entityType: "Year",
          entityId: id,
          description: "Lỗi khi đánh dấu xóa năm học",
          severity: "ERROR",
          error: (error as Error).message || "Unknown error",
          stackTrace: (error as Error).stack || "No stack trace",
          ipAddress: ipAddress || "unknown",
        },
      });
      throw error;
    }
  }
}
