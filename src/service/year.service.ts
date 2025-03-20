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

  async deleteYear(id: string) {
    // Kiểm tra xem năm học có tồn tại không
    const year = await prisma.year.findUnique({
      where: { id },
      include: {
        semesters: true
      }
    });

    if (!year) {
      throw new Error("YEAR_NOT_FOUND");
    }

    // Xóa tất cả dữ liệu liên quan đến các học kỳ trong năm
    for (const semester of year.semesters) {
      // Xóa tất cả dữ liệu liên quan đến học kỳ
      await prisma.$transaction([
        // Xóa các bảng liên quan đến học kỳ
        prisma.semesterStudent.deleteMany({
          where: { semesterId: semester.id }
        }),
        prisma.reviewDefenseCouncil.deleteMany({
          where: { semesterId: semester.id }
        }),
        prisma.topic.deleteMany({
          where: { semesterId: semester.id }
        }),
        prisma.group.deleteMany({
          where: { semesterId: semester.id }
        }),
        prisma.council.deleteMany({
          where: { semesterId: semester.id }
        }),
        prisma.reviewCouncil.deleteMany({
          where: { semesterId: semester.id }
        }),
        prisma.decision.deleteMany({
          where: { semesterId: semester.id }
        }),
        prisma.submissionPeriod.deleteMany({
          where: { semesterId: semester.id }
        }),
        prisma.userRole.deleteMany({
          where: { semesterId: semester.id }
        }),
        // Xóa học kỳ
        prisma.semester.delete({
          where: { id: semester.id }
        })
      ]);
    }

    // Xóa năm học
    return prisma.year.delete({
      where: { id }
    });
  }
}
