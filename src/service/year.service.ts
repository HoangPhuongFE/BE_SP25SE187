import { PrismaClient } from "@prisma/client";
import { paginate } from "~/helpers/pagination.helper";

const prisma = new PrismaClient();

export class YearService {
  async getAllYears(page: number, pageSize: number) {
    return paginate(prisma.year, { page, pageSize }, { orderBy: { year: "asc" } });
  }

  async createYear(year: number) {
    return prisma.year.create({
      data: { year },
    });
  }

  async updateYear(id: string, year: number) {
    return prisma.year.update({
      where: { id },
      data: { year },
    });
  }
  async deleteYear(id: string, userId: string, ipAddress?: string) {
    try {
      // Kiểm tra xem Year có tồn tại và chưa bị đánh dấu xóa
      const year = await prisma.year.findUnique({
        where: { id, isDeleted: false },
        include: { semesters: true },
      });

      if (!year) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_YEAR_ATTEMPT',
            entityType: 'Year',
            entityId: id,
            description: 'Thử xóa năm học nhưng không tìm thấy hoặc đã bị đánh dấu xóa',
            severity: 'WARNING',
            ipAddress: ipAddress || 'unknown',
          },
        });
        throw new Error('Year not found');
      }

      const semesterIds = year.semesters.map((s) => s.id);
      console.log(`Processing Year ${id} with Semesters:`, semesterIds);

      // Thực hiện xóa mềm trong transaction
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
          reviewDefenseCouncils: 0,
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
          documents: 0,
        };

        // 1. Đánh dấu xóa Year
        console.log(`Marking Year ${id} as deleted`);
        await tx.year.update({
          where: { id },
          data: { isDeleted: true },
        });

        // 2. Đánh dấu xóa tất cả Semester liên quan
        console.log(`Marking ${semesterIds.length} Semesters as deleted`);
        updatedCounts.semesters = await tx.semester.updateMany({
          where: { yearId: id, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
        console.log(`Updated ${updatedCounts.semesters} Semesters`);

        // 3. Đánh dấu xóa các SemesterStudent liên quan
        console.log(`Marking SemesterStudents for Semesters ${semesterIds} as deleted`);
        updatedCounts.semesterStudents = await tx.semesterStudent.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
        console.log(`Updated ${updatedCounts.semesterStudents} SemesterStudents`);

        // Bỏ phần đánh dấu xóa Student
        // Không lấy studentIds và không cập nhật isDeleted cho Student

        // 4. Đánh dấu xóa các Topic liên quan
        console.log(`Marking Topics for Semesters ${semesterIds} as deleted`);
        updatedCounts.topics = await tx.topic.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
        console.log(`Updated ${updatedCounts.topics} Topics`);

        // 5. Đánh dấu xóa các Group liên quan
        console.log(`Marking Groups for Semesters ${semesterIds} as deleted`);
        const groupIds = await tx.group
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((groups) => groups.map((g) => g.id));
        updatedCounts.groups = await tx.group.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
        console.log(`Updated ${updatedCounts.groups} Groups with IDs:`, groupIds);

        // 6. Đánh dấu xóa các Council liên quan
        console.log(`Marking Councils for Semesters ${semesterIds} as deleted`);
        const councilIds = await tx.council
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((councils) => councils.map((c) => c.id));
        updatedCounts.councils = await tx.council.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);
        console.log(`Updated ${updatedCounts.councils} Councils with IDs:`, councilIds);

        // 7. Đánh dấu xóa các bảng phụ khác
        updatedCounts.submissionPeriods = await tx.submissionPeriod.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.userRoles = await tx.userRole.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.decisions = await tx.decision.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.reviewDefenseCouncils = await tx.reviewDefenseCouncil.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.semesterTopicMajors = await tx.semesterTopicMajor.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        // 8. Xử lý các bảng phụ của Group
        updatedCounts.groupMembers = await tx.groupMember.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.groupMentors = await tx.groupMentor.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.reviewSchedules = await tx.reviewSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.progressReports = await tx.progressReport.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.groupInvitations = await tx.groupInvitation.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.meetingSchedules = await tx.meetingSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        // 9. Xử lý các bảng phụ của Topic
        const topicIds = await tx.topic
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((topics) => topics.map((t) => t.id));
        updatedCounts.topicAssignments = await tx.topicAssignment.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.topicRegistrations = await tx.topicRegistration.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.reviewAssignments = await tx.reviewAssignment.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        // 10. Xử lý các bảng phụ của Council
        updatedCounts.councilMembers = await tx.councilMember.updateMany({
          where: { councilId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.defenseSchedules = await tx.defenseSchedule.updateMany({
          where: { councilId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        updatedCounts.reviewAssignments += await tx.reviewAssignment.updateMany({
          where: { councilId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        }).then(res => res.count);

        // 11. Đánh dấu xóa các Document liên quan
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
        console.log(`Updated ${updatedCounts.documents} Documents`);

        // 12. Ghi log hành động thành công
        await tx.systemLog.create({
          data: {
            userId,
            action: 'DELETE_YEAR',
            entityType: 'Year',
            entityId: id,
            description: `Năm học ${year.year} đã được đánh dấu xóa cùng các học kỳ và dữ liệu liên quan`,
            severity: 'INFO',
            ipAddress: ipAddress || 'unknown',
            metadata: {
              semesterCount: year.semesters.length,
              deletedSemesters: year.semesters.map((s) => s.code),
              deletedGroupCount: groupIds.length,
              deletedCouncilCount: councilIds.length,
              deletedTopicCount: topicIds.length,
              deletedUserRoleCount: updatedCounts.userRoles, // Số lượng UserRole bị xóa mềm
              deletedSemesterStudentCount: updatedCounts.semesterStudents, // Số lượng SemesterStudent bị xóa mềm
              updatedCounts, // Toàn bộ số lượng bản ghi bị ảnh hưởng
            },
            oldValues: JSON.stringify(year),
          },
        });

        // Trả về kết quả với thông tin chi tiết
        return {
          updatedYear: await tx.year.findUnique({
            where: { id },
            include: { semesters: true },
          }),
          updatedCounts, // Trả về số lượng bản ghi bị ảnh hưởng
        };
      });

      return {
        message: `Năm học ${year.year} đã được xóa mềm thành công`,
        data: result.updatedYear,
        updatedCounts: result.updatedCounts, // Số lượng bản ghi bị ảnh hưởng
      };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_YEAR_ERROR',
          entityType: 'Year',
          entityId: id,
          description: 'Lỗi hệ thống khi đánh dấu xóa năm học',
          severity: 'ERROR',
          error: (error as Error).message || 'Unknown error',
          stackTrace: (error as Error).stack || 'No stack trace',
          ipAddress: ipAddress || 'unknown',
        },
      });
      throw error;
    }
  }
}
