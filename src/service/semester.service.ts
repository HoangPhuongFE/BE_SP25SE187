import { PrismaClient } from "@prisma/client";
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
        registrationDeadline,
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
        registrationDeadline,
        status,
      },
    });
  }

  async deleteSemester(id: string) {
    return prisma.semester.delete({
      where: { id },
    });
  }
}
