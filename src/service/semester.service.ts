import { PrismaClient } from "@prisma/client";
import { SEMESTER_MESSAGE } from "~/constants/message";
import { paginate } from "~/helpers/pagination.helper"; // Nếu bạn có helper này

const prisma = new PrismaClient();

export class SemesterService {
  // Lấy danh sách semester theo yearId, phân trang
  async getSemestersByYear(yearId: string, page: number, pageSize: number) {
    return paginate(prisma.semester, { page, pageSize }, { where: { yearId } });
  }

  // Tạo mới semester
  async createSemester(
    yearId: string,
    code: string,
    startDate: Date,
    endDate: Date,
    status: string,
  ) {
    return prisma.semester.create({
      data: {
        yearId,
        code,
        startDate,
        endDate,
        status,
      },
    });
  }

  // Cập nhật semester
  async updateSemester(
    id: string,
    code: string,
    startDate: Date,
    endDate: Date,
    status: string,
  ) {
    return prisma.semester.update({
      where: { id },
      data: {
        code,
        startDate,
        endDate,
        status,
      },
    });
  }

  // Xóa semester
  async deleteSemester(id: string) {
    return prisma.semester.delete({
      where: { id },
    });
  }

  // Lấy tất cả semester
  async getAllSemesters() {
    const semesters = await prisma.semester.findMany();
    console.log("Semesters:", semesters);
    return semesters;
  }

  // Lấy semester theo id, kèm quan hệ year
  async getSemesterById(id: string) {
    const semester = await prisma.semester.findUnique({
      where: { id },
      include: {
        year: true, 
      },
    });

    if (!semester) {
      throw new Error(SEMESTER_MESSAGE.SEMESTER_NOT_FOUND);
    }

    return semester;
  }
}
