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
  
      // Thực hiện xóa mềm trong transaction
      const updatedYear = await prisma.$transaction(async (tx) => {
        // 1. Đánh dấu xóa Year
        await tx.year.update({
          where: { id },
          data: { isDeleted: true },
        });
  
        // 2. Đánh dấu xóa tất cả Semester liên quan
        await tx.semester.updateMany({
          where: { yearId: id, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 3. Đánh dấu xóa các SemesterStudent liên quan
        await tx.semesterStudent.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 4. Lấy danh sách studentIds để xóa Student
        const studentIds = await tx.semesterStudent
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { studentId: true },
          })
          .then((students) => students.map((s) => s.studentId));
  
        // 5. Đánh dấu xóa các Student liên quan
        await tx.student.updateMany({
          where: { id: { in: studentIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 6. Đánh dấu xóa các Topic liên quan
        await tx.topic.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 7. Đánh dấu xóa các Group liên quan
        await tx.group.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 8. Đánh dấu xóa các Council liên quan
        await tx.council.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 9. Đánh dấu xóa các SubmissionPeriod liên quan
        await tx.submissionPeriod.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 10. Đánh dấu xóa các UserRole liên quan
        await tx.userRole.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 11. Đánh dấu xóa các Decision liên quan
        await tx.decision.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 12. Đánh dấu xóa các ReviewDefenseCouncil liên quan
        await tx.reviewDefenseCouncil.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 13. Đánh dấu xóa các SemesterTopicMajor liên quan
        await tx.semesterTopicMajor.updateMany({
          where: { semesterId: { in: semesterIds }, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 14. Lấy danh sách ID của Group để xử lý các bảng phụ
        const groupIds = await tx.group
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((groups) => groups.map((g) => g.id));
  
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
  
        // 15. Lấy danh sách ID của Topic để xử lý các bảng phụ
        const topicIds = await tx.topic
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((topics) => topics.map((t) => t.id));
  
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
  
        // 16. Lấy danh sách ID của Council để xử lý các bảng phụ
        const councilIds = await tx.council
          .findMany({
            where: { semesterId: { in: semesterIds }, isDeleted: false },
            select: { id: true },
          })
          .then((councils) => councils.map((c) => c.id));
  
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
        await tx.document.updateMany({
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
