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
    return prisma.year.delete({
      where: { id },
    });
  }
}
