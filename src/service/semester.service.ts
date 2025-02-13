import { PrismaClient } from "@prisma/client";
import { SEMESTER_MESSAGE } from "~/constants/message";
import { paginate } from "~/helpers/pagination.helper";

const prisma = new PrismaClient();

export class SemesterService {
  async getSemestersByYear(yearId: string, page: number, pageSize: number) {
    return paginate(prisma.semester, { page, pageSize }, { where: { yearId } });
  }

  async createSemester(
    yearId: string,
    code: string,
    startDate: Date,
    endDate: Date,
    registrationDeadline: Date,
    status: string
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

  async updateSemester(
    id: string,
    code: string,
    startDate: Date,
    endDate: Date,
    registrationDeadline: Date,
    status: string
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

  async deleteSemester(id: string) {
    return prisma.semester.delete({
      where: { id },
    });
  }
  async getAllSemesters() {
    const semesters = await prisma.semester.findMany();
    console.log("Semesters:", semesters); // Kiểm tra xem có dữ liệu không
    return semesters;
  }

  async getSemesterById(id: string) {
    const semester = await prisma.semester.findUnique({
      where: { id },
      include: {
        year: true // Chỉ include thông tin về năm học
      }
    });

    if (!semester) {
      throw new Error(SEMESTER_MESSAGE.SEMESTER_NOT_FOUND);
    }

    return semester;
  }




}
