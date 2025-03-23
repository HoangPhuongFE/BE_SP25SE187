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
      const updatedYear = await prisma.$transaction(async (tx) => {
        // 1. Đánh dấu xóa Year
        console.log(`Marking Year ${id} as deleted`);
        await tx.year.update({
          where: { id },
          data: { isDeleted: true },
        });
  
        // 2. Đánh dấu xóa tất cả Semester liên quan
        console.log(`Marking ${semesterIds.length} Semesters as deleted`);
        const updatedSemesters = await tx.semester.updateMany({
          where: { yearId: id, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedSemesters.count} Semesters`);
  
        // 3. Đánh dấu xóa các SemesterStudent liên quan
        console.log(`Marking SemesterStudents for Semesters ${semesterIds} as deleted`);
        const updatedSemesterStudents = await tx.semesterStudent.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedSemesterStudents.count} SemesterStudents`);
  
        // 4. Lấy danh sách studentIds để đánh dấu xóa Student
        const semesterStudents = await tx.semesterStudent.findMany({
          where: { semesterId: { in: semesterIds } }, // Lấy tất cả, bất kể isDeleted
          select: { studentId: true, isDeleted: true },
        });
        const studentIds = [...new Set(semesterStudents.map((s) => s.studentId))]; // Loại bỏ trùng lặp
        console.log(`Found ${studentIds.length} unique Student IDs:`, studentIds);
  
        // 5. Đánh dấu xóa các Student liên quan
        if (studentIds.length > 0) {
          console.log(`Marking ${studentIds.length} Students as deleted`);
          const updatedStudents = await tx.student.updateMany({
            where: { id: { in: studentIds } }, // Bất kể isDeleted trước đó
            data: { isDeleted: true },
          });
          console.log(`Updated ${updatedStudents.count} Students`);
        } else {
          console.log('No Students found to mark as deleted');
        }
  
        // 6. Đánh dấu xóa các Topic liên quan
        console.log(`Marking Topics for Semesters ${semesterIds} as deleted`);
        const updatedTopics = await tx.topic.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedTopics.count} Topics`);
  
        // 7. Đánh dấu xóa các Group liên quan
        console.log(`Marking Groups for Semesters ${semesterIds} as deleted`);
        const groupIds = await tx.group
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((groups) => groups.map((g) => g.id));
        const updatedGroups = await tx.group.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedGroups.count} Groups with IDs:`, groupIds);
  
        // 8. Đánh dấu xóa các Council liên quan
        console.log(`Marking Councils for Semesters ${semesterIds} as deleted`);
        const councilIds = await tx.council
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((councils) => councils.map((c) => c.id));
        const updatedCouncils = await tx.council.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedCouncils.count} Councils with IDs:`, councilIds);
  
        // 9. Đánh dấu xóa các SubmissionPeriod liên quan
        const updatedSubmissionPeriods = await tx.submissionPeriod.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedSubmissionPeriods.count} SubmissionPeriods`);
  
        // 10. Đánh dấu xóa các UserRole liên quan
        const updatedUserRoles = await tx.userRole.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedUserRoles.count} UserRoles`);
  
        // 11. Đánh dấu xóa các Decision liên quan
        const updatedDecisions = await tx.decision.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedDecisions.count} Decisions`);
  
        // 12. Đánh dấu xóa các ReviewDefenseCouncil liên quan
        const updatedReviewDefenseCouncils = await tx.reviewDefenseCouncil.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedReviewDefenseCouncils.count} ReviewDefenseCouncils`);
  
        // 13. Đánh dấu xóa các SemesterTopicMajor liên quan
        const updatedSemesterTopicMajors = await tx.semesterTopicMajor.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedSemesterTopicMajors.count} SemesterTopicMajors`);
  
        // 14. Xử lý các bảng phụ của Group
        console.log(`Marking Group-related tables for Group IDs: ${groupIds}`);
        await tx.groupMember.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.groupMentor.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.reviewSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.progressReport.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.groupInvitation.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.meetingSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 15. Xử lý các bảng phụ của Topic
        const topicIds = await tx.topic
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((topics) => topics.map((t) => t.id));
        console.log(`Marking Topic-related tables for Topic IDs: ${topicIds}`);
        await tx.topicAssignment.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.reviewAssignment.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.topicRegistration.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 16. Xử lý các bảng phụ của Council
        console.log(`Marking Council-related tables for Council IDs: ${councilIds}`);
        await tx.councilMember.updateMany({
          where: { councilId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.defenseSchedule.updateMany({
          where: { councilId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.reviewAssignment.updateMany({
          where: { councilId: { in: councilIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 17. Đánh dấu xóa các Document liên quan đến Group, Topic, Council
        console.log(`Marking Documents related to Groups, Topics, Councils as deleted`);
        const updatedDocuments = await tx.document.updateMany({
          where: {
            OR: [
              { groupId: { in: groupIds } },
              { topicId: { in: topicIds } },
              { councilId: { in: councilIds } },
            ],
            isDeleted: false,
          },
          data: { isDeleted: true },
        });
        console.log(`Updated ${updatedDocuments.count} Documents`);
  
        // 18. Ghi log hành động thành công
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
              deletedStudentCount: studentIds.length,
              deletedGroupCount: groupIds.length,
              deletedCouncilCount: councilIds.length,
              deletedTopicCount: topicIds.length,
            },
            oldValues: JSON.stringify(year),
          },
        });
  
        return await tx.year.findUnique({
          where: { id },
          include: { semesters: true },
        });
      });
  
      return updatedYear;
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
